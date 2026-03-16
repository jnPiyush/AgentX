# Tech Debt Tracker

> Known gaps, deferred work, and planned improvements.
> Add items as they are discovered. Remove items when resolved.

---

## Active Debt

### High Priority

| ID | Area | Description | Impact | Added |
|----|------|-------------|--------|-------|
| TD-001 | VS Code Extension | Test coverage gaps remain in `chat/`, `commands/`, and current harness integration paths | Regressions may go undetected in the live extension runtime | v8.0.0 |
| TD-002 | Bash CLI | `agentx.sh` missing parity with `agentx.ps1` (config, loop, workflow commands) | Linux/macOS users have reduced CLI functionality | v8.0.0 |
| TD-004 | Documentation | No automated doc count validation in CI -- counts can drift from reality | Agents given wrong counts, confusion in routing | v8.0.0 |
| TD-012 | Harness Enforcement | Complex-task execution plan policy exists in docs but is not yet enforced by CI or workflow automation | Plan-first workflow can drift or be skipped | v8.2.0 |
| TD-013 | Harness Runtime | No explicit thread/turn/item/evidence runtime model in the visible extension and CLI surfaces | Limits durable progress tracking and rich agent legibility | v8.2.0 |

### Medium Priority

| ID | Area | Description | Impact | Added |
|----|------|-------------|--------|-------|
| TD-005 | Preview Agents | 7 internal sub-agents (GitHub Ops, ADO Ops, etc.) need field-testing hardening | Edge cases may cause unexpected behavior | v8.0.0 |
| TD-008 | Template Inputs | Not all templates declare `<!-- Inputs: -->` comment blocks | Agents may fill templates incorrectly | v8.0.0 |
| TD-014 | Entropy Cleanup | Weekly health reporting exists but doc-gardening, archival marking, and targeted cleanup automation are not implemented | Stale docs and agent drift may compound over time | v8.2.0 |
| TD-015 | Validation Evidence | Evidence-backed validation is now specified but not yet captured or checked consistently across workflows | Reviews remain partially narrative instead of evidence-driven | v8.2.0 |

### Low Priority

| ID | Area | Description | Impact | Added |
|----|------|-------------|--------|-------|
| TD-009 | Domain Skills | Only 5 domain verticals (oil & gas, financial, audit, tax, legal) | Limited domain coverage for consulting agents | v8.0.0 |
| TD-011 | README | Missing badges (CI status, coverage, version) and screenshots | Less professional first impression | v8.0.0 |

---

## Resolved Debt

| ID | Area | Description | Resolved In | Resolution |
|----|------|-------------|-------------|------------|
| TD-R01 | AGENTS.md | Monolithic 920-line file crowding agent context | v8.0.0 | Split into slim AGENTS.md + docs/WORKFLOW.md |
| TD-R02 | Documentation | Stale agent/skill/template counts across 4 files | v8.0.0 | Audited and fixed all counts (commit 3850f1e) |
| TD-R03 | Frontmatter | validate-frontmatter.ps1 had terse error messages | v8.0.0 | Added remediation instructions to all error messages |
| TD-R04 | Documentation | No automated link validation in CI (TD-003) | v8.2.0 | Added `scripts/validate-references.ps1` + reference check step in `quality-gates.yml` |
| TD-R05 | Instruction Tokens | No automated token count enforcement (TD-007) | v8.2.0 | Added `scripts/token-counter.ps1`, `.token-limits.json`, token-optimizer skill, and CI token budget check |
| TD-R06 | Memory System | Git-backed observation store untested at scale (>1000 observations) (TD-006) | v8.2.0 | Added `tests/memory-scale-test.ps1` - validates JsonObservationStore pattern at 1500+ observations (all 11 tests pass, performance thresholds met) |
| TD-R07 | Comparison Docs | Point-in-time comparison and adoption review documents created documentation drift and clutter | v8.2.8 | Removed the stale comparison-review debt and unreferenced external adoption review during documentation cleanup |

---

## How to Add Debt

When you discover a gap or defer work, add a row to the appropriate priority section:

```markdown
| TD-NNN | Area | Description | Impact | Added |
```

When resolving debt, move the row to the Resolved section with the version and resolution description.

---

**See Also**: [QUALITY_SCORE.md](QUALITY_SCORE.md) | [GOLDEN_PRINCIPLES.md](GOLDEN_PRINCIPLES.md) | [AGENTS.md](../AGENTS.md)
