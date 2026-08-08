# Model Council: skill-rubric-402

**Convened:** 2026-08-07T20:20:49Z
**Mode:** agent-internal (calling agent adopts each role and writes responses below)
**Purpose pack:** ai-design

## Question

This council deliberates on 2 related topics. Address EACH topic explicitly and keep them distinct.

Topic 1: Which criteria must be blocking floors rather than compensable points?
Topic 2: What deterministic dimensions and weights should a 100-point AgentX skill-quality rubric use?

## Supporting Context

Current scorer is 40 points, mixes structural presence with heuristic quality, averages 31.1/40 across 130 skills, and exits nonzero for 17 skills below 28. Requirements: agentskills.io compatibility, progressive disclosure, trigger precision, actionable workflow, safety, verification, maintainability, token efficiency, JSON evidence, deterministic CI, optional future LLM judge.

## Council Roster

| Role | Model |
|------|-------|
| Analyst | openai/gpt-5.5 |
| Strategist | anthropic/claude-opus-4.8 |
| Skeptic | google/gemini-3.1-pro |

## Member Responses

### Analyst - deterministic quality model

**Topic 1 - blocking floors.** The rubric must fail a skill regardless of aggregate score when the skill cannot be discovered or safely executed: missing/invalid frontmatter, directory/name mismatch, description outside the agentskills.io limit, hard token budget breach, broken local references, or missing required development rationalization. Floors should also require non-zero discoverability, actionability, and reliability scores so formatting points cannot compensate for an unusable workflow.

**Topic 2 - dimensions and weights.** Recommend: Specification 20, Discoverability 15, Decision Support 15, Actionability 20, Safety and Reliability 15, Maintainability 10, Efficiency 5. Every point must map to a deterministic regex, file check, or count and emit evidence. LLM judging may add a separate diagnostic score but must not alter the deterministic CI result.

### Strategist - rollout and operating model

**Topic 1 - blocking floors.** Separate universal blockers from maturity targets. Universal blockers are invalid metadata, >5,000-token main body, broken local links, and category-specific required sections. A minimum aggregate score should be configurable by command, not embedded invisibly. New or changed skills should be held to the target while the existing inventory is reported as debt instead of forcing a 130-file rewrite.

**Topic 2 - dimensions and weights.** Keep 100 points for operator clarity. Give the most weight to executable usefulness: actionability and specification. Publish a rubric document, JSON output, per-dimension findings, and exit semantics. Batch mode should report the distribution and only fail with an explicit enforcement switch or when a blocking floor is violated.

### Skeptic - gaming and false-confidence review

**Topic 1 - blocking floors.** Section-name checks are easy to game. A skill with empty headings can score well unless checks require substantive body text. Do not make optional directories mandatory: short skills can be better without references or scripts. Do not treat every broken link as equal when it is an external URL that CI cannot resolve; only local references should block.

**Topic 2 - dimensions and weights.** Token efficiency should remain low-weight because brevity can remove necessary edge cases. Require evidence that decision/action/checklist sections contain content, not merely headings. Include contamination checks for negative trigger phrases and ensure the scorer itself has fixture tests for a strong skill, a structurally valid but weak skill, and a blocked skill.

## Synthesis

**To be completed by the calling agent after writing all three Member Responses above. The user is not in the loop.**

This council covered 2 topics. In each section below, attribute findings to the relevant Topic <n> so the deliverable can trace each decision back to its topic.

### Consensus on Model Selection and Pipeline Shape

**Topic 1.** All members agree on non-compensable floors for specification validity, local-reference integrity, hard token limits, and category-specific mandatory sections. Formatting points cannot compensate for zero discoverability, actionability, or reliability.

**Topic 2.** Adopt the Analyst's 100-point weights: Specification 20, Discoverability 15, Decision Support 15, Actionability 20, Safety and Reliability 15, Maintainability 10, Efficiency 5. Emit deterministic evidence and keep model-backed judging separate.

### Divergences on Model, Eval Strategy, or Guardrails

**Topic 1.** The Analyst favored immediate blocking for all floors; the Strategist distinguishes universal blockers from configurable score targets. Resolution: blockers always fail, while aggregate minimum enforcement is explicit and configurable.

**Topic 2.** The Skeptic challenged heading-only heuristics. Resolution: section checks require substantive text and fixture tests must prove weak/empty skills cannot game the rubric.

### Drift, Safety, and Cost Risks Surfaced

- Rubric gaming through empty headings or keyword stuffing.
- Penalizing concise skills for correctly omitting unnecessary support directories.
- Hiding inventory debt by averaging strong and weak skills.
- Breaking CI immediately by silently changing default exit semantics.

### Net Adjustment to Pipeline and Eval Plan

Implement a deterministic scorer with per-dimension evidence, blocker list, score, tier, and pass state. Batch scoring reports all 130 skills and fails on blockers; aggregate minimum failure requires `-Enforce`. `validate-skill.ps1` explicitly passes its configured minimum and consumes JSON rather than scraping display text. Add fixture-based rubric behavior tests and publish the rubric under `evaluation/rubrics/skill-quality.md`.
