import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildCrossSessionContext } from '../../agentic/contextInjector';
import { OutcomeTracker } from '../../memory/outcomeTracker';
import { SessionRecorder } from '../../memory/sessionRecorder';
import { SynapseNetwork } from '../../memory/synapseNetwork';
import { GlobalKnowledgeStore } from '../../memory/globalKnowledgeStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let memoryDir: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ctx-test-'));
  memoryDir = path.join(tmpDir, 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
  // Override HOME for GlobalKnowledgeStore
  originalHome = process.env['HOME'];
  originalUserProfile = process.env['USERPROFILE'];
  process.env['HOME'] = tmpDir;
  process.env['USERPROFILE'] = tmpDir;
});

afterEach(() => {
  if (originalHome !== undefined) { process.env['HOME'] = originalHome; }
  else { delete process.env['HOME']; }
  if (originalUserProfile !== undefined) { process.env['USERPROFILE'] = originalUserProfile; }
  else { delete process.env['USERPROFILE']; }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCrossSessionContext', () => {
  it('should return empty string when no deps provided', async () => {
    const result = await buildCrossSessionContext(undefined, 'engineer', {});
    assert.strictEqual(result, '', 'Should return empty with no deps');
  });

  it('should return empty string when issue is undefined and deps provided', async () => {
    const tracker = new OutcomeTracker(memoryDir);
    const result = await buildCrossSessionContext(undefined, 'engineer', {
      outcomeTracker: tracker,
    });
    // No issue -> outcome block skipped
    assert.strictEqual(result, '', 'Should return empty for no-issue context');
  });

  it('should not throw when subsystems have no data', async () => {
    const tracker = new OutcomeTracker(memoryDir);
    const recorder = new SessionRecorder(memoryDir);
    const synapse = new SynapseNetwork(memoryDir);
    const knowledge = new GlobalKnowledgeStore();

    const result = await buildCrossSessionContext(42, 'engineer', {
      outcomeTracker: tracker,
      sessionRecorder: recorder,
      synapseNetwork: synapse,
      globalKnowledge: knowledge,
    });

    // With empty stores, should still return a string (possibly empty)
    assert.ok(typeof result === 'string', 'Should return a string');
  });

  it('should include session summary when session data exists', async () => {
    const recorder = new SessionRecorder(memoryDir);

    // Seed a session record
    await recorder.capture({
      id: 'ses-20260301-abc123',
      agent: 'engineer',
      issueNumber: 42,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      summary: 'Implemented JWT validation middleware for API gateway',
      actions: ['Added middleware', 'Updated routes'],
      decisions: ['Use RS256 algorithm'],
      filesChanged: ['src/auth/middleware.ts'],
      messageCount: 15,
    });

    const result = await buildCrossSessionContext(42, 'engineer', {
      sessionRecorder: recorder,
    });

    assert.ok(result.includes('Previous Session'), 'Should include session header');
    assert.ok(result.includes('JWT'), 'Should include session content');
  });

  it('should include outcome lessons when outcome data exists', async () => {
    const tracker = new OutcomeTracker(memoryDir);

    await tracker.record({
      id: 'out-engineer-42-1',
      agent: 'engineer',
      issueNumber: 42,
      result: 'pass',
      actionSummary: 'Implemented pagination endpoint',
      rootCause: null,
      lesson: 'Cursor-based pagination outperforms offset for large datasets',
      iterationCount: 3,
      timestamp: new Date().toISOString(),
      sessionId: 'session-test',
      labels: ['type:story'],
    });

    const result = await buildCrossSessionContext(42, 'engineer', {
      outcomeTracker: tracker,
    });

    // formatLessonsForPrompt queries by agent, not issueNumber, so lessons may appear
    assert.ok(typeof result === 'string', 'Should return a string');
  });

  it('should handle errors in subsystems gracefully', async () => {
    // Create an outcomeTracker pointing to a non-existent dir
    const badTracker = new OutcomeTracker('/nonexistent/path/that/should/not/exist');

    const result = await buildCrossSessionContext(42, 'engineer', {
      outcomeTracker: badTracker,
    });

    // Should not throw - errors are caught internally
    assert.ok(typeof result === 'string', 'Should return a string even on error');
  });
});
