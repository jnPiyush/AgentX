import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { registerInitializeCommand } from './initialize';
import { registerAddPluginCommand } from './plugins';
import { registerStatusCommand } from './status';
import { registerWorkflowCommand } from './workflow';
import { registerDepsCommand } from './deps';
import { registerDigestCommand } from './digest';
import { registerLoopCommand } from './loopCommand';
import { registerAgentNativeReviewCommand } from './agent-native-review';
import { registerLearningsCommands } from './learnings';
import { registerParallelDeliveryCommands } from './parallel-delivery';
import { registerReviewFindingCommands } from './review-findings';
import { registerShowIssueCommand } from './showIssue';
import { registerTaskBundleCommands } from './task-bundles';
import { registerPendingClarificationCommand } from './pendingClarification';

export function registerAgentXCommands(
 context: vscode.ExtensionContext,
 agentx: AgentXContext,
): void {
 registerInitializeCommand(context, agentx);
 registerAddPluginCommand(context, agentx);
 registerStatusCommand(context, agentx);
 registerWorkflowCommand(context, agentx);
 registerDepsCommand(context, agentx);
 registerDigestCommand(context, agentx);
 registerLoopCommand(context, agentx);
 registerAgentNativeReviewCommand(context, agentx);
 registerLearningsCommands(context, agentx);
 registerParallelDeliveryCommands(context, agentx);
 registerReviewFindingCommands(context, agentx);
 registerTaskBundleCommands(context, agentx);
 registerShowIssueCommand(context, agentx);
 registerPendingClarificationCommand(context, agentx);
}