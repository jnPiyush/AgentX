import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BackgroundEngine, SILENT_DISPATCHER } from '../../intelligence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let agentxDir: string;
let memoryDir: string;

function writeStateFile(dir: string, issueNumber: number, agent: string, state: string, extra: Record<string, unknown> = {}): void {
  const stateDir = path.join(dir, 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, `${agent}-${issueNumber}.json`),
    JSON.stringify({ agent, state, issueNumber, updatedAt: new Date().toISOString(), ...extra }),
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-bg-test-'));
  agentxDir = path.join(tmpDir, '.agentx');
  memoryDir = path.join(agentxDir, 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BackgroundEngine', () => {
  it('should be constructable with silent dispatcher', () => {
    const engine = new BackgroundEngine(agentxDir, memoryDir, SILENT_DISPATCHER);
    assert.ok(engine, 'BackgroundEngine instance should be created');
  });

  it('should start and stop without error', () => {
    const engine = new BackgroundEngine(agentxDir, memoryDir, SILENT_DISPATCHER, {
      scanIntervalMs: 60_000,
    });
    engine.start();
    engine.stop();
    // Double-stop is safe
    engine.stop();
  });

  it('should not throw if stopped when not running', () => {
    const engine = new BackgroundEngine(agentxDir, memoryDir, SILENT_DISPATCHER);
    assert.doesNotThrow(() => engine.stop());
  });

  it('should run a scan cycle via runNow', async () => {
    const engine = new BackgroundEngine(agentxDir, memoryDir, SILENT_DISPATCHER);
    engine.start({ scanIntervalMs: 999_999 });
    const results = await engine.runNow();
    assert.ok(Array.isArray(results), 'Should return DetectorResult[]');
    engine.stop();
  });

  it('should handle empty directories gracefully', async () => {
    const engine = new BackgroundEngine(agentxDir, memoryDir, SILENT_DISPATCHER);
    engine.start({ scanIntervalMs: 999_999 });
    const results = await engine.runNow();
    assert.strictEqual(results.length, 0, 'No results from empty dirs');
    engine.stop();
  });

  it('should handle state files during scan', async () => {
    writeStateFile(agentxDir, 99, 'engineer', 'working');
    const engine = new BackgroundEngine(agentxDir, memoryDir, SILENT_DISPATCHER);
    engine.start({ scanIntervalMs: 999_999 });
    const results = await engine.runNow();
    assert.ok(Array.isArray(results), 'Scan should complete');
    engine.stop();
  });

  it('should work with custom dispatcher', async () => {
    const dispatcher = {
      info: () => {},
      warning: () => {},
      error: () => {},
    };
    const engine = new BackgroundEngine(agentxDir, memoryDir, dispatcher);
    engine.start({ scanIntervalMs: 999_999 });
    await engine.runNow();
    engine.stop();
  });
});
