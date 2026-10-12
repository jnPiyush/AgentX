---
title: Quality-Loop Artifact Scope Model Council
description: Factual record of already-executed independent council calls on the artifact-scoped quality-loop delta versus master 9.8.1.
author: GitHub Copilot
ms.date: 2026-10-12
ms.topic: reference
---

## Council Context

**Mode:** Independent read-only model sessions (already executed; this document
is a write-up, not a new council invocation)
**Purpose:** code-review
**Subject:** artifact-scoped quality-loop applicability delta versus master 9.8.1
(`.frontier/runtime/frontier-cli.ps1`, `vscode-extension/src/runtime/loopState.ts`)
**Owning loop:** L-P loop, active, iteration 4/20 (owner-reported; no lifecycle
action taken by this document)
**Source review state:** CHANGES_REQUESTED (unchanged)
**Decision status:** NOT a final approval. Approval is BLOCKED (see Synthesis).

## Provenance

| Item | Value |
|------|-------|
| Raw output file | `.frontier/state/lp-council-raw-2026-10-12.txt` |
| Raw file SHA256 | `3B224AA100834FEBC46E517420F84BDCD30E2DB4FA2C37B2D1B5C79D72342F5F` (re-verified when writing this document) |
| Transport | Official Copilot SDK sessions (`@github/copilot-sdk`) |
| Custom instructions | Disabled (`--no-custom-instructions`) |
| Tools | `availableTools=[]`; tool permission requests denied |
| Model lookup | Explicit model IDs resolved in the live authenticated SDK catalog |
| Model confirmation | `session.rpc.model.getCurrent().modelId` checked before and after each successful call |
| Source | `host-agent` |
| GitHub Models CLI catalog | Failed (HTTP 200 with `text/plain` body `OK`, not a catalog) |
| Alternate catalog | Official Copilot SDK catalog, `authenticated: true`, worked |
| Billing | No billing change made |
| Premium inference cost | Not measured. MUST NOT be reported as zero. |

Model IDs are catalog aliases as selected by the host. They are not proof of
specific underlying model snapshots.

## Questions

1. Does the delta correctly limit loops to PRD/TechSpec/code/unit-test
   mutations without role-based exemptions?
2. Do exact staged path/blob/mode bindings and exempt-commit handling hold
   against bypass (stop-parsing, escapes, Git aliases/includes, direct
   `.git/config` or hook writes)?
3. Does `adopt-scope` authenticate owner authority?
4. Do recognizers cover declared PRD/TechSpec artifacts with ordinary names?

## Council Roster

| Role | Requested model | Selected model | Status | Session ID | Latency (ms) |
|------|-----------------|----------------|--------|------------|--------------|
| Analyst | gpt-5.6-sol | gpt-5.6-sol | ok | 08f62bdb-94e8-40fd-9a7b-c200295f5320 | 35878 |
| Strategist | claude-opus-5.5 | claude-opus-5.5 | ok | 26ad5527-1768-4b82-9b2f-98be509aa141 | 58281 |
| Skeptic (bounded replacement) | gpt-5.4 | gpt-5.4 | ok | af3106b0-486c-4287-9006-d26e133ba81d | 27692 |

Diversity note: three distinct successful model selections, but Analyst
(gpt-5.6-sol) and Skeptic replacement (gpt-5.4) share the same provider and
model family. Gemini was unavailable in the catalog; the xAI model (grok-4.7)
timed out. Provider diversity is therefore two providers, not three.

## Attempts (Including Failures)

| # | Role | Requested model | Selected model | Status | Detail |
|---|------|-----------------|----------------|--------|--------|
| 1 | Analyst | gpt-5.6-sol | gpt-5.6-sol | ok | See roster |
| 2 | Strategist | claude-opus-5.5 | claude-opus-5.5 | ok | See roster |
| 3 | Skeptic | grok-4.7 | (none) | failed | `Timeout after 180000ms waiting for session.idle`; raw file records `COUNCIL_EXECUTION` status `incomplete` at 2026-10-12T17:50:31.685Z |
| 4 | Skeptic (replacement) | gpt-5.4 | gpt-5.4 | ok | Bounded single fallback; replacement reason `180000ms session.idle timeout; supported-model lower-reasoning retry`; recordedAt 2026-10-12T17:54:37.465Z |

The failed attempt is retained here so that the completed execution record
below does not hide it.

## Member Responses

