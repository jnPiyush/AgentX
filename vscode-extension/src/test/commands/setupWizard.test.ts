import { strict as assert } from 'assert';
import * as sinon from 'sinon';

// The register.ts hook rewrites require('vscode') to our mock.
// Import mock for stubbing:
import * as vscode from 'vscode';

// Module under test:
import {
  runCriticalPreCheck,
  runStartupCheck,
  runSilentInstall,
  PreCheckResult,
} from '../../commands/setupWizard';

// We need to stub checkAllDependencies at the module level
import * as depChecker from '../../utils/dependencyChecker';

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/** Build a healthy EnvironmentReport (all found). */
function makeHealthyReport(): depChecker.EnvironmentReport {
  return {
    results: [
      { name: 'Git', found: true, version: '2.43.0', severity: 'required', message: 'Git 2.43.0 detected.' },
      { name: 'PowerShell', found: true, version: '7.4.1', severity: 'required', message: 'PowerShell 7.4.1 detected.' },
      { name: 'Node.js', found: true, version: '20.11.0', severity: 'required', message: 'Node.js 20.11.0 detected.' },
      { name: 'GitHub CLI (gh)', found: false, version: '', severity: 'optional', message: 'GitHub CLI not installed.' },
    ],
    healthy: true,
    criticalCount: 0,
    warningCount: 0,
    timestamp: new Date().toISOString(),
  };
}

