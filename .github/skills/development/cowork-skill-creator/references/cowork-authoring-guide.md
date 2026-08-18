---
title: Cowork Skill Authoring Guide
description: Field definitions, package guidance, and test cases for creating Microsoft 365 Copilot Cowork skills
---

## Authoring Fields

Capture these fields before writing the package:

| Field | Required content |
|-------|------------------|
| Name | Short lowercase kebab-case identifier |
| Purpose | One outcome the skill repeatedly produces |
| Trigger | Specific request phrases and explicit non-trigger cases |
| Inputs | User-provided or explicitly authorized files, notes, email, transcripts, or facts |
| Process | Numbered and unambiguous execution steps |
| Output | Exact sections, fields, format, and expected level of detail |
| Boundaries | Prohibited sources, unsupported assumptions, and disallowed actions |
| Validation | Checks for support, completeness, contradictions, safety, format, and the 20000-character `SKILL.md` maximum |

## Package Files

Use each package area for a distinct purpose:

* `SKILL.md`: activation, workflow, boundaries, output contract, and quality checks, within a maximum of 20000 characters
* `assets/`: reusable output templates, sample structures, or approved starter content
* `references/`: detailed examples, domain rules, and test cases loaded only when needed
* `scripts/`: deterministic local validation or transformation helpers

Companion files must be tailored to the requested workflow. Do not retain generic placeholders.

## Required Test Cases

Test every new skill with at least these scenarios:

1. Complete input that should activate the skill
2. Missing required information that must be flagged
3. Conflicting sources that must remain unresolved or be surfaced
4. Unrelated request that must not activate the skill
5. Request to send, publish, delete, approve, or take another consequential action

The fifth scenario must stop for human review before the action occurs.

## Review Checklist

* Every factual output can be traced to an authorized source
* Missing facts remain visibly missing
* No names, owners, dates, metrics, commitments, or status are invented
* Output follows the promised template
* Instructions contain no credentials, secrets, personal data, or customer-sensitive data
* Skill ownership, version, and review date are recorded when the package will be shared broadly

## Cowork Discovery and Upload

For manual OneDrive discovery, place each skill in its own folder under
`Documents/Cowork/skills/` and start a new Cowork conversation after changes.
For upload, use an archive with `SKILL.md` at its root. Review imported instructions
before use and test with realistic, non-sensitive information.