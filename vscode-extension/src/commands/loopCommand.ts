import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
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
 * Register the Frontier: Iterative Loop commands.
 * Manages Ralph Loop style iterative refinement cycles.
 */
export function registerLoopCommand(
 context: vscode.ExtensionContext,
 agentx: FrontierContext
) {
 const ensureInitialized = async (): Promise<boolean> => ensureLoopInitialized(agentx);

 // Main loop management command
 const loopCmd = vscode.commands.registerCommand('frontier.loop', async () => {
  if (!await ensureInitialized()) {
   return;
  }

  const action = await vscode.window.showQuickPick(
   LOOP_ACTION_ITEMS,
   { placeHolder: 'Select loop action', title: 'Frontier Iterative Loop' }
  );
  if (!action) { return; }

  await executeLoopAction(agentx, action.label);
 });

 const loopStartCmd = vscode.commands.registerCommand('frontier.loopStart', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopStart(agentx);
 });

 const loopStatusCmd = vscode.commands.registerCommand('frontier.loopStatus', async () => {
  if (!await ensureInitialized()) {
  return false;
  }
  return loopStatus(agentx);
 });

 const loopIterateCmd = vscode.commands.registerCommand('frontier.loopIterate', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopIterate(agentx);
 });

 const loopCompleteCmd = vscode.commands.registerCommand('frontier.loopComplete', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopComplete(agentx);
 });

 const loopCancelCmd = vscode.commands.registerCommand('frontier.loopCancel', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopCancel(agentx);
 });

 const loopRollbackCmd = vscode.commands.registerCommand('frontier.loopRollback', async () => {
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
