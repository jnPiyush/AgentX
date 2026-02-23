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
const assert_1 = require("assert");
const sinon = __importStar(require("sinon"));
// The register.ts hook rewrites require('vscode') to our mock.
// Import mock for stubbing:
const vscode = __importStar(require("vscode"));
// Module under test:
const setupWizard_1 = require("../../commands/setupWizard");
// We need to stub checkAllDependencies at the module level
const depChecker = __importStar(require("../../utils/dependencyChecker"));
// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------
/** Build a healthy EnvironmentReport (all found). */
function makeHealthyReport() {
    return {
        results: [
            { name: 'Git', found: true, version: '2.43.0', severity: 'required', message: 'Git 2.43.0 detected.' },
            { name: 'PowerShell', found: true, version: '7.4.1', severity: 'required', message: 'PowerShell 7.4.1 detected.' },
            { name: 'Node.js', found: true, version: '20.11.0', severity: 'required', message: 'Node.js 20.11.0 detected.' },
            { name: 'GitHub Copilot', found: true, version: 'installed', severity: 'required', message: 'GitHub Copilot is installed.' },
            { name: 'GitHub Copilot Chat', found: true, version: 'installed', severity: 'required', message: 'GitHub Copilot Chat is installed.' },
            { name: 'GitHub CLI (gh)', found: false, version: '', severity: 'optional', message: 'GitHub CLI not installed.' },
        ],
        healthy: true,
        criticalCount: 0,
        warningCount: 0,
        timestamp: new Date().toISOString(),
    };
}
/** Build a report with specific missing required deps. */
function makeUnhealthyReport(missingNames) {
    const allDeps = [
        { name: 'Git', found: true, version: '2.43.0', severity: 'required', message: 'Git 2.43.0 detected.', fixCommand: 'winget install Git.Git', fixUrl: 'https://git-scm.com/downloads' },
        { name: 'PowerShell', found: true, version: '7.4.1', severity: 'required', message: 'PowerShell 7.4.1 detected.', fixCommand: 'winget install Microsoft.PowerShell', fixUrl: 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell' },
        { name: 'Node.js', found: true, version: '20.11.0', severity: 'required', message: 'Node.js 20.11.0 detected.', fixCommand: 'winget install OpenJS.NodeJS.LTS', fixUrl: 'https://nodejs.org/' },
        { name: 'GitHub Copilot', found: true, version: 'installed', severity: 'required', message: 'GitHub Copilot is installed.', fixCommand: 'code --install-extension github.copilot' },
        { name: 'GitHub Copilot Chat', found: true, version: 'installed', severity: 'required', message: 'GitHub Copilot Chat is installed.', fixCommand: 'code --install-extension github.copilot-chat' },
        { name: 'GitHub CLI (gh)', found: true, version: '2.40.0', severity: 'optional', message: 'GitHub CLI 2.40.0 detected.', fixCommand: 'winget install GitHub.cli' },
    ];
    // Mark the requested deps as missing
    const results = allDeps.map(d => {
        if (missingNames.includes(d.name)) {
            return { ...d, found: false, version: '', message: `${d.name} is not installed.` };
        }
        return d;
    });
    const criticalCount = results.filter(r => r.severity === 'required' && !r.found).length;
    return {
        results,
        healthy: criticalCount === 0,
        criticalCount,
        warningCount: 0,
        timestamp: new Date().toISOString(),
    };
}
// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------
describe('setupWizard - runCriticalPreCheck', () => {
    let checkAllStub;
    let showWarningStub;
    let showInfoStub;
    let showErrorStub;
    let execCommandStub;
    let createTerminalStub;
    beforeEach(() => {
        checkAllStub = sinon.stub(depChecker, 'checkAllDependencies');
        showWarningStub = sinon.stub(vscode.window, 'showWarningMessage');
        showInfoStub = sinon.stub(vscode.window, 'showInformationMessage');
        showErrorStub = sinon.stub(vscode.window, 'showErrorMessage');
        execCommandStub = sinon.stub(vscode.commands, 'executeCommand');
        createTerminalStub = sinon.stub(vscode.window, 'createTerminal');
    });
    afterEach(() => {
        sinon.restore();
    });
    // ---------------------------------------------------------------
    // Scenario 1: All deps present -> passed = true, no prompts
    // ---------------------------------------------------------------
    it('should return passed=true when all required deps are found', async () => {
        checkAllStub.resolves(makeHealthyReport());
        const result = await (0, setupWizard_1.runCriticalPreCheck)('local');
        assert_1.strict.strictEqual(result.passed, true);
        assert_1.strict.strictEqual(result.report.healthy, true);
        // No warning messages should have been shown
        sinon.assert.notCalled(showWarningStub);
    });
    // ---------------------------------------------------------------
    // Scenario 2: Missing VS Code extensions -> user picks Install All
    //   -> installs via commands API -> offers reload
    // ---------------------------------------------------------------
    it('should install missing VS Code extensions when user picks Install All', async () => {
        const report = makeUnhealthyReport(['GitHub Copilot', 'GitHub Copilot Chat']);
        checkAllStub.resolves(report);
        // User picks "Install All" on the modal
        showWarningStub.resolves('Install All');
        // Install commands succeed
        execCommandStub.resolves(undefined);
        // User picks "Later" on the reload prompt, then "Skip" on re-check
        showInfoStub
            .onFirstCall().resolves(undefined) // "Installed X" info
            .onSecondCall().resolves(undefined) // "Installed Y" info
            .onThirdCall().resolves('Later') // reload prompt
            .onCall(3).resolves('Skip'); // re-check prompt
        const result = await (0, setupWizard_1.runCriticalPreCheck)('local', true);
        // Should have called executeCommand to install both extensions
        const installCalls = execCommandStub.getCalls().filter(c => c.args[0] === 'workbench.extensions.installExtension');
        assert_1.strict.strictEqual(installCalls.length, 2);
        assert_1.strict.ok(installCalls.some(c => c.args[1] === 'github.copilot'));
        assert_1.strict.ok(installCalls.some(c => c.args[1] === 'github.copilot-chat'));
        // Result is passed=false because user didn't re-check
        assert_1.strict.strictEqual(result.passed, false);
    });
    // ---------------------------------------------------------------
    // Scenario 3: Missing CLI tool -> user picks Install All
    //   -> opens terminal, polls until tool available -> passed=true
    // ---------------------------------------------------------------
    it('should open a terminal for missing external CLI tools and poll for install', async () => {
        const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
        try {
            const unhealthyReport = makeUnhealthyReport(['Git']);
            const healthyReport = makeHealthyReport();
            // First call: unhealthy; second call (poll check): healthy
            checkAllStub.onFirstCall().resolves(unhealthyReport);
            checkAllStub.onSecondCall().resolves(healthyReport);
            checkAllStub.resolves(healthyReport);
            // User picks "Install All"
            showWarningStub.resolves('Install All');
            // Mock terminal
            const terminalSendTextSpy = sinon.spy();
            createTerminalStub.returns({
                show: sinon.spy(),
                sendText: terminalSendTextSpy,
                dispose: sinon.spy(),
            });
            showInfoStub.resolves(undefined);
            // Start the operation (don't await yet - polling will block on setTimeout)
            const resultPromise = (0, setupWizard_1.runCriticalPreCheck)('local', true);
            // Advance timer to trigger the first poll interval (5s)
            await clock.tickAsync(5_000);
            const result = await resultPromise;
            // Should have created a terminal
            sinon.assert.calledOnce(createTerminalStub);
            // Should have sent install command text to the terminal
            assert_1.strict.ok(terminalSendTextSpy.getCalls().some((c) => String(c.args[0]).includes('Installing Git')), 'terminal should receive Git install command');
            // Polling detected the tool is now available -> passed
            assert_1.strict.strictEqual(result.passed, true);
        }
        finally {
            clock.restore();
        }
    });
    // ---------------------------------------------------------------
    // Scenario 4: Missing deps -> user picks Install All -> re-check
    //   passes -> returned passed=true
    // ---------------------------------------------------------------
    it('should return passed=true after successful re-check', async () => {
        const unhealthy = makeUnhealthyReport(['GitHub Copilot']);
        const healthy = makeHealthyReport();
        // First call: unhealthy. Second call (re-check): healthy.
        checkAllStub.onFirstCall().resolves(unhealthy);
        checkAllStub.onSecondCall().resolves(healthy);
        // User picks "Install All"
        showWarningStub.resolves('Install All');
        execCommandStub.resolves(undefined);
        // Info messages: "Installed...", reload "Later", re-check "Re-check Now"
        showInfoStub
            .onFirstCall().resolves(undefined) // installed info
            .onSecondCall().resolves('Later') // reload prompt
            .onCall(2).resolves('Re-check Now') // offer re-check
            .onCall(3).resolves(undefined); // "all present" info
        const result = await (0, setupWizard_1.runCriticalPreCheck)('local', true);
        assert_1.strict.strictEqual(result.passed, true);
        assert_1.strict.strictEqual(result.report.healthy, true);
    });
    // ---------------------------------------------------------------
    // Scenario 5: Missing deps -> user picks "Open Setup Docs"
    //   -> returns passed=false
    // ---------------------------------------------------------------
    it('should return passed=false when user picks Open Setup Docs', async () => {
        const report = makeUnhealthyReport(['Git']);
        checkAllStub.resolves(report);
        showWarningStub.resolves('Open Setup Docs');
        const result = await (0, setupWizard_1.runCriticalPreCheck)('local', true);
        assert_1.strict.strictEqual(result.passed, false);
    });
    // ---------------------------------------------------------------
    // Scenario 6: Missing deps -> user dismisses the dialog
    //   -> returns passed=false
    // ---------------------------------------------------------------
    it('should return passed=false when user dismisses the dialog', async () => {
        const report = makeUnhealthyReport(['Git', 'GitHub Copilot']);
        checkAllStub.resolves(report);
        // User dismisses (undefined return)
        showWarningStub.resolves(undefined);
        const result = await (0, setupWizard_1.runCriticalPreCheck)('local', true);
        assert_1.strict.strictEqual(result.passed, false);
    });
    // ---------------------------------------------------------------
    // Scenario 7: Non-blocking mode uses non-modal warning
    // ---------------------------------------------------------------
    it('should use non-modal warning in non-blocking mode', async () => {
        const report = makeUnhealthyReport(['Git']);
        checkAllStub.resolves(report);
        showWarningStub.resolves('Dismiss');
        const result = await (0, setupWizard_1.runCriticalPreCheck)('local', false);
        assert_1.strict.strictEqual(result.passed, false);
        // The non-blocking call should NOT use modal option
        const call = showWarningStub.getCall(0);
        // In non-blocking mode the second arg is a string button (not options object)
        assert_1.strict.ok(typeof call.args[1] === 'string', 'non-blocking mode should not pass modal options object');
    });
    // ---------------------------------------------------------------
    // Scenario 8: Blocking mode uses modal dialog with detail
    // ---------------------------------------------------------------
    it('should use modal dialog in blocking mode', async () => {
        const report = makeUnhealthyReport(['Git']);
        checkAllStub.resolves(report);
        showWarningStub.resolves(undefined);
        await (0, setupWizard_1.runCriticalPreCheck)('local', true);
        const call = showWarningStub.getCall(0);
        // In blocking mode the second arg should be the modal options object
        assert_1.strict.ok(typeof call.args[1] === 'object' && call.args[1].modal === true, 'blocking mode should pass { modal: true } options');
    });
    // ---------------------------------------------------------------
    // Scenario 9: Mixed missing (extensions + CLI) -> installs both
    //  Extensions via API, CLI via terminal + polling
    // ---------------------------------------------------------------
    it('should handle mixed missing deps (extensions + CLI tools)', async () => {
        const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
        try {
            const unhealthyReport = makeUnhealthyReport(['Git', 'GitHub Copilot']);
            // After polling, external tools are found but extension still needs reload
            const extMissingReport = makeUnhealthyReport(['GitHub Copilot']);
            checkAllStub.onFirstCall().resolves(unhealthyReport);
            // Polling check: Git now found but Copilot still needs reload
            checkAllStub.onSecondCall().resolves(extMissingReport);
            checkAllStub.resolves(extMissingReport);
            showWarningStub.resolves('Install All');
            execCommandStub.resolves(undefined);
            const terminalSendTextSpy = sinon.spy();
            createTerminalStub.returns({
                show: sinon.spy(),
                sendText: terminalSendTextSpy,
                dispose: sinon.spy(),
            });
            // Info messages: "Installed Copilot", reload "Later", re-check "Skip"
            showInfoStub.resolves('Skip');
            const resultPromise = (0, setupWizard_1.runCriticalPreCheck)('local', true);
            // Advance timer for the polling interval
            await clock.tickAsync(5_000);
            const result = await resultPromise;
            // VS Code extension installed via API
            const installCalls = execCommandStub.getCalls().filter(c => c.args[0] === 'workbench.extensions.installExtension');
            assert_1.strict.strictEqual(installCalls.length, 1);
            assert_1.strict.strictEqual(installCalls[0].args[1], 'github.copilot');
            // CLI tool installed via terminal
            sinon.assert.calledOnce(createTerminalStub);
            assert_1.strict.ok(terminalSendTextSpy.getCalls().some((c) => String(c.args[0]).includes('Installing Git')));
        }
        finally {
            clock.restore();
        }
    });
    // ---------------------------------------------------------------
    // Scenario 9b: GitHub mode - missing gh CLI -> polls successfully
    // ---------------------------------------------------------------
    it('should poll for gh CLI in github mode and return passed=true', async () => {
        const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
        try {
            // In github mode, GitHub CLI becomes required
            const unhealthyReport = makeUnhealthyReport(['GitHub CLI (gh)']);
            unhealthyReport.results = unhealthyReport.results.map(r => {
                if (r.name === 'GitHub CLI (gh)') {
                    r.severity = 'required';
                }
                return r;
            });
            unhealthyReport.healthy = false;
            unhealthyReport.criticalCount = 1;
            const healthyReport = makeHealthyReport();
            // First call: unhealthy; second call (poll): healthy
            checkAllStub.onFirstCall().resolves(unhealthyReport);
            checkAllStub.onSecondCall().resolves(healthyReport);
            checkAllStub.resolves(healthyReport);
            showWarningStub.resolves('Install All');
            const terminalSendTextSpy = sinon.spy();
            createTerminalStub.returns({
                show: sinon.spy(),
                sendText: terminalSendTextSpy,
                dispose: sinon.spy(),
            });
            showInfoStub.resolves(undefined);
            const resultPromise = (0, setupWizard_1.runCriticalPreCheck)('github', true);
            // Advance timer for the polling interval
            await clock.tickAsync(5_000);
            const result = await resultPromise;
            // Terminal should have received gh install command
            assert_1.strict.ok(terminalSendTextSpy.getCalls().some((c) => String(c.args[0]).includes('GitHub.cli')), 'terminal should receive gh install command');
            // Should pass after polling detects gh is installed
            assert_1.strict.strictEqual(result.passed, true);
        }
        finally {
            clock.restore();
        }
    });
    // ---------------------------------------------------------------
    // Scenario 9c: Polling times out -> returns passed=false
    // ---------------------------------------------------------------
    it('should return passed=false when polling times out', async () => {
        const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
        try {
            const unhealthyReport = makeUnhealthyReport(['Git']);
            // Always return unhealthy - simulates tool never being installed
            checkAllStub.resolves(unhealthyReport);
            showWarningStub.resolves('Install All');
            const terminalSendTextSpy = sinon.spy();
            createTerminalStub.returns({
                show: sinon.spy(),
                sendText: terminalSendTextSpy,
                dispose: sinon.spy(),
            });
            let showWarnCallCount = 0;
            const origShowWarning = showWarningStub;
            origShowWarning.callsFake((...args) => {
                showWarnCallCount++;
                // First call is the "Install All" prompt
                if (showWarnCallCount === 1) {
                    return Promise.resolve('Install All');
                }
                // Subsequent calls are warning messages - just resolve
                return Promise.resolve(undefined);
            });
            const resultPromise = (0, setupWizard_1.runCriticalPreCheck)('local', true);
            // Advance timer past the max wait (180s = 36 poll intervals of 5s)
            await clock.tickAsync(180_000);
            const result = await resultPromise;
            assert_1.strict.strictEqual(result.passed, false);
        }
        finally {
            clock.restore();
        }
    });
    // ---------------------------------------------------------------
    // Scenario 10: Extension install failure shows error
    // ---------------------------------------------------------------
    it('should show error when extension install fails', async () => {
        const report = makeUnhealthyReport(['GitHub Copilot']);
        checkAllStub.resolves(report);
        showWarningStub.resolves('Install All');
        execCommandStub.rejects(new Error('Marketplace timeout'));
        // re-check "Skip"
        showInfoStub.resolves('Skip');
        await (0, setupWizard_1.runCriticalPreCheck)('local', true);
        // Should have shown an error message about the failure
        sinon.assert.called(showErrorStub);
        const errorCall = showErrorStub.getCall(0);
        assert_1.strict.ok(String(errorCall.args[0]).includes('Failed to install'), 'error message should mention install failure');
    });
});
// -----------------------------------------------------------------
// runStartupCheck (delegates to runCriticalPreCheck)
// -----------------------------------------------------------------
describe('setupWizard - runStartupCheck', () => {
    let checkAllStub;
    let showWarningStub;
    beforeEach(() => {
        checkAllStub = sinon.stub(depChecker, 'checkAllDependencies');
        showWarningStub = sinon.stub(vscode.window, 'showWarningMessage');
    });
    afterEach(() => {
        sinon.restore();
    });
    it('should not show any prompt when all deps are healthy', async () => {
        checkAllStub.resolves(makeHealthyReport());
        await (0, setupWizard_1.runStartupCheck)('local');
        sinon.assert.notCalled(showWarningStub);
    });
    it('should trigger pre-check when deps are missing', async () => {
        const report = makeUnhealthyReport(['Git']);
        checkAllStub.resolves(report);
        // User dismisses
        showWarningStub.resolves(undefined);
        await (0, setupWizard_1.runStartupCheck)('local');
        // Should have shown a warning because deps are missing
        sinon.assert.called(showWarningStub);
    });
});
//# sourceMappingURL=setupWizard.test.js.map