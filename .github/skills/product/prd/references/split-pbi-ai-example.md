# split-pbi-ai-example

> Source: [pbi-examples.md](pbi-examples.md)
> Source hash (LF-normalized original file): `25A212719E44EB72C587AF2A5DE902B24D30CE7A0E5C56EAE265138C23A88C1C`
> Relocation manifest:
> - `## AI PBI Example` -> original lines 154-198
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

## AI PBI Example

Use this shape when a PBI includes AI behavior. Keep the PBI product-facing; Architect and Data Scientist own implementation details.

```markdown
Title: [Story] Summarize support case history with cited source messages

## User Outcome
As a support lead, I want an AI-generated case summary with citations to source messages, so that I can review escalation context in <=2 minutes without reading the full thread.

## Problem
Escalation review currently takes 12 minutes median across 80 sampled cases because leads read long case histories manually. PRD-210 targets median review time <=2 minutes while preserving citation accuracy >=95%.

## Scope
Included:
- Generate a summary from messages already visible to the support lead.
- Include citations to source message IDs for each factual claim.
- Fall back to a manual review prompt when citation confidence is below threshold.

Out of scope:
- Auto-sending responses to customers.
- Reading private notes outside the lead's permissions.
- Training or fine-tuning a model.

## Acceptance Criteria
- Given a case with at least five messages, when the lead requests a summary, then the response includes `summary`, `key_events`, `open_questions`, and `citations` fields.
- Given the model cannot cite at least 95% of factual claims to source message IDs on the eval set, when CI runs the case-summary evaluation, then the build fails.
- Given retrieval confidence is <0.6 for the case thread, when the lead requests a summary, then the product shows `Summary unavailable. Review the case history directly.` and does not fabricate citations.
- Given the lead lacks permission for a private note, when generating the summary, then that note is excluded from grounding and citations.

## Evidence Required
- Evaluation dataset: evaluation/datasets/case-summary.jsonl with >=50 held-out cases.
- Quality gate: citation precision >=95% and faithfulness >=0.85.
- Security test proves unauthorized private notes are excluded.

## Dependencies
- PRD: docs/artifacts/prd/PRD-210.md AI contract.
- Data Scientist: eval rubric and dataset ownership.
- Architect: authorization and grounding-source contract.

## Priority Rationale
P0 because it validates the central AI value proposition while keeping high-risk autonomous customer actions out of scope.
```

---
