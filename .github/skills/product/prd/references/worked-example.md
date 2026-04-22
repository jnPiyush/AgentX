# Worked Example: "Intelligent Docs Search" PRD

> **Parent skill**: [PRD](../SKILL.md)
> **Purpose**: A compact, filled PRD demonstrating concrete requirements, explicit Non-Goals, and a complete product-facing AI contract.
> **Scope**: This is an illustrative example, not a real feature. Use it as a shape reference when writing real PRDs.

---

## 1. Problem Statement

Developers waste ~15 minutes per day searching for specific snippets across our 120-repo monorepo. Keyword search returns too many false positives; Slack-asking teammates has ~2h response latency. If unaddressed, onboarding stays slow (new-hire time-to-first-PR averages 9 days) and documentation debt compounds because nobody can find existing patterns.

## 2. Target Users

**Primary**: Backend engineers (N=180) working across the monorepo, median 2 years tenure, comfortable with CLI.
**Secondary**: New hires in first 30 days (N=~8/month) who do not yet know the repo structure.

## 3. Goals & Success Metrics

| Metric | Baseline | Target | Window |
|---|---|---|---|
| Median search-to-answer time | 15 min | <= 2 min | 30 days post-launch |
| New-hire time-to-first-PR | 9 days | <= 6 days | 90 days post-launch |
| Citation accuracy on eval set | n/a | >= 95% | From day 1 |
| p95 query latency | n/a | <= 3s | From day 1 |

## 4. Requirements

### P0 -- Must Have

**FR-1: Natural-language query endpoint.**
*AC:* POST `/search` accepts `{query: string}`, returns `{answer: string, citations: [{path, line_start, line_end, score}]}` within 3s p95 for queries <=200 tokens.

**FR-2: Grounded responses.**
*AC:* Every answer includes >=1 citation whose `score` >= 0.6. Responses with no citation at `score >= 0.6` return the fallback: `"No confident match. Top 3 related files: ..."`.

**FR-3: Evaluation gate in CI.**
*AC:* `evaluation/datasets/docs-search.jsonl` contains 50 held-out queries with expected citation paths. CI blocks merge when Citation Precision@3 < 95% or Faithfulness (RAGAS) < 0.85.

### P1 -- Should Have

**FR-4: Multi-turn clarification.**
*AC:* When `query` is ambiguous (classifier confidence < 0.7), the response is `{clarification_question: string}` instead of an answer.

### P2 -- Could Have

**FR-5: Copy-to-clipboard button in the CLI renderer.**

### Non-Goals (this PRD)

- Cross-monorepo semantic search outside the 120 repos in `config/repo-allowlist.json`.
- Code generation or edit suggestions.
- IDE plugin (tracked separately).
- Indexing issues, PRs, or Slack history.

## 4.2 AI/ML Requirements (product-facing contract)

| Field | Value |
|---|---|
| Primary AI Job | Answer natural-language questions about internal codebase and docs with citations to source files. |
| Grounding Sources | Markdown files under `docs/`, inline code comments, and README files in the 120 allowlisted repos. No external web. |
| Tool / Action Boundaries | MAY read indexed content and issue retrieval queries. MUST NOT execute code, open PRs, or write to any repo. |
| Response Contract | Structured JSON: `{answer, citations[]}`. Plain-text `answer`, citations always an array (possibly empty when falling back). |
| Fallback Behavior | When no citation scores >=0.6, return top-3 related file paths with the phrase `"No confident match."` Never fabricate citations. |
| Human Review Trigger | None at runtime (read-only tool). Weekly human review of 20 sampled queries for quality-drift tracking. |
| Quality Threshold | Citation Precision@3 >= 95%; Faithfulness (RAGAS) >= 0.85; p95 latency <= 3s. Eval dataset: `evaluation/datasets/docs-search.jsonl`. |

#### Technology Classification
- [x] AI/ML powered -- requires LLM inference + embedding model

#### Model Requirements
| Requirement | Spec |
|---|---|
| Model Type | LLM (generation) + embedding (retrieval) |
| Provider | Microsoft Foundry (pinned) |
| Latency | Near-real-time (<3s p95) |
| Quality Threshold | Faithfulness >= 0.85, Citation P@3 >= 95% |
| Cost Budget | $0.02 per query p95 |
| Data Sensitivity | Internal only -- no PII expected; PII filter runs defensively |

## 5. User Stories

| ID | Story | AC | Priority |
|---|---|---|---|
| US-1 | As a backend engineer, I want to ask `"how do we do feature flags?"` and get a direct answer with file citations, so I stop grepping. | Returns answer + >=1 citation with `score>=0.6` within 3s p95. | P0 |
| US-2 | As a new hire, I want ambiguous questions to be clarified rather than guessed at, so I dont get sent down the wrong path. | Queries with ambiguity-classifier confidence <0.7 return a clarification question instead of an answer. | P1 |

## 6. User Flows

1. Engineer runs `docs-search "<query>"` in the CLI.
2. CLI hits `/search`; loading indicator shown for up to 3s.
3. Response rendered: answer + numbered citations (clickable in VS Code terminal).
4. **Alt 3a**: No confident match -> fallback list of related files.
5. **Alt 3b**: Ambiguous -> CLI prompts the user to refine.

## 7. Dependencies & Constraints

- Microsoft Foundry project `docs-search-prod` provisioned and accessible via managed identity (confirmed with Platform team).
- Embedding index refreshed nightly via the existing `repo-sync` cron.
- Budget: $500/month inference cost cap enforced via Foundry quota.

## 8. Risks & Mitigations

| Risk | Impact | Prob | Mitigation |
|---|---|---|---|
| Model hallucinates citations | High | Med | Faithfulness gate in CI; runtime citation verifier rejects answers whose cited lines do not contain referenced terms. |
| Index staleness misleads users | Med | Med | Show `indexed_at` timestamp with every response; nightly refresh + on-demand refresh endpoint. |
| Query cost spikes | Med | Low | Per-user rate limit 60/min; budget alert at 80% of monthly cap. |

## 9. Timeline

- Phase 1 (weeks 1-2): Retrieval index + `/search` endpoint, fallback behavior, eval dataset seeded with 30 queries.
- Phase 2 (week 3): Clarification classifier, CLI renderer.
- Phase 3 (week 4): Eval dataset to 50 queries, CI gate enabled, soft launch to platform team.

## 10. Out of Scope

Covered in section 4 Non-Goals.

## 11. Open Questions

- Do we need RBAC on which repos a given user can query? (Owner: Security team; needed by end of Phase 1.)
- Should clarification questions be generated by the same LLM or a smaller classifier? (Owner: Data Scientist.)

## 12. Appendix

- Eval dataset: [`evaluation/datasets/docs-search.jsonl`](../../../../../evaluation/datasets/docs-search.jsonl) (to be created).
- Model pin: `<provider>/<model>@<version>` -- exact value resolved by Architect/Data Scientist alignment checkpoint.

---

## What This Example Demonstrates

- **Every success metric is numeric and has a window.**
- **Every P0 requirement has a testable AC.**
- **Non-Goals are explicit at the PRD level.**
- **The AI contract is fully product-facing** -- Architect and Data Scientist can now specify retrieval, chunking, and prompting without guessing what the product wants.
- **Fallback behavior is defined** -- "never fabricate citations" is a product rule, not an implementation detail.
- **Open Questions are listed** -- the PRD does not fabricate answers for unresolved items.

Compare this to the vague equivalents in [requirements-quality.md](requirements-quality.md) to see the rewrite pattern in action.