Analyst and Strategist text is copied from the raw file. The only edits are
ASCII normalization required by repository policy (em dash -> `--`, curly
apostrophe -> `'`). The fallback Skeptic response is not in the raw file; it is
recorded as the host-reported content of the fallback call output.

### Analyst (gpt-5.6-sol) -- REQUEST_CHANGES

````text
## REQUEST_CHANGES

### HIGH -- Covered PRD/TechSpec false negatives *(introduced)*

`Test-LoopCoveredPath` / `isLoopCoveredPath` recognize only special directories or filename prefixes such as `prd-*` and `techspec-*`. Ordinary declared artifacts such as `docs/product-requirements.md` or `docs/architecture.md` remain exempt because `.md` is exempt first-class content unless the naming regex matches. This violates the stated coverage of PRD and TechSpec mutations and can bypass both loop creation and staged-scope approval.

**Smallest fix:** support an explicit, repository-owned declaration of PRD/TechSpec paths and consult it in both PowerShell and TypeScript classifiers before extension exemptions. Keep current naming conventions as convenience, but do not attempt an expanding filename blacklist/heuristic set.

### HIGH -- Git verification control plane remains bypassable *(mostly inherited, incompletely remediated here)*

The delta depends on pre/post-commit hooks yet terminal checks are textual and bypassable:

- `git commit -m --% x -n`
- escaped `com\`mit` / `core.hooks\`Path`
- `git config` include or alias writes
- direct writes to `.git/config` or hook files

Notably, `.git/config` is treated as exempt by the `.config` extension rule. Disabling or redirecting hooks defeats exact staged approval and loop consumption. These capabilities largely predate this delta, but the newly added defenses do not close them and therefore cannot support the delta's stronger guarantee.

**Smallest fix:** parse PowerShell commands structurally and fail closed for dynamic/stop-parsing commit invocations; inspect normalized AST argument values for verification-disabling options. Independently deny mutations to the resolved Git directory's config/hooks and deny `git config` writes affecting hook paths, aliases, or includes. This is a bounded control-plane rule, not an interpreter blacklist.

### MEDIUM -- Scope-adoption authorization is not authenticated *(introduced)*

`adopt-scope` accepts a command-line flag plus any fresh evidence file. An agent able to create files can manufacture both. Freshness and hashing establish integrity, not owner authorization. The stated owner adoption may validate this particular migration, and preserved history/digests plus the required fresh scoped review reduce impact, but the command's general authorization claim is unsound.

**Smallest fix:** require an already available trusted-host/user-input approval record or owner-operated invocation; otherwise describe evidence only as migration provenance, not authenticated authorization.

### Limitations

- No suites ran, so parser, path-classification, staged blob/mode, deletion/symlink, and hook-consumption behavior is unverified.
- The iteration-4 history/digest verification and inclusion of 15 covered paths support this migration's integrity but do not resolve the policy defects above.
- Git hooks remain inherently bypassable by users with unrestricted repository control; the claimed guarantee should be scoped to mediated agent/tool execution.
````

### Strategist (claude-opus-5.5) -- REQUEST_CHANGES

````text
# Strategist Review: Artifact-Scoped Quality-Loop Delta vs 9.8.1

**Verdict: REQUEST_CHANGES.** The scoping model is sound: staged `path`/`blob`/`mode` binding, exempt commits that do not consume a loop, and post-commit consumption bound to the tree and state hash. Two MEDIUM gaps still block approval: hook bypasses can go undetected, and PRD/TechSpec coverage is incomplete. Neither needs a new architecture.

## HIGH/MEDIUM findings

**1. MEDIUM (inherited, partly widened): client-hook bypasses go undetected.**
- The `--%` check fails in two ways:
  - The preceding `-m` consumes it as the message operand.
  - PowerShell's stop-parsing token folds `x -n` into the verbatim extent.
- Backtick escapes (``com`mit``, ``core.hooks`Path``) defeat both the raw-text regex and the `Extent.Text` comparisons.
- The parser is PowerShell, but terminals may run bash, so bash quoting (`--no\-verify`) is also missed.
- Git config writes are not blocked: `git config alias.*`, `include.path`, `core.hooksPath`.
- Direct `.git/config` or `.git/hooks` edits are classified as "covered" (no extension). That only requires an active loop; it does not block the edit.
- Inheritance: 9.8.1 had the same `--no-verify` class. The delta still claims "no bypass," so the gap matters more now.

