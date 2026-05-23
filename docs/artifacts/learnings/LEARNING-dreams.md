# LEARNING: agentx dream command - PowerShell CLI patterns

**Issue**: dreams (standalone feature, no issue number)
**Date**: 2026-05-23
**Status**: Closed - captured

---

## Context

Implemented the `agentx dream` subcommand for memory consolidation lifecycle
(create / status / list / cancel / archive / help). Six subcommands, deterministic
dedup consolidation, LLM hook stubbed for v2.

---

## Key Learnings

### 1. `[ordered]` type accelerator only valid on hash literals

`[ordered]@{}` is valid PowerShell. Using it as a parameter type annotation
(`param([ordered]$Dict)`) causes a parse error at script load time.

Fix: use `[System.Collections.Specialized.OrderedDictionary]` as the type.

### 2. RelPath must be relative to MemPath, not ROOT

When writing output files, compute the relative path from the memory store
base (`$MemPath`) not the workspace root (`$script:ROOT`). Using ROOT causes
double-nesting when `$MemPath` is inside ROOT.

### 3. Format-Ts dual-type pattern for ConvertFrom-Json compat

`ConvertFrom-Json` deserializes ISO-8601 strings as `[datetime]` on some
PowerShell versions but as `[string]` on others. Accept `[object]` and branch:

```powershell
function Format-Ts ([object]$v) {
    if ($v -is [datetime]) { return $v.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }
    if ($v -is [string] -and $v) { return $v }
    return ''
}
```

### 4. exitCode pattern - never exit (Invoke-Function ...)

All returns must use:
```powershell
$script:exitCode = 1; return
```
Never use `exit (Invoke-Function ...)` - it swallows stdout to the pipeline.
Dispatch block ends with `exit $script:exitCode`.

### 5. AGENTX_WORKSPACE_ROOT env-var injection in isolated tests

For tests that need an isolated workspace, inject the root via env var:
```powershell
$env:AGENTX_WORKSPACE_ROOT = $TestRoot
$out = & pwsh -NoProfile -File $Script @Args 2>&1
$env:AGENTX_WORKSPACE_ROOT = $null
```
In the script under test: `$script:ROOT = if ($env:AGENTX_WORKSPACE_ROOT) { $env:AGENTX_WORKSPACE_ROOT } else { (Resolve-Path ...).Path }`

### 6. Case-insensitive dedup with HashSet + StringComparer

```powershell
$seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($entry in $entries) {
    if ($seen.Add($entry.text)) { $deduped += $entry }
}
```

### 7. ConvertTo-Json -Compress for programmatically-parsed output

When JSON output will be parsed by tests or callers, use `-Compress` for
single-line output to avoid multiline parsing issues.

### 8. param([string[]]$Args) naming conflict

Declaring `param([string[]]$Args)` in a PowerShell function causes `@Args`
inside that function to refer to PowerShell's automatic `$args` variable
(always empty in param-declared functions), not the declared parameter.

Fix: rename to `$DreamArgs` / `@DreamArgs` (or any non-reserved name).

### 9. try/catch required for ConvertFrom-Json when ErrorActionPreference=Stop

`-ErrorAction SilentlyContinue` is ignored by some cmdlets when
`$ErrorActionPreference = 'Stop'` is set at scope level. Wrap instead:

```powershell
$json = $null
try { $json = $raw | ConvertFrom-Json } catch { $json = $null }
```

### 10. IsPathRooted check before joining workspace root with user-supplied paths

`Join-Path $ROOT $UserPath` silently double-nests on Windows when `$UserPath`
is already absolute (e.g. `C:\Temp\out`). Guard with:

```powershell
$resolved = if ([System.IO.Path]::IsPathRooted($UserPath)) { $UserPath }
            else { Join-Path $ROOT $UserPath }
```

### 11. ASCII-only rule applies to comments

Em-dashes and other Unicode punctuation in code comments violate the
ASCII-only rule. Replace `--` for em-dash, `-` for en-dash.

---

## Evidence

- 27/27 tests passing (tests/dream-behavior.ps1)
- Loop complete: 5 iterations, zero HIGH/MEDIUM findings
- Evidence archived at .agentx/state/loop-evidence/

---

## Related Files

- `scripts/dream.ps1`
- `tests/dream-behavior.ps1`
- `prompts/dream-consolidation.md`
- `.agentx/agentx-cli.ps1` (dispatch wiring)
