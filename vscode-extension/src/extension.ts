import * as vscode from 'vscode';
import {
 registerFrontierCommands,
} from './commands/registry';
import {
 createSidebarProviders,
 refreshSidebarProviders,
 registerSidebarProviders,
} from './views/registry';
import { FrontierContext } from './frontierContext';
import { registerChatParticipant } from './chat/chatParticipant';
import { clearInstructionCache } from './chat/agentContextLoader';
import { runSetupWizard } from './commands/setupWizard';
import { registerFrontierMcp } from './runtime/mcpProvider';
import { findBrokenCopilotCliLinks, refreshCopilotCliSymlinks } from './commands/initializeInternals';
import { hasRepositoryState, isPrivateFrontierState } from './utils/frontierPaths';
import { checkCompanionExtensions } from './utils/companionExtensions';
import {
 enableInAgentsWindow,
 maybePromptForAgentsWindow,
} from './utils/agentsWindowOptIn';
import { getQualityStateDisplay } from './utils/loopStateChecker';
import { readHarnessState } from './utils/harnessState';
import { warnIfHostUnsupported } from './utils/hostCapability';

let frontierContext: FrontierContext;

export function activate(context: vscode.ExtensionContext) {
 console.log('Frontier extension activating...');

 // Defence in depth for hosts that bypass the Marketplace engine check: a host
 // older than the agent contribution points ignores every agent and skill
 // silently, so surface it once instead of failing invisibly.
 void warnIfHostUnsupported(context);

 frontierContext = new FrontierContext(context);
 const sidebarProviders = createSidebarProviders(frontierContext);
 const repairOffered = new Set<string>();
 const offerCliLinkRepair = async (): Promise<void> => {
  const root = frontierContext.workspaceRoot;
  if (!root || !vscode.workspace.isTrusted || repairOffered.has(root)) { return; }
  frontierContext.workspaceState.inspect(root);
  if (!hasRepositoryState(root) || isPrivateFrontierState(root)) { return; }
  const installation = { extensionRoot: context.extensionPath, extensionId: context.extension.id };
  const broken = findBrokenCopilotCliLinks(root, installation);
  if (!broken.length) { return; }
  repairOffered.add(root);
  const choice = await vscode.window.showWarningMessage(
   `Frontier CLI links in ${root} target a removed extension version. Repair the managed links?`, 'Repair links');
  if (choice !== 'Repair links') { return; }
  frontierContext.workspaceState.assertAvailable(root);
  frontierContext.workspaceState.inspect(root);
  if (isPrivateFrontierState(root)) { throw new Error('Storage mode changed before CLI link repair.'); }
  const current = findBrokenCopilotCliLinks(root, installation);
  const result = refreshCopilotCliSymlinks(context.extensionPath, root, current);
  if (result.skipped.length) {
   void vscode.window.showWarningMessage(`Frontier CLI link repair is incomplete: ${result.skipped.join(', ')}`);
  } else {
   void vscode.window.showInformationMessage(`Frontier repaired ${result.refreshed.length} managed CLI links.`);
  }
 };
 const checkCliLinks = () => {
  void offerCliLinkRepair().catch(error => {
   const message = error instanceof Error ? error.message : String(error);
   void vscode.window.showWarningMessage(`Frontier CLI link check failed: ${message}`);
  });
 };

 const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
 statusBar.text = '$(hubot) Frontier';
 statusBar.tooltip = 'Frontier - Digital Force for Software Delivery';
 statusBar.command = 'frontier.showStatus';
 statusBar.show();
 context.subscriptions.push(statusBar);

 const updateUiState = async (): Promise<void> => {
  try {
  const initialized = await frontierContext.checkInitialized();
  const root = frontierContext.workspaceRoot;
  const qualityState = root ? getQualityStateDisplay(root) : 'No workspace';
  const harnessState = root ? readHarnessState(root) : undefined;
  const harnessActive = harnessState
   ? harnessState.threads.some((thread) => thread.status === 'active')
   : false;

  statusBar.text = '$(hubot) Frontier';
  statusBar.tooltip = `Frontier - Digital Force for Software Delivery\n${qualityState}`;

  await vscode.commands.executeCommand('setContext', 'frontier.initialized', initialized);
  await vscode.commands.executeCommand('setContext', 'frontier.githubConnected', frontierContext.githubConnected);
  await vscode.commands.executeCommand('setContext', 'frontier.adoConnected', frontierContext.adoConnected);
  await vscode.commands.executeCommand('setContext', 'frontier.harnessActive', harnessActive);
  } catch (error) {
   const message = error instanceof Error ? error.message : String(error);
   statusBar.tooltip = `Frontier workspace state unavailable: ${message}`;
   await vscode.commands.executeCommand('setContext', 'frontier.initialized', false);
   await vscode.commands.executeCommand('setContext', 'frontier.githubConnected', false);
   await vscode.commands.executeCommand('setContext', 'frontier.adoConnected', false);
   await vscode.commands.executeCommand('setContext', 'frontier.harnessActive', false);
   void vscode.window.showErrorMessage(`Frontier workspace state unavailable: ${message}`);
  }
 };

 // Register sidebar tree view providers (VS Code-only value)
 registerSidebarProviders(sidebarProviders);

 // Register commands
 registerFrontierCommands(context, frontierContext);
 registerFrontierMcp(context, frontierContext);

 // Refresh all views
 context.subscriptions.push(
  vscode.commands.registerCommand('frontier.refresh', () => {
   frontierContext.invalidateCache();
   refreshSidebarProviders(sidebarProviders);
   clearInstructionCache();
    void updateUiState();
   vscode.window.showInformationMessage('Frontier: Refreshed all views.');
  })
 );

 // Environment health check
 context.subscriptions.push(
  vscode.commands.registerCommand('frontier.checkEnvironment', () => {
   runSetupWizard(frontierContext);
  })
 );

 // Manual opt-in into the VS Code Agents Window. Power-user command that
 // performs the same idempotent merge as the activation prompt, with no
 // questions asked. See utils/agentsWindowOptIn.ts.
 context.subscriptions.push(
  vscode.commands.registerCommand('frontier.enableInAgentsWindow', async () => {
   try {
    await enableInAgentsWindow();
    const reload = 'Reload Window';
    const later = 'Later';
    const choice = await vscode.window.showInformationMessage(
     'Frontier is now enabled in the Agents Window. Reload the window to apply?',
     reload,
     later,
    );
    if (choice === reload) {
     await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
   } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Frontier: failed to enable in Agents Window: ${message}`);
   }
  }),
 );

 // Register chat participant (Copilot Chat integration -- only when API available)
 if (typeof vscode.chat?.createChatParticipant === 'function') {
  registerChatParticipant(context, frontierContext);
 }

 // Auto-discover Frontier when config or MCP files change
 const configWatcher = vscode.workspace.createFileSystemWatcher('**/.frontier/config.json');
 const mcpWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/mcp.json');
 const privateConfigWatcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(context.globalStorageUri, 'workspaces/*/{config,workspace-binding}.json'));

 // Debounce refreshes. .git/config in particular is touched frequently by
 // VS Code's git extension, gh, and Copilot, which would otherwise trigger
 // a refresh storm (each refresh re-runs `gh issue list`, ~2-5s).
 let refreshTimer: NodeJS.Timeout | undefined;
 let selectedRoot = frontierContext.workspaceRoot;
 const scheduleRefresh = () => {
  if (refreshTimer) { clearTimeout(refreshTimer); }
  refreshTimer = setTimeout(() => {
   refreshTimer = undefined;
   frontierContext.invalidateCache();
   selectedRoot = frontierContext.workspaceRoot;
   clearInstructionCache();
   void updateUiState().then(() => {
    if (frontierContext.workspaceRoot) {
     refreshSidebarProviders(sidebarProviders);
    }
   });
   checkCliLinks();
  }, 500);
 };

 configWatcher.onDidCreate(scheduleRefresh);
 configWatcher.onDidChange(scheduleRefresh);
 configWatcher.onDidDelete(scheduleRefresh);
 mcpWatcher.onDidCreate(scheduleRefresh);
 mcpWatcher.onDidChange(scheduleRefresh);
 mcpWatcher.onDidDelete(scheduleRefresh);
 privateConfigWatcher.onDidCreate(scheduleRefresh);
 privateConfigWatcher.onDidChange(scheduleRefresh);
 privateConfigWatcher.onDidDelete(scheduleRefresh);
 context.subscriptions.push(configWatcher, mcpWatcher, privateConfigWatcher,
  vscode.workspace.onDidGrantWorkspaceTrust(scheduleRefresh),
  vscode.workspace.onDidChangeWorkspaceFolders(scheduleRefresh),
  vscode.window.onDidChangeActiveTextEditor(() => {
   const nextRoot = frontierContext.workspaceRoot;
   if (nextRoot === selectedRoot) { return; }
   selectedRoot = nextRoot;
   scheduleRefresh();
  }),
  { dispose: () => { if (refreshTimer) { clearTimeout(refreshTimer); } } });

 // Check companion extensions are installed (non-blocking)
 checkCompanionExtensions(frontierContext.workspaceRoot).catch(() => { /* ignore */ });

 // One-time prompt: opt every install/upgrade into the VS Code Agents
 // Window. Self-gates on globalState; safe to call on every activation.
 void maybePromptForAgentsWindow(
  context,
  context.extension.packageJSON.version,
 ).catch(() => { /* ignore */ });

 // Set initial context flags
 void updateUiState();
 checkCliLinks();

 console.log('Frontier extension activated.');
}

export function deactivate() {
 console.log('Frontier extension deactivated.');
}
