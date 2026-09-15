---
name: "prompt-versioning"
description: 'Version, test, promote, and roll back prompts like production artifacts. Use when managing prompt lifecycle, prompt variants, few-shot changes, rubric alignment, baseline comparisons, and safe prompt release workflows across models or environments.'
metadata:
 author: "Frontier"
 version: "1.0.0"
 created: "2026-04-04"
 updated: "2026-04-04"
compatibility:
 frameworks: ["promptfoo", "langsmith", "azure-ai-evaluation", "git"]
 languages: ["markdown", "python", "typescript", "csharp"]
 platforms: ["windows", "linux", "macos"]
prerequisites: ["Prompt files in repo", "Evaluation dataset", "Baselines or acceptance thresholds", "Code review workflow"]
---

# Prompt Versioning

> WHEN: Managing prompts as versioned production assets with diffable changes, prompt variants, few-shot evolution, evaluation baselines, promotion criteria, and rollback safety.

## When to Use

- Introducing prompt files into a team workflow for the first time
- Managing prompt variants per model, task, or environment
- Reviewing prompt changes with eval evidence instead of subjective judgment only
- Promoting prompts through dev, canary, and production stages
- Rolling back bad prompt releases safely

## Decision Tree

```
Changing a prompt?
+- Small wording tweak only?
|  - Still run regression tests against the fixed dataset
+- Few-shot examples changed?
|  - Treat as a semantic behavior change and compare to baseline
+- New model target?
|  - Branch or parameterize prompt variants per model family
+- Multiple environments?
|  - Keep one source prompt with explicit overlays or clear variant files
+- Need rollback?
|  - Keep last-known-good version and accepted baseline together
-- Need reviewability?
   - Store prompts as files, never hidden inside code or portal-only state
```

## Core Rules

1. Every prompt must live in a repo file, not only in code, a portal, or a secret note.
2. Every meaningful prompt change requires evaluation evidence against a stable dataset or rubric.
3. Prompt variants must have a naming scheme that communicates role, model target, and lifecycle stage.
4. Accepted baselines belong next to prompt evolution, not in someone else's memory.
5. Rollback must be trivial: the previous approved prompt and its baseline should be easy to restore.

## Directory Pattern

```text
prompts/
  support-agent.md
  support-agent.gpt-5.md
  support-agent.claude-opus.md
templates/
evaluation/
  datasets/
  rubrics/
  baseline.json
```

## Versioning Pattern

- Use Git as the source of truth.
- Add a short header in each prompt with purpose, target model family, owner, and last validated date.
- When variants diverge materially, split them into separate files rather than hiding branches inside code.
- Record why a prompt changed, not only what text changed.

## Review Guidance

- Review the prompt diff itself.
- Review the affected few-shot examples and templates.
- Review evaluation deltas relative to baseline.
- Check whether the change is prompt-only or also depends on model/tool/retrieval changes.
- Require a rollback note for major prompt shifts.

## Promotion Guidance

- `draft` -> local/manual test
- `candidate` -> regression dataset and rubric run
- `canary` -> limited production exposure
- `approved` -> baseline updated and promoted

The exact labels can vary, but the promotion logic should remain visible and evidence-backed.

## Error Handling

- If a prompt diff improves one metric but harms a blocking metric, do not promote it.
- If multiple prompts share the same task but diverge silently, consolidate ownership and naming first.
- If a prompt cannot be tested repeatably, fix the dataset and rubric problem before adding more prompt variants.
- If portal-edited prompts drift from repo prompts, re-establish the repo as the source of truth immediately.

## Anti-Patterns

- **Inline Prompt Strings**: Prompt text hidden in code paths -> Move prompts into files under `prompts/`.
- **Unnamed Variants**: Multiple prompt copies with vague filenames like `prompt-new-final2.md` -> Use role/model/stage naming.
- **No Baseline**: Declaring a prompt better based on vibe only -> Compare against a saved baseline.
- **Portal Drift**: Editing the runtime prompt in a UI and forgetting the repo copy -> Keep repo-local source of truth and promotion workflow.
- **Coupled Changes**: Changing prompt, model, and tools together with no attribution -> Separate variables when possible.

## Checklist

- [ ] Prompt lives in a repo file with clear ownership metadata
- [ ] Variant naming communicates role and target model/family
- [ ] Evaluation evidence exists for the new candidate
- [ ] Baseline comparison is attached to the review decision
- [ ] Rollback path points to the last approved prompt version
- [ ] Portal/runtime state matches repo source of truth

## References

- [Lightweight AI evaluation workflow](https://learn.microsoft.com/en-us/azure/foundry/observability/how-to/evaluate-agent)
- [LangSmith](https://www.langchain.com/langsmith)
- [Promptfoo](https://www.promptfoo.dev/)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Prompt reviews are subjective and inconsistent | Require dataset, rubric, and baseline deltas with each prompt change |
| Too many nearly identical prompt files | Consolidate naming and split only by real model/task differences |
| Runtime behavior differs from reviewed prompt | Audit portal/runtime copies and restore repo-local source of truth |
| Rollback takes too long | Keep previous approved prompt and baseline tagged and easy to restore |