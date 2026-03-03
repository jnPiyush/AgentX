import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  AgenticLoop,
  FileSessionStorage,
  SessionMessage,
  ToolRegistry,
} from '../agentic';
import { AgentXContext } from '../agentxContext';
import { createVsCodeLmAdapter } from '../chat/vscodeLmAdapter';
import { selectModelForAgent, listAvailableModels } from '../utils/modelSelector';
import { ClarificationRouter } from '../utils/clarificationRouter';
import { AgentEventBus } from '../utils/eventBus';

function readCompactionSummaries(sessionFilePath: string): string[] {
  if (!fs.existsSync(sessionFilePath)) {
    return [];
  }

  const session = JSON.parse(fs.readFileSync(sessionFilePath, 'utf-8')) as {
    messages: Array<{ role: string; content: string }>;
  };

  return session.messages
    .filter((m) => m.role === 'system' && m.content.startsWith('[Session compacted:'))
    .map((m) => m.content);
}

async function runSubagentWithRealLlm(
  chatModel: vscode.LanguageModelChat,
  agentName: string,
  prompt: string,
): Promise<string> {
  const adapter = createVsCodeLmAdapter({ chatModel });
  const abortController = new AbortController();
  const now = new Date().toISOString();

  const messages: SessionMessage[] = [
    {
      role: 'system',
      content: `You are ${agentName}. Respond concisely with guidance only.`,
      timestamp: now,
    },
    {
      role: 'user',
      content: prompt,
      timestamp: now,
    },
  ];

  const response = await adapter.chat(messages, [], abortController.signal);
  return response.text || '(No response from sub-agent model)';
}

