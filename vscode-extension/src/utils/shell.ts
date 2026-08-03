import { spawn } from 'child_process';
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
      `Command blocked by AgentX security policy: ${result.reason ?? 'matches a dangerous pattern.'}`,
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
 * AgentX requires `pwsh` 7.4+ on Windows. Returns an empty string when no
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
): Promise<string> {
 return runShell(command, cwd, shell, { onLine, envOverrides });
}

interface RunShellOptions {
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
 const { onLine, envOverrides } = options;

 return new Promise((resolve, reject) => {
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
  });

  let settled = false;
  const timer = setTimeout(() => {
   if (settled) { return; }
   settled = true;
   child.kill();
   reject(new Error(`Command failed: timed out after ${DEFAULT_EXEC_TIMEOUT_MS}ms`));
  }, DEFAULT_EXEC_TIMEOUT_MS);

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let stdoutBuffer = '';
  let stderrBuffer = '';

  child.stdout.on('data', (chunk: Buffer | string) => {
   const text = chunk.toString();
   stdoutChunks.push(text);
   stdoutBuffer += text;
   stdoutBuffer = flushBuffer(stdoutBuffer, 'stdout', onLine);
  });

  child.stderr.on('data', (chunk: Buffer | string) => {
   const text = chunk.toString();
   stderrChunks.push(text);
   stderrBuffer += text;
   stderrBuffer = flushBuffer(stderrBuffer, 'stderr', onLine);
  });

  child.on('error', (error) => {
   if (settled) { return; }
   settled = true;
   clearTimeout(timer);
   reject(new Error(redactSecrets(`Command failed: ${error.message}`)));
  });

  child.on('close', (code) => {
   if (settled) { return; }
   settled = true;
   clearTimeout(timer);

   if (stdoutBuffer.trim().length > 0) {
    onLine?.(stdoutBuffer.trim(), 'stdout');
   }
   if (stderrBuffer.trim().length > 0) {
    onLine?.(stderrBuffer.trim(), 'stderr');
   }

  const stdout = stdoutChunks.join('').replace(/\r/g, '');
  const stderr = stderrChunks.join('').replace(/\r/g, '');
   if (code && code !== 0) {
    reject(new Error(redactSecrets(`Command failed: exit code ${code}\n${stderr}`)));
    return;
   }
   resolve(stdout.trim());
  });
 });
}
