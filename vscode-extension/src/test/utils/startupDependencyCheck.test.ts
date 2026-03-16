import { strict as assert } from 'assert';
import {
 markStartupDependencyCheck,
 shouldRunStartupDependencyCheck,
 STARTUP_DEP_CHECK_COOLDOWN_MS,
} from '../../utils/startupDependencyCheck';

describe('startupDependencyCheck', () => {
 const workspaceRoot = '/tmp/agentx';
 const extensionVersion = '8.3.2';

 function createContext() {
  const state = new Map<string, unknown>();

  return {
   globalState: {
    get: <T>(key: string) => state.get(key) as T | undefined,
    update: async (key: string, value: unknown) => {
     if (typeof value === 'undefined') {
      state.delete(key);
      return;
     }
     state.set(key, value);
    },
   },
  } as any;
 }

 it('returns false when no workspace root is available', () => {
  const context = createContext();

  assert.equal(shouldRunStartupDependencyCheck(context, undefined, extensionVersion), false);
 });

  it('returns true when no prior startup check is recorded', () => {
   const context = createContext();

   assert.equal(shouldRunStartupDependencyCheck(context, workspaceRoot, extensionVersion), true);
  });

 it('returns false during the cooldown window for the same version', async () => {
  const context = createContext();
  const now = Date.now();

  await markStartupDependencyCheck(context, workspaceRoot, extensionVersion, now);

  assert.equal(
   shouldRunStartupDependencyCheck(context, workspaceRoot, extensionVersion, now + 1000),
   false,
  );
 });

 it('returns true after the cooldown window expires', async () => {
  const context = createContext();
  const now = Date.now();

  await markStartupDependencyCheck(context, workspaceRoot, extensionVersion, now);

  assert.equal(
   shouldRunStartupDependencyCheck(
    context,
    workspaceRoot,
    extensionVersion,
    now + STARTUP_DEP_CHECK_COOLDOWN_MS + 1,
   ),
   true,
  );
 });

 it('returns true when the extension version changes', async () => {
  const context = createContext();
  const now = Date.now();

  await markStartupDependencyCheck(context, workspaceRoot, '8.2.7', now);

  assert.equal(
   shouldRunStartupDependencyCheck(context, workspaceRoot, extensionVersion, now + 1000),
   true,
  );
 });
});