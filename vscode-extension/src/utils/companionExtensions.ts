import * as vscode from 'vscode';
import { workspaceUsesAzure } from './azureWorkspaceDetector';

/**
 * Companion extensions that Frontier recommends.
 * Checked on every activation; user is prompted to install if missing.
 */
const AZURE_PRIMARY_EXTENSION_ID = 'ms-azuretools.vscode-azure-mcp-server';
const AZURE_LEGACY_EXTENSION_ID = 'ms-azuretools.vscode-azure-github-copilot';

type AzureCompanionState = 'installed' | 'legacy' | 'recommended' | 'not-needed';

function isInstalled(extensionId: string): boolean {
  return !!vscode.extensions.getExtension(extensionId);
}

export function getAzureCompanionState(workspaceRoot?: string): AzureCompanionState {
  if (isInstalled(AZURE_PRIMARY_EXTENSION_ID)) {
    return 'installed';
  }

  if (isInstalled(AZURE_LEGACY_EXTENSION_ID)) {
    return 'legacy';
  }

  return workspaceUsesAzure(workspaceRoot) ? 'recommended' : 'not-needed';
}

/**
 * Check whether companion extensions are installed.
 * If any are missing, show a one-time prompt offering to install them.
 * The user can dismiss permanently via "Don't Ask Again".
 */
export async function checkCompanionExtensions(workspaceRoot?: string): Promise<void> {
  const state = getAzureCompanionState(workspaceRoot);
  if (state === 'installed' || state === 'not-needed') {
    return;
  }

  const config = vscode.workspace.getConfiguration('agentx');
  const dismissed: string[] = config.get<string[]>('companionDismissed', []);
  if (dismissed.includes(AZURE_PRIMARY_EXTENSION_ID)) {
    return;
  }

  const install = state === 'legacy' ? 'Install Azure MCP' : 'Install';
  const later = 'Later';
  const never = "Don't Ask Again";
  const message = state === 'legacy'
    ? 'Frontier detected the legacy GitHub Copilot for Azure companion. Install the Azure MCP Extension to enable the Azure Skills plugin, Azure MCP Server, and Foundry MCP in the current Azure workspace.'
    : 'Frontier detected Azure usage in this workspace. Install the Azure MCP Extension to enable the Azure Skills plugin, Azure MCP Server, and Foundry MCP for Azure design, deployment, diagnostics, and operations.';

  const choice = await vscode.window.showInformationMessage(
    message,
    install,
    later,
    never,
  );

  if (choice === install) {
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      AZURE_PRIMARY_EXTENSION_ID,
    );
  } else if (choice === never) {
    const updated = [...dismissed, AZURE_PRIMARY_EXTENSION_ID];
    await config.update('companionDismissed', updated, vscode.ConfigurationTarget.Global);
  }
}
