// ---------------------------------------------------------------------------
// AgentX -- Cron Task Scheduler
// ---------------------------------------------------------------------------
//
// Lightweight cron-based scheduler for recurring agent tasks.
// Evaluates cron expressions and fires callbacks on schedule.
// Zero dependencies -- cron parser is ~80 lines of pure TypeScript.
//
// Inspired by OpenBrowserClaw's task-scheduler.ts.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { AgentEventBus } from './eventBus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A scheduled task definition.
 */
export interface ScheduledTask {
  readonly id: string;
  readonly schedule: string;
  readonly description: string;
  readonly command: string;
  enabled: boolean;
  lastRun: number | null;
  readonly createdAt: number;
}

/**
 * Callback invoked when a task fires.
 */
export type TaskRunner = (task: ScheduledTask) => Promise<void>;

// ---------------------------------------------------------------------------
// Cron expression parser
// ---------------------------------------------------------------------------
// Format: minute hour day-of-month month day-of-week
// Supports: * (any), N (exact), N-M (range), N,M (list), */N (step)
// ---------------------------------------------------------------------------

/**
 * Check whether a cron expression matches a given date.
 */
export function matchesCron(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) { return false; }

  const [min, hour, dom, mon, dow] = parts;
  return (
    matchField(min, date.getMinutes())
    && matchField(hour, date.getHours())
    && matchField(dom, date.getDate())
    && matchField(mon, date.getMonth() + 1)
    && matchField(dow, date.getDay())
  );
}

function matchField(field: string, value: number): boolean {
  if (field === '*') { return true; }

  return field.split(',').some((part) => {
    // Step: */N or N-M/S
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) { return false; }

      if (range === '*') {
        return value % step === 0;
      }

      if (range.includes('-')) {
        const [lo, hi] = range.split('-').map(Number);
        return value >= lo && value <= hi && (value - lo) % step === 0;
      }

      const start = parseInt(range, 10);
      return value >= start && (value - start) % step === 0;
    }

    // Range: N-M
    if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      return value >= lo && value <= hi;
    }

    // Exact match
    return parseInt(part, 10) === value;
  });
}

// ---------------------------------------------------------------------------
// Task Scheduler
// ---------------------------------------------------------------------------

/** Default check interval: 60 seconds. */
const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Cron-based task scheduler for AgentX.
 *
 * Stores tasks in `.agentx/schedules.json` and checks every 60 seconds
 * for due tasks.
 *
 * Usage:
 * ```ts
 * const scheduler = new TaskScheduler(eventBus, '/path/to/.agentx');
 * scheduler.addTask({
 *   id: 'nightly-scan',
 *   schedule: '0 2 * * *',
 *   description: 'Run nightly code quality scan',
 *   command: 'quality-scan',
 *   enabled: true,
 *   lastRun: null,
 *   createdAt: Date.now(),
 * });
 * scheduler.start(async (task) => {
 *   console.log(`Running: ${task.description}`);
 * });
 * ```
 */
export class TaskScheduler {
  private tasks: ScheduledTask[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private runner: TaskRunner | null = null;
  private readonly eventBus: AgentEventBus | undefined;
  private readonly storePath: string | undefined;

  constructor(eventBus?: AgentEventBus, agentxDir?: string) {
    this.eventBus = eventBus;
    this.storePath = agentxDir
      ? path.join(agentxDir, 'schedules.json')
      : undefined;

    // Load persisted tasks
    this.loadFromDisk();
  }

  // -----------------------------------------------------------------------
  // Task management
  // -----------------------------------------------------------------------

  /**
   * Add a new scheduled task.
   */
  addTask(task: ScheduledTask): void {
    // Replace if same ID exists
    this.tasks = this.tasks.filter((t) => t.id !== task.id);
    this.tasks.push(task);
    this.saveToDisk();
  }

  /**
   * Remove a task by ID.
   */
  removeTask(id: string): boolean {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.tasks.length !== before) {
      this.saveToDisk();
      return true;
    }
    return false;
  }

  /**
   * Enable or disable a task.
   */
  setEnabled(id: string, enabled: boolean): void {
    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      task.enabled = enabled;
      this.saveToDisk();
    }
  }

  /**
   * Get all tasks.
   */
  getTasks(): ReadonlyArray<ScheduledTask> {
    return [...this.tasks];
  }

  /**
   * Get only enabled tasks.
   */
  getEnabledTasks(): ReadonlyArray<ScheduledTask> {
    return this.tasks.filter((t) => t.enabled);
  }

  // -----------------------------------------------------------------------
  // Scheduler lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start the scheduler with a task runner callback.
   */
  start(runner: TaskRunner, intervalMs = DEFAULT_INTERVAL_MS): void {
    this.runner = runner;
    if (this.interval) { return; }

    this.interval = setInterval(() => this.tick(), intervalMs);
    // Immediate first check
    this.tick();
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.runner = null;
  }

  /**
   * Whether the scheduler is currently running.
   */
  isRunning(): boolean {
    return this.interval !== null;
  }

  // -----------------------------------------------------------------------
  // Tick
  // -----------------------------------------------------------------------

  private async tick(): Promise<void> {
    if (!this.runner) { return; }

    const now = new Date();

    for (const task of this.tasks) {
      if (!task.enabled) { continue; }
      if (!matchesCron(task.schedule, now)) { continue; }
      if (this.ranThisMinute(task, now)) { continue; }

      // Mark as run immediately to prevent double-firing
      task.lastRun = now.getTime();
      this.saveToDisk();

      // Emit event
      if (this.eventBus) {
        this.eventBus.emit('task-fired', {
          taskId: task.id,
          schedule: task.schedule,
          description: task.description,
          timestamp: now.getTime(),
        });
      }

      // Fire task (non-blocking)
      this.runner(task).catch((err) => {
        console.error(`TaskScheduler: task '${task.id}' failed:`, err);
      });
    }
  }

  /**
   * Check if a task already ran in this calendar minute.
   */
  private ranThisMinute(task: ScheduledTask, now: Date): boolean {
    if (!task.lastRun) { return false; }
    const last = new Date(task.lastRun);
    return (
      last.getFullYear() === now.getFullYear()
      && last.getMonth() === now.getMonth()
      && last.getDate() === now.getDate()
      && last.getHours() === now.getHours()
      && last.getMinutes() === now.getMinutes()
    );
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private loadFromDisk(): void {
    if (!this.storePath || !fs.existsSync(this.storePath)) { return; }
    try {
      const data = fs.readFileSync(this.storePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        this.tasks = parsed;
      }
    } catch (err) {
      console.warn('TaskScheduler: failed to load schedules.json:', err);
    }
  }

  private saveToDisk(): void {
    if (!this.storePath) { return; }
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storePath, JSON.stringify(this.tasks, null, 2), 'utf-8');
    } catch (err) {
      console.warn('TaskScheduler: failed to save schedules.json:', err);
    }
  }

  /**
   * Dispose the scheduler -- stops ticking and clears state.
   */
  dispose(): void {
    this.stop();
    this.tasks = [];
  }
}
