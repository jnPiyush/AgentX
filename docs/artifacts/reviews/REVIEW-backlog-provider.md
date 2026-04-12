---
type: review
issue: backlog-provider-deep-review
date: 2026-03-14
agent: Reviewer
status: Complete
decision: Conditional Approval - fix two Major findings before merging
---

# Code Review: Backlog.md Provider Implementation

**Scope**: `.agentx/agentx-cli.ps1` - Backlog.md local provider (lines 504-1450 plus sync helpers ~1200-1420)
**Tests**: `tests/provider-behavior.ps1` - Backlog provider test group
**Commit reviewed**: `ae83325`
**Reviewer**: GitHub Copilot (AgentX Reviewer mode)
**Date**: 2026-03-14

---

## Summary

The Backlog.md provider is a well-structured adapter that maps AgentX issue operations
onto a file-backed Backlog.md-compatible Markdown/YAML format. The overall architecture
is sound: provider detection, CRUD seam functions, YAML parsing, task file serialization,
and GitHub sync are all clearly separated and follow consistent patterns.

Two Major findings prevent unconditional approval: a priority label round-trip data loss
bug (P0 loses urgency on read-back) and an unlocked config write in the Backlog-backend
issue numbering path. Four minor findings are advisory and do not block approval.

---

## Checklist Results

| Category | Result | Notes |
|----------|--------|-------|
| Spec Conformance | PASS | Provider CRUD interface matches local/GitHub/ADO contract |
| Code Quality | MOSTLY PASS | Functions well-named; two functions exceed 40 lines (Build-BacklogTaskContent at ~70, Sync-LocalBacklogToGitHubIfNeeded at ~60); DRY is good |
| Testing | PARTIAL | 49/49 pass; two Major gaps: P0 round-trip and concurrent-create coverage |
| Security | PASS | No hardcoded secrets; no SQL; file I/O uses -LiteralPath throughout; YAML is hand-parsed (no injection surface) |
| Performance | PASS WITH NITs | Correct for single-user; config re-read per prefix lookup; O(n) for large backlogs |
| Error Handling | PASS | Try/catch on all file I/O; null returns propagate correctly; Initialize-BacklogLocalStructure is idempotent |
| Documentation | PASS | Function names self-document intent; inline comments present where non-obvious |
| Intent Preservation | PASS | Round-trip from create -> update -> comment -> close preserves all fields correctly except P0 priority |

---

## Findings

### MAJOR

---

#### FINDING-1 [MAJOR]: Priority:P0 label lost on round-trip through Backlog

**Confidence**: HIGH

**Location**:
- `Convert-AgentXLabelsToBacklogPriority` (line 727): both `priority:p0` and `priority:p1` map to `'high'`
- `Convert-BacklogPriorityToAgentXLabel` (line 739): `'high'` maps back to `'priority:p1'`

**Reproduction**:
1. Create an issue with `--labels 'type:story,priority:p0'`
2. Read it back: `issue get -n 1 --json`
3. Observe: `labels` shows `priority:p1`, not `priority:p0`

**Root cause**: The mapping is lossy. P0 (urgent) and P1 (high) collapse to the same Backlog `priority` string, so P0 cannot survive the YAML round-trip.

**Impact**: Any issue assigned `priority:p0` silently degrades to `priority:p1` after the first save/read cycle. The ready queue still returns it, but urgency metadata is permanently discarded.

**Fix**: Map P0 to a distinct Backlog priority token, or preserve AgentX labels verbatim so the priority label is not re-derived from the lossy `priority` field on read-back.

Simplest fix that preserves Backlog.md compatibility:
```powershell
function Convert-AgentXLabelsToBacklogPriority([string[]]$labels) {
    foreach ($label in @($labels)) {
        switch ([string]$label) {
            'priority:p0' { return 'urgent' }   # p0 -> 'urgent' (distinct slot)
            'priority:p1' { return 'high' }
            'priority:p2' { return 'medium' }
            'priority:p3' { return 'low' }
        }
    }
    return 'medium'
}
```
And update `Convert-BacklogPriorityToAgentXLabel` so `'urgent'` maps back to `'priority:p0'`
(already handled by the existing `'urgent'` case). No other changes needed.

