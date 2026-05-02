<!-- Inputs: {issue_number}, {slice_name}, {author}, {date} -->

# Evidence Summary: ${slice_name}

**Issue**: #${issue_number}
**Checkpoint**: Work | Review
**Status**: Draft | Current | Superseded
**Author**: ${author}
**Date**: ${date}

---

## Implementation Evidence

- Changed files: {paths or summaries}
- Generated artifacts: {paths or summaries}
- Scope confirmation: {what changed vs what stayed untouched}

## Verification Evidence

- Tests run: {unit, integration, e2e, or other validation}
- Static checks: {lint, build, typecheck, or equivalent}
- Result summary: {pass, fail, partial, blocker}

## Runtime Evidence

- Real-surface observation: {UI path, API response, log trace, command output, or walkthrough}
- Durable proof: {stored output, linked artifact, or summarized observation}
- Remaining runtime gap: {empty if complete}

## Evaluator Findings

- Active findings: {link or summary}
- Requested next action: {what must change before the slice can advance}

## Review References

- Work contract: {path}
- Review artifact: {path}
- Durable findings: {path}

## Notes

- {Anything important for resumption, rollback, or follow-up review}
---

## Appendix A: Evidence Diagrams (v8.4.43+)

> Additive section.

### A.1 Three Evidence Classes -> Review Decision

```mermaid
flowchart LR
    subgraph Evidence["Evidence classes"]
        Impl["Implementation evidence<br/>(diffs, files changed)"]
        Verify["Verification evidence<br/>(tests, build, lint, scan)"]
        Runtime["Runtime evidence<br/>(real-surface observation)"]
    end
    Impl --> Findings["Evaluator findings<br/>(HIGH / MEDIUM / LOW)"]
    Verify --> Findings
    Runtime --> Findings
    Findings --> Decision{Review decision}
    Decision -- approved --> Capture["Compound capture"]
    Decision -- changes requested --> Loop["Back to Work"]
    Decision -- blocked --> Block["Blocked - missing evidence"]
```

### A.2 Filled Mini-Example

| Class | Artifact | Path / link | Note |
|-------|----------|-------------|------|
| Implementation | Diff | `git show HEAD~1` | Adds `/health` endpoint and registration |
| Verification | xUnit run | `artifacts/test-results/health.trx` | 12/12 pass, coverage 86% |
| Verification | Static analysis | `artifacts/sast/health.sarif` | 0 high, 0 medium |
| Runtime | curl probe | `artifacts/runtime/health-prod.txt` | 200 OK, p95 18ms over 1k requests |

### A.3 Evidence Freshness Note

| Field | Value |
|-------|-------|
| Captured at | {ISO 8601 timestamp} |
| Captured by | {agent / role / human} |
| Valid until | {expiry; e.g., next deploy} |
| Reproducer command | {one command another agent can run} |


## Appendix B: Rich Visual Diagrams (v8.4.43+)

### B.1 Evidence Mix (pie)

```mermaid
pie showData
  title Evidence by class
  "Implementation" : 6
  "Verification" : 8
  "Runtime" : 4
```

### B.2 Evidence Flow (styled)

```mermaid
flowchart LR
  I[Implementation]:::i --> F[Evaluator finding]:::f
  V[Verification]:::v --> F
  R[Runtime]:::r --> F
  F --> D[Review decision]:::d
  classDef i fill:#e3f2fd,stroke:#1976d2
  classDef v fill:#e8f5e9,stroke:#388e3c
  classDef r fill:#fff3e0,stroke:#f57c00
  classDef f fill:#fce4ec,stroke:#c2185b
  classDef d fill:#f3e5f5,stroke:#7b1fa2
```
