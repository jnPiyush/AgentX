import { AgentEventBus } from './eventBus';
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
/**
 * Check whether a cron expression matches a given date.
 */
export declare function matchesCron(expr: string, date: Date): boolean;
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
export declare class TaskScheduler {
    private tasks;
    private interval;
    private runner;
    private readonly eventBus;
    private readonly storePath;
    constructor(eventBus?: AgentEventBus, agentxDir?: string);
    /**
     * Add a new scheduled task.
     */
    addTask(task: ScheduledTask): void;
    /**
     * Remove a task by ID.
     */
    removeTask(id: string): boolean;
    /**
     * Enable or disable a task.
     */
    setEnabled(id: string, enabled: boolean): void;
    /**
     * Get all tasks.
     */
    getTasks(): ReadonlyArray<ScheduledTask>;
    /**
     * Get only enabled tasks.
     */
    getEnabledTasks(): ReadonlyArray<ScheduledTask>;
    /**
     * Start the scheduler with a task runner callback.
     */
    start(runner: TaskRunner, intervalMs?: number): void;
    /**
     * Stop the scheduler.
     */
    stop(): void;
    /**
     * Whether the scheduler is currently running.
     */
    isRunning(): boolean;
    private tick;
    /**
     * Check if a task already ran in this calendar minute.
     */
    private ranThisMinute;
    private loadFromDisk;
    private saveToDisk;
    /**
     * Dispose the scheduler -- stops ticking and clears state.
     */
    dispose(): void;
}
//# sourceMappingURL=taskScheduler.d.ts.map