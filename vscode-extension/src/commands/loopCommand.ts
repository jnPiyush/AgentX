import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  ensureLoopInitialized,
  executeLoopAction,
  LOOP_ACTION_ITEMS,
  loopCancel,
  loopComplete,
  loopIterate,
  loopRollback,
  loopStart,
  loopStatus,
} from './loopCommandInternals';

/**
 * Register the AgentX: Iterative Loop commands.
 * Manages Ralph Loop style iterative refinement cycles.
 */
export function registerLoopCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 const ensureInitialized = async (): Promise<boolean> => ensureLoopInitialized(agentx);

 // Main loop management command
 const loopCmd = vscode.commands.registerCommand('agentx.loop', async () => {
  if (!await ensureInitialized()) {
   return;
  }

  const action = await vscode.window.showQuickPick(
   LOOP_ACTION_ITEMS,
   { placeHolder: 'Select loop action', title: 'AgentX Iterative Loop' }
  );
  if (!action) { return; }

  await executeLoopAction(agentx, action.label);
 });

 const loopStartCmd = vscode.commands.registerCommand('agentx.loopStart', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopStart(agentx);
 });

 const loopStatusCmd = vscode.commands.registerCommand('agentx.loopStatus', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopStatus(agentx);
 });

 const loopIterateCmd = vscode.commands.registerCommand('agentx.loopIterate', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopIterate(agentx);
 });

 const loopCompleteCmd = vscode.commands.registerCommand('agentx.loopComplete', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopComplete(agentx);
 });

 const loopCancelCmd = vscode.commands.registerCommand('agentx.loopCancel', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopCancel(agentx);
 });

 const loopRollbackCmd = vscode.commands.registerCommand('agentx.loopRollback', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopRollback(agentx);
 });

 context.subscriptions.push(
  loopCmd,
  loopStartCmd,
  loopStatusCmd,
  loopIterateCmd,
  loopCompleteCmd,
  loopCancelCmd,
  loopRollbackCmd,
 );
}
