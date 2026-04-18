import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  __setMockModels,
  __clearMockModels,
  MockLanguageModelChat,
} from '../mocks/vscode';
import { AgentXContext } from '../../agentxContext';
import { registerRunCouncilCommand } from '../../commands/runCouncil';
import {
  buildRolePrompt,
  getRoleInstruction,
  modelKey,
  modelSelectorCandidates,
  parseCouncilBrief,
  replaceRoleBlock,
  summarizeVendorDiversity,
} from '../../commands/runCouncilInternals';

const SAMPLE_BRIEF = [
  '# Model Council: example',
  '',
  '**Convened:** 2026-04-18T10:00:00Z',
  '**Mode:** agent-internal (calling agent adopts each role and writes responses below)',
  '**Purpose pack:** adr-options',
  '',
  '## Question',
  '',
  'Should we use Postgres or Cosmos for the URL shortener?',
  '',
  '## Supporting Context',
  '',
  '10K writes/day, 1M reads/day, 50 internal users.',
  '',
  '## Council Roster',
  '',
  '| Role | Model |',
  '|------|-------|',
  '| Analyst | `openai/gpt-5.4` |',
  '| Strategist | `anthropic/claude-opus-4.7` |',
  '| Skeptic | `google/gemini-3.1-pro` |',
  '',
  '## Member Responses',
  '',
  '### Analyst -- `openai/gpt-5.4`',
  '',
  '[AGENT-TODO] Calling agent: adopt the role below...',
  '',
  '```',
  'Role: Analyst',
  'Suggested model bias: openai/gpt-5.4',
  'Role instruction: Decompose the decision. List candidate options with criteria that differentiate them.',
  'Prompt: see top of file',
  'Response format: ## Position / ## Key Reasoning / ## What Could Make Me Wrong',
  '```',
  '',
  '### Strategist -- `anthropic/claude-opus-4.7`',
  '',
  '[AGENT-TODO] Calling agent: adopt the role below...',
  '',
  '```',
  'Role: Strategist',
  'Suggested model bias: anthropic/claude-opus-4.7',
  'Role instruction: Step back. Recommend the option a senior architect would pick.',
  '```',
  '',
  '### Skeptic -- `google/gemini-3.1-pro`',
  '',
  '[AGENT-TODO] Calling agent: adopt the role below...',
  '',
  '```',
  'Role: Skeptic',
  'Suggested model bias: google/gemini-3.1-pro',
  'Role instruction: Argue against the front-runner. Identify failure modes and vendor risks.',
  '```',
  '',
  '## Synthesis',
  '',
  '**To be completed by the calling agent...**',
  '',
  '### Consensus on the Recommended Option',
  '(Option(s) that at least two members would pick...)',
  '',
].join('\n');

