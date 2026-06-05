# Architecture Review: CLI Runtime Migration to Shared TypeScript Runtime

- **Mode**: `agentx`
- **ADR**: [docs/artifacts/adr/ADR-401.md](../adr/ADR-401.md)
- **Tech Spec**: [docs/artifacts/specs/SPEC-401.md](../specs/SPEC-401.md)
- **Council**: [docs/artifacts/adr/COUNCIL-401.md](../adr/COUNCIL-401.md)
- **Architect**: AgentX Architect
- **Reviewer**: AgentX Architecture Reviewer
- **Date**: 2026-06-01
- **Domain labels**: needs:ai
- **Decision**: APPROVED

---

## Summary

- **Mode**: `agentx`
- **Pre-review gates**: PASS
- **Findings**: 0 Critical, 0 High, 2 Medium (both already tracked in ADR/Spec risk registers), 2 Low
- **Frameworks cited**: ATAM (trade-off), STRIDE (security), ISO/IEC 25010 (maintainability/portability)
- **Decision rationale**: ADR-401 evaluates 5 options against differentiating criteria, selects a council-consensus option (Option D), bounds migration scope to the enforcement core, and makes two prerequisites (cli.mjs post-mortem + golden-file parity suite) hard gates. SPEC-401 turns this into an implementation-ready contract with preserved durable state, preserved CLI surface, and cross-platform behavior. No critical or high gaps remain; the two Medium items are already in the risk register with mitigations.

---

## Pre-Review Gates (AgentX Workflow Mode)

| Gate | Result | Evidence |
|------|--------|----------|
| Issue exists | PASS | #401 |
| Parent context (ADR-400/341) | PASS | referenced and amended explicitly |
| ADR present, decision stated | PASS | ADR-401 Decision = Option D |
| Tech Spec present, all sections | PASS | SPEC-401 13/13 sections (scorer) |
| 3+ options considered | PASS | 5 options (A-E) with diagrams |
| Zero code in ADR/Spec | PASS | scorer: 0 code blocks |

---

## 12-Dimension Review

| # | Dimension | Result | Notes |
|---|-----------|--------|-------|
| 1 | Business/requirement fit | PASS | Directly serves ADR-400 goal: gate must run on Agents Window/Copilot CLI/Cloud |
| 2 | Scalability | PASS | Not a scale-bound change; agent engine parity preserved |
| 3 | Reliability/availability | PASS | Defense-in-depth retained (independent bash gate); atomic state writes specified |
| 4 | Security | PASS | STRIDE-relevant items covered: cred handling, command allowlist, atomic writes, dep scanning |
| 5 | Data | PASS | Durable JSON contract explicitly unchanged; parity suite enforces it |
| 6 | Integration | PASS | Native MCP SDK is the decisive integration driver; CLI surface preserved |
| 7 | Observability | PASS | Loop history, session traces, gate events, parity-suite drift guard |
| 8 | Deployment | PASS | Phased sequencing with exit gates; Node preinstalled on targets |
| 9 | Cost | PASS | Bounded to ~11.9K LOC core vs full 40K; reuses extension runtime |
| 10 | Maintainability (ISO 25010) | MEDIUM | Repo stays bilingual; accepted trade-off, documented |
| 11 | Compliance/portability | MEDIUM | Node LTS floor must be pinned to avoid version skew (Open Q #3) |
| 12 | Risks | PASS | Council failure modes promoted into ADR Consequences + Spec risk register |

---

## Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| M1 | Medium | Bilingual repo increases contributor onboarding cost | Accepted trade-off in ADR Consequences |
| M2 | Medium | Node LTS floor not yet pinned to an exact policy | Tracked as Spec Open Question #3 |
| L1 | Low | Shared-runtime home (packages/ vs extension/src) unresolved | Spec Open Question #1 |
| L2 | Low | Agent-engine phase may warrant its own bounded work contract | Spec Open Question #2 |

No Critical or High findings. All Medium findings are pre-existing, documented, and have owners.

---

## ATAM Trade-off Note

The central trade-off (accepted): give up single-language repo simplicity and absorb a second CLI re-migration in exchange for (a) a gate that actually executes on the target agent surfaces and (b) native MCP integration. The Skeptic's counter -- that re-migration is the real risk -- is mitigated by the mandatory cli.mjs post-mortem and golden-file parity suite before any cutover.

---

## Decision

**APPROVED.** ADR-401 and SPEC-401 are implementation-ready. Engineer may proceed to Phase 0 (prerequisites) first; Phases 1-5 are gated on the post-mortem go-decision and a green parity suite.
