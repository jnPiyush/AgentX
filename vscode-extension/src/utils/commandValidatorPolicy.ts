import type { Reversibility } from './commandValidatorTypes';

export const DEFAULT_ALLOWLIST: readonly string[] = [
  'git status', 'git diff', 'git log', 'git branch', 'git show',
  'git stash', 'git remote', 'git fetch', 'git ls-files',
  'ls', 'dir', 'cat', 'type', 'head', 'tail', 'wc', 'find', 'grep',
  'rg', 'ripgrep', 'fd',
  'echo', 'printf', 'pwd', 'cd', 'which', 'where', 'whoami',
  'hostname', 'date', 'env', 'printenv',
  'npm run', 'npm test', 'npm list', 'npm ls', 'npm outdated',
  'npm audit', 'npm ci', 'npm version', 'npm view', 'npm info',
  'npm help', 'npm search',
  'node --version', 'node -v', 'npx --version',
  'bun --version', 'deno --version',
  'python --version', 'python -V', 'python3 --version', 'python3 -V',
  'pip list', 'pip show', 'pip check', 'pip freeze',
  'pip3 list', 'pip3 show', 'pip3 check', 'pip3 freeze',
  'pipenv run', 'poetry run', 'poetry show',
  'dotnet build', 'dotnet test', 'dotnet run', 'dotnet restore',
  'dotnet clean', 'dotnet --version', 'dotnet --list-sdks',
  'dotnet --list-runtimes', 'dotnet --info',
  'nuget list', 'nuget sources',
  'tsc', 'eslint', 'prettier', 'jest', 'vitest', 'mocha', 'pytest',
  'cargo build', 'cargo test', 'cargo check', 'cargo clippy',
  'rustc --version', 'go build', 'go test', 'go vet', 'go version',
  'make', 'cmake', 'ninja',
  'docker ps', 'docker images', 'docker inspect', 'docker logs',
  'docker version', 'docker info', 'docker compose ps',
  'kubectl get', 'kubectl describe', 'kubectl logs',
  'kubectl version', 'kubectl config',
  'curl --version', 'wget --version',
] as const;