describe('parseCouncilBrief', () => {
  it('extracts question, context, and 3-member roster', () => {
    const brief = parseCouncilBrief(SAMPLE_BRIEF);
    assert.equal(brief.question, 'Should we use Postgres or Cosmos for the URL shortener?');
    assert.equal(brief.context, '10K writes/day, 1M reads/day, 50 internal users.');
    assert.equal(brief.roster.length, 3);
    assert.equal(brief.roster[0].role, 'Analyst');
    assert.equal(brief.roster[0].model, 'openai/gpt-5.4');
    assert.equal(brief.roster[2].role, 'Skeptic');
    assert.equal(brief.roster[2].model, 'google/gemini-3.1-pro');
    assert.equal(brief.hasPendingRoles, true);
  });

  it('extracts the purpose pack header', () => {
    const brief = parseCouncilBrief(SAMPLE_BRIEF);
    assert.equal(brief.purposePack, 'adr-options');
  });

  it('returns empty purpose pack for legacy briefs without the header', () => {
    const legacy = SAMPLE_BRIEF.replace(/\*\*Purpose pack:\*\*[^\n]*\n/, '');
    const brief = parseCouncilBrief(legacy);
    assert.equal(brief.purposePack, '');
  });

  it('extracts per-role purpose-pack instruction from each fenced block', () => {
    const brief = parseCouncilBrief(SAMPLE_BRIEF);
    assert.match(
      brief.roster[0].instruction ?? '',
      /Decompose the decision. List candidate options/,
    );
    assert.match(
      brief.roster[1].instruction ?? '',
      /Step back. Recommend the option a senior architect/,
    );
    assert.match(
      brief.roster[2].instruction ?? '',
      /Argue against the front-runner/,
    );
  });

  it('returns undefined instruction when the role block has no Role instruction line', () => {
    // Strip the Role instruction line from the Strategist block only.
    const stripped = SAMPLE_BRIEF.replace(
      /Role instruction: Step back\. Recommend the option a senior architect would pick\.\n/,
      '',
    );
    const brief = parseCouncilBrief(stripped);
    assert.equal(brief.roster[1].instruction, undefined);
    // Other roles still have their instructions.
    assert.match(brief.roster[0].instruction ?? '', /Decompose the decision/);
  });

  it('handles brief with no Supporting Context', () => {
    const noCtx = SAMPLE_BRIEF.replace(/## Supporting Context\n\n.*\n\n/, '');
    const brief = parseCouncilBrief(noCtx);
    assert.equal(brief.context, '');
    assert.equal(brief.question, 'Should we use Postgres or Cosmos for the URL shortener?');
  });

  it('reports no pending roles when all AGENT-TODOs are gone', () => {
    const filled = SAMPLE_BRIEF.replace(/\[AGENT-TODO\][^\n]*/g, 'done');
    const brief = parseCouncilBrief(filled);
    assert.equal(brief.hasPendingRoles, false);
  });

  it('skips the table header row', () => {
    const brief = parseCouncilBrief(SAMPLE_BRIEF);
    for (const entry of brief.roster) {
      assert.notEqual(entry.role.toLowerCase(), 'role');
    }
  });
});

describe('modelSelectorCandidates', () => {
  it('emits family then vendor then empty fallback for vendor/family ids by default', () => {
    const candidates = modelSelectorCandidates('openai/gpt-5.4');
    assert.deepEqual(candidates, [
      { family: 'gpt-5.4' },
      { vendor: 'openai' },
      {},
    ]);
  });

  it('omits the empty fallback when allowAnyFallback is false', () => {
    const candidates = modelSelectorCandidates('openai/gpt-5.4', { allowAnyFallback: false });
    assert.deepEqual(candidates, [
      { family: 'gpt-5.4' },
      { vendor: 'openai' },
    ]);
  });

  it('handles family-only ids without a slash', () => {
    const candidates = modelSelectorCandidates('claude-opus-4.7');
    assert.deepEqual(candidates, [
      { family: 'claude-opus-4.7' },
      {},
    ]);
  });

  it('handles family-only ids with allowAnyFallback false (no empty selector)', () => {
    const candidates = modelSelectorCandidates('claude-opus-4.7', { allowAnyFallback: false });
    assert.deepEqual(candidates, [
      { family: 'claude-opus-4.7' },
    ]);
  });
});

describe('buildRolePrompt', () => {
  it('embeds role, instruction, question, and context', () => {
    const prompt = buildRolePrompt({
      role: 'Skeptic',
      roleInstruction: 'Argue the opposite.',
      question: 'Q?',
      context: 'C',
    });
    assert.ok(prompt.includes('**Skeptic**'));
    assert.ok(prompt.includes('Argue the opposite.'));
    assert.ok(prompt.includes('## Position'));
    assert.ok(prompt.includes('## What Could Make Me Wrong'));
    assert.ok(prompt.includes('Q?'));
    assert.ok(prompt.includes('Supporting context:\nC'));
  });

  it('omits supporting-context section when context is empty', () => {
    const prompt = buildRolePrompt({
      role: 'Analyst',
      roleInstruction: 'x',
      question: 'Q?',
      context: '',
    });
    assert.ok(!prompt.includes('Supporting context:'));
  });
});

describe('getRoleInstruction', () => {
  it('returns canonical instruction for known roles when no brief instruction', () => {
    assert.match(getRoleInstruction('Analyst'), /Decompose/);
    assert.match(getRoleInstruction('Strategist'), /strategic/);
    assert.match(getRoleInstruction('Skeptic'), /contrarian/);
  });

  it('returns generic fallback for unknown roles', () => {
    assert.equal(getRoleInstruction('Bogus'), 'Speak from your assigned role.');
  });

  it('prefers the brief-supplied per-role instruction over the generic default', () => {
    const briefSpecific = 'Argue against the front-runner option specifically.';
    assert.equal(getRoleInstruction('Skeptic', briefSpecific), briefSpecific);
  });

  it('falls back to generic when brief instruction is empty/whitespace', () => {
    assert.match(getRoleInstruction('Analyst', '   '), /Decompose/);
    assert.match(getRoleInstruction('Analyst', ''), /Decompose/);
    assert.match(getRoleInstruction('Analyst', undefined), /Decompose/);
  });
});

describe('summarizeVendorDiversity', () => {
  it('reports collapsed when 2+ members share one vendor', () => {
    const r = summarizeVendorDiversity([
      { role: 'A', model: 'openai/x', status: 'ok', resolvedVendor: 'openai' },
      { role: 'B', model: 'openai/y', status: 'ok', resolvedVendor: 'openai' },
      { role: 'C', model: 'openai/z', status: 'ok', resolvedVendor: 'openai' },
    ]);
    assert.equal(r.collapsed, true);
    assert.equal(r.vendors.size, 1);
  });

  it('reports not collapsed when 3 distinct vendors responded', () => {
    const r = summarizeVendorDiversity([
      { role: 'A', model: 'openai/x', status: 'ok', resolvedVendor: 'openai' },
      { role: 'B', model: 'anthropic/y', status: 'ok', resolvedVendor: 'anthropic' },
      { role: 'C', model: 'google/z', status: 'ok', resolvedVendor: 'google' },
    ]);
    assert.equal(r.collapsed, false);
    assert.equal(r.vendors.size, 3);
  });

  it('ignores failed members when judging diversity', () => {
    const r = summarizeVendorDiversity([
      { role: 'A', model: 'openai/x', status: 'ok', resolvedVendor: 'openai' },
      { role: 'B', model: 'anthropic/y', status: 'failed', error: 'x' },
    ]);
    // Only one ok response -> not "collapsed" (single-member rosters cannot be diverse).
    assert.equal(r.collapsed, false);
    assert.equal(r.vendors.size, 1);
  });

  it('treats vendor case-insensitively', () => {
    const r = summarizeVendorDiversity([
      { role: 'A', model: 'openai/x', status: 'ok', resolvedVendor: 'OpenAI' },
      { role: 'B', model: 'openai/y', status: 'ok', resolvedVendor: 'openai' },
    ]);
    assert.equal(r.collapsed, true);
    assert.equal(r.vendors.size, 1);
  });

  // ------------------------------------------------------------------
  // 3-tier diversity: vendor (best) > model > role (worst).
  // The reported tier is the WORST seen across ok roles -- one Tier-3
  // role collapses the whole council to 'role'.
  // ------------------------------------------------------------------
  it('reports tier=vendor when every ok role landed on Tier 1', () => {
    const r = summarizeVendorDiversity([
      { role: 'A', model: 'openai/x', status: 'ok', resolvedVendor: 'openai', diversityTier: 'vendor' },
      { role: 'B', model: 'anthropic/y', status: 'ok', resolvedVendor: 'anthropic', diversityTier: 'vendor' },
      { role: 'C', model: 'google/z', status: 'ok', resolvedVendor: 'google', diversityTier: 'vendor' },
    ]);
    assert.equal(r.tier, 'vendor');
    assert.equal(r.collapsed, false);
  });

  it('reports tier=model when at least one role fell to Tier 2', () => {
    const r = summarizeVendorDiversity([
      { role: 'A', model: 'openai/x', status: 'ok', resolvedVendor: 'openai', diversityTier: 'vendor' },
      { role: 'B', model: 'anthropic/y', status: 'ok', resolvedVendor: 'anthropic', diversityTier: 'vendor' },
      { role: 'C', model: 'openai/z', status: 'ok', resolvedVendor: 'openai', diversityTier: 'model' },
    ]);
    assert.equal(r.tier, 'model');
  });

  it('reports tier=role when any role fell to Tier 3 (worst-rank wins)', () => {
    const r = summarizeVendorDiversity([
      { role: 'A', model: 'openai/x', status: 'ok', resolvedVendor: 'openai', diversityTier: 'vendor' },
      { role: 'B', model: 'openai/y', status: 'ok', resolvedVendor: 'openai', diversityTier: 'model' },
      { role: 'C', model: 'openai/x', status: 'ok', resolvedVendor: 'openai', diversityTier: 'role' },
    ]);
    assert.equal(r.tier, 'role');
  });

  it('reports tier=none when no roles succeeded', () => {
    const r = summarizeVendorDiversity([
      { role: 'A', model: 'openai/x', status: 'failed', error: 'x' },
      { role: 'B', model: 'anthropic/y', status: 'failed', error: 'x' },
    ]);
    assert.equal(r.tier, 'none');
  });
});

describe('modelKey', () => {
  it('joins vendor|family|name lowercased', () => {
    assert.equal(
      modelKey({ vendor: 'OpenAI', family: 'GPT-5.4', name: 'GPT-5.4' }),
      'openai|gpt-5.4|gpt-5.4',
    );
  });

  it('treats missing fields as empty', () => {
    assert.equal(modelKey({}), '||');
    assert.equal(modelKey({ vendor: 'openai' }), 'openai||');
  });

  it('distinguishes same family different version (e.g. gpt-5.4 vs gpt-5.5)', () => {
    const a = modelKey({ vendor: 'openai', family: 'gpt-5', name: 'gpt-5.4' });
    const b = modelKey({ vendor: 'openai', family: 'gpt-5', name: 'gpt-5.5' });
    assert.notEqual(a, b);
  });
});

describe('replaceRoleBlock', () => {
  it('replaces the AGENT-TODO block for a role with the response', () => {
    const updated = replaceRoleBlock(SAMPLE_BRIEF, 'Strategist', 'STRATEGIST RESPONSE BODY');
    assert.ok(updated.includes('STRATEGIST RESPONSE BODY'));
    assert.ok(!updated.includes("Role: Strategist\n```"));
    // Other roles untouched
    assert.ok(updated.includes('Role: Analyst'));
    assert.ok(updated.includes('Role: Skeptic'));
    // Synthesis section preserved
    assert.ok(updated.includes('## Synthesis'));
  });

  it('returns content unchanged when role heading is missing', () => {
    const updated = replaceRoleBlock(SAMPLE_BRIEF, 'NonexistentRole', 'X');
    assert.equal(updated, SAMPLE_BRIEF);
  });

  it('preserves the role heading line itself', () => {
    const updated = replaceRoleBlock(SAMPLE_BRIEF, 'Analyst', 'A');
    assert.ok(updated.includes('### Analyst -- `openai/gpt-5.4`'));
  });

  // ------------------------------------------------------------------
  // BUG #2 regression: rerun must not lose purpose-pack semantics.
  // replaceRoleBlock must emit a recoverable instruction marker when an
  // instruction is provided, and parseCouncilBrief must read it back so a
  // second pass over the same brief still carries the per-role instruction.
  // ------------------------------------------------------------------
  it('embeds the per-role instruction so a rerun can recover it', () => {
    const instruction = 'Argue against the front-runner -- expose vendor risk in 18 months.';
    const updated = replaceRoleBlock(SAMPLE_BRIEF, 'Skeptic', 'SKEPTIC BODY', instruction);
    // The original Role instruction line inside the [AGENT-TODO] fenced block
    // is gone (it was part of the block we replaced), so the marker is the
    // ONLY surviving copy of the per-role instruction.
    assert.ok(!updated.includes('Role instruction: Argue against the front-runner'));
    // The sentinel marker must be present in the file.
    assert.match(updated, /<!-- agentx:role-instruction:base64 [A-Za-z0-9+/=]+ -->/);

    // parseCouncilBrief on the updated content must recover the same
    // instruction, even though `--` in the original text would have broken
    // a naive HTML comment encoding.
    const reparsed = parseCouncilBrief(updated);
    const skeptic = reparsed.roster.find((r) => r.role === 'Skeptic');
    assert.ok(skeptic);
    assert.equal(skeptic!.instruction, instruction);

    // Other roles still have their original [AGENT-TODO] block instructions.
    const analyst = reparsed.roster.find((r) => r.role === 'Analyst');
    assert.ok(analyst);
    assert.match(analyst!.instruction ?? '', /Decompose the decision/);
  });

  it('omits the instruction marker when no instruction is provided', () => {
    const updated = replaceRoleBlock(SAMPLE_BRIEF, 'Analyst', 'PLAIN BODY');
    assert.ok(!/agentx:role-instruction/.test(updated));
    assert.ok(updated.includes('PLAIN BODY'));
  });

  it('omits the instruction marker for empty/whitespace instruction', () => {
    const a = replaceRoleBlock(SAMPLE_BRIEF, 'Analyst', 'X', '');
    assert.ok(!/agentx:role-instruction/.test(a));
    const b = replaceRoleBlock(SAMPLE_BRIEF, 'Analyst', 'X', '   ');
    assert.ok(!/agentx:role-instruction/.test(b));
  });

  it('round-trips even when the instruction contains characters hostile to HTML comments', () => {
    // Both `--` and `>` would corrupt a naive HTML comment. The base64\n    // payload makes the marker robust against both.
    const tricky = 'Pick option -- not the cheap one. Reject if cost > 2x baseline.';
    const updated = replaceRoleBlock(SAMPLE_BRIEF, 'Strategist', 'BODY', tricky);
    const reparsed = parseCouncilBrief(updated);
    const strategist = reparsed.roster.find((r) => r.role === 'Strategist');
    assert.equal(strategist!.instruction, tricky);
  });

  it('marker takes precedence over a stray "Role instruction:" line in model output', () => {
    // Hostile case: the model response itself contains a line starting with
    // "Role instruction:" (e.g. it quoted the prompt back). The marker we
    // wrote must still win so the recovered instruction is the authoritative
    // one we passed in, not the model's quoted text.
    const real = 'REAL purpose-pack instruction.';
    const responseQuotingPrompt = [
      '## Position',
      'I considered the role.',
      '',
      '## Key Reasoning',
      '- The original prompt said: Role instruction: SHADOWED FAKE INSTRUCTION',
      '- And then I reasoned about it.',
    ].join('\n');
    const updated = replaceRoleBlock(SAMPLE_BRIEF, 'Analyst', responseQuotingPrompt, real);
    const reparsed = parseCouncilBrief(updated);
    const analyst = reparsed.roster.find((r) => r.role === 'Analyst');
    assert.equal(analyst!.instruction, real, 'marker must win over a stray text line in response');
  });
});

// ---------------------------------------------------------------------------
// Orchestration tests for registerRunCouncilCommand. These cover the runtime
// paths (vscode.lm orchestration, vendor exclusion, file revert safety, dirty
// editor protection) that the helper-only tests above cannot exercise.
// ---------------------------------------------------------------------------

interface CapturedRequest {
  vendor: string;
  family: string;
  prompt: string;
}

function makeMockModel(
  vendor: string,
  family: string,
  responses: CapturedRequest[],
  responseText: string,
): MockLanguageModelChat {
  return {
    name: `${vendor}/${family}`,
    vendor,
    family,
    sendRequest: async (messages: unknown[]) => {
      const first = (messages as Array<{ content?: string }>)[0];
      const prompt = typeof first?.content === 'string' ? first.content : '';
      responses.push({ vendor, family, prompt });
      // Stream a single chunk.
      return {
        text: (async function* () {
          yield responseText;
        })(),
      };
    },
  };
}

describe('registerRunCouncilCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: AgentXContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    fakeAgentx = { workspaceRoot: '/tmp/workspace' } as unknown as AgentXContext;
    __clearMockModels();
  });

  afterEach(() => {
    sandbox.restore();
    __clearMockModels();
  });

  it('registers the agentx.runCouncil command', () => {
    const stub = sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, _cb: (...args: unknown[]) => unknown) => ({ dispose: () => { /* noop */ } }),
    );
    registerRunCouncilCommand(fakeContext, fakeAgentx);
    assert.ok(stub.calledWith('agentx.runCouncil'));
  });
});

