import { spawn, type ChildProcess } from 'child_process';
import {
 buildShellArgs,
 compareSemver,
 detectPwshVersion,
 flushBuffer,
 getMissingPwshError,
 MIN_POWERSHELL_VERSION,
 resolveShellPath,
} from './shellInternals';
import { validateCommand } from './commandValidator';
import { redactSecrets } from './secretRedactor';

const DEFAULT_EXEC_TIMEOUT_MS = 120_000;

/**
 * Reject commands that match the hard-blocked dangerous patterns.
 *
 * SCOPE OF THIS CONTROL -- read before relying on it:
 *
 * This enforces Layer 1 (`blocked`) only. `requires_confirmation` passes
 * through, because this is a non-interactive API and a coding harness must be
 * able to run arbitrary build and test tooling. There is currently NO
 * interactive confirmation path in the extension, so Layers 2 and 3 of the
 * validator have no runtime consumer.
 *
 * The effective production control is therefore a DENYLIST of catastrophic
 * operations. It stops accidents and naive model output. It is NOT a sandbox
 * and it will not stop a determined adversary: a denylist over command text
 * can always be evaded by quoting, aliasing, or indirection
 * (`g""it clean -fd`, `$c='...'; iex $c`). Do not run this harness against a
 * repository you would not trust with your shell.
 *
 * @throws Error when the command matches a blocked pattern.
 */
function assertCommandAllowed(command: string): void {
  const result = validateCommand(command);
  if (result.classification === 'blocked') {
    throw new Error(
      `Command blocked by Frontier security policy: ${result.reason ?? 'matches a dangerous pattern.'}`,
    );
  }
}

/**
 * Apply the security policy and resolve the shell executable.
 *
 * Shared by both execution entry points so the guard can never be present on
 * one path and missing on the other.
 *
 * @throws Error when the command is blocked or no supported shell is found.
 */
function prepareShell(command: string, shell: 'pwsh' | 'bash'): string {
  assertCommandAllowed(command);

  if (shell === 'bash') {
    return resolveShellPath(shell, '');
  }

  // Resolve to a supported PowerShell runtime (pwsh 7.4+)
  const resolved = resolveWindowsShell();
  if (!resolved) {
    throw getMissingPwshError();
  }
  return resolveShellPath(shell, resolved);
}

/**
 * Cached result of PowerShell availability check.
 * null = not yet checked, string = resolved shell path.
 */
let _resolvedPwsh: string | null = null;

/**
 * Detect a supported PowerShell executable on the current system.
 *
 * Frontier requires `pwsh` 7.4+ on Windows. Returns an empty string when no
 * supported `pwsh` runtime is found.
 */
export function resolveWindowsShell(): string {
  if (_resolvedPwsh !== null) { return _resolvedPwsh; }

  // Try pwsh (PowerShell 7+ cross-platform)
  try {
    const version = detectPwshVersion();
    if (compareSemver(version, MIN_POWERSHELL_VERSION) >= 0) {
      _resolvedPwsh = 'pwsh';
      return _resolvedPwsh;
    }
  } catch { /* pwsh not available */ }

  _resolvedPwsh = '';
  return _resolvedPwsh;
}

/**
 * Clear the cached shell resolution (useful for tests).
 */
export function resetShellCache(): void {
  _resolvedPwsh = null;
}

/**
 * Execute a shell command and return stdout.
 *
 * On Windows the `shell` parameter accepts `'pwsh'` (default) and requires
 * PowerShell 7.4+ to be installed. Pass `'bash'` for Unix shells.
 */
export function execShell(
 command: string,
 cwd: string,
 shell: 'pwsh' | 'bash' = 'pwsh',
 envOverrides?: NodeJS.ProcessEnv,
): Promise<string> {
 return runShell(command, cwd, shell, { envOverrides });
}

/**
 * Execute a shell command and stream stdout/stderr line-by-line while also
 * returning the final stdout payload.
 */
export function execShellStreaming(
 command: string,
 cwd: string,
 shell: 'pwsh' | 'bash' = 'pwsh',
 onLine?: (line: string, source: 'stdout' | 'stderr') => void,
 envOverrides?: NodeJS.ProcessEnv,
 execution: ShellExecutionOptions = {},
): Promise<string> {
 return runShell(command, cwd, shell, { onLine, envOverrides, ...execution });
}

export interface ShellExecutionOptions {
 readonly signal?: AbortSignal;
 readonly timeoutMs?: number;
}

interface RunShellOptions extends ShellExecutionOptions {
 readonly onLine?: (line: string, source: 'stdout' | 'stderr') => void;
 readonly envOverrides?: NodeJS.ProcessEnv;
}

/**
 * Single implementation behind both public entry points.
 *
 * Both paths MUST share this function. A previous version ran `execShell`
 * through Node's `exec({ shell })`, which invokes `pwsh -c` and therefore
 * sourced the user's `$PROFILE` on every call -- while `execShellStreaming`
 * used `buildShellArgs` (`-NoProfile`). Validating command text is meaningless
 * if the two execution paths give that text different meanings, so shell
 * argument construction is centralised here.
 */
