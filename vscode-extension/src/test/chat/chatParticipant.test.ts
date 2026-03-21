import { strict as assert } from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createMockResponseStream } from '../mocks/vscode';
import {
  getAgentXChatFollowups,
  handleAgentXChatRequest,
  resetChatParticipantStateForTests,
} from '../../chat/chatParticipant';

describe('chatParticipant', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-chat-learnings-'));
    fs.mkdirSync(path.join(tmpDir, 'docs', 'artifacts', 'learnings'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'guides'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'artifacts', 'reviews', 'findings'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'artifacts', 'learnings', 'LEARNING-163.md'),
      [
        '---',
        'id: LEARNING-163',
        'title: Use a five-phase knowledge-compounding lifecycle',
        'category: workflow-contract',
        'subcategory: compound-capture',
        'phases: planning,review,capture',
        'validation: approved',
        'evidence: high',
        'mode: shared',
        'keywords: workflow,review,compound,artifacts,planning',
        'sources: docs/artifacts/adr/ADR-163.md,docs/artifacts/specs/SPEC-163.md',
        '---',
        '## Summary',
        'Treat compound capture as a formal post-review phase over existing AgentX artifacts.',
        '',
        '## Guidance',
        '- Resolve capture after review rather than during early implementation.',
        '- Reuse issue, plan, progress, and review artifacts rather than a sidecar tracker.',
        '',
        '## Use When',
        '- Defining planning and review handoff behavior.',
        '',
        '## Avoid',
        '- Creating a second backlog for learnings.',
        '',
      ].join('\n'),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'guides', 'KNOWLEDGE-REVIEW-WORKFLOWS.md'),
      '# Knowledge And Review Workflows\n',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'artifacts', 'reviews', 'findings', 'FINDING-164-001.md'),
      [
        '---',
        'id: FINDING-164-001',
        'title: Promote deferred review gaps',
        'source_review: docs/artifacts/reviews/REVIEW-164.md',
        'source_issue: 164',
        'severity: high',
        'status: Backlog',
        'priority: p1',
        'owner: reviewer',
        'promotion: required',
        'suggested_type: story',
        'labels: type:story,needs:changes',
        'dependencies: #163',
        'evidence: docs/artifacts/reviews/REVIEW-164.md',
        'backlog_issue: ',
        'created: 2026-03-12',
        'updated: 2026-03-12',
        '---',
        '',
        '# Review Finding: Promote deferred review gaps',
        '',
        '## Summary',
        '',
        'Deferred review gaps should become tracked backlog work.',
        '',
        '## Impact',
        '',
        '- Important follow-up can disappear after review.',
        '',
        '## Recommended Action',
        '',
        '- Promote the finding into the normal AgentX backlog.',
        '',
        '## Promotion Notes',
        '',
        '- Required because the gap affects future review quality.',
        '',
      ].join('\n'),
      'utf-8',
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('streams live CLI status lines into chat progress', async () => {
    const progressStream = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      runCliStreaming: async (
        _subcommand: string,
        _cliArgs: string[],
        onLine?: (line: string, source: 'stdout' | 'stderr') => void,
      ) => {
        onLine?.('  [COMPACTION] 8 messages pruned', 'stdout');
        onLine?.('  [CLARIFY 1/6] Asking architect about: auth flow', 'stdout');
        onLine?.('  [CLARIFY DETAIL] Use the existing auth provider and preserve refresh tokens.', 'stdout');
        onLine?.('  [SELF-REVIEW] Approved on iteration 1', 'stdout');
        onLine?.('  [SELF-REVIEW] Approved on iteration 2', 'stdout');
        onLine?.('  [SELF-REVIEW] Approved on iteration 3', 'stdout');
        return '[SELF-REVIEW SUMMARY] Completed 3/3 required review iterations\n[SELF-REVIEW SUMMARY] Iteration 1: APPROVED (0 findings, 0 actionable, minimum not yet met)\n[SELF-REVIEW SUMMARY] Iteration 2: APPROVED (0 findings, 0 actionable, minimum not yet met)\n[SELF-REVIEW SUMMARY] Iteration 3: APPROVED (0 findings, 0 actionable)\n\nFinal answer from AgentX';
      },
      clearPendingClarification: async () => undefined,
    };

    await handleAgentXChatRequest(
      { prompt: 'run engineer implement the login fix' } as any,
      progressStream as any,
      agentx as any,
    );

    const progressCalls = progressStream.calls
      .filter((call) => call.method === 'progress')
      .map((call) => String(call.args[0]));

    assert.ok(progressCalls.some((value) => value.includes('Running engineer agent...')));
    assert.ok(progressCalls.some((value) => value.includes('[COMPACTION]')));
    assert.ok(progressCalls.some((value) => value.includes('[CLARIFY 1/6]')));
    assert.ok(progressCalls.some((value) => value.includes('[CLARIFY DETAIL]')));
    assert.ok(progressCalls.some((value) => value.includes('[SELF-REVIEW] Approved')));
    assert.ok(progressCalls.some((value) => value.includes('iteration 3')));
    assert.ok(progressStream.getMarkdown().includes('Clarification Discussion'));
    assert.ok(progressStream.getMarkdown().includes('Asked architect about auth flow.'));
    assert.ok(progressStream.getMarkdown().includes('Guidance: Use the existing auth provider and preserve refresh tokens.'));
    assert.ok(progressStream.getMarkdown().includes('[SELF-REVIEW SUMMARY] Completed 3/3 required review iterations'));
    assert.ok(progressStream.getMarkdown().includes('Final answer from AgentX'));
  });

  it('shows usage guidance for non-run prompts', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    await handleAgentXChatRequest(
      { prompt: 'help me route this task' } as any,
      response as any,
      agentx as any,
    );

    assert.ok(response.getMarkdown().includes('During execution, live status updates'));
  });

  it('launches Initialize Local Runtime directly from chat', async () => {
    const response = createMockResponseStream();
    const executed: string[] = [];
    const originalExecuteCommand = vscode.commands.executeCommand;
    (vscode.commands as any).executeCommand = async (command: string) => {
      executed.push(command);
      return undefined;
    };

    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    try {
      await handleAgentXChatRequest(
        { prompt: 'initialize local runtime' } as any,
        response as any,
        agentx as any,
      );
    } finally {
      (vscode.commands as any).executeCommand = originalExecuteCommand;
    }

    assert.deepEqual(executed, ['agentx.initializeLocalRuntime']);
    assert.ok(response.getMarkdown().includes('Opened **AgentX: Initialize Local Runtime** for this workspace.'));
  });

  it('launches Add Remote Adapter directly from chat', async () => {
    const response = createMockResponseStream();
    const executed: string[] = [];
    const originalExecuteCommand = vscode.commands.executeCommand;
    (vscode.commands as any).executeCommand = async (command: string) => {
      executed.push(command);
      return undefined;
    };

    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    try {
      await handleAgentXChatRequest(
        { prompt: 'add remote adapter' } as any,
        response as any,
        agentx as any,
      );
    } finally {
      (vscode.commands as any).executeCommand = originalExecuteCommand;
    }

    assert.deepEqual(executed, ['agentx.addRemoteAdapter']);
    assert.ok(response.getMarkdown().includes('Opened **AgentX: Add Remote Adapter** for this workspace.'));
  });

  it('launches Add Plugin directly from chat', async () => {
    const response = createMockResponseStream();
    const executed: string[] = [];
    const originalExecuteCommand = vscode.commands.executeCommand;
    (vscode.commands as any).executeCommand = async (command: string) => {
      executed.push(command);
      return undefined;
    };

    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    try {
      await handleAgentXChatRequest(
        { prompt: 'add plugin' } as any,
        response as any,
        agentx as any,
      );
    } finally {
      (vscode.commands as any).executeCommand = originalExecuteCommand;
    }

    assert.deepEqual(executed, ['agentx.addPlugin']);
    assert.ok(response.getMarkdown().includes('Opened **AgentX: Add Plugin** for this workspace.'));
  });

  it('explains that formal AgentX execution needs workspace initialization', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      hasCliRuntime: () => false,
      workspaceRoot: tmpDir,
    };

    await handleAgentXChatRequest(
      { prompt: 'run engineer implement the login fix' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('AgentX workspace initialization is not available in this workspace.'));
    assert.ok(markdown.includes('AgentX: Initialize Local Runtime'));
  });

  it('returns ranked planning learnings from chat', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    await handleAgentXChatRequest(
      { prompt: 'learnings planning workflow review' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('Planning Learnings'));
    assert.ok(markdown.includes('Use a five-phase knowledge-compounding lifecycle'));
    assert.ok(markdown.includes('Resolve capture after review'));
  });

  it('returns knowledge capture guidance from chat', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    await handleAgentXChatRequest(
      { prompt: 'capture guidance' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('Knowledge Capture Guidance'));
    assert.ok(markdown.includes('docs/artifacts/learnings/LEARNING-<issue>.md'));
  });

  it('returns brainstorm guidance from chat', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    await handleAgentXChatRequest(
      { prompt: 'brainstorm workflow capture loop' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('Brainstorm'));
    assert.ok(markdown.includes('Top planning learnings'));
  });

  it('returns workflow next-step guidance from chat', async () => {
    fs.mkdirSync(path.join(tmpDir, '.agentx', 'issues'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.agentx', 'state'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'execution', 'plans'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'execution', 'progress'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'artifacts', 'specs'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.agentx', 'issues', '219.json'), JSON.stringify({ number: 219, title: 'Create rollout scorecard', state: 'open', status: 'In Progress' }), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.agentx', 'state', 'harness-state.json'), JSON.stringify({ version: 1, threads: [{ id: 'thread-1', title: 'Create rollout scorecard', taskType: 'story', status: 'active', issueNumber: 219, planPath: 'docs/execution/plans/ROLLOUT-SCORECARD-IMPLEMENTATION-PLAN.md', startedAt: '2026-03-13T10:00:00Z', updatedAt: '2026-03-13T10:05:00Z' }], turns: [], items: [], evidence: [] }), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.agentx', 'state', 'loop-state.json'), JSON.stringify({ active: false, status: 'complete', prompt: 'Done', iteration: 3, minIterations: 3, maxIterations: 10, completionCriteria: 'TASK_COMPLETE', startedAt: '2026-03-13T10:00:00Z', lastIterationAt: '2026-03-13T10:05:00Z', history: [] }), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'execution', 'plans', 'ROLLOUT-SCORECARD-IMPLEMENTATION-PLAN.md'), '# Plan', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'execution', 'progress', 'ROLLOUT-SCORECARD-IMPLEMENTATION-PROGRESS.md'), '# Progress', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'guides', 'WORKFLOW-ROLLOUT-SCORECARD.md'), '# Scorecard', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'guides', 'WORKFLOW-PILOT-ORDER.md'), '# Pilot', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'guides', 'WORKFLOW-OPERATOR-CHECKLIST.md'), '# Checklist', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'artifacts', 'specs', 'SPEC-218.md'), '# Spec', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'artifacts', 'specs', 'SPEC-219.md'), '# Spec', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'artifacts', 'specs', 'SPEC-220.md'), '# Spec', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'artifacts', 'specs', 'SPEC-221.md'), '# Spec', 'utf-8');

    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    await handleAgentXChatRequest(
      { prompt: 'workflow next step' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('Workflow Guidance'));
    assert.ok(markdown.includes('Current checkpoint'));
  });

  it('returns review kickoff context from chat', async () => {
    fs.mkdirSync(path.join(tmpDir, '.agentx', 'issues'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.agentx', 'state'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'execution', 'plans'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'execution', 'progress'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.agentx', 'issues', '219.json'), JSON.stringify({ number: 219, title: 'Create rollout scorecard', state: 'open', status: 'In Progress' }), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.agentx', 'state', 'harness-state.json'), JSON.stringify({ version: 1, threads: [{ id: 'thread-1', title: 'Create rollout scorecard', taskType: 'story', status: 'active', issueNumber: 219, planPath: 'docs/execution/plans/ROLLOUT-SCORECARD-IMPLEMENTATION-PLAN.md', startedAt: '2026-03-13T10:00:00Z', updatedAt: '2026-03-13T10:05:00Z' }], turns: [], items: [], evidence: [] }), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.agentx', 'state', 'loop-state.json'), JSON.stringify({ active: false, status: 'complete', prompt: 'Done', iteration: 3, minIterations: 3, maxIterations: 10, completionCriteria: 'TASK_COMPLETE', startedAt: '2026-03-13T10:00:00Z', lastIterationAt: '2026-03-13T10:05:00Z', history: [] }), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'execution', 'plans', 'ROLLOUT-SCORECARD-IMPLEMENTATION-PLAN.md'), '# Plan', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'execution', 'progress', 'ROLLOUT-SCORECARD-IMPLEMENTATION-PROGRESS.md'), '# Progress', 'utf-8');

    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    await handleAgentXChatRequest(
      { prompt: 'kick off review' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('Kick Off Review'));
    assert.ok(markdown.includes('Context Package'));
  });

  it('returns compound loop guidance from chat', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    await handleAgentXChatRequest(
      { prompt: 'compound' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('Compound Loop'));
    assert.ok(markdown.includes('Promotable findings'));
  });

  it('returns agent-native review output from chat', async () => {
    fs.writeFileSync(path.join(tmpDir, 'docs', 'guides', 'KNOWLEDGE-REVIEW-WORKFLOWS.md'), '# Knowledge And Review Workflows\n', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, '.github', 'templates'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.github', 'templates', 'REVIEW-TEMPLATE.md'), '# Review\n', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, 'vscode-extension', 'src', 'views'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'vscode-extension', 'src', 'chat'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'vscode-extension', 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'vscode-extension', 'package.json'), JSON.stringify({ contributes: { commands: [{ command: 'agentx.runWorkflow' }, { command: 'agentx.showReviewLearnings' }, { command: 'agentx.showKnowledgeCaptureGuidance' }] } }), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'vscode-extension', 'src', 'views', 'workTreeProvider.ts'), 'Show workflow steps\nagentx.runWorkflow\nReview learnings\nagentx.showReviewLearnings\nCapture guidance\nagentx.showKnowledgeCaptureGuidance\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'vscode-extension', 'src', 'views', 'qualityTreeProvider.ts'), 'agentx.showAgentNativeReview\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'vscode-extension', 'src', 'chat', 'chatParticipant.ts'), 'run engineer\nrun reviewer\nrun architect\nlearnings review\nshowReviewLearnings\ncapture guidance\nshowKnowledgeCaptureGuidance\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'vscode-extension', 'src', 'agentxContext.ts'), 'workspaceRoot\ngetPendingClarification\nlistExecutionPlanFiles\ngetStatePath\n', 'utf-8');

    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    await handleAgentXChatRequest(
      { prompt: 'agent-native review' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('Agent-Native Review'));
    assert.ok(markdown.includes('advisory-first'));
  });

  it('returns durable review findings from chat', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
    };

    await handleAgentXChatRequest(
      { prompt: 'review findings' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('Review Findings'));
    assert.ok(markdown.includes('FINDING-164-001'));
  });

  it('promotes a finding from chat through the AgentX issue flow', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      workspaceRoot: tmpDir,
      runCli: async () => 'Created issue #88: Resolve review finding',
    };

    await handleAgentXChatRequest(
      { prompt: 'promote finding FINDING-164-001' } as any,
      response as any,
      agentx as any,
    );

    assert.ok(response.getMarkdown().includes('Promoted FINDING-164-001 as issue #88.'));
  });

  it('stores pending clarification and shows continue guidance when human input is required', async () => {
    const response = createMockResponseStream();
    let pending: unknown;
    const agentx = {
      checkInitialized: async () => true,
      runCliStreaming: async (
        _subcommand: string,
        _cliArgs: string[],
        onLine?: (line: string, source: 'stdout' | 'stderr') => void,
      ) => {
        onLine?.('  [HUMAN ESCALATION] Clarification not resolved after 6 iterations.', 'stdout');
        onLine?.('  [HUMAN REQUIRED SESSION] engineer-20260309120000-abcd', 'stdout');
        return 'Need your guidance on auth rollout.';
      },
      setPendingClarification: async (value: unknown) => { pending = value; },
      clearPendingClarification: async () => undefined,
    };

    await handleAgentXChatRequest(
      { prompt: 'run engineer implement the login fix' } as any,
      response as any,
      agentx as any,
    );

    assert.deepEqual(pending, {
      sessionId: 'engineer-20260309120000-abcd',
      agentName: 'engineer',
      prompt: 'implement the login fix',
      humanPrompt: 'Need your guidance on auth rollout.',
    });
    assert.ok(response.getMarkdown().includes('Clarification Discussion'));
    assert.ok(response.getMarkdown().includes('Escalated for human input: Clarification not resolved after 6 iterations.'));
    assert.ok(response.getMarkdown().includes('@agentx continue'));
  });

  it('summarizes large output in chat and writes the full transcript to the output channel', async () => {
    const response = createMockResponseStream();
    const largeOutput = [
      ...Array.from({ length: 34 }, (_, index) => `line ${index + 1} ${'x'.repeat(120)}`),
      '[EXECUTION SUMMARY] Notable runtime events (3)',
      '[EXECUTION SUMMARY] COMPACTION: 8 messages pruned to stay within the token threshold.',
      '[EXECUTION SUMMARY] HUMAN RESPONSE: Use the existing auth flow.',
      '[SELF-REVIEW SUMMARY] Completed 3/3 required review iterations',
      '[SELF-REVIEW SUMMARY] Iteration 1: APPROVED (0 findings, 0 actionable, minimum not yet met)',
      '[SELF-REVIEW SUMMARY] Iteration 2: APPROVED (0 findings, 0 actionable, minimum not yet met)',
      '[SELF-REVIEW SUMMARY] Iteration 3: APPROVED (0 findings, 0 actionable)',
      'Final answer from AgentX',
    ].join('\n');
    const written: string[] = [];
    const originalCreateOutputChannel = vscode.window.createOutputChannel;
    resetChatParticipantStateForTests();
    (vscode.window as any).createOutputChannel = () => ({
      appendLine: (value: string) => { written.push(value); },
      append: (value: string) => { written.push(value); },
      clear: () => { written.length = 0; },
      show: () => undefined,
      hide: () => undefined,
      dispose: () => undefined,
    });

    const agentx = {
      checkInitialized: async () => true,
      runCliStreaming: async () => largeOutput,
      clearPendingClarification: async () => undefined,
    };

    try {
      await handleAgentXChatRequest(
        { prompt: 'run engineer generate a large report' } as any,
        response as any,
        agentx as any,
      );
    } finally {
      (vscode.window as any).createOutputChannel = originalCreateOutputChannel;
    }

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('Large output detected'));
    assert.ok(markdown.includes('Full output was written to the **AgentX Chat** output channel'));
    assert.ok(markdown.includes('Execution summary:'));
    assert.ok(markdown.includes('[EXECUTION SUMMARY] COMPACTION: 8 messages pruned to stay within the token threshold.'));
    assert.ok(markdown.includes('Self-review summary:'));
    assert.ok(markdown.includes('[SELF-REVIEW SUMMARY] Completed 3/3 required review iterations'));
    assert.ok(/\.\.\. \(\d+ lines omitted\) \.\.\./.test(markdown));
    assert.ok(!markdown.includes(largeOutput));
    assert.ok(written.some((value) => value.includes('AgentX Chat Run: engineer')));
    assert.ok(written.some((value) => value.includes('line 1')));
    assert.ok(written.some((value) => value.includes('Final answer from AgentX')));
  });

  it('resumes a pending clarification with continue', async () => {
    const response = createMockResponseStream();
    let cleared = false;
    let capturedArgs: string[] = [];
    const agentx = {
      checkInitialized: async () => true,
      getPendingClarification: async () => ({
        sessionId: 'engineer-20260309120000-abcd',
        agentName: 'engineer',
        prompt: 'implement the login fix',
      }),
      runCliStreaming: async (
        _subcommand: string,
        cliArgs: string[],
      ) => {
        capturedArgs = cliArgs;
        return 'Final answer after human clarification';
      },
      setPendingClarification: async () => undefined,
      clearPendingClarification: async () => { cleared = true; },
    };

    await handleAgentXChatRequest(
      { prompt: 'continue use the existing auth flow' } as any,
      response as any,
      agentx as any,
    );

    assert.deepEqual(capturedArgs, [
      '--resume-session', 'engineer-20260309120000-abcd',
      '--clarification-response', 'use the existing auth flow',
    ]);
    assert.equal(cleared, true);
    assert.ok(response.getMarkdown().includes('Final answer after human clarification'));
  });

  it('keeps clarification discussion visible in markdown after resume', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      getPendingClarification: async () => ({
        sessionId: 'engineer-20260309120000-abcd',
        agentName: 'engineer',
        prompt: 'implement the login fix',
      }),
      runCliStreaming: async (
        _subcommand: string,
        _cliArgs: string[],
        onLine?: (line: string, source: 'stdout' | 'stderr') => void,
      ) => {
        onLine?.('  [CLARIFY 2/6] Asking architect about: token semantics', 'stdout');
        onLine?.('  [CLARIFY DETAIL] Keep refresh tokens unchanged.', 'stdout');
        onLine?.('  [HUMAN RESPONSE] Use the existing auth flow.', 'stdout');
        return 'Final answer after human clarification';
      },
      setPendingClarification: async () => undefined,
      clearPendingClarification: async () => undefined,
    };

    await handleAgentXChatRequest(
      { prompt: 'continue use the existing auth flow' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('Clarification Discussion'));
    assert.ok(markdown.includes('Asked architect about token semantics.'));
    assert.ok(markdown.includes('Guidance: Keep refresh tokens unchanged.'));
    assert.ok(markdown.includes('Human response: Use the existing auth flow.'));
    assert.ok(markdown.includes('Final answer after human clarification'));
  });

  it('blocks clarification resume when workspace initialization is missing', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      hasCliRuntime: () => false,
      getPendingClarification: async () => ({
        sessionId: 'engineer-20260309120000-abcd',
        agentName: 'engineer',
        prompt: 'implement the login fix',
      }),
    };

    await handleAgentXChatRequest(
      { prompt: 'continue use the existing auth flow' } as any,
      response as any,
      agentx as any,
    );

    const markdown = response.getMarkdown();
    assert.ok(markdown.includes('AgentX workspace initialization is not available in this workspace.'));
    assert.ok(markdown.includes('AgentX: Initialize Local Runtime'));
  });

  it('shows pending clarification context for bare continue', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      getPendingClarification: async () => ({
        sessionId: 'engineer-20260309120000-abcd',
        agentName: 'engineer',
        prompt: 'implement the login fix',
        humanPrompt: 'Need your guidance on auth rollout.',
      }),
    };

    await handleAgentXChatRequest(
      { prompt: 'continue' } as any,
      response as any,
      agentx as any,
    );

    assert.ok(response.getMarkdown().includes('Pending clarification for engineer'));
    assert.ok(response.getMarkdown().includes('Need your guidance on auth rollout.'));
  });

  it('uses plain-language replies as clarification responses when one is pending', async () => {
    const response = createMockResponseStream();
    let capturedArgs: string[] = [];
    const agentx = {
      checkInitialized: async () => true,
      getPendingClarification: async () => ({
        sessionId: 'engineer-20260309120000-abcd',
        agentName: 'engineer',
        prompt: 'implement the login fix',
      }),
      runCliStreaming: async (
        _subcommand: string,
        cliArgs: string[],
      ) => {
        capturedArgs = cliArgs;
        return 'Resumed with natural-language clarification';
      },
      setPendingClarification: async () => undefined,
      clearPendingClarification: async () => undefined,
    };

    await handleAgentXChatRequest(
      { prompt: 'Use the existing auth flow and do not change token semantics.' } as any,
      response as any,
      agentx as any,
    );

    assert.deepEqual(capturedArgs, [
      '--resume-session', 'engineer-20260309120000-abcd',
      '--clarification-response', 'Use the existing auth flow and do not change token semantics.',
    ]);
    assert.ok(response.getMarkdown().includes('Resumed with natural-language clarification'));
  });

  it('returns follow-up suggestions when clarification is pending', async () => {
    const agentx = {
      getPendingClarification: async () => ({
        sessionId: 'engineer-20260309120000-abcd',
        agentName: 'engineer',
        prompt: 'implement the login fix',
      }),
    };

    const followups = await getAgentXChatFollowups(agentx as any);
    assert.equal(followups.length, 2);
    assert.equal(followups[0].prompt, 'continue');
    assert.ok(followups[0].label?.includes('engineer'));
    assert.equal(followups[1].prompt, 'clarification status');
  });
});