describe('registerRunCouncilCommand - orchestration', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: AgentXContext;
  let commandCallback: () => Promise<void>;
  let tmpFile: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    fakeAgentx = { workspaceRoot: '/tmp/workspace' } as unknown as AgentXContext;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        commandCallback = cb as () => Promise<void>;
        return { dispose: () => { /* noop */ } };
      },
    );

    // Write the sample brief to a temp file so the command's fs.readFileSync
    // / fs.writeFileSync paths exercise real I/O.
    tmpFile = path.join(os.tmpdir(), `COUNCIL-test-${Date.now()}-${Math.random()}.md`);
    fs.writeFileSync(tmpFile, SAMPLE_BRIEF, 'utf8');

    // Default: an active editor pointing at the temp brief so resolveTargetUri
    // picks it without showing a file dialog.
    (vscode.window as { activeTextEditor?: unknown }).activeTextEditor = {
      document: { uri: { fsPath: tmpFile } as vscode.Uri, isDirty: false },
    };
    (vscode.workspace as { textDocuments?: unknown }).textDocuments = [];

    __clearMockModels();
    registerRunCouncilCommand(fakeContext, fakeAgentx);
  });

  afterEach(() => {
    sandbox.restore();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    (vscode.window as { activeTextEditor?: unknown }).activeTextEditor = undefined;
    (vscode.workspace as { textDocuments?: unknown }).textDocuments = [];
    __clearMockModels();
  });

  it('invokes three distinct vendors and writes purpose-pack instructions into prompts', async () => {
    const captured: CapturedRequest[] = [];
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', captured, 'Analyst answer body.'),
      makeMockModel('anthropic', 'claude-opus-4.7', captured, 'Strategist answer body.'),
      makeMockModel('google', 'gemini-3.1-pro', captured, 'Skeptic answer body.'),
    ]);

    const infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);
    const errStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

    await commandCallback();

    assert.equal(errStub.callCount, 0, 'no error messages should be shown');
    assert.equal(warnStub.callCount, 0, 'collapsed-vendor warning should NOT fire when 3 vendors are available');
    assert.ok(infoStub.calledOnce, 'success info message should fire once');
    const successMessage = String(infoStub.firstCall.args[0]);
    assert.match(successMessage, /3\/3 members responded/);
    assert.match(successMessage, /3 vendor/);

    // Each role must have been routed to a DIFFERENT vendor.
    assert.equal(captured.length, 3);
    const vendors = new Set(captured.map((c) => c.vendor));
    assert.equal(vendors.size, 3, `expected 3 distinct vendors, got ${[...vendors].join(',')}`);

    // Critical-finding fix: the purpose-pack instruction parsed from the
    // brief must appear in the prompt sent to each model. This is the bug
    // fix for finding 1 (purpose pack semantics dropped).
    const analystReq = captured.find((c) => c.vendor === 'openai');
    assert.ok(analystReq);
    assert.match(
      analystReq!.prompt,
      /Decompose the decision\. List candidate options/,
      'Analyst prompt must carry the brief-specific (adr-options pack) Role instruction',
    );

    const strategistReq = captured.find((c) => c.vendor === 'anthropic');
    assert.ok(strategistReq);
    assert.match(
      strategistReq!.prompt,
      /Recommend the option a senior architect/,
      'Strategist prompt must carry the adr-options-pack instruction, not the generic research-pack default',
    );

    const skepticReq = captured.find((c) => c.vendor === 'google');
    assert.ok(skepticReq);
    assert.match(
      skepticReq!.prompt,
      /Argue against the front-runner/,
      'Skeptic prompt must carry the adr-options-pack instruction, not the generic research-pack default',
    );

    // The temp file on disk should have all three role responses written.
    const updated = fs.readFileSync(tmpFile, 'utf8');
    assert.match(updated, /Analyst answer body\./);
    assert.match(updated, /Strategist answer body\./);
    assert.match(updated, /Skeptic answer body\./);
    // No AGENT-TODO placeholders remain.
    assert.equal(/\[AGENT-TODO\]/.test(updated), false);
  });

  it('warns about collapsed vendor diversity when only one vendor is available', async () => {
    const captured: CapturedRequest[] = [];
    // Only one vendor available -> all three roles must collapse onto it.
    // 3 distinct families => Tier 2 'model' (model-diverse mode), not Tier 3.
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', captured, 'one'),
      makeMockModel('openai', 'gpt-4', captured, 'two'),
      makeMockModel('openai', 'gpt-3.5', captured, 'three'),
    ]);

    const infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

    await commandCallback();

    assert.equal(infoStub.callCount, 0, 'success info should NOT fire when diversity collapsed');
    assert.ok(warnStub.calledOnce, 'collapsed-vendor warning must fire');
    const warnMessage = String(warnStub.firstCall.args[0]);
    // Legacy assertions (preserved for backward compat with old wording).
    assert.match(warnMessage, /vendor diversity collapsed/);
    assert.match(warnMessage, /multi-vendor.*was NOT met/i);
    // New Tier-2 specific wording.
    assert.match(warnMessage, /model-diverse mode/i);

    // Per-role tier tags: the FIRST role lands at tier=vendor (no claimed
    // vendors yet), then subsequent roles collapse to tier=model because
    // the only vendor is now blocked. Overall worst-rank tier is 'model'.
    const updated = fs.readFileSync(tmpFile, 'utf8');
    const tierMatches = updated.match(/tier=(\w+)/g) ?? [];
    assert.equal(tierMatches.length, 3, 'every role block should carry a tier= tag');
    assert.equal(
      tierMatches.filter((t) => t === 'tier=vendor').length,
      1,
      'exactly the first role should be tier=vendor (no vendors claimed yet)',
    );
    assert.equal(
      tierMatches.filter((t) => t === 'tier=model').length,
      2,
      'roles 2 and 3 should collapse to tier=model when only one vendor is available',
    );
  });

  // ------------------------------------------------------------------
  // 3-tier diversity: mixed availability.
  // Brief asks for [openai, anthropic, google] but only OpenAI and Google
  // are installed. The 3-tier algorithm should:
  //   role 1 (Analyst, openai)      -> Tier 1A: openai matches.
  //   role 2 (Strategist, anthropic) -> Tier 1A misses (no anthropic);
  //                                     Tier 1B picks google (unclaimed
  //                                     vendor in inventory).
  //   role 3 (Skeptic, google)       -> Tier 1A would have picked google,
  //                                     but Strategist already claimed it;
  //                                     Tier 1B finds no unclaimed vendors;
  //                                     Tier 2 picks an unused OpenAI model.
  // Net: vendor diversity is preserved (2 vendors) for 2/3 roles, and the
  // third lands at Tier 2 'model'. Overall tier reports as 'model'
  // because worst-rank wins.
  // ------------------------------------------------------------------
  it('uses Tier 1B vendor sweep to recover diversity in mixed-availability environments', async () => {
    const captured: CapturedRequest[] = [];
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', captured, 'analyst body'),
      makeMockModel('openai', 'gpt-4', captured, 'fallback body'),
      makeMockModel('google', 'gemini-3.1-pro', captured, 'google body'),
    ]);

    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

    await commandCallback();

    // All 3 roles ran.
    assert.equal(captured.length, 3);
    const vendors = captured.map((c) => c.vendor);
    // Two distinct vendors should be claimed (vendor diversity at least
    // partially recovered) -- this is the Tier 1B fallback in action.
    const uniqueVendors = new Set(vendors);
    assert.equal(uniqueVendors.size, 2, `expected 2 distinct vendors via Tier 1B, got ${[...uniqueVendors].join(',')}`);
    assert.ok(uniqueVendors.has('openai'));
    assert.ok(uniqueVendors.has('google'));

    // Overall tier should be 'model' (one role at Tier 2 collapses the label).
    assert.ok(warnStub.calledOnce, 'a warning should fire because diversity is not fully vendor-tier');
    const warnMessage = String(warnStub.firstCall.args[0]);
    assert.match(warnMessage, /model-diverse mode/i);

    // Source tags: 2 of them tier=vendor, 1 of them tier=model.
    const updated = fs.readFileSync(tmpFile, 'utf8');
    const tierMatches = updated.match(/tier=(\w+)/g) ?? [];
    assert.equal(tierMatches.length, 3);
    const vendorTierCount = tierMatches.filter((t) => t === 'tier=vendor').length;
    const modelTierCount = tierMatches.filter((t) => t === 'tier=model').length;
    assert.equal(vendorTierCount, 2, 'two roles should land at tier=vendor');
    assert.equal(modelTierCount, 1, 'one role should land at tier=model');
  });

  // ------------------------------------------------------------------
  // 3-tier diversity: only one model available.
  // The brief still produces 3 substantive responses (because role
  // instructions vary), but the council degrades to Tier 3 'role'.
  // The user must see a STRONG warning that agreement between roles
  // should be treated as weak signal.
  // ------------------------------------------------------------------
  it('falls back to role-diverse-only mode when only one model is available', async () => {
    const captured: CapturedRequest[] = [];
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', captured, 'shared body'),
    ]);

    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

    await commandCallback();

    // All 3 roles still ran -- the council always produces a brief.
    assert.equal(captured.length, 3);

    // ...but every role used the SAME model.
    const modelKeys = new Set(captured.map((c) => `${c.vendor}|${c.family}`));
    assert.equal(modelKeys.size, 1, 'all roles should share the only available model');

    // Strong warning required so the calling agent down-weights role agreement.
    assert.ok(warnStub.calledOnce);
    const warnMessage = String(warnStub.firstCall.args[0]);
    assert.match(warnMessage, /role-diverse-only mode/i);
    assert.match(warnMessage, /weak signal/i);

    // First role lands at tier=vendor (Tier 1A succeeds with no
    // competition). Subsequent roles cannot get a fresh vendor OR a fresh
    // model identity, so they fall to tier=role. Overall worst-rank is
    // 'role', which is what the user-visible warning reports.
    const updated = fs.readFileSync(tmpFile, 'utf8');
    const tierMatches = updated.match(/tier=(\w+)/g) ?? [];
    assert.equal(tierMatches.length, 3);
    assert.equal(
      tierMatches.filter((t) => t === 'tier=vendor').length,
      1,
      'exactly the first role should be tier=vendor',
    );
    assert.equal(
      tierMatches.filter((t) => t === 'tier=role').length,
      2,
      'roles 2 and 3 should collapse to tier=role when only one model is available',
    );
  });

  // Augment the happy-path test by asserting tier=vendor labels on every
  // source tag when 3 distinct vendors are available.
  it('tags every role with tier=vendor when 3 distinct vendors are available', async () => {
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', [], 'a'),
      makeMockModel('anthropic', 'claude-opus-4.7', [], 'b'),
      makeMockModel('google', 'gemini-3.1-pro', [], 'c'),
    ]);
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

    await commandCallback();

    const updated = fs.readFileSync(tmpFile, 'utf8');
    const tierMatches = updated.match(/tier=(\w+)/g) ?? [];
    assert.equal(tierMatches.length, 3);
    assert.ok(
      tierMatches.every((t) => t === 'tier=vendor'),
      `expected every role tagged tier=vendor, got ${tierMatches.join(',')}`,
    );
  });

  it('aborts without writing when the brief is dirty in an open editor and user declines', async () => {
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', [], 'x'),
      makeMockModel('anthropic', 'claude-opus-4.7', [], 'y'),
      makeMockModel('google', 'gemini-3.1-pro', [], 'z'),
    ]);

    // Simulate an open document with unsaved edits.
    (vscode.workspace as { textDocuments?: unknown }).textDocuments = [
      { uri: { fsPath: tmpFile } as vscode.Uri, isDirty: true },
    ];

    // User declines the discard prompt by returning undefined.
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

    const beforeContent = fs.readFileSync(tmpFile, 'utf8');
    await commandCallback();
    const afterContent = fs.readFileSync(tmpFile, 'utf8');

    // Dirty-edit prompt should have been raised.
    assert.ok(warnStub.calledOnce);
    const promptMessage = String(warnStub.firstCall.args[0]);
    assert.match(promptMessage, /unsaved edits/i);

    // File on disk MUST be unchanged because user declined.
    assert.equal(afterContent, beforeContent, 'file must not be overwritten when user declines');
  });

  it('proceeds and writes when the user accepts the dirty-edit discard prompt', async () => {
    const captured: CapturedRequest[] = [];
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', captured, 'A1'),
      makeMockModel('anthropic', 'claude-opus-4.7', captured, 'S1'),
      makeMockModel('google', 'gemini-3.1-pro', captured, 'K1'),
    ]);

    (vscode.workspace as { textDocuments?: unknown }).textDocuments = [
      { uri: { fsPath: tmpFile } as vscode.Uri, isDirty: true },
    ];

    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage')
      .onFirstCall().resolves('Discard edits and run' as unknown as vscode.MessageItem)
      .onSecondCall().resolves(undefined);
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

    await commandCallback();

    // First warning was the dirty-edit prompt; user accepted, so file gets written.
    assert.ok(warnStub.calledOnce);
    const updated = fs.readFileSync(tmpFile, 'utf8');
    assert.match(updated, /A1/);
    assert.match(updated, /S1/);
    assert.match(updated, /K1/);
  });

  it('only reverts the editor when the council brief is the active editor', async () => {
    const captured: CapturedRequest[] = [];
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', captured, 'a'),
      makeMockModel('anthropic', 'claude-opus-4.7', captured, 'b'),
      makeMockModel('google', 'gemini-3.1-pro', captured, 'c'),
    ]);

    // Brief is OPEN but NOT the active editor -- some unrelated file is.
    const otherFile = path.join(os.tmpdir(), 'unrelated-active.md');
    (vscode.window as { activeTextEditor?: unknown }).activeTextEditor = {
      document: { uri: { fsPath: otherFile } as vscode.Uri, isDirty: false },
    };
    (vscode.workspace as { textDocuments?: unknown }).textDocuments = [
      { uri: { fsPath: tmpFile } as vscode.Uri, isDirty: false },
    ];

    // showOpenDialog will be invoked since active editor is not a council brief.
    sandbox.stub(vscode.window, 'showOpenDialog').resolves([{ fsPath: tmpFile } as vscode.Uri]);
    const showDocStub = sandbox.stub(vscode.window, 'showTextDocument').resolves(undefined as unknown as vscode.TextEditor);
    const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves(undefined);
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

    await commandCallback();

    // Safety contract: when the brief is open but NOT active, we must
    // showTextDocument FIRST (focus it) before executing files.revert. This
    // prevents the prior bug of reverting whichever unrelated file was
    // active.
    assert.ok(showDocStub.calledOnce, 'showTextDocument must focus the brief before revert');
    assert.ok(
      execStub.calledWith('workbench.action.files.revert'),
      'workbench.action.files.revert should be called once focus is on the brief',
    );

    // The order matters: showTextDocument must happen before revert.
    assert.ok(
      showDocStub.firstCall.calledBefore(execStub.getCalls().find((c) => c.args[0] === 'workbench.action.files.revert')!),
      'showTextDocument must precede revert',
    );
  });

  it('shows error and bails when the brief lacks Question or Roster', async () => {
    fs.writeFileSync(tmpFile, '# Empty council brief\n', 'utf8');
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', [], 'x'),
    ]);
    const errStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

    await commandCallback();

    assert.ok(errStub.calledOnce);
    assert.match(String(errStub.firstCall.args[0]), /missing a Question or Council Roster/);
  });

  // BUG #2 regression at orchestration level: rerunning a brief that has
  // already been filled in by a prior run must still send the per-role
  // purpose-pack instruction (recovered from the embedded marker), not the
  // generic research-pack default.
  it('preserves purpose-pack instruction on rerun of an already-filled brief', async () => {
    // Pass 1: fill the brief end-to-end.
    const firstCaptured: CapturedRequest[] = [];
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', firstCaptured, 'pass1-analyst'),
      makeMockModel('anthropic', 'claude-opus-4.7', firstCaptured, 'pass1-strategist'),
      makeMockModel('google', 'gemini-3.1-pro', firstCaptured, 'pass1-skeptic'),
    ]);
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    // The first warning is the "no AGENT-TODO placeholders remain" prompt
    // raised on rerun; the second covers any later warnings. Pass 1 has TODOs
    // present so the rerun-confirm dialog does not fire.
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage')
      .onFirstCall().resolves('Run anyway' as unknown as vscode.MessageItem)
      .resolves(undefined);

    await commandCallback();

    // Sanity: pass 1 wrote responses and consumed all AGENT-TODOs.
    const afterPass1 = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(afterPass1.includes('pass1-analyst'));
    assert.equal(/\[AGENT-TODO\]/.test(afterPass1), false);
    // Sanity: pass 1 carried the adr-options instructions.
    const analystP1 = firstCaptured.find((c) => c.vendor === 'openai');
    assert.match(analystP1!.prompt, /Decompose the decision\. List candidate options/);

    // Pass 2: rerun on the now-filled file. Mocks are reset so we can capture
    // the fresh prompts independently.
    __clearMockModels();
    const secondCaptured: CapturedRequest[] = [];
    __setMockModels([
      makeMockModel('openai', 'gpt-5.4', secondCaptured, 'pass2-analyst'),
      makeMockModel('anthropic', 'claude-opus-4.7', secondCaptured, 'pass2-strategist'),
      makeMockModel('google', 'gemini-3.1-pro', secondCaptured, 'pass2-skeptic'),
    ]);

    await commandCallback();

    // The rerun confirmation prompt must have been raised (no AGENT-TODOs left).
    assert.ok(
      warnStub.getCalls().some((c) => /No \[AGENT-TODO\]/.test(String(c.args[0]))),
      'rerun must surface the "no placeholders remain" confirmation prompt',
    );

    // CRITICAL: the second-pass prompts must still carry the brief-specific
    // (adr-options pack) Role instructions. Without the marker, Skeptic
    // would silently fall back to the generic "Be contrarian." research
    // default and the council would lose its purpose-pack discipline.
    assert.equal(secondCaptured.length, 3);
    const analystP2 = secondCaptured.find((c) => c.vendor === 'openai');
    assert.ok(analystP2);
    assert.match(
      analystP2!.prompt,
      /Decompose the decision\. List candidate options/,
      'rerun Analyst prompt must still carry the adr-options instruction',
    );
    const strategistP2 = secondCaptured.find((c) => c.vendor === 'anthropic');
    assert.match(
      strategistP2!.prompt,
      /Recommend the option a senior architect/,
      'rerun Strategist prompt must still carry the adr-options instruction',
    );
    const skepticP2 = secondCaptured.find((c) => c.vendor === 'google');
    assert.match(
      skepticP2!.prompt,
      /Argue against the front-runner/,
      'rerun Skeptic prompt must still carry the adr-options instruction (not the generic research default)',
    );
    // And explicitly: the Skeptic prompt must NOT have collapsed to the
    // generic research-pack instruction.
    assert.ok(
      !/Be contrarian\. Identify the strongest argument AGAINST/.test(skepticP2!.prompt),
      'rerun Skeptic prompt must NOT fall back to the generic research-pack default',
    );
  });
});

