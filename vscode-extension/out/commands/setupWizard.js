"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSetupWizard = runSetupWizard;
exports.runStartupCheck = runStartupCheck;
exports.checkCopilotChatConfig = checkCopilotChatConfig;
exports.applyCopilotConfigFixes = applyCopilotConfigFixes;
const vscode = __importStar(require("vscode"));
const dependencyChecker_1 = require("../utils/dependencyChecker");
// -----------------------------------------------------------------------
// Icons used in the quick-pick and webview - ASCII-safe
// -----------------------------------------------------------------------
const ICON_PASS = '$(check)';
const ICON_FAIL = '$(error)';
const ICON_WARN = '$(warning)';
const ICON_INFO = '$(info)';
function severityIcon(r) {
    if (r.found) {
        return ICON_PASS;
    }
    switch (r.severity) {
        case 'required': return ICON_FAIL;
        case 'recommended': return ICON_WARN;
        default: return ICON_INFO;
    }
}
function severityLabel(s) {
    switch (s) {
        case 'required': return 'Required';
        case 'recommended': return 'Recommended';
        default: return 'Optional';
    }
}
// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------
/**
 * Run the full environment check and present an interactive report.
 * Called by the `agentx.checkEnvironment` command and on first activation.
 */
async function runSetupWizard(mode) {
    const report = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AgentX: Checking environment...',
        cancellable: false,
    }, async () => (0, dependencyChecker_1.checkAllDependencies)(mode));
    if (report.healthy && report.warningCount === 0) {
        vscode.window.showInformationMessage('AgentX: Environment is healthy - all dependencies found.');
        return;
    }
    // Show interactive report
    await showEnvironmentReport(report);
}
/**
 * Lightweight startup check - runs silently after activation and only
 * surfaces a notification when critical problems are detected.
 */
async function runStartupCheck(mode) {
    const report = await (0, dependencyChecker_1.checkAllDependencies)(mode);
    if (report.healthy) {
        // Healthy - nothing to do. Log for debugging.
        console.log('AgentX: Environment check passed.');
        return;
    }
    // Build a short summary of critical issues
    const critical = report.results.filter(r => r.severity === 'required' && !r.found);
    const names = critical.map(r => r.name).join(', ');
    const action = await vscode.window.showWarningMessage(`AgentX: Missing required dependencies: ${names}`, 'Run Setup Wizard', 'Dismiss');
    if (action === 'Run Setup Wizard') {
        await showEnvironmentReport(report);
    }
}
// -----------------------------------------------------------------------
// Interactive report (quick-pick based)
// -----------------------------------------------------------------------
async function showEnvironmentReport(report) {
    const items = [];
    // Header
    const statusLine = report.healthy
        ? `${ICON_PASS} Environment healthy`
        : `${ICON_FAIL} ${report.criticalCount} required, ${report.warningCount} recommended issue(s)`;
    items.push({ label: statusLine, kind: vscode.QuickPickItemKind.Separator });
    // Group by severity
    const groups = [
        ['Required', 'required'],
        ['Recommended', 'recommended'],
        ['Optional', 'optional'],
    ];
    for (const [header, sev] of groups) {
        const group = report.results.filter(r => r.severity === sev);
        if (group.length === 0) {
            continue;
        }
        items.push({ label: header, kind: vscode.QuickPickItemKind.Separator });
        for (const dep of group) {
            const icon = severityIcon(dep);
            const status = dep.found ? dep.version || 'OK' : 'MISSING';
            items.push({
                label: `${icon} ${dep.name}`,
                description: status,
                detail: dep.message,
                dep,
            });
        }
    }
    // Footer actions
    items.push({ label: 'Actions', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: '$(tools) Fix All Missing Dependencies',
        description: 'Install missing tools automatically',
        detail: 'Runs install commands for all missing required and recommended dependencies.',
    });
    items.push({
        label: '$(globe) Open Setup Documentation',
        description: 'View SETUP.md for manual instructions',
    });
    items.push({
        label: '$(refresh) Re-check Environment',
        description: 'Run all checks again',
    });
    const pick = await vscode.window.showQuickPick(items, {
        title: 'AgentX - Environment Health Check',
        placeHolder: 'Select a dependency to fix or an action to run',
        matchOnDescription: true,
        matchOnDetail: true,
    });
    if (!pick) {
        return;
    }
    // Handle actions
    if (pick.label.includes('Fix All Missing')) {
        await fixAllMissing(report);
    }
    else if (pick.label.includes('Open Setup Documentation')) {
        const docUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file('.'), 'docs', 'SETUP.md');
        try {
            const doc = await vscode.workspace.openTextDocument(docUri);
            await vscode.window.showTextDocument(doc);
        }
        catch {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/jnPiyush/AgentX/blob/master/docs/SETUP.md'));
        }
    }
    else if (pick.label.includes('Re-check')) {
        await runSetupWizard(vscode.workspace.getConfiguration('agentx').get('mode', 'local'));
    }
    else if (pick.dep) {
        await fixSingleDependency(pick.dep);
    }
}
// -----------------------------------------------------------------------
// Fix actions
// -----------------------------------------------------------------------
/**
 * Fix a single missing dependency - either run a terminal command or open
 * a browser to the download page.
 */
