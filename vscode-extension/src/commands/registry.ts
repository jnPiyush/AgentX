import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { registerInitializeLocalRuntimeCommand } from './initialize';
import { registerInitializeCliCommand } from './initializeCli';
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
import { registerRunCouncilCommand } from './runCouncil';
import { registerDashboardCommand } from './dashboard';

export function registerFrontierCommands(
 context: vscode.ExtensionContext,
 agentx: FrontierContext,
): void {
 registerInitializeLocalRuntimeCommand(context, agentx);
 registerInitializeCliCommand(context, agentx);
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
 registerRunCouncilCommand(context, agentx);
 registerDashboardCommand(context, agentx);
}

interface CommandContribution {
 readonly command?: unknown;
}

interface PackageWithCommands {
 readonly contributes?: {
  readonly commands?: readonly CommandContribution[];
 };
}

export function registerLegacyCommandAliases(context: vscode.ExtensionContext): void {
 const packageMetadata = context.extension.packageJSON as PackageWithCommands;
 const commandIds = packageMetadata.contributes?.commands
  ?.map((entry) => entry.command)
  .filter((command): command is string => typeof command === 'string' && command.startsWith('frontier.'))
  ?? [];

 for (const commandId of commandIds) {
  const legacyCommandId = `agentx.${commandId.substring('frontier.'.length)}`;
  context.subscriptions.push(vscode.commands.registerCommand(
   legacyCommandId,
   (...args: unknown[]) => vscode.commands.executeCommand(commandId, ...args),
  ));
 }
}