---

#### FINDING-2 [MAJOR]: Get-NextIssueNumber backlog path writes config without a file lock

**Confidence**: HIGH

**Location**: `Get-NextIssueNumber` (line 2802), backlog branch

**Reproduction**:
1. Start two concurrent `agentx issue create` processes in the same workspace
2. Both can read the same max-existing-number from disk before either writes the new file
3. Both compute the same $num, both write files with the same issue number
4. Second write silently overwrites the first issue

**Root cause**: The backlog path calls `Write-JsonFile $Script:CONFIG_FILE $cfg` directly.
The regular JSON provider (line 2833) has the same gap, but the backlog path is more
exposed because it scans task files (not just config), creating a wider read-then-write window.

`Invoke-WithJsonLock` is used correctly in `Sync-LocalBacklogToGitHubIfNeeded` (lines 1360,
1376, 1406, 1413), but not in `Get-NextIssueNumber`.

**Impact**: In a single-user sequential workflow this never triggers. In agentic
multi-session or parallel agent coordination scenarios (the target use case), concurrent
creates produce duplicate issue numbers. The second issue silently replaces the first.

**Fix**: Wrap the read-compute-write of nextIssueNumber in `Invoke-WithJsonLock`:

```powershell
if ((Get-LocalIssueBackend) -eq 'backlog') {
    $num = 1
    Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
        $existingNumbers = @(Get-LocalBacklogIssues | ForEach-Object { [int]$_.number } | Where-Object { $_ -gt 0 })
        $lockedCfg = Get-AgentXConfig
        $configuredNext = [int](Get-ConfigValue $lockedCfg 'nextIssueNumber' 1)
        $candidate = if (@($existingNumbers).Count -gt 0) { (($existingNumbers | Measure-Object -Maximum).Maximum + 1) } else { 1 }
        $num = [Math]::Max($candidate, $configuredNext)
        Set-ConfigValue $lockedCfg 'nextIssueNumber' ($num + 1)
        Write-JsonFile $Script:CONFIG_FILE $lockedCfg
    }
    return $num
}
```

Note: `$num` must be declared in the outer scope first because scriptblocks in
`Invoke-WithJsonLock` run in child scope.

---

### MINOR

---

#### FINDING-3 [MINOR]: ConvertFrom-BacklogInlineArray naive comma split

**Confidence**: MEDIUM

**Location**: `ConvertFrom-BacklogInlineArray` (line 550)

`$inner -split ','` splits on every literal comma. An inline element that contains
a comma (e.g., `['Description, with comma', 'label']`) would produce three tokens instead
of two. Today's label values (`type:story`, `priority:p1`) never contain commas, so this
is harmless. If custom label values with commas are introduced this silently truncates them.

**Recommendation**: Advisory only. Document the limitation or switch to a proper
CSV-aware split when values are quoted, but do not block approval on this.

---

#### FINDING-4 [MINOR]: ConvertFrom-BacklogYamlFrontmatter requires 2+ spaces for multiline array items

**Confidence**: HIGH

**Location**: `ConvertFrom-BacklogYamlFrontmatter` (line 569), pattern `^\s{2,}-\s*(.*)$`

Standard YAML allows any consistent indentation including one space. A `.md` file
hand-edited with single-space indented array items would have those items silently ignored,
producing an empty array rather than an error. Files generated by the system always use
2-space indentation so this never fires in practice.

**Recommendation**: Loosen to `^\s+-\s*(.*)$` (one or more spaces) and update the test
fixture to test 1-space indent as a regression guard.

---

#### FINDING-5 [MINOR]: Get-BacklogFrontmatterParts regex can match --- in file body

**Confidence**: MEDIUM

**Location**: `Get-BacklogFrontmatterParts` (line 596)