/** Build a report with specific missing required deps. */
function makeUnhealthyReport(
  missingNames: string[],
): depChecker.EnvironmentReport {
  const allDeps: depChecker.DependencyResult[] = [
    { name: 'Git', found: true, version: '2.43.0', severity: 'required', message: 'Git 2.43.0 detected.', fixCommand: 'winget install Git.Git', fixUrl: 'https://git-scm.com/downloads' },
    { name: 'PowerShell', found: true, version: '7.4.1', severity: 'required', message: 'PowerShell 7.4.1 detected.', fixCommand: 'winget install Microsoft.PowerShell', fixUrl: 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell' },
    { name: 'Node.js', found: true, version: '20.11.0', severity: 'required', message: 'Node.js 20.11.0 detected.', fixCommand: 'winget install OpenJS.NodeJS.LTS', fixUrl: 'https://nodejs.org/' },
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
  let checkAllStub: sinon.SinonStub;
  let showWarningStub: sinon.SinonStub;
  let showInfoStub: sinon.SinonStub;
  let showErrorStub: sinon.SinonStub;
  let execCommandStub: sinon.SinonStub;
  let createTerminalStub: sinon.SinonStub;

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

    const result = await runCriticalPreCheck('local');

    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.report.healthy, true);
    // No warning messages should have been shown
    sinon.assert.notCalled(showWarningStub);
  });

  // ---------------------------------------------------------------
  // Scenario 2: Missing CLI tool -> user picks Install All
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
      const resultPromise = runCriticalPreCheck('local', true);

      // Advance timer to trigger the first poll interval (5s)
      await clock.tickAsync(5_000);

      const result = await resultPromise;

      // Should have created a terminal
      sinon.assert.calledOnce(createTerminalStub);
      // Should have sent install command text to the terminal
      assert.ok(
        terminalSendTextSpy.getCalls().some(
          (c: sinon.SinonSpyCall) => String(c.args[0]).includes('Installing Git')
        ),
        'terminal should receive Git install command'
      );
      // Polling detected the tool is now available -> passed
      assert.strictEqual(result.passed, true);
    } finally {
      clock.restore();
    }
  });

  // ---------------------------------------------------------------
  // Scenario 3: Missing deps -> user picks Install All -> re-check
  //   passes -> returned passed=true
  // ---------------------------------------------------------------
  it('should return passed=true after successful re-check', async () => {
    const unhealthy = makeUnhealthyReport(['Node.js']);
    const healthy = makeHealthyReport();

    // First call: unhealthy. Second call (poll): healthy.
    checkAllStub.onFirstCall().resolves(unhealthy);
    checkAllStub.onSecondCall().resolves(healthy);
    checkAllStub.resolves(healthy);

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

    const result = await runCriticalPreCheck('local', true);

    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.report.healthy, true);
  });

  // ---------------------------------------------------------------
  // Scenario 4: Missing deps -> user picks "Open Setup Docs"
  //   -> returns passed=false
  // ---------------------------------------------------------------
  it('should return passed=false when user picks Open Setup Docs', async () => {
    const report = makeUnhealthyReport(['Git']);
    checkAllStub.resolves(report);

    showWarningStub.resolves('Open Setup Docs');

    const result = await runCriticalPreCheck('local', true);

    assert.strictEqual(result.passed, false);
  });

  // ---------------------------------------------------------------
  // Scenario 5: Missing deps -> user dismisses the dialog
  //   -> returns passed=false
  // ---------------------------------------------------------------
  it('should return passed=false when user dismisses the dialog', async () => {
    const report = makeUnhealthyReport(['Git']);
    checkAllStub.resolves(report);

    // User dismisses (undefined return)
    showWarningStub.resolves(undefined);

    const result = await runCriticalPreCheck('local', true);

    assert.strictEqual(result.passed, false);
  });

  // ---------------------------------------------------------------
  // Scenario 6: Non-blocking mode uses non-modal warning
  // ---------------------------------------------------------------
  it('should use non-modal warning in non-blocking mode', async () => {
    const report = makeUnhealthyReport(['Git']);
    checkAllStub.resolves(report);

    showWarningStub.resolves('Dismiss');

    const result = await runCriticalPreCheck('local', false);

    assert.strictEqual(result.passed, false);
    // The non-blocking call should NOT use modal option
    const call = showWarningStub.getCall(0);
    // In non-blocking mode the second arg is a string button (not options object)
    assert.ok(
      typeof call.args[1] === 'string',
      'non-blocking mode should not pass modal options object'
    );
  });

  // ---------------------------------------------------------------
  // Scenario 7: Blocking mode uses modal dialog with detail
  // ---------------------------------------------------------------
  it('should use modal dialog in blocking mode', async () => {
    const report = makeUnhealthyReport(['Git']);
    checkAllStub.resolves(report);

    showWarningStub.resolves(undefined);

    await runCriticalPreCheck('local', true);

    const call = showWarningStub.getCall(0);
    // In blocking mode the second arg should be the modal options object
    assert.ok(
      typeof call.args[1] === 'object' && (call.args[1] as any).modal === true,
      'blocking mode should pass { modal: true } options'
    );
  });

  // ---------------------------------------------------------------
  // Scenario 8: Mixed missing CLI tools -> installs via terminal + polling
  // ---------------------------------------------------------------
  it('should handle mixed missing CLI tools', async () => {
    const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });

    try {
      const unhealthyReport = makeUnhealthyReport(['Git', 'Node.js']);
      const healthyReport = makeHealthyReport();

      checkAllStub.onFirstCall().resolves(unhealthyReport);
      // Polling check: all tools now found
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

      const resultPromise = runCriticalPreCheck('local', true);

      // Advance timer for the polling interval
      await clock.tickAsync(5_000);

      const result = await resultPromise;

      // CLI tools installed via terminal
      sinon.assert.calledOnce(createTerminalStub);
      assert.ok(
        terminalSendTextSpy.getCalls().some(
          (c: sinon.SinonSpyCall) => String(c.args[0]).includes('Installing Git')
        ),
      );
      assert.ok(
        terminalSendTextSpy.getCalls().some(
          (c: sinon.SinonSpyCall) => String(c.args[0]).includes('Installing Node.js')
        ),
      );
      // Polling detected tools are now available -> passed
      assert.strictEqual(result.passed, true);
    } finally {
      clock.restore();
    }
  });

  // ---------------------------------------------------------------
  // Scenario 8b: GitHub mode - missing gh CLI -> polls successfully
  // ---------------------------------------------------------------
  it('should poll for gh CLI in github mode and return passed=true', async () => {
    const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });

    try {
      // In github mode, GitHub CLI becomes required
      const unhealthyReport = makeUnhealthyReport(['GitHub CLI (gh)']);
      unhealthyReport.results = unhealthyReport.results.map(r => {
        if (r.name === 'GitHub CLI (gh)') { r.severity = 'required'; }
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

      const resultPromise = runCriticalPreCheck('github', true);

      // Advance timer for the polling interval
      await clock.tickAsync(5_000);

      const result = await resultPromise;

      // Terminal should have received gh install command
      assert.ok(
        terminalSendTextSpy.getCalls().some(
          (c: sinon.SinonSpyCall) => String(c.args[0]).includes('GitHub.cli')
        ),
        'terminal should receive gh install command'
      );
      // Should pass after polling detects gh is installed
      assert.strictEqual(result.passed, true);
    } finally {
      clock.restore();
    }
  });

  // ---------------------------------------------------------------
  // Scenario 8c: Polling times out -> returns passed=false
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
      origShowWarning.callsFake((...args: unknown[]) => {
        showWarnCallCount++;
        // First call is the "Install All" prompt
        if (showWarnCallCount === 1) { return Promise.resolve('Install All'); }
        // Subsequent calls are warning messages - just resolve
        return Promise.resolve(undefined);
      });

      const resultPromise = runCriticalPreCheck('local', true);

      // Advance timer past the max wait (180s = 36 poll intervals of 5s)
      await clock.tickAsync(180_000);

      const result = await resultPromise;

      assert.strictEqual(result.passed, false);
    } finally {
      clock.restore();
    }
  });
});

