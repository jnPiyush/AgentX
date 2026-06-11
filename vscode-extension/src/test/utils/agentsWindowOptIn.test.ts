import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  enableInAgentsWindow,
  maybePromptForAgentsWindow,
  __internals,
} from '../../utils/agentsWindowOptIn';

const { EXTENSION_ID, STATE_KEY_DECLINED, STATE_KEY_LAST_PROMPTED_MAJOR } = __internals;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a fake ExtensionContext whose globalState is a Map-backed store, since
 * the vscode mock's default globalState is a no-op. We only need get + update;
 * everything else can stay `unknown`.
 */
function makeFakeContext(): vscode.ExtensionContext {
  const store = new Map<string, unknown>();
  const globalState = {
    get: <T>(key: string, defaultValue?: T): T | undefined => {
      return (store.has(key) ? (store.get(key) as T) : defaultValue);
    },
    update: async (key: string, value: unknown): Promise<void> => {
      if (value === undefined) {
        store.delete(key);
      } else {
        store.set(key, value);
      }
    },
    keys: () => Array.from(store.keys()),
    setKeysForSync: (_keys: readonly string[]): void => { /* noop */ },
  };
  return { globalState, subscriptions: [] } as unknown as vscode.ExtensionContext;
}

/**
 * Stub `workspace.getConfiguration('extensions')` so it returns a config object
 * backed by an in-memory map. The returned `updateSpy` lets tests assert how
 * (and whether) `config.update` was called.
 */
