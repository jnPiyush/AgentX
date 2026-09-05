import { strict as assert } from 'assert';
import {
  MINIMUM_HOST_VERSION,
  buildUnsupportedHostMessage,
  compareVersions,
  isHostBelowMinimum,
  warnIfHostUnsupported,
} from '../../utils/hostCapability';

describe('hostCapability', () => {
  it('compares dotted versions numerically, not lexically', () => {
    assert.ok(compareVersions('1.9.0', '1.10.0') < 0);
    assert.ok(compareVersions('1.134.0', '1.85.0') > 0);
    assert.equal(compareVersions('1.134.0', '1.134.0'), 0);
    assert.equal(compareVersions('1.134.0-insider', '1.134.0'), 0);
    assert.ok(compareVersions('1.134', '1.134.1') < 0);
  });

  it('flags hosts older than the declared minimum', () => {
    assert.equal(isHostBelowMinimum('1.85.0'), true);
    assert.equal(isHostBelowMinimum('1.133.9'), true);
    assert.equal(isHostBelowMinimum(MINIMUM_HOST_VERSION), false);
    assert.equal(isHostBelowMinimum('1.136.1'), false);
  });

  it('never treats a malformed version as unsupported by accident', () => {
    assert.equal(isHostBelowMinimum('not-a-version'), true);
    assert.equal(isHostBelowMinimum('9999.0.0'), false);
  });

  it('names both the requirement and the actual host in the message', () => {
    const message = buildUnsupportedHostMessage('1.85.0');
    assert.ok(message.includes(MINIMUM_HOST_VERSION));
    assert.ok(message.includes('1.85.0'));
  });

  it('warns once per host version and stays silent on supported hosts', async () => {
    const store = new Map<string, unknown>();
    const context = {
      globalState: {
        get: (key: string) => store.get(key),
        update: async (key: string, value: unknown) => { store.set(key, value); },
      },
    } as never;

    assert.equal(await warnIfHostUnsupported(context, '1.85.0'), true);
    assert.equal(await warnIfHostUnsupported(context, '1.85.0'), false);
    assert.equal(await warnIfHostUnsupported(context, '1.136.1'), false);
  });
});
