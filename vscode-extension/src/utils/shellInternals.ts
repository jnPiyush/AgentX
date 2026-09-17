import { execFileSync } from 'child_process';

export const MIN_POWERSHELL_VERSION = '7.4.0';

export function compareSemver(left: string, right: string): number {
 const leftParts = left.split('.').map((part) => parseInt(part, 10) || 0);
 const rightParts = right.split('.').map((part) => parseInt(part, 10) || 0);
 const length = Math.max(leftParts.length, rightParts.length);
 for (let index = 0; index < length; index++) {
  const leftValue = leftParts[index] ?? 0;
  const rightValue = rightParts[index] ?? 0;
  if (leftValue > rightValue) {
   return 1;
  }
  if (leftValue < rightValue) {
   return -1;
  }
 }
 return 0;
}

export function resolveShellPath(shell: 'pwsh' | 'bash', resolvedPwsh: string): string {
 if (shell === 'bash') {
  return '/bin/bash';
 }
 return resolvedPwsh;
}

export function getMissingPwshError(): Error {
 return new Error(
  'PowerShell 7.4+ (pwsh) is required. Install it from '
  + 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell.',
 );
}

export function detectPwshVersion(): string {
 return execFileSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
  stdio: ['ignore', 'pipe', 'ignore'],
  timeout: 5_000,
 }).toString().trim();
}

export function buildShellArgs(shell: 'pwsh' | 'bash', command: string): string[] {
 return shell === 'bash'
  ? ['-lc', command]
  : ['-NoProfile', '-Command', command];
}

export function flushBuffer(
 buffer: string,
 source: 'stdout' | 'stderr',
 onLine?: (line: string, source: 'stdout' | 'stderr') => void,
): string {
 const normalized = buffer.replace(/\r/g, '');
 const lines = normalized.split('\n');
 const remainder = lines.pop() ?? '';
 for (const line of lines) {
  if (line.length > 0) {
   onLine?.(line, source);
  }
 }
 return remainder;
}