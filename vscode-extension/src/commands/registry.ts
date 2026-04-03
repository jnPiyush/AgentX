import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { registerInitializeLocalRuntimeCommand } from './initialize';
import { registerAddRemoteAdapterCommand } from './adapters';
import { registerAddLlmAdapterCommand } from './llmAdapters';
import { registerAddPluginCommand } from './plugins';
import { registerStatusCommand } from './status';
import { registerWorkflowCommand } from './workflow';
import { registerDepsCommand } from './deps';
import { registerDigestCommand } from './digest';
import { registerLoopCommand } from './loopCommand';
import { registerAgentNativeReviewCommand } from './agent-native-review';
import { registerAIEvaluationCommands } from './ai-evaluation';
import { registerLearningsCommands } from './learnings';
import { registerParallelDeliveryCommands } from './parallel-delivery';
import { registerReviewFindingCommands } from './review-findings';
import { registerShowIssueCommand } from './showIssue';
import { registerTaskBundleCommands } from './task-bundles';
import { registerPendingClarificationCommand } from './pendingClarification';
import { registerAddAgentCommand } from './addAgent';
import { registerAddSkillCommand } from './addSkill';

export function registerAgentXCommands(
 context: vscode.ExtensionContext,
 agentx: AgentXContext,
): void {
 registerInitializeLocalRuntimeCommand(context, agentx);
 registerAddRemoteAdapterCommand(context, agentx);
 registerAddLlmAdapterCommand(context, agentx);
 registerAddPluginCommand(context, agentx);
 registerStatusCommand(context, agentx);
 registerWorkflowCommand(context, agentx);
 registerDepsCommand(context, agentx);
 registerDigestCommand(context, agentx);
 registerLoopCommand(context, agentx);
 registerAgentNativeReviewCommand(context, agentx);
 registerAIEvaluationCommands(context, agentx);
 registerLearningsCommands(context, agentx);
 registerParallelDeliveryCommands(context, agentx);
 registerReviewFindingCommands(context, agentx);
 registerTaskBundleCommands(context, agentx);
 registerShowIssueCommand(context, agentx);
 registerPendingClarificationCommand(context, agentx);
 registerAddAgentCommand(context, agentx);
 registerAddSkillCommand(context, agentx);
}