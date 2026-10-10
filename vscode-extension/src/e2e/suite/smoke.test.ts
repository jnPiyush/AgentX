import { strict as assert } from 'assert';
import * as vscode from 'vscode';
import { getRegisteredSidebarViewIds } from '../../views/registry';

suite('Frontier Extension Host smoke', () => {
  test('registers minimal initialization without changing the standard default', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'The smoke test requires its isolated workspace');
    const settings = vscode.workspace.getConfiguration('frontier', folder.uri);
    assert.equal(settings.inspect('initializationMode')?.defaultValue, 'standard');
    try {
      await settings.update('initializationMode', 'minimal', vscode.ConfigurationTarget.WorkspaceFolder);
      assert.equal(
        vscode.workspace.getConfiguration('frontier', folder.uri).get('initializationMode'),
        'minimal',
      );
    } finally {
      await settings.update('initializationMode', undefined, vscode.ConfigurationTarget.WorkspaceFolder);
    }
  });

  test('activates, contributes sidebars, and executes a read-only command', async () => {
    const extension = vscode.extensions.all.find((candidate) => (
      candidate.packageJSON?.name === 'agentx'
      && String(candidate.packageJSON?.publisher).toLowerCase() === 'jnpiyush'
    ));
    assert.ok(extension, 'Frontier development extension was not discovered');

    await extension.activate();
    assert.equal(extension.isActive, true, 'Frontier extension should be active');

    const commands = await vscode.commands.getCommands(true);
    for (const command of ['frontier.refresh', 'frontier.loopStatus', 'frontier.runWorkflow']) {
      assert.ok(commands.includes(command), `missing registered command: ${command}`);
    }

    assert.deepEqual(
      getRegisteredSidebarViewIds(),
      ['frontier-work', 'frontier-status', 'frontier-templates', 'frontier-skills'],
      'all sidebar providers should be registered during activation',
    );

    await vscode.commands.executeCommand('workbench.view.extension.frontier-sidebar');
    await vscode.commands.executeCommand('workbench.action.openView', 'frontier-work');
    const loopStatusSucceeded = await vscode.commands.executeCommand<boolean>('frontier.loopStatus');
    assert.equal(loopStatusSucceeded, true, 'loop-status command should complete through the CLI bridge');
  });
});
