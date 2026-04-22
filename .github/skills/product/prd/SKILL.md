---
name: "prd"
description: "Produce production-grade Product Requirements Documents (PRDs) that bridge business vision and technical execution. Use when writing, reading, reviewing, or extending a PRD -- by Product Manager agents authoring one, or by Architect/UX/Engineer/Agent-X agents that need to consume or fact-check PRD conventions without loading the full PM agent contract."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-21"
  updated: "2026-04-21"
---

# Product Requirements Document (PRD)

> **Purpose**: Shared PRD conventions loadable by any AgentX role.
> **Goal**: Concrete, measurable, non-contradictory requirements that survive handoff to Architect, UX, Data Scientist, and Engineer.
> **Scope**: This skill is the conventions layer. The PM agent contract (`.github/agents/product-manager.agent.md`) owns the full authoring workflow. The template (`.github/templates/PRD-TEMPLATE.md`) owns the section structure.

---

## When to Use This Skill

- Authoring a PRD (PM agent)
- Reading a PRD to design architecture (Architect)
- Reading a PRD to design UX (UX Designer)
- Reading a PRD to plan ML/AI work (Data Scientist)
- Reading a PRD to implement a story (Engineer)
- Reviewing a PRD for quality (Reviewer, Agent X)
- Refining or amending an existing PRD

Non-PM agents load this skill to understand **what a "good" PRD looks like** without pulling the full PM agent payload.

## Load Order

1. This `SKILL.md` (conventions)
2. [`.github/templates/PRD-TEMPLATE.md`](../../../templates/PRD-TEMPLATE.md) (structure)
3. [`.github/agents/product-manager.agent.md`](../../../agents/product-manager.agent.md) (full authoring contract, PM role only)
4. [`references/requirements-quality.md`](references/requirements-quality.md) (vague vs concrete, anti-patterns)
5. [`references/worked-example.md`](references/worked-example.md) (end-to-end filled example)

---

## The Five Non-Negotiables

Every PRD in this repo MUST satisfy these. If any are missing, the PRD is not ready for Architect handoff.

1. **Evidence-based research** -- Research Summary section cites sources (prior art, standards, user feedback). No assumption-only requirements.
2. **Concrete, measurable requirements** -- no "fast", "easy", "intuitive", "modern". Every requirement has a number, a rubric, or a named standard. See [references/requirements-quality.md](references/requirements-quality.md).
3. **Intent preservation** -- constraints MUST NOT contradict the user's stated technology intent. If the user said "AI agent", do not quietly downgrade to rule-based. If the user did not specify a stack, label it `TBD`, do not invent one.
4. **Explicit Non-Goals** -- every Feature states what it is NOT building. Global "Out of Scope" section is required.
5. **Testable acceptance criteria** -- every User Story has concrete, verifiable AC. "Works well" is not AC; "returns HTTP 200 with schema X in <200ms for 10k records" is.

---

## Discovery Gate (before drafting)

A PRD MUST NOT be drafted cold. Before writing section 1, either:

- **Ask at least 2 clarifying questions** on: core problem, success metric, hard constraints, user persona, or tech stack -- and wait for answers, OR
- **Explicitly record `TBD`** for every unknown in the Research Summary and flag it as an Open Question in section 11.

**Never hallucinate constraints.** "Must use Postgres" is a requirement only if the user or repo context stated it. Otherwise it is `TBD`.

## Requirements Quality Rule (the core contribution of this skill)

Every functional and non-functional requirement must be rewritable as a test. If it cannot be tested, it cannot be built, and it cannot be reviewed.

```diff
# Vague (REJECTED)
- The search should be fast and return relevant results.
- The UI must look modern and be easy to use.
- The system should be secure.
- The AI must give good answers.

# Concrete (ACCEPTED)
+ Search returns results within 200ms p95 for a 10k-record dataset.
+ Search achieves >=85% Precision@10 on the eval set in `evaluation/datasets/search.jsonl`.
+ UI conforms to the design system at `docs/ux/UX-{id}.md` and achieves a Lighthouse Accessibility score of 100.
+ All endpoints require OAuth 2.1 bearer tokens; secrets stored in Key Vault; OWASP Top 10 tests pass in CI.
+ AI responses achieve >=4.2/5 on the rubric at `evaluation/rubrics/correctness.md` over 50 held-out queries.
```

Full anti-pattern catalogue: [references/requirements-quality.md](references/requirements-quality.md).

## AI/ML PRDs -- Product-Facing Contract

If the PRD carries `needs:ai`, the AI section MUST be specified at the **product-facing contract** layer (not implementation). Minimum content:

| Field | What to capture |
|-------|----------------|
| Primary AI Job | The user-visible reasoning, generation, classification, or decision task |
| Grounding Sources | Docs, KBs, APIs, databases, or "none / model prior only" |
| Tool / Action Boundaries | What the AI may read, write, trigger; what it MUST NOT do autonomously |
| Response Contract | Free-form text / structured JSON / citations / action plan |
| Fallback Behavior | What to do when confidence is low, retrieval fails, or model is unavailable |
| Human Review Trigger | When a human must approve, edit, or confirm before completion |
| Quality Threshold | Numeric metric + eval dataset path |

Architect and Data Scientist turn this into the implementation-level spec. The PRD MUST make them not have to guess.

## Schema (delegated)

The 12-section structure lives in the template. Do not restate it here; read:

- [`.github/templates/PRD-TEMPLATE.md`](../../../templates/PRD-TEMPLATE.md)

PM-specific workflow (Research 5-phase, Model Council, issue hierarchy, enforcement gates) lives in the PM agent file and is not duplicated here.

## Consumer Checklist (non-PM agents)

When a non-PM agent loads a PRD before doing its own work:

- [ ] Problem Statement is present and specific
- [ ] At least one success metric is numeric
- [ ] Every P0 requirement has testable AC
- [ ] Non-Goals are explicit
- [ ] If AI-bearing, the product-facing AI contract is complete (table above)
- [ ] No constraint contradicts the original user intent
- [ ] Open Questions are listed rather than silently assumed

If any check fails, the downstream agent MUST push back through the clarification loop rather than inventing the missing requirement.

## Related

- [Documentation skill](../../development/documentation/SKILL.md)
- [AI Agent Development skill](../../ai-systems/ai-agent-development/SKILL.md)
- [Code Review skill](../../development/code-review/SKILL.md)