// -----------------------------------------------------------------
// runStartupCheck (delegates to runCriticalPreCheck)
// -----------------------------------------------------------------

describe('setupWizard - runStartupCheck', () => {
  let checkAllStub: sinon.SinonStub;
  let showWarningStub: sinon.SinonStub;

  beforeEach(() => {
    checkAllStub = sinon.stub(depChecker, 'checkAllDependencies');
    showWarningStub = sinon.stub(vscode.window, 'showWarningMessage');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should not show any prompt when all deps are healthy', async () => {
    checkAllStub.resolves(makeHealthyReport());

    await runStartupCheck('local');

    sinon.assert.notCalled(showWarningStub);
  });

  it('should trigger pre-check when deps are missing', async () => {
    const report = makeUnhealthyReport(['Git']);
    checkAllStub.resolves(report);

    // User dismisses
    showWarningStub.resolves(undefined);

    await runStartupCheck('local');

    // Should have shown a warning because deps are missing
    sinon.assert.called(showWarningStub);
  });
});

// -----------------------------------------------------------------
// runSilentInstall - auto-installs without any user prompts
// -----------------------------------------------------------------

describe('setupWizard - runSilentInstall', () => {
  let checkAllStub: sinon.SinonStub;
  let createTerminalStub: sinon.SinonStub;
  let showWarningStub: sinon.SinonStub;

  beforeEach(() => {
    checkAllStub = sinon.stub(depChecker, 'checkAllDependencies');
    createTerminalStub = sinon.stub(vscode.window, 'createTerminal');
    showWarningStub = sinon.stub(vscode.window, 'showWarningMessage');
  });

  afterEach(() => {
    sinon.restore();
  });

  // ---------------------------------------------------------------
  // Scenario 1: All deps present -> passed = true, no terminal
  // ---------------------------------------------------------------
  it('should return passed=true immediately when all deps are found', async () => {
    checkAllStub.resolves(makeHealthyReport());

    const result = await runSilentInstall('local');

    assert.strictEqual(result.passed, true);
    sinon.assert.notCalled(createTerminalStub);
    sinon.assert.notCalled(showWarningStub);
  });

  // ---------------------------------------------------------------
  // Scenario 2: Missing deps -> installs silently via hidden terminal
  // ---------------------------------------------------------------
  it('should install missing deps silently without prompting', async () => {
    const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });

    try {
      const unhealthyReport = makeUnhealthyReport(['Git']);
      const healthyReport = makeHealthyReport();

      // First call (initial check): unhealthy; second call (poll): healthy
      checkAllStub.onFirstCall().resolves(unhealthyReport);
      checkAllStub.onSecondCall().resolves(healthyReport);
      checkAllStub.resolves(healthyReport);

      // Mock hidden terminal
      const terminalSendTextSpy = sinon.spy();
      const terminalDisposeSpy = sinon.spy();
      createTerminalStub.returns({
        show: sinon.spy(),
        sendText: terminalSendTextSpy,
        dispose: terminalDisposeSpy,
      });

      const resultPromise = runSilentInstall('local');

      // Advance timer to trigger polling
      await clock.tickAsync(5_000);

      const result = await resultPromise;

      // Terminal was created with hideFromUser: true
      sinon.assert.calledOnce(createTerminalStub);
      const termOpts = createTerminalStub.getCall(0).args[0];
      assert.strictEqual(termOpts.hideFromUser, true, 'Terminal should be hidden');

      // Install command was sent
      assert.ok(
        terminalSendTextSpy.getCalls().some(
          (c: sinon.SinonSpyCall) => String(c.args[0]).includes('winget install Git.Git')
        ),
        'should send Git install command silently'
      );

      // No user prompts were shown
      sinon.assert.notCalled(showWarningStub);

      // Terminal was disposed after success
      sinon.assert.calledOnce(terminalDisposeSpy);

      assert.strictEqual(result.passed, true);
    } finally {
      clock.restore();
    }
  });

  // ---------------------------------------------------------------
  // Scenario 3: Multiple missing deps -> all installed silently
  // ---------------------------------------------------------------
  it('should install multiple missing deps in a single terminal', async () => {
    const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });

    try {
      const unhealthyReport = makeUnhealthyReport(['Git', 'Node.js']);
      const healthyReport = makeHealthyReport();

      checkAllStub.onFirstCall().resolves(unhealthyReport);
      checkAllStub.onSecondCall().resolves(healthyReport);
      checkAllStub.resolves(healthyReport);

      const terminalSendTextSpy = sinon.spy();
      createTerminalStub.returns({
        show: sinon.spy(),
        sendText: terminalSendTextSpy,
        dispose: sinon.spy(),
      });

      const resultPromise = runSilentInstall('local');

      await clock.tickAsync(5_000);

      const result = await resultPromise;

      // Both install commands sent
      const allCmds = terminalSendTextSpy.getCalls().map(
        (c: sinon.SinonSpyCall) => String(c.args[0])
      );
      assert.ok(allCmds.some(cmd => cmd.includes('Git')), 'should install Git');
      assert.ok(allCmds.some(cmd => cmd.includes('Node')), 'should install Node.js');
      assert.strictEqual(result.passed, true);
    } finally {
      clock.restore();
    }
  });

  // ---------------------------------------------------------------
  // Scenario 4: Polling times out -> returns passed=false with warning
  // ---------------------------------------------------------------
  it('should return passed=false and show warning when polling times out', async () => {
    const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });

    try {
      const unhealthyReport = makeUnhealthyReport(['Git']);
      // Always return unhealthy
      checkAllStub.resolves(unhealthyReport);

      const terminalDisposeSpy = sinon.spy();
      createTerminalStub.returns({
        show: sinon.spy(),
        sendText: sinon.spy(),
        dispose: terminalDisposeSpy,
      });

      showWarningStub.resolves(undefined);

      const resultPromise = runSilentInstall('local');

      // Advance past max wait (180s)
      await clock.tickAsync(180_000);

      const result = await resultPromise;

      assert.strictEqual(result.passed, false);
      // Terminal was cleaned up
      sinon.assert.calledOnce(terminalDisposeSpy);
      // Warning shown after timeout
      sinon.assert.calledOnce(showWarningStub);
    } finally {
      clock.restore();
    }
  });
});
