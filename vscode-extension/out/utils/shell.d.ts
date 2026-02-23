/**
 * Detect the best available PowerShell executable on the current system.
 *
 * Checks `pwsh` (PowerShell 7+) first, then falls back to `powershell.exe`
 * (Windows PowerShell 5.1) on Windows. Returns an empty string when neither
 * is found.
 */
export declare function resolveWindowsShell(): string;
/**
 * Clear the cached shell resolution (useful for tests).
 */
export declare function resetShellCache(): void;
/**
 * Execute a shell command and return stdout.
 *
 * On Windows the `shell` parameter accepts `'pwsh'` (default) which will
 * automatically resolve to `pwsh` or `powershell.exe` depending on what
 * is available. Pass `'bash'` for Unix shells.
 */
export declare function execShell(command: string, cwd: string, shell?: 'pwsh' | 'bash'): Promise<string>;
//# sourceMappingURL=shell.d.ts.map