function stubExtensionsConfig(
  sandbox: sinon.SinonSandbox,
  initial: Record<string, boolean> | undefined,
): { updateSpy: sinon.SinonSpy; getSupportMap: () => Record<string, boolean> | undefined } {
  let current: Record<string, boolean> | undefined = initial
    ? { ...initial }
    : initial;

  const updateSpy = sinon.spy(
    async (key: string, value: unknown, _target?: vscode.ConfigurationTarget) => {
      if (key === 'supportAgentsWindow') {
        current = value as Record<string, boolean>;
      }
    },
  );

  sandbox.stub(vscode.workspace, 'getConfiguration').callsFake((section?: string) => {
    return {
      get: <T>(key: string, defaultValue?: T): T => {
        if (section === 'extensions' && key === 'supportAgentsWindow') {
          return (current as unknown as T) ?? (defaultValue as T);
        }
        return defaultValue as T;
      },
      update: updateSpy as unknown as (
        key: string,
        value: unknown,
        target?: vscode.ConfigurationTarget,
      ) => Promise<void>,
      has: () => false,
      inspect: () => undefined,
    } as unknown as vscode.WorkspaceConfiguration;
  });

  return { updateSpy, getSupportMap: () => current };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('agentsWindowOptIn - maybePromptForAgentsWindow', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Enable: writes merged supportAgentsWindow with global target and records prompt major', async () => {
    const ctx = makeFakeContext();
    const { updateSpy, getSupportMap } = stubExtensionsConfig(sandbox, {
      'other.publisher.foo': true,
    });
    sandbox
      .stub(vscode.window, 'showInformationMessage')
      .onFirstCall()
      .resolves('Enable in Agents Window' as unknown as vscode.MessageItem)
      .onSecondCall()
      .resolves('Later' as unknown as vscode.MessageItem);

    await maybePromptForAgentsWindow(ctx, '8.4.62');

    assert.equal(updateSpy.callCount, 1);
    const args = updateSpy.firstCall.args;
    assert.equal(args[0], 'supportAgentsWindow');
    assert.deepEqual(args[1], { 'other.publisher.foo': true, [EXTENSION_ID]: true });
    assert.equal(args[2], vscode.ConfigurationTarget.Global);
    assert.deepEqual(getSupportMap(), {
      'other.publisher.foo': true,
      [EXTENSION_ID]: true,
    });
    assert.equal(ctx.globalState.get(STATE_KEY_LAST_PROMPTED_MAJOR), '8');
    assert.equal(ctx.globalState.get(STATE_KEY_DECLINED), undefined);
  });

  it('Not now: records prompt major but does not write the setting', async () => {
    const ctx = makeFakeContext();
    const { updateSpy } = stubExtensionsConfig(sandbox, undefined);
    sandbox
      .stub(vscode.window, 'showInformationMessage')
      .resolves('Not now' as unknown as vscode.MessageItem);

    await maybePromptForAgentsWindow(ctx, '8.4.62');

    assert.equal(updateSpy.callCount, 0);
    assert.equal(ctx.globalState.get(STATE_KEY_LAST_PROMPTED_MAJOR), '8');
    assert.equal(ctx.globalState.get(STATE_KEY_DECLINED), undefined);
  });

  it('Don\'t ask again: persists permanent decline and does not write the setting', async () => {
    const ctx = makeFakeContext();
    const { updateSpy } = stubExtensionsConfig(sandbox, undefined);
    sandbox
      .stub(vscode.window, 'showInformationMessage')
      .resolves("Don't ask again" as unknown as vscode.MessageItem);

    await maybePromptForAgentsWindow(ctx, '8.4.62');

    assert.equal(updateSpy.callCount, 0);
    assert.equal(ctx.globalState.get(STATE_KEY_DECLINED), true);
    assert.equal(ctx.globalState.get(STATE_KEY_LAST_PROMPTED_MAJOR), '8');
  });

  it('Re-activation in the same major version does not re-prompt', async () => {
    const ctx = makeFakeContext();
    await ctx.globalState.update(STATE_KEY_LAST_PROMPTED_MAJOR, '8');
    const { updateSpy } = stubExtensionsConfig(sandbox, undefined);
    const showSpy = sandbox
      .stub(vscode.window, 'showInformationMessage')
      .resolves(undefined);

    await maybePromptForAgentsWindow(ctx, '8.5.0');

    assert.equal(showSpy.callCount, 0);
    assert.equal(updateSpy.callCount, 0);
  });

  it('Major-version bump after Not now re-prompts the user', async () => {
    const ctx = makeFakeContext();
    await ctx.globalState.update(STATE_KEY_LAST_PROMPTED_MAJOR, '8');
    const { updateSpy } = stubExtensionsConfig(sandbox, undefined);
    sandbox
      .stub(vscode.window, 'showInformationMessage')
      .onFirstCall()
      .resolves('Enable in Agents Window' as unknown as vscode.MessageItem)
      .onSecondCall()
      .resolves('Later' as unknown as vscode.MessageItem);

    await maybePromptForAgentsWindow(ctx, '9.0.0');

    assert.equal(updateSpy.callCount, 1);
    assert.deepEqual(updateSpy.firstCall.args[1], { [EXTENSION_ID]: true });
    assert.equal(ctx.globalState.get(STATE_KEY_LAST_PROMPTED_MAJOR), '9');
  });

  it('Already opted in: returns early without prompting', async () => {
    const ctx = makeFakeContext();
    const { updateSpy } = stubExtensionsConfig(sandbox, { [EXTENSION_ID]: true });
    const showSpy = sandbox
      .stub(vscode.window, 'showInformationMessage')
      .resolves(undefined);

    await maybePromptForAgentsWindow(ctx, '8.4.62');

    assert.equal(showSpy.callCount, 0);
    assert.equal(updateSpy.callCount, 0);
    assert.equal(ctx.globalState.get(STATE_KEY_LAST_PROMPTED_MAJOR), undefined);
  });

  it('Permanent decline gate: declined users are never prompted again', async () => {
    const ctx = makeFakeContext();
    await ctx.globalState.update(STATE_KEY_DECLINED, true);
    const { updateSpy } = stubExtensionsConfig(sandbox, undefined);
    const showSpy = sandbox
      .stub(vscode.window, 'showInformationMessage')
      .resolves(undefined);

    await maybePromptForAgentsWindow(ctx, '9.0.0');

    assert.equal(showSpy.callCount, 0);
    assert.equal(updateSpy.callCount, 0);
  });

  it('Concurrent activations: prompt-major is recorded before await so only one prompt fires', async () => {
    // Reviewer finding (medium): if STATE_KEY_LAST_PROMPTED_MAJOR is updated
    // only after the await on showInformationMessage resolves, two
    // simultaneous activations in the same process both pass the gate before
    // either records the major, resulting in duplicate prompts. The helper
    // records the major BEFORE awaiting the prompt; awaiting on an already-
    // resolved globalState update still yields one microtask, by which point
    // the persisted value is visible to the second invocation.
    const ctx = makeFakeContext();
    stubExtensionsConfig(sandbox, undefined);

    const showStub = sandbox
      .stub(vscode.window, 'showInformationMessage')
      .resolves('Not now' as unknown as vscode.MessageItem);

    await Promise.all([
      maybePromptForAgentsWindow(ctx, '8.4.62'),
      maybePromptForAgentsWindow(ctx, '8.4.62'),
    ]);

    assert.equal(showStub.callCount, 1, 'only one prompt should fire across concurrent activations in the same process');
    assert.equal(ctx.globalState.get(STATE_KEY_LAST_PROMPTED_MAJOR), '8');
  });
});

describe('agentsWindowOptIn - enableInAgentsWindow (manual command path)', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Idempotent merge: sets jnPiyush.agentx true and preserves existing entries', async () => {
    const { updateSpy, getSupportMap } = stubExtensionsConfig(sandbox, {
      'other.publisher.bar': true,
      [EXTENSION_ID]: false,
    });

    await enableInAgentsWindow();

    assert.equal(updateSpy.callCount, 1);
    assert.deepEqual(updateSpy.firstCall.args[1], {
      'other.publisher.bar': true,
      [EXTENSION_ID]: true,
    });
    assert.equal(updateSpy.firstCall.args[2], vscode.ConfigurationTarget.Global);
    assert.deepEqual(getSupportMap(), {
      'other.publisher.bar': true,
      [EXTENSION_ID]: true,
    });
  });
});
