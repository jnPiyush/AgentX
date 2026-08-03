import { strict as assert } from 'assert';
import * as vscode from 'vscode';
import { getRegisteredSidebarViewIds } from '../../views/registry';

suite('AgentX Extension Host smoke', () => {
  test('activates, contributes sidebars, and executes a read-only command', async () => {
    const extension = vscode.extensions.all.find((candidate) => (
      candidate.packageJSON?.name === 'agentx'
      && String(candidate.packageJSON?.publisher).toLowerCase() === 'jnpiyush'
    ));
    assert.ok(extension, 'AgentX development extension was not discovered');

    await extension.activate();
    assert.equal(extension.isActive, true, 'AgentX extension should be active');

    const commands = await vscode.commands.getCommands(true);
    for (const command of ['agentx.refresh', 'agentx.loopStatus', 'agentx.runWorkflow']) {
      assert.ok(commands.includes(command), `missing registered command: ${command}`);
    }

    assert.deepEqual(
      getRegisteredSidebarViewIds(),
      ['agentx-work', 'agentx-status', 'agentx-templates', 'agentx-skills'],
      'all sidebar providers should be registered during activation',
    );

    await vscode.commands.executeCommand('workbench.view.extension.agentx-sidebar');
    await vscode.commands.executeCommand('workbench.action.openView', 'agentx-work');
    const loopStatusSucceeded = await vscode.commands.executeCommand<boolean>('agentx.loopStatus');
    assert.equal(loopStatusSucceeded, true, 'loop-status command should complete through the CLI bridge');
  });
});
