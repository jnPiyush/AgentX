import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { matchesCron, TaskScheduler } from '../../utils/taskScheduler';
import type { ScheduledTask } from '../../utils/taskScheduler';
import { AgentEventBus } from '../../utils/eventBus';

describe('taskScheduler - matchesCron', () => {

  it('should match * * * * * (every minute)', () => {
    assert.equal(matchesCron('* * * * *', new Date(2026, 1, 24, 10, 30)), true);
  });

  it('should match exact minute/hour', () => {
    const date = new Date(2026, 1, 24, 9, 0); // 09:00
    assert.equal(matchesCron('0 9 * * *', date), true);
    assert.equal(matchesCron('30 9 * * *', date), false);
  });

  it('should match day-of-week (0=Sun, 1=Mon, ...)', () => {
    const tuesday = new Date(2026, 1, 24); // Feb 24 2026 is a Tuesday (2)
    assert.equal(matchesCron('* * * * 2', tuesday), true);
    assert.equal(matchesCron('* * * * 0', tuesday), false);
  });

  it('should match weekday range (1-5)', () => {
    const tuesday = new Date(2026, 1, 24, 9, 0); // Feb 24 2026 is Tuesday, 09:00
    assert.equal(matchesCron('0 9 * * 1-5', tuesday), true);
  });

  it('should match comma-separated values', () => {
    const date = new Date(2026, 1, 24, 10, 15);
    assert.equal(matchesCron('15,30,45 * * * *', date), true);
    assert.equal(matchesCron('0,30 * * * *', date), false);
  });

  it('should match step expressions */N', () => {
    const date = new Date(2026, 1, 24, 10, 0);
    assert.equal(matchesCron('*/15 * * * *', date), true); // 0 % 15 === 0
    assert.equal(matchesCron('*/15 * * * *', new Date(2026, 1, 24, 10, 7)), false);
  });

  it('should match range with step N-M/S', () => {
    // 0-30/10 should match 0, 10, 20, 30
    assert.equal(matchesCron('0-30/10 * * * *', new Date(2026, 0, 1, 0, 0)), true);
    assert.equal(matchesCron('0-30/10 * * * *', new Date(2026, 0, 1, 0, 10)), true);
    assert.equal(matchesCron('0-30/10 * * * *', new Date(2026, 0, 1, 0, 5)), false);
  });

  it('should reject invalid cron (wrong number of fields)', () => {
    assert.equal(matchesCron('* * *', new Date()), false);
    assert.equal(matchesCron('', new Date()), false);
  });

  it('should match month field', () => {
    const feb = new Date(2026, 1, 1); // month=1 (0-indexed) -> cron month=2
    assert.equal(matchesCron('* * * 2 *', feb), true);
    assert.equal(matchesCron('* * * 3 *', feb), false);
  });

  it('should match day-of-month field', () => {
    const the15th = new Date(2026, 1, 15);
    assert.equal(matchesCron('* * 15 * *', the15th), true);
    assert.equal(matchesCron('* * 1 * *', the15th), false);
  });
});

describe('TaskScheduler', () => {

  let scheduler: TaskScheduler;
  let bus: AgentEventBus;
  let tmpDir: string;

  beforeEach(() => {
    bus = new AgentEventBus();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-sched-'));
    scheduler = new TaskScheduler(bus, tmpDir);
  });

  afterEach(() => {
    scheduler.dispose();
    bus.dispose();
    // Clean up temp dir
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ok */ }
  });

  it('should add and retrieve tasks', () => {
    const task: ScheduledTask = {
      id: 'test-1',
      schedule: '0 9 * * 1-5',
      description: 'Morning scan',
      command: 'quality-scan',
      enabled: true,
      lastRun: null,
      createdAt: Date.now(),
    };

    scheduler.addTask(task);
    const tasks = scheduler.getTasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 'test-1');
  });

  it('should replace task with same ID', () => {
    scheduler.addTask({
      id: 'x', schedule: '* * * * *', description: 'v1',
      command: 'cmd', enabled: true, lastRun: null, createdAt: 1,
    });
    scheduler.addTask({
      id: 'x', schedule: '*/5 * * * *', description: 'v2',
      command: 'cmd', enabled: true, lastRun: null, createdAt: 2,
    });

    const tasks = scheduler.getTasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].description, 'v2');
  });

  it('should remove a task', () => {
    scheduler.addTask({
      id: 'rm-me', schedule: '* * * * *', description: 'temp',
      command: 'cmd', enabled: true, lastRun: null, createdAt: 1,
    });

    assert.equal(scheduler.removeTask('rm-me'), true);
    assert.equal(scheduler.getTasks().length, 0);
    assert.equal(scheduler.removeTask('nonexistent'), false);
  });

  it('should enable/disable a task', () => {
    scheduler.addTask({
      id: 'toggle', schedule: '* * * * *', description: 'test',
      command: 'cmd', enabled: true, lastRun: null, createdAt: 1,
    });

    scheduler.setEnabled('toggle', false);
    assert.equal(scheduler.getEnabledTasks().length, 0);

    scheduler.setEnabled('toggle', true);
    assert.equal(scheduler.getEnabledTasks().length, 1);
  });

  it('should persist tasks to disk', () => {
    scheduler.addTask({
      id: 'persist', schedule: '0 2 * * *', description: 'nightly',
      command: 'scan', enabled: true, lastRun: null, createdAt: 1,
    });

    const filePath = path.join(tmpDir, 'schedules.json');
    assert.ok(fs.existsSync(filePath));

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(data.length, 1);
    assert.equal(data[0].id, 'persist');
  });

  it('should load tasks from disk on construction', () => {
    const filePath = path.join(tmpDir, 'schedules.json');
    fs.writeFileSync(filePath, JSON.stringify([{
      id: 'loaded', schedule: '* * * * *', description: 'from disk',
      command: 'cmd', enabled: true, lastRun: null, createdAt: 1,
    }]));

    const s2 = new TaskScheduler(bus, tmpDir);
    assert.equal(s2.getTasks().length, 1);
    assert.equal(s2.getTasks()[0].id, 'loaded');
    s2.dispose();
  });

  it('should report running state', () => {
    assert.equal(scheduler.isRunning(), false);
    scheduler.start(async () => {});
    assert.equal(scheduler.isRunning(), true);
    scheduler.stop();
    assert.equal(scheduler.isRunning(), false);
  });

  it('should emit task-fired event when task runs', (done) => {
    bus.on('task-fired', (e) => {
      assert.equal(e.taskId, 'fire-test');
      scheduler.stop();
      done();
    });

    // Add a task that matches every minute
    scheduler.addTask({
      id: 'fire-test', schedule: '* * * * *', description: 'always fires',
      command: 'test', enabled: true, lastRun: null, createdAt: 1,
    });

    // Start with a very short interval for testing
    scheduler.start(async () => {}, 100);
  });
});