**2. MEDIUM (introduced/unfinished): PRD/TechSpec coverage depends on file names.**
- Ordinary names are missed, e.g. `docs/product-requirements.md`, `TECH-SPEC.md`, and a singular `spec/` directory.
- Separately, the exempt-extension list covers executable configuration:
  - `.github/workflows/*.yml`, `package.json` scripts, `.psd1` (`ScriptsToProcess`), `.env`.
  - These are implementation in substance, so edits to them bypass the loop.
- The extension `isLoopCoveredPath` mirrors the CLI regex. That duplication will drift.

**3. LOW (introduced): scope adoption trusts agent-supplied flags.**
- `adopt-scope` takes flags and an evidence file that an agent can produce.
- Impact is limited:
  - Adoption sets `coveredBaseline = @()`, so every current covered mutation needs fresh review.
  - It widens what must be reviewed; it never grants approval.
- Still, add `adopt-scope` to the hook's list of user-only operations alongside `--input-decision`.

## Smallest defensible fix

1. **Detect bypasses instead of blacklisting them.**
   - Append each consumed acceptance tree to loop state.
   - In `loop gate`/handoff, run `git rev-list <loop-start-HEAD>..HEAD`.
   - Block if any commit touching covered paths has a tree with no recorded acceptance.
   - Cost: one bounded `rev-list` + `diff-tree`. This makes every hook bypass detectable at handoff without enumerating interpreters.
