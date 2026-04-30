import { strict as assert } from 'assert';
import { createMockResponseStream } from '../mocks/vscode';
import {
  resetIntentRouterStateForTests,
  setNowFnForTests,
  tryHandleNaturalLanguageIntent,
} from '../../chat/intentRouter';

interface CliCall {
  subcommand: string;
  args: string[];
}

interface FakeAgentX {
  workspaceRoot: string | undefined;
  runCli: (subcommand: string, args?: string[]) => Promise<string>;
  cliCalls: CliCall[];
}

function makeAgentX(stdout: string = '(stub)', workspaceRoot: string | undefined = '/tmp/intent-router-test'): FakeAgentX {
  const cliCalls: CliCall[] = [];
  return {
    workspaceRoot,
    cliCalls,
    runCli: async (subcommand: string, args: string[] = []) => {
      cliCalls.push({ subcommand, args: [...args] });
      return stdout;
    },
  };
}

describe('intentRouter', () => {
  beforeEach(() => {
    resetIntentRouterStateForTests();
  });

  describe('phrase matching', () => {
    const cases: Array<{ phrase: string; subcommand: string; args: string[] }> = [
      // config show
      { phrase: 'show config', subcommand: 'config', args: ['show'] },
      { phrase: 'show configuration', subcommand: 'config', args: ['show'] },
      { phrase: "what's my config?", subcommand: 'config', args: ['show'] },
      { phrase: 'view current config', subcommand: 'config', args: ['show'] },
      // ready
      { phrase: 'show ready', subcommand: 'ready', args: [] },
      { phrase: "what's ready?", subcommand: 'ready', args: [] },
      { phrase: 'what should I work on', subcommand: 'ready', args: [] },
      // state
      { phrase: 'show state', subcommand: 'state', args: [] },
      { phrase: 'show agent state', subcommand: 'state', args: [] },
      { phrase: 'states', subcommand: 'state', args: [] },
      // loop status
      { phrase: 'show loop status', subcommand: 'loop', args: ['status'] },
      { phrase: 'loop status', subcommand: 'loop', args: ['status'] },
      { phrase: "what's the loop?", subcommand: 'loop', args: ['status'] },
      // deps
      { phrase: 'show deps for #42', subcommand: 'deps', args: ['42'] },
      { phrase: 'show dependencies of 17', subcommand: 'deps', args: ['17'] },
      { phrase: 'what blocks #99', subcommand: 'deps', args: ['99'] },
      // issue list / get
      { phrase: 'list issues', subcommand: 'issue', args: ['list'] },
      { phrase: 'show all issues', subcommand: 'issue', args: ['list'] },
      { phrase: 'issues', subcommand: 'issue', args: ['list'] },
      { phrase: 'show issue 42', subcommand: 'issue', args: ['get', '42'] },
      { phrase: 'view issue #17', subcommand: 'issue', args: ['get', '17'] },
      // workflow
      { phrase: 'list workflows', subcommand: 'workflow', args: [] },
      { phrase: 'show all agents', subcommand: 'workflow', args: [] },
      { phrase: 'show workflow for engineer', subcommand: 'workflow', args: ['engineer'] },
      { phrase: 'what is the workflow for architect', subcommand: 'workflow', args: ['architect'] },
      { phrase: 'describe the workflow for ux-designer', subcommand: 'workflow', args: ['ux-designer'] },
      // digest, audit, lessons, tokens
      { phrase: 'show digest', subcommand: 'digest', args: [] },
      { phrase: 'generate weekly digest', subcommand: 'digest', args: [] },
      { phrase: 'digest', subcommand: 'digest', args: [] },
      { phrase: 'run audit', subcommand: 'audit', args: [] },
      { phrase: 'audit', subcommand: 'audit', args: [] },
      { phrase: 'show lessons', subcommand: 'lessons', args: [] },
      { phrase: 'list lessons', subcommand: 'lessons', args: [] },
      { phrase: 'count tokens', subcommand: 'tokens', args: [] },
      { phrase: 'show token budget', subcommand: 'tokens', args: [] },
      { phrase: 'tokens', subcommand: 'tokens', args: [] },
      // bundles, parallel
      { phrase: 'list bundles', subcommand: 'bundle', args: ['list'] },
      { phrase: 'bundles', subcommand: 'bundle', args: ['list'] },
      { phrase: 'list parallel runs', subcommand: 'parallel', args: ['list'] },
      { phrase: 'show bounded-parallel runs', subcommand: 'parallel', args: ['list'] },
      // validate
      { phrase: 'validate 42 engineer', subcommand: 'validate', args: ['42', 'engineer'] },
      { phrase: 'validate issue #17 for architect', subcommand: 'validate', args: ['17', 'architect'] },
      { phrase: 'validate 99 as reviewer', subcommand: 'validate', args: ['99', 'reviewer'] },
    ];

    for (const c of cases) {
      it(`runs read-only verb for "${c.phrase}"`, async () => {
        const response = createMockResponseStream();
        const agentx = makeAgentX('done');
        const result = await tryHandleNaturalLanguageIntent(c.phrase, response as any, agentx as any);
        assert.ok(result, `expected match for "${c.phrase}"`);
        assert.equal(agentx.cliCalls.length, 1, `expected exactly one CLI call for "${c.phrase}"`);
        assert.equal(agentx.cliCalls[0].subcommand, c.subcommand);
        assert.deepEqual(agentx.cliCalls[0].args, c.args);
      });
    }
  });

  describe('destructive verbs', () => {
    it('proposes provider switch and waits for confirmation', async () => {
      const response = createMockResponseStream();
      const agentx = makeAgentX();
      const result = await tryHandleNaturalLanguageIntent(
        'change adapter to ado',
        response as any,
        agentx as any,
      );
      assert.ok(result);
      assert.equal(agentx.cliCalls.length, 0, 'must not run before confirmation');
      assert.ok(response.getMarkdown().includes('Proposed:'));
      assert.ok(response.getMarkdown().includes('config set provider ado'));
    });

    it('executes after explicit confirmation', async () => {
      const response1 = createMockResponseStream();
      const agentx = makeAgentX('switched');
      await tryHandleNaturalLanguageIntent('switch to github', response1 as any, agentx as any);
      assert.equal(agentx.cliCalls.length, 0);

      const response2 = createMockResponseStream();
      const result = await tryHandleNaturalLanguageIntent('yes', response2 as any, agentx as any);
      assert.ok(result);
      assert.equal(agentx.cliCalls.length, 1);
      assert.equal(agentx.cliCalls[0].subcommand, 'config');
      assert.deepEqual(agentx.cliCalls[0].args, ['set', 'provider', 'github']);
    });

    it('cancels pending intent on "no"', async () => {
      const r1 = createMockResponseStream();
      const agentx = makeAgentX();
      await tryHandleNaturalLanguageIntent('switch to local', r1 as any, agentx as any);

      const r2 = createMockResponseStream();
      const result = await tryHandleNaturalLanguageIntent('cancel', r2 as any, agentx as any);
      assert.ok(result);
      assert.equal(agentx.cliCalls.length, 0);
      assert.ok(r2.getMarkdown().toLowerCase().includes('cancelled'));
    });

    it('matches alternative phrasings of the provider switch', async () => {
      const phrasings: Array<{ text: string; provider: string }> = [
        { text: 'switch provider to ado', provider: 'ado' },
        { text: 'use github adapter', provider: 'github' },
        { text: 'change provider to local', provider: 'local' },
        { text: 'set adapter to ado', provider: 'ado' },
      ];
      for (const p of phrasings) {
        resetIntentRouterStateForTests();
        const r1 = createMockResponseStream();
        const agentx = makeAgentX();
        const proposed = await tryHandleNaturalLanguageIntent(p.text, r1 as any, agentx as any);
        assert.ok(proposed, `should propose for "${p.text}"`);

        const r2 = createMockResponseStream();
        await tryHandleNaturalLanguageIntent('yes', r2 as any, agentx as any);
        assert.equal(agentx.cliCalls.length, 1);
        assert.deepEqual(
          agentx.cliCalls[0].args,
          ['set', 'provider', p.provider],
          `wrong provider for "${p.text}"`,
        );
      }
    });

    const destructiveCases: Array<{
      phrase: string;
      subcommand: string;
      args: string[];
    }> = [
      // issue close
      { phrase: 'close issue 42', subcommand: 'issue', args: ['close', '42'] },
      { phrase: 'close #17', subcommand: 'issue', args: ['close', '17'] },
      // issue update status
      { phrase: 'set issue 42 to in progress', subcommand: 'issue', args: ['update', '-n', '42', '-s', 'In Progress'] },
      { phrase: 'move issue #17 to in review', subcommand: 'issue', args: ['update', '-n', '17', '-s', 'In Review'] },
      { phrase: 'mark issue 99 as done', subcommand: 'issue', args: ['update', '-n', '99', '-s', 'Done'] },
      { phrase: 'move #5 to ready', subcommand: 'issue', args: ['update', '-n', '5', '-s', 'Ready'] },
      // loop control
      { phrase: 'cancel loop', subcommand: 'loop', args: ['cancel'] },
      { phrase: 'cancel the loop', subcommand: 'loop', args: ['cancel'] },
      {
        phrase: 'complete loop with all gates passed',
        subcommand: 'loop',
        args: ['complete', '-s', 'all gates passed'],
      },
      {
        phrase: 'finish the loop: green',
        subcommand: 'loop',
        args: ['complete', '-s', 'green'],
      },
      {
        phrase: 'iterate loop with progress made',
        subcommand: 'loop',
        args: ['iterate', '-s', 'progress made'],
      },
      {
        phrase: 'start a loop for fix the bug',
        subcommand: 'loop',
        args: ['start', '-p', 'fix the bug'],
      },
      {
        phrase: 'begin loop on refactor module',
        subcommand: 'loop',
        args: ['start', '-p', 'refactor module'],
      },
      // sync — explicit target required
      { phrase: 'sync backlog to github', subcommand: 'backlog-sync', args: ['github', '--force'] },
      { phrase: 'sync the backlog with ado', subcommand: 'backlog-sync', args: ['ado', '--force'] },
      // git-sync
      { phrase: 'git-sync push', subcommand: 'git-sync', args: ['push'] },
      { phrase: 'git pull via agentx', subcommand: 'git-sync', args: ['pull'] },
      { phrase: 'run git-sync push', subcommand: 'git-sync', args: ['push'] },
      // hire
      { phrase: 'hire architect', subcommand: 'hire', args: ['architect'] },
      { phrase: 'scaffold a new agent reviewer', subcommand: 'hire', args: ['reviewer'] },
    ];

    for (const c of destructiveCases) {
      it(`proposes (no auto-execute) for "${c.phrase}"`, async () => {
        resetIntentRouterStateForTests();
        const r1 = createMockResponseStream();
        const agentx = makeAgentX();
        const proposed = await tryHandleNaturalLanguageIntent(c.phrase, r1 as any, agentx as any);
        assert.ok(proposed, `expected proposal for "${c.phrase}"`);
        assert.equal(agentx.cliCalls.length, 0, 'must not run before confirmation');
        assert.ok(r1.getMarkdown().includes('Proposed:'));

        const r2 = createMockResponseStream();
        await tryHandleNaturalLanguageIntent('yes', r2 as any, agentx as any);
        assert.equal(agentx.cliCalls.length, 1, `expected one CLI call after confirm for "${c.phrase}"`);
        assert.equal(agentx.cliCalls[0].subcommand, c.subcommand);
        assert.deepEqual(agentx.cliCalls[0].args, c.args);
      });
    }
  });

  describe('non-matching input', () => {
    it('returns undefined for unrelated free-text', async () => {
      const response = createMockResponseStream();
      const agentx = makeAgentX();
      const result = await tryHandleNaturalLanguageIntent(
        'tell me a joke about ducks',
        response as any,
        agentx as any,
      );
      assert.equal(result, undefined);
      assert.equal(agentx.cliCalls.length, 0);
    });

    it('returns undefined for empty input', async () => {
      const response = createMockResponseStream();
      const agentx = makeAgentX();
      const result = await tryHandleNaturalLanguageIntent('   ', response as any, agentx as any);
      assert.equal(result, undefined);
    });

    it('rejects unknown provider value', async () => {
      const response = createMockResponseStream();
      const agentx = makeAgentX();
      const result = await tryHandleNaturalLanguageIntent(
        'switch to bitbucket',
        response as any,
        agentx as any,
      );
      assert.equal(result, undefined);
      assert.equal(agentx.cliCalls.length, 0);
    });

    // Adversarial: ambiguous/partial phrases that must NOT silently match and run
    const noMatchPhrases = [
      'sync backlog',                  // no target — old default was github (bug fixed)
      'force-sync backlog',            // no target
      'push backlog',                  // no target
      'sync backlog to bitbucket',     // unsupported target
      'sync the backlog to jenkins',   // unsupported target
    ];
    for (const phrase of noMatchPhrases) {
      it(`rejects ambiguous/unsupported backlog-sync phrase: "${phrase}"`, async () => {
        const response = createMockResponseStream();
        const agentx = makeAgentX();
        const result = await tryHandleNaturalLanguageIntent(phrase, response as any, agentx as any);
        assert.equal(result, undefined, `"${phrase}" must not match any rule`);
        assert.equal(agentx.cliCalls.length, 0);
      });
    }
  });

  describe('boundary and safety guards', () => {
    it('does not execute an expired pending — shows expiry message instead', async () => {
      const BASE_TIME = 1_000_000;
      setNowFnForTests(() => BASE_TIME);
      const r1 = createMockResponseStream();
      const agentx = makeAgentX();
      await tryHandleNaturalLanguageIntent('sync backlog to github', r1 as any, agentx as any);
      assert.ok(r1.getMarkdown().includes('Proposed:'));
      assert.equal(agentx.cliCalls.length, 0);

      // Advance clock past the 5-minute TTL.
      setNowFnForTests(() => BASE_TIME + 6 * 60 * 1000);

      const r2 = createMockResponseStream();
      await tryHandleNaturalLanguageIntent('yes', r2 as any, agentx as any);
      assert.equal(agentx.cliCalls.length, 0, 'must NOT execute expired command');
      assert.ok(
        r2.getMarkdown().toLowerCase().includes('expired'),
        'response should mention expiry',
      );
    });

    it('backlog-sync without explicit target returns no match (no provider assumption)', async () => {
      const agentx = makeAgentX();
      const r = createMockResponseStream();
      const result = await tryHandleNaturalLanguageIntent('sync backlog', r as any, agentx as any);
      assert.equal(result, undefined, '"sync backlog" without target should not match');
      assert.equal(agentx.cliCalls.length, 0);
    });

    it('force-sync backlog without explicit target returns no match', async () => {
      const agentx = makeAgentX();
      const r = createMockResponseStream();
      const result = await tryHandleNaturalLanguageIntent('force-sync backlog', r as any, agentx as any);
      assert.equal(result, undefined, '"force-sync backlog" without target should not match');
      assert.equal(agentx.cliCalls.length, 0);
    });

    it('destructive intent with no workspace open — shows error, no pending stored', async () => {
      const agentx = makeAgentX();
      agentx.workspaceRoot = undefined; // explicitly unset after construction to bypass default
      const r = createMockResponseStream();
      const result = await tryHandleNaturalLanguageIntent(
        'sync backlog to github',
        r as any,
        agentx as any,
      );
      assert.ok(result, 'should return a result (not undefined)');
      assert.ok(
        r.getMarkdown().toLowerCase().includes('no workspace'),
        'response should mention no workspace',
      );
      assert.equal(agentx.cliCalls.length, 0, 'must not run any CLI call');

      // Confirm should NOT run anything either (no pending was stored).
      const r2 = createMockResponseStream();
      const result2 = await tryHandleNaturalLanguageIntent('yes', r2 as any, agentx as any);
      assert.equal(agentx.cliCalls.length, 0, 'yes after no-workspace must still run nothing');
      assert.equal(result2, undefined, 'yes with no pending should return undefined');
    });
  });
});