export const BLOCKED_PATTERNS: readonly RegExp[] = [
  /\brm\s+-rf\s+\//i,
  /\bformat\s+c:/i,
  /\bdrop\s+database\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/,
  /bash\s+-i\s*>&\s*\/dev\/tcp\//i,
  /nc\s+.*-e\s+\/bin\/(ba)?sh/i,
  /python[23]?\s+.*socket.*exec/i,
  /\bdd\s+if=\/dev\/zero\b/i,
  /\bdd\s+if=\/dev\/random\b/i,
  /\bmkfs\./i,
  /\bshred\s+.*\/dev\//i,
  /\b(curl|wget)\b.*\|\s*\b(ba)?sh\b/i,
  /\b(curl|wget)\b.*\|\s*\bpython[23]?\b/i,
  /\bbase64\s+.*--decode\b.*\|\s*\b(ba)?sh\b/i,
  /echo\s+.*\|\s*base64\s+.*\|\s*\b(ba)?sh\b/i,
  /\b(shutdown|reboot|halt)\b/i,
  /\binit\s+0\b/i,
  /\bsystemctl\s+(poweroff|reboot|halt)\b/i,
  /\bchmod\s+(-R\s+)?777\s+\//i,
  /\bTRUNCATE\s+TABLE\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bgit\s+push\s+.*--force\b/i,
  /\bgit\s+push\s+.*-f\b/i,
  // Invoke-Expression in any form: the parenthesised-only variant missed the
  // most common usage (`Invoke-Expression $cmd`).
  /\b(iex|invoke-expression)\b/i,
  /\bpowershell\b.*-[Ee]ncodedCommand\b/i,
  /\bpwsh\b.*-[Ee]ncodedCommand\b/i,
  /\b(?:powershell|pwsh)\b.*\s-[Ee]\s+/i,
  /\bcertutil\b.*-decode\b/i,

  // --- Destructive operations documented in .github/security/allowed-commands.json ---
  //
  // Scoping decision: `rm -rf <relative-path>` stays ALLOWED, because
  // `rm -rf node_modules` / `dist` is routine build work in a coding harness.
  // Only filesystem-root and user-home deletions are blocked.
  //
  // `[^;&|]*` is used instead of `.*` throughout so a pattern cannot span a
  // compound separator and wrongly block an unrelated later command
  // (e.g. `npm install && git log -g`).

  // rm targeting / or the user home, tolerant of flag order and quoting.
  // Catches: rm -rf /, rm -fr /, rm -r ~, rm -rf "$HOME", rm -rf ${HOME},
  //          rm -rf $env:USERPROFILE, rm -rf %USERPROFILE%, rm -rf /*
  /\brm\s+(?:-{1,2}\S+\s+)*["']?(?:\/\*?|~|\$HOME|\$\{HOME\}|\$env:USERPROFILE|%USERPROFILE%)["']?\s*(?:$|[;&|])/i,

  // PowerShell is the DEFAULT shell for this harness, so its native deletion
  // cmdlet needs the same guard as the POSIX binaries.
  // Catches: Remove-Item -Recurse -Force $HOME, Remove-Item -Recurse C:\
  /\bremove-item\b[^;&|]*\s-recurse\b[^;&|]*\s["']?(?:\$HOME|\$env:USERPROFILE|~|[a-z]:\\?)["']?\s*(?:$|[;&|])/i,

  // git clean only deletes with -f/--force; -n is a dry run and stays allowed.
  // Catches: git clean -fdx, git clean --force -d, git clean -x -f
  // Allows:  git clean -nd, git clean --dry-run
  /\bgit\s+clean\b(?![^;&|]*\s-{1,2}[a-z]*n)[^;&|]*\s(?:-[a-z]*f|--force)/i,

  /\bgit\s+filter-branch\b/i,
  // filter-repo is the modern replacement git's own docs recommend.
  /\bgit\s+filter-repo\b/i,
  /\bgh\s+repo\s+(delete|archive)\b/i,
  // Equivalent effect via the raw API surface.
  /\bgh\s+api\b[^;&|]*--method\s+delete\b/i,

  // Global npm installs. Lookahead allows the subcommand to appear after the
  // flag (`npm --global install x`) and covers documented aliases.
  // `(?![-\w])` prevents the --global-style false positive.
  /\bnpm\b(?=[^;&|]*\s(?:install|i|add|uninstall|un|rm|remove)\b)[^;&|]*\s(?:-g|--global)(?![-\w])/i,
  /\bnpm\b(?=[^;&|]*\s(?:install|i|add|uninstall|un|rm|remove)\b)[^;&|]*\s--location\s*=\s*global\b/i,
  /\b(?:yarn\s+global\s+add|pnpm\s+add\b[^;&|]*\s-g(?![-\w]))/i,

  // Windows recursive delete of a drive root, independent of flag order.
  // Catches: del /f /s /q C:\, rmdir /q /s C:\
  // Allows:  rmdir /s /q build (named subdirectory, not a drive root)
  /\b(?:rmdir|rd|del)\b(?=[^;&|]*\s\/s\b)[^;&|]*\s["']?[a-z]:\\?["']?\s*(?:$|[;&|])/i,
] as const;

export interface ReversibilityEntry {
  readonly pattern: RegExp;
  readonly reversibility: Reversibility;
  readonly undoHint: string;
}

export const REVERSIBILITY_TABLE: readonly ReversibilityEntry[] = [
  { pattern: /\bgit\s+checkout\b/i, reversibility: 'easy', undoHint: 'git checkout <previous-branch-or-commit>' },
  { pattern: /\bgit\s+stash\s+pop\b/i, reversibility: 'easy', undoHint: 'git stash (to re-stash the changes)' },
  { pattern: /\bgit\s+commit\b/i, reversibility: 'easy', undoHint: 'git reset HEAD~1 (to undo the last commit)' },
  { pattern: /\bgit\s+merge\b/i, reversibility: 'easy', undoHint: 'git merge --abort or git reset --merge' },
  { pattern: /\bmv\b/i, reversibility: 'easy', undoHint: 'Move the file back with mv <dest> <src>' },
  { pattern: /\bcp\b/i, reversibility: 'easy', undoHint: 'Delete the copy with rm <destination>' },
  { pattern: /\brm\s+-[rRf]{1,3}\b/i, reversibility: 'irreversible', undoHint: 'No undo -- ensure files are backed up first' },
  { pattern: /\bgit\s+push\b/i, reversibility: 'irreversible', undoHint: 'Already pushed to remote; contact repo admin to revert' },
  { pattern: /\bDROP\b/i, reversibility: 'irreversible', undoHint: 'No undo for DROP; restore from database backup' },
  { pattern: /\bTRUNCATE\b/i, reversibility: 'irreversible', undoHint: 'No undo for TRUNCATE; restore from database backup' },
  { pattern: /\brm\b/i, reversibility: 'effort', undoHint: 'Restore from backup or trash (if available)' },
  { pattern: /\bnpm\s+install\b/i, reversibility: 'effort', undoHint: 'npm uninstall <pkg> or restore package.json' },
  { pattern: /\byarn\s+add\b/i, reversibility: 'effort', undoHint: 'yarn remove <pkg>' },
  { pattern: /\bpip\s+install\b/i, reversibility: 'effort', undoHint: 'pip uninstall <pkg>' },
] as const;