function runShell(
 command: string,
 cwd: string,
 shell: 'pwsh' | 'bash',
 options: RunShellOptions,
): Promise<string> {
 const { onLine, envOverrides, signal, timeoutMs = DEFAULT_EXEC_TIMEOUT_MS } = options;

 return new Promise((resolve, reject) => {
  const abortError = () => Object.assign(new Error('Command cancelled.'), { name: 'AbortError' });
  if (signal?.aborted) { reject(abortError()); return; }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
   reject(new Error('Command timeout must be positive.'));
   return;
  }
  let shellPath: string;

  try {
    shellPath = prepareShell(command, shell);
  } catch (error) {
    reject(error as Error);
    return;
  }

  const args = buildShellArgs(shell, command);

  const child = spawn(shellPath, args, {
   cwd,
    env: { ...process.env, ...envOverrides, NO_COLOR: '1' },
   stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
  });

  let settled = false;
  let closed = false;
  let terminationComplete = false;
  let stoppingError: Error | undefined;
  let teardownTimer: NodeJS.Timeout | undefined;
  let escalationTimer: NodeJS.Timeout | undefined;
  let terminator: ChildProcess | undefined;
  const finish = (error?: Error, output = '') => {
  if (settled) { return; }
  settled = true;
  clearTimeout(timer);
  clearTimeout(teardownTimer);
  clearTimeout(escalationTimer);
  signal?.removeEventListener('abort', onAbort);
  if (error) { reject(error); } else { resolve(output); }
  };
  const finishStopped = () => {
  if (closed && terminationComplete) { finish(stoppingError); }
  };
  const stop = (error: Error) => {
  if (settled || stoppingError) { return; }
  stoppingError = error;
  clearTimeout(timer);
  teardownTimer = setTimeout(() => {
    if (terminator?.exitCode === null) { terminator.kill(); }
   finish(new Error(`${error.message} Process-tree termination could not be confirmed.`));
  }, 8000);
  if (!child.pid) { terminationComplete = true; finishStopped(); return; }
  if (process.platform === 'win32') {
   const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  terminator = killer;
   killer.on('error', () => finish(new Error(`${error.message} Unable to start process-tree termination.`)));
   killer.on('close', (code) => {
    if (code !== 0) { finish(new Error(`${error.message} Process-tree termination failed (exit ${code}).`)); return; }
    terminationComplete = true;
    finishStopped();
   });
  } else {
   try { process.kill(-child.pid, 'SIGTERM'); }
   catch (killError) {
    if ((killError as NodeJS.ErrnoException).code !== 'ESRCH') {
    finish(new Error(`${error.message} Unable to terminate process group.`));
    return;
    }
   }
   escalationTimer = setTimeout(() => {
    try { process.kill(-child.pid!, 'SIGKILL'); }
    catch (killError) {
    if ((killError as NodeJS.ErrnoException).code !== 'ESRCH') {
     finish(new Error(`${error.message} Unable to terminate process group.`));
     return;
    }
    }
    terminationComplete = true;
    finishStopped();
   }, 2000);
  }
  };
  const onAbort = () => stop(abortError());
  const timer = setTimeout(() => stop(new Error(`Command failed: timed out after ${timeoutMs}ms`)), timeoutMs);
  signal?.addEventListener('abort', onAbort, { once: true });

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let outputBytes = 0;
  const acceptChunk = (text: string): boolean => {
   if (settled || stoppingError) { return false; }
   outputBytes += Buffer.byteLength(text);
   if (outputBytes > 8 * 1024 * 1024) {
    stop(new Error('Command output exceeded 8 MiB.'));
    return false;
   }
   return true;
  };

  child.stdout.on('data', (chunk: Buffer | string) => {
   const text = chunk.toString();
   if (!acceptChunk(text)) { return; }
   stdoutChunks.push(text);
   stdoutBuffer += text;
   stdoutBuffer = flushBuffer(stdoutBuffer, 'stdout', onLine);
  });

  child.stderr.on('data', (chunk: Buffer | string) => {
   const text = chunk.toString();
    if (!acceptChunk(text)) { return; }
   stderrChunks.push(text);
   stderrBuffer += text;
   stderrBuffer = flushBuffer(stderrBuffer, 'stderr', onLine);
  });

  child.on('error', (error) => {
    finish(new Error(redactSecrets(`Command failed: ${error.message}`)));
  });

  child.on('close', (code) => {
    closed = true;
   if (settled) { return; }
    if (stoppingError) { finishStopped(); return; }

   if (stdoutBuffer.trim().length > 0) {
    onLine?.(stdoutBuffer.trim(), 'stdout');
   }
   if (stderrBuffer.trim().length > 0) {
    onLine?.(stderrBuffer.trim(), 'stderr');
   }

  const stdout = stdoutChunks.join('').replace(/\r/g, '');
  const stderr = stderrChunks.join('').replace(/\r/g, '');
  if (code !== 0) {
   finish(new Error(redactSecrets(`Command failed: exit code ${code}\n${stderr}`)));
    return;
   }
  finish(undefined, stdout.trim());
  });
  if (signal?.aborted) { onAbort(); }
 });
}
