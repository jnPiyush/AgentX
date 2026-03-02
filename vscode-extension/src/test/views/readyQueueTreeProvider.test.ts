import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import { ReadyQueueTreeProvider } from '../../views/readyQueueTreeProvider';

/**
 * Build a fake AgentXContext with a controllable runCli stub.
 */
function makeFakeAgentx(
  cliOutput?: string,
  cliError?: Error,
  initialized = true,
  workspaceRoot = '/fake/root',
) {
  return {
    checkInitialized: sinon.stub().resolves(initialized),
    runCli: sinon.stub().callsFake(async () => {
      if (cliError) { throw cliError; }
      return cliOutput ?? '';
    }),
    workspaceRoot,
  } as any;
}

describe('ReadyQueueTreeProvider', () => {
  afterEach(() => sinon.restore());

  // --- getChildren - not initialized ---

  it('should show "not initialized" when AgentX is not set up', async () => {
    const agentx = makeFakeAgentx('', undefined, false);
    const provider = new ReadyQueueTreeProvider(agentx);

    const items = await provider.getChildren();
    assert.equal(items.length, 1);
    assert.equal(items[0].label, 'AgentX not initialized');
    assert.equal(items[0].contextValue, 'infoItem');
  });

  // --- getChildren - empty output ---

  it('should show "no unblocked work" when CLI returns empty string', async () => {
    const agentx = makeFakeAgentx('');
    const provider = new ReadyQueueTreeProvider(agentx);

    const items = await provider.getChildren();
    assert.equal(items.length, 1);
    assert.equal(items[0].label, 'No unblocked work');
  });

  it('should show "no unblocked work" when CLI returns "No ready work found."', async () => {
    const agentx = makeFakeAgentx('No ready work found.');
    const provider = new ReadyQueueTreeProvider(agentx);

    const items = await provider.getChildren();
    assert.equal(items.length, 1);
    assert.equal(items[0].label, 'No unblocked work');
  });

  // --- getChildren - JSON output (primary path) ---

  it('should parse JSON output into structured tree items', async () => {
    const issues = [
      { number: 1, title: 'Fix auth', labels: ['type:bug', 'priority:p0'], state: 'open', status: 'Ready' },
      { number: 2, title: 'Add feature', labels: ['type:story', 'priority:p2'], state: 'open', status: 'Ready' },
    ];
    const agentx = makeFakeAgentx(JSON.stringify(issues));
    const provider = new ReadyQueueTreeProvider(agentx);

    const items = await provider.getChildren();
    assert.equal(items.length, 2);

    // First item
    assert.ok((items[0].label as string).includes('#1'));
    assert.ok((items[0].label as string).includes('Fix auth'));
    assert.ok((items[0].label as string).includes('[P0]'));
    assert.equal(items[0].issueNumber, '1');
    assert.equal(items[0].contextValue, 'readyItem');

    // Second item
    assert.ok((items[1].label as string).includes('#2'));
    assert.ok((items[1].label as string).includes('Add feature'));
    assert.equal(items[1].issueNumber, '2');
  });

  it('should pass --json flag to CLI', async () => {
    const agentx = makeFakeAgentx('[]');
    const provider = new ReadyQueueTreeProvider(agentx);

    await provider.getChildren();
    sinon.assert.calledOnce(agentx.runCli);
    sinon.assert.calledWith(agentx.runCli, 'ready', ['--json']);
  });

  it('should add click command to ready items', async () => {
    const issues = [
      { number: 42, title: 'Test issue', labels: ['type:story'], state: 'open', status: 'Ready' },
    ];
    const agentx = makeFakeAgentx(JSON.stringify(issues));
    const provider = new ReadyQueueTreeProvider(agentx);

    const items = await provider.getChildren();
    assert.equal(items.length, 1);
    assert.ok(items[0].command, 'ready item should have a click command');
    assert.equal((items[0].command as any).command, 'agentx.showIssue');
    assert.deepEqual((items[0].command as any).arguments, ['42']);
  });

  // --- getChildren - ANSI stripping ---

  it('should strip ANSI codes from JSON output', async () => {
    const issues = [
      { number: 5, title: 'Clean output', labels: ['type:bug'], state: 'open' },
    ];
    // Wrap JSON in ANSI escape sequences (simulating CLI color leak)
    const ansiWrapped = '\x1b[36m' + JSON.stringify(issues) + '\x1b[0m';
    const agentx = makeFakeAgentx(ansiWrapped);
    const provider = new ReadyQueueTreeProvider(agentx);

    const items = await provider.getChildren();
    assert.equal(items.length, 1);
    assert.ok((items[0].label as string).includes('#5'));
    assert.ok((items[0].label as string).includes('Clean output'));
  });

  // --- getChildren - fallback text parsing ---

  it('should parse human-readable text output as fallback', async () => {
    // Simulated non-JSON CLI output (header + separator + issue lines)
    const textOutput = [
      'Ready Work (unblocked, sorted by priority):',
      '---------------------------------------------',
      '[P0] #10 (bug) Fix login crash',
      '[P1] #11 (story) Add dashboard',
      '',
    ].join('\n');

    const agentx = makeFakeAgentx(textOutput);
    const provider = new ReadyQueueTreeProvider(agentx);

    const items = await provider.getChildren();

    // Should NOT include header or separator lines
    assert.equal(items.length, 2);
    assert.ok((items[0].label as string).includes('#10'));
    assert.ok((items[1].label as string).includes('#11'));
  });

  it('should filter out header lines in text fallback', async () => {
    const textOutput = [
      'Ready Work (unblocked, sorted by priority):',
      '---------------------------------------------',
    ].join('\n');

    const agentx = makeFakeAgentx(textOutput);
    const provider = new ReadyQueueTreeProvider(agentx);

    const items = await provider.getChildren();
    // Only headers, no issue lines -> should show "no unblocked work"
    assert.equal(items.length, 1);
    assert.equal(items[0].label, 'No unblocked work');
  });

  // --- getChildren - error handling ---

  it('should show info message when CLI fails', async () => {
    const agentx = makeFakeAgentx(undefined, new Error('CLI crashed'));
    const provider = new ReadyQueueTreeProvider(agentx);

    const items = await provider.getChildren();
    assert.equal(items.length, 1);
    assert.ok((items[0].label as string).includes('Run'));
    assert.equal(items[0].contextValue, 'infoItem');
  });

  // --- refresh() ---

  it('should clear cached items on refresh()', async () => {
    const issues = [
      { number: 1, title: 'First', labels: [], state: 'open' },
    ];
    const agentx = makeFakeAgentx(JSON.stringify(issues));
    const provider = new ReadyQueueTreeProvider(agentx);

    // First call populates cache
    let items = await provider.getChildren();
    assert.equal(items.length, 1);

    // Clear cache
    provider.refresh();

    // Should call CLI again
    items = await provider.getChildren();
    assert.equal(agentx.runCli.callCount, 2);
  });

  it('should accept prefetched issues on refresh()', async () => {
    const agentx = makeFakeAgentx('');
    const provider = new ReadyQueueTreeProvider(agentx);

    const prefetched = [
      { number: 99, title: 'Prefetched', labels: ['type:feature', 'priority:p1'], state: 'open' },
    ];

    provider.refresh(prefetched);

    const items = await provider.getChildren();
    assert.equal(items.length, 1);
    assert.ok((items[0].label as string).includes('#99'));
    assert.ok((items[0].label as string).includes('Prefetched'));
    // Should NOT have called CLI since we prefetched
    sinon.assert.notCalled(agentx.runCli);
  });

  // --- Static helpers ---

  describe('issuesToItems', () => {
    it('should extract priority and type from labels', () => {
      const agentx = makeFakeAgentx();
      const items = ReadyQueueTreeProvider.issuesToItems(
        [{ number: 3, title: 'Test', labels: ['priority:p0', 'type:epic'], state: 'open' }],
        agentx
      );
      assert.equal(items.length, 1);
      assert.ok((items[0].label as string).includes('[P0]'));
      assert.ok((items[0].label as string).includes('(epic)'));
    });

    it('should default to story type when no type label', () => {
      const agentx = makeFakeAgentx();
      const items = ReadyQueueTreeProvider.issuesToItems(
        [{ number: 4, title: 'No type', labels: [], state: 'open' }],
        agentx
      );
      assert.ok((items[0].label as string).includes('(story)'));
    });
  });

  describe('parseTextOutput', () => {
    it('should only include lines with issue numbers', () => {
      const agentx = makeFakeAgentx();
      const items = ReadyQueueTreeProvider.parseTextOutput(
        'Header line\n-----\n[P0] #7 (bug) Something\nRandom text',
        agentx
      );
      assert.equal(items.length, 1);
      assert.equal(items[0].issueNumber, '7');
    });

    it('should detect BLOCKED clarification in text output', () => {
      const agentx = makeFakeAgentx();
      const items = ReadyQueueTreeProvider.parseTextOutput(
        '[BLOCKED: Clarification pending] #8 (story) Needs input',
        agentx
      );
      assert.equal(items.length, 1);
      assert.equal(items[0].contextValue, 'blockedClarificationItem');
    });
  });
});