The regex `(?ms)^---\s*\r?\n(?<yaml>.*?)\r?\n---\s*\r?\n?(?<body>.*)$` uses `(?m)` which
makes `^` match the start of any line. If a task body contains a horizontal rule `---`
on its own line, the regex would treat it as the closing frontmatter delimiter, slicing
part of the body into the YAML capture group.

All files written by the system are safe because the body is managed through
`Set-MarkdownSectionContent` which uses `##` headings. However, imported or manually
edited task files with `---` hrules in the body would corrupt the metadata parse.

**Recommendation**: Anchor the frontmatter detection to the file start:
Use `(?s)^\---\s*\r?\n(?<yaml>.*?)\r?\n---\s*\r?\n?(?<body>.*)$` (remove `(?m)` and
anchor explicitly), or add a comment noting the limitation.

---

#### FINDING-6 [NIL]: Get-BacklogTaskPrefix re-reads config on every call

**Confidence**: HIGH

**Location**: `Get-BacklogTaskPrefix` (line 700)

Each call chain: `Get-BacklogTaskPrefix` -> `Get-BacklogLocalPaths` -> `Get-BacklogLocalResolution` -> `Read-BacklogConfigMetadata` (disk read). In a backlog sync of N issues this is N disk reads for a value that cannot change mid-operation.

**Recommendation**: Memoize into a `$Script:BacklogTaskPrefixCache` set once per process.
Not blocking. No correctness impact.

---

## Test Coverage Gaps

| Gap | Severity | Recommended Test |
|-----|----------|-----------------|
| `priority:p0` round-trip through Backlog | Major (would catch FINDING-1) | Create with p0, read back, assert label is still p0 |
| Concurrent issue create (same number) | Major (would catch FINDING-2) | Two parallel `issue create` calls, assert distinct numbers |
| Multiline-array item with 1-space indent | Minor | Hand-craft .md with 1-space indent, Assert labels parsed |
| Title change during update | Minor | Create, update with new title, assert old file gone and new file present |
| Custom `task_prefix` value | Minor | Set `task_prefix: 'feat'`, create issue, assert file named `feat-1-*` |
| Issue `list` output on Backlog backend | Minor | `issue list` after create+close, assert both present with correct state |
| Issue with `dependencies` field | Minor | Create with deps, read back, assert dependencies array round-trips |
| Malformed frontmatter (no `---`) | Minor | Raw .md without fences, assert graceful empty return |
| `backlog.config.yml` at repo root | Minor | Set root-level config, assert provider auto-detected |

---

## Positive Observations

- `Format-YamlScalar` correctly escapes single quotes by doubling them -- no injection surface.
- `Save-LocalIssue` atomically handles the `tasks/ -> completed/` file move when status changes.
- `Build-BacklogTaskContent` cleanly separates frontmatter, description, and metadata comment sections.
- `Remove-SurroundingQuotes` handles both single and double quote wrapping with double-quote escape.
- `Get-BacklogLocalResolution` probes multiple conventional paths (`backlog/`, `.backlog/`, `backlog.config.yml`) in priority order with graceful fallback.
- `Sync-LocalBacklogToGitHubIfNeeded` uses `Invoke-WithJsonLock` correctly throughout.
- All file I/O uses `-LiteralPath` and `-Encoding utf8`, preventing path-glob hazards and encoding drift.
- `Convert-BacklogTaskFileToAgentXIssue` returns `$null` on bad input and callers use `Where-Object { $_ }` to filter, preventing null propagation.

---

## Decision

**CONDITIONAL APPROVAL**

Approve after Engineer resolves:

1. FINDING-1 (P0 priority round-trip) -- map `priority:p0` to the `'urgent'` slot and add a test
2. FINDING-2 (unlocked nextIssueNumber write) -- wrap the backlog branch in `Invoke-WithJsonLock`

Findings 3-6 are advisory. They do not block approval but should be tracked as
tech-debt items or addressed in follow-up stories.

After the two fixes: re-run `tests/provider-behavior.ps1` and confirm 49+ tests pass.