async function fixSingleDependency(dep) {
    if (dep.found) {
        vscode.window.showInformationMessage(`${dep.name} is already installed (${dep.version}).`);
        return;
    }
    // For VS Code extensions, install directly via the API
    if (dep.fixCommand?.startsWith('code --install-extension')) {
        const extId = dep.fixCommand.replace('code --install-extension ', '').trim();
        const action = await vscode.window.showInformationMessage(`Install ${dep.name} extension?`, 'Install', 'Cancel');
        if (action === 'Install') {
            await vscode.commands.executeCommand('workbench.extensions.installExtension', extId);
            vscode.window.showInformationMessage(`${dep.name} installation started. You may need to reload VS Code.`);
        }
        return;
    }
    // For external tools, offer terminal install or browser download
    const choices = [];
    if (dep.fixCommand) {
        choices.push('Install via Terminal');
    }
    if (dep.fixUrl) {
        choices.push('Open Download Page');
    }
    choices.push('Cancel');
    const choice = await vscode.window.showInformationMessage(`${dep.name} is missing. ${dep.message}`, ...choices);
    if (choice === 'Install via Terminal' && dep.fixCommand) {
        const terminal = vscode.window.createTerminal({
            name: `AgentX: Install ${dep.name}`,
            shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
        });
        terminal.show();
        terminal.sendText(dep.fixCommand);
        vscode.window.showInformationMessage(`Installing ${dep.name}... Check the terminal for progress. Re-run the environment check when done.`);
    }
    else if (choice === 'Open Download Page' && dep.fixUrl) {
        vscode.env.openExternal(vscode.Uri.parse(dep.fixUrl));
    }
}
/**
 * Attempt to fix all missing dependencies.
 */
async function fixAllMissing(report) {
    const missing = report.results.filter(r => !r.found && (r.severity === 'required' || r.severity === 'recommended'));
    if (missing.length === 0) {
        vscode.window.showInformationMessage('AgentX: No missing dependencies to fix.');
        return;
    }
    const confirm = await vscode.window.showWarningMessage(`AgentX will attempt to install ${missing.length} missing dependencies: ${missing.map(r => r.name).join(', ')}. Continue?`, 'Install All', 'Cancel');
    if (confirm !== 'Install All') {
        return;
    }
    // Separate VS Code extensions from external tools
    const vsExtensions = missing.filter(r => r.fixCommand?.startsWith('code --install-extension'));
    const externalTools = missing.filter(r => r.fixCommand && !r.fixCommand.startsWith('code --install-extension'));
    // Install VS Code extensions directly
    for (const ext of vsExtensions) {
        const extId = ext.fixCommand.replace('code --install-extension ', '').trim();
        try {
            await vscode.commands.executeCommand('workbench.extensions.installExtension', extId);
            vscode.window.showInformationMessage(`Installed ${ext.name}.`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to install ${ext.name}: ${msg}`);
        }
    }
    // Install external tools via a single terminal
    if (externalTools.length > 0) {
        const terminal = vscode.window.createTerminal({
            name: 'AgentX: Install Dependencies',
            shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
        });
        terminal.show();
        const separator = process.platform === 'win32' ? '; ' : ' && ';
        const commands = externalTools
            .filter(r => r.fixCommand)
            .map(r => `echo "--- Installing ${r.name} ---" ${separator} ${r.fixCommand}`);
        for (const cmd of commands) {
            terminal.sendText(cmd);
        }
        terminal.sendText('echo "--- All installations complete. Please restart your terminal and re-run AgentX environment check. ---"');
        vscode.window.showInformationMessage('Installing dependencies in the terminal. Re-run the environment check after installations complete.');
    }
    // Remind about reload if extensions were installed
    if (vsExtensions.length > 0) {
        const reload = await vscode.window.showInformationMessage('VS Code extensions were installed. Reload window to activate them?', 'Reload Window', 'Later');
        if (reload === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    }
}
// -----------------------------------------------------------------------
// Copilot Chat configuration check
// -----------------------------------------------------------------------
/**
 * Verify that key Copilot Chat settings are configured for AgentX.
 * Returns a list of suggested setting changes.
 */
async function checkCopilotChatConfig() {
    const suggestions = [];
    const config = vscode.workspace.getConfiguration();
    // Check that chat.agent.enabled is true (required for @agentx participant)
    const agentEnabled = config.get('chat.agent.enabled');
    if (agentEnabled === false) {
        suggestions.push('"chat.agent.enabled" is disabled. AgentX requires agent mode in Copilot Chat.');
    }
    // Check GitHub Copilot is not disabled for the workspace
    const copilotEnable = config.get('github.copilot.enable');
    if (copilotEnable && copilotEnable['*'] === false) {
        suggestions.push('"github.copilot.enable" has Copilot disabled for all languages. Enable it for AgentX to work.');
    }
    return suggestions;
}
/**
 * Apply suggested Copilot Chat configuration fixes.
 */
async function applyCopilotConfigFixes(suggestions) {
    if (suggestions.length === 0) {
        return;
    }
    const action = await vscode.window.showWarningMessage(`AgentX detected ${suggestions.length} Copilot configuration issue(s):\n${suggestions.join('\n')}`, 'Auto-Fix Settings', 'Open Settings', 'Dismiss');
    if (action === 'Auto-Fix Settings') {
        const config = vscode.workspace.getConfiguration();
        for (const s of suggestions) {
            if (s.includes('chat.agent.enabled')) {
                await config.update('chat.agent.enabled', true, vscode.ConfigurationTarget.Global);
            }
            if (s.includes('github.copilot.enable')) {
                await config.update('github.copilot.enable', { '*': true }, vscode.ConfigurationTarget.Global);
            }
        }
        vscode.window.showInformationMessage('AgentX: Copilot Chat settings have been updated.');
    }
    else if (action === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'copilot');
    }
}
//# sourceMappingURL=setupWizard.js.map