2. **Allowlist commit syntax.**
   - Accept only `git commit` plus a closed set of options (`-m`/`-F` with a single literal, `-s`, `--amend`).
   - Reject any command containing a backtick, `\`, `$`, or `--%`.
   - Use AST `StringConstantExpressionAst.Value`, not `Extent.Text`.
3. **Protect Git configuration.**
   - Treat `.git/` as protected state for file tools.
   - Block `git config` except `--get` and `--list`.
4. **Make coverage declarative.**
   - Add a `coveredArtifacts` glob list in repo config: defaults plus declared PRD/TechSpec paths, workflows, and package manifests.
   - Have the TypeScript extension call `loop applicability` (the CLI path classifier) rather than duplicating the regex.

## Verified-by-reading (not executed)

- `requiresEngineeringLoop` and `Test-HookScopeRequiresLoop` fail closed on empty, unresolvable, wildcard, hard-link, and extensionless paths.
- Pre-commit cannot drift between check and accept: it re-runs `write-tree` and compares the result.
- Removing the role-based exemption is consistent with "roles cannot exempt edits."

## Limitations

- No suites ran; all conclusions come from static reading of the diff.
- Unseen functions were assumed correct: `Assert-LoopReviewCurrent`, `Resolve-HookPathComponents`, `Test-TrustedFrontierCommand`, and the `$pathAnalysis` origin.
- The parsing of `--%` and backtick tokens is inferred from PowerShell AST semantics, not tested.
- The 15 covered paths and the unchanged digests at iteration 4/20 are owner-reported and were not independently verified.
- Server-side or CI enforcement remains the only true guarantee; fix 1 is detection, not prevention.
````

### Skeptic (gpt-5.4, bounded replacement) -- REQUEST_CHANGES

Host-reported response content (not present in the raw file):

- **HIGH:** raw regex / `Extent.Text` matching allows escaped ``com`mit`` /
  ``core.hooks`Path`` and `git commit -m --% x -n`. Fix: normalize semantic
  tokens and reject stop-parsing.
- **HIGH:** Git aliases/includes and direct `.git/config` / hooks mutations can
  disable verification even while a loop is active. Fix: protect the Git control
  plane rather than merely marking those paths loop-covered.
- **MEDIUM:** the `adopt-scope` flag plus fresh evidence is documentary, not
  authenticated authority. Fix: trusted host authorization.
- **MEDIUM:** ordinary-name declared PRD/TechSpec artifacts are omitted by the
  naming recognizers. Suggested a declaration registry; noted that the Analyst
  recommendation is stronger than accepting a weaker naming heuristic.
- **Limitations:** read-only review; no suites ran.

## Execution Evidence

```json
{
  "schemaVersion": 1,
  "status": "complete",
  "recordedAt": "2026-10-12T17:54:37.465Z",
  "members": [
    {
      "role": "Analyst",
      "requestedModel": "gpt-5.6-sol",
      "selectedModel": "gpt-5.6-sol",
      "source": "host-agent",
      "status": "ok",
      "sessionId": "08f62bdb-94e8-40fd-9a7b-c200295f5320",
      "latencyMs": 35878
    },
    {
      "role": "Strategist",
      "requestedModel": "claude-opus-5.5",
      "selectedModel": "claude-opus-5.5",
      "source": "host-agent",
      "status": "ok",
      "sessionId": "26ad5527-1768-4b82-9b2f-98be509aa141",
      "latencyMs": 58281
    },
    {
      "role": "Skeptic",
      "requestedModel": "gpt-5.4",
      "selectedModel": "gpt-5.4",
      "source": "host-agent",
      "status": "ok",
      "sessionId": "af3106b0-486c-4287-9006-d26e133ba81d",
      "latencyMs": 27692
    }
  ],
  "failedAttempts": [
    {
      "role": "Skeptic",
      "requestedModel": "grok-4.7",
      "source": "host-agent",
      "status": "failed",
      "error": "Timeout after 180000ms waiting for session.idle"
    }
  ]
}
```

`status: complete` means three successful role responses were obtained after one
bounded replacement. It does not mean the failed grok-4.7 attempt succeeded, and
it does not establish three-provider diversity.

## Synthesis

### Consensus

All three successful members returned **REQUEST_CHANGES**. Shared findings:

1. **Semantic Git bypasses.** Textual / `Extent.Text` checks miss stop-parsing
   (`git commit -m --% x -n`) and backtick-escaped tokens (``com`mit``,
   ``core.hooks`Path``). Analyst and Skeptic: HIGH; Strategist: MEDIUM.
2. **Git metadata control plane.** `git config` alias/include/`core.hooksPath`
   writes and direct `.git/config` or hook-file writes can disable or redirect
   verification. Marking them loop-covered does not block them. Analyst and
   Skeptic: HIGH; Strategist: MEDIUM.
3. **Incomplete declared PRD/TechSpec coverage.** Naming recognizers omit
   ordinarily named PRD/TechSpec artifacts. Analyst: HIGH; Strategist and
   Skeptic: MEDIUM. Analyst and Skeptic favor an explicit repository-owned
   declaration over expanding heuristics.
4. **Adoption trusted-authority gap.** `adopt-scope` flags plus fresh evidence
   prove integrity, not owner authority. Analyst and Skeptic: MEDIUM;
   Strategist: LOW (impact bounded because adoption resets the covered baseline
   and only widens review scope).

### Divergences

- **Severity:** Strategist rated the Git bypass findings MEDIUM and adoption LOW;
  the other two rated them HIGH and MEDIUM respectively. The higher severities
  are retained for blocking purposes.
- **Configuration coverage:** Strategist proposed treating workflows, package
  manifests, `.psd1` and `.env` as covered implementation. This is NOT adopted.
  By user requirement, configuration and declarations remain ordinarily exempt;
  this record does not silently redefine all configuration as implementation.
  Protecting the Git control plane (finding 2) is a distinct, narrower rule.
- **Mechanism:** Strategist favors post-hoc detection (`rev-list` against
  recorded acceptance trees) plus a commit-syntax allowlist; Analyst and Skeptic
  favor structural AST normalization with fail-closed stop-parsing plus Git
  control-plane denial. These are complementary, not exclusive.

### Hidden Risks

- The PowerShell parser does not cover bash-quoted variants (Strategist).
- Duplicate PowerShell and TypeScript classifiers can drift (Strategist).
- Hook-based guarantees hold only for mediated agent/tool execution; server-side
  or CI enforcement is the only full guarantee (Analyst, Strategist).

### Scope Adoption Run (Owner-Reported Fact)

The owner's actual `adopt-scope` run succeeded: 15 covered paths, history
preserved, iteration 4, `startedAt`, quality baseline hash and engineering
baseline hash unchanged. This validates that specific migration's integrity
only; it does NOT fix the general adoption authority policy.

### Decision

**Approval BLOCKED.** Blocking items:

1. Semantic Git command bypasses (stop-parsing, escaped tokens).
2. Git metadata bypasses (aliases, includes, `core.hooksPath`, direct
   `.git/config` / hooks writes).
3. Incomplete declared PRD/TechSpec coverage.
4. Adoption trusted-authority gap.
5. Missing regression breadth: no tests demonstrate the parser, classifier,
   staged blob/mode, Git control-plane and adoption behaviors above.

Source review remains CHANGES_REQUESTED.

## Limitations

- No test suites ran; no suite is claimed passed.
- No code-quality score was supplied or computed.
- No final verdict is issued by this document.
- No loop lifecycle action, commit, push or publication was performed.
- Premium inference cost was not measured.
- Model IDs are aliases, not proof of underlying snapshots.