export function registerTodoDemoCommand(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.runTodoDemo', async () => {
      const workspaceRoot = agentx.workspaceRoot;
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('AgentX Todo Demo: Open a workspace first.');
        return;
      }

      const output = vscode.window.createOutputChannel('AgentX Todo Demo (Real LLM)');
      output.clear();
      output.show(true);
      output.appendLine('=== AgentX Todo Demo (Real LLM) ===');

      const engineerDef = await agentx.readAgentDef('engineer.agent.md');
      const modelResult = await selectModelForAgent(engineerDef);

      if (!modelResult.chatModel) {
        const available = await listAvailableModels();
        output.appendLine('No Copilot chat model could be selected for engineer agent.');
        output.appendLine('Available models:');
        if (available.length === 0) {
          output.appendLine('- none');
        } else {
          for (const item of available) {
            output.appendLine(`- ${item}`);
          }
        }
        vscode.window.showErrorMessage('AgentX Todo Demo: no chat model available.');
        return;
      }

      output.appendLine(`Model: ${modelResult.modelName || modelResult.chatModel.name}`);
      output.appendLine(`Context window: ${modelResult.maxInputTokens}`);

      const chatModel = modelResult.chatModel;
      const adapter = createVsCodeLmAdapter({ chatModel });
      const issueNumber = Number(String(Date.now()).slice(-6));

      const router = new ClarificationRouter({
        workspaceRoot,
        eventBus: new AgentEventBus(),
        runSubagent: async (agentName, prompt) => {
          return runSubagentWithRealLlm(chatModel, agentName, prompt);
        },
      });

      const storage = new FileSessionStorage(workspaceRoot);
      const registry = new ToolRegistry();
      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          issueNumber,
          systemPrompt:
            'You are running a live AgentX Todo demo. Required workflow:\n'
            + '1) Use file_write to create demo-app/todos.json\n'
            + '2) Use request_clarification to ask architect one schema question\n'
            + '3) Use file_write to update todos.json with architect guidance\n'
            + '4) Use file_read to verify content\n'
            + '5) Final response must include a line starting with DECISION:\n'
            + 'Provide reasoning and be explicit about steps.',
          maxIterations: 14,
          tokenBudget: 700,
          compactKeepRecent: 3,
          autoCompact: true,
          canClarify: ['architect'],
          workspaceRoot,
          onClarificationNeeded: async (topic, question) => {
            return router.requestClarification(
              {
                issueNumber,
                fromAgent: 'engineer',
                toAgent: 'architect',
                topic,
                question,
                blocking: true,
              },
              ['architect'],
            );
          },
        },
        registry,
        storage,
      );

      const abortController = new AbortController();
      output.appendLine('Running loop...');

      const summary = await loop.run(
        'Build a minimal Todo demo and prove the full AgentX flow with real tools and clarification.',
        adapter,
        abortController.signal,
        {
          onIteration: (i, max) => output.appendLine(`[loop] iteration ${i}/${max}`),
          onToolCall: (name) => output.appendLine(`[tool-call] ${name}`),
          onToolResult: (name, result) => output.appendLine(`[tool-result] ${name}: error=${result.isError}`),
          onLoopWarning: (result) => output.appendLine(`[loop-warning] ${result.severity}: ${result.message}`),
        },
      );

      const ledgerPath = path.join(
        workspaceRoot,
        '.agentx',
        'state',
        'clarifications',
        `issue-${issueNumber}.json`,
      );
      const sessionPath = path.join(workspaceRoot, '.agentx', 'sessions', `${summary.sessionId}.json`);
      const todoPath = path.join(workspaceRoot, 'demo-app', 'todos.json');

      const ledgerExists = fs.existsSync(ledgerPath);
      const todoExists = fs.existsSync(todoPath);
      const compactions = readCompactionSummaries(sessionPath);

      let handoffToArchitect = false;
      let clarificationAnswered = false;
      if (ledgerExists) {
        const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8')) as {
          clarifications: Array<{ to: string; status: string }>;
        };
        const first = ledger.clarifications[0];
        handoffToArchitect = first?.to === 'architect';
        clarificationAnswered = first?.status === 'answered' || first?.status === 'resolved';
      }

      output.appendLine('');
      output.appendLine('--- Verification ---');
      output.appendLine(`[check] Agentic loop executed: ${summary.iterations > 1 ? 'PASS' : 'FAIL'}`);
      output.appendLine(`[check] Tool execution exercised: ${summary.toolCallsExecuted > 0 ? 'PASS' : 'FAIL'}`);
      output.appendLine(`[check] Clarification ledger created: ${ledgerExists ? 'PASS' : 'FAIL'}`);
      output.appendLine(`[check] Handoff target architect: ${handoffToArchitect ? 'PASS' : 'FAIL'}`);
      output.appendLine(`[check] Clarification answered/resolved: ${clarificationAnswered ? 'PASS' : 'FAIL'}`);
      output.appendLine(`[check] Compaction occurred: ${compactions.length > 0 ? 'PASS' : 'WARN'}`);
      output.appendLine(`[check] Todo artifact created: ${todoExists ? 'PASS' : 'FAIL'}`);
      output.appendLine('');
      output.appendLine(`Loop exit reason: ${summary.exitReason}`);
      output.appendLine(`Iterations: ${summary.iterations}`);
      output.appendLine(`Tool calls: ${summary.toolCallsExecuted}`);
      output.appendLine(`Session: ${summary.sessionId}`);
      output.appendLine(`Session file: ${sessionPath}`);
      output.appendLine(`Ledger file: ${ledgerPath}`);
      output.appendLine(`Todo file: ${todoPath}`);
      output.appendLine('');

      if (compactions.length > 0) {
        output.appendLine('--- First Compaction Summary ---');
        output.appendLine(compactions[0]);
      }

      if (todoExists) {
        output.appendLine('');
        output.appendLine('--- Todo File ---');
        output.appendLine(fs.readFileSync(todoPath, 'utf-8'));
      }

      vscode.window.showInformationMessage('AgentX Todo Demo (Real LLM) completed. See output channel for details.');
    }),
  );
}
