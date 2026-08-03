# Prompt Assets

Store AI system prompts and reusable prompt templates here.

## Rules

- Keep prompts in Markdown files, not inline code strings.
- Version prompts with simple names such as `assistant-v1.md`.
- Put the purpose, expected model family, and key constraints at the top of each file.
- Keep prompt changes reviewable and pair them with evaluation evidence.

## Suggested Naming

- `assistant-v1.md`
- `retrieval-agent-v1.md`
- `summarizer-v2.md`

## Current Example

`assistant-v1.md` is a reference prompt that documents the AgentX issue-classification
task in natural language. It is an illustrative asset only.

The regression evaluation does **not** execute this prompt. It runs the deterministic
production classifier in [scripts/classify-issue.js](../scripts/classify-issue.js) --
the same module `.github/workflows/issue-triage.yml` uses -- so the evaluation scores
the shipped code path rather than a parallel copy. If you change the label taxonomy,
update the classifier first; this prompt is documentation that should follow it.

The files in `.github/prompts/` are repo automation prompts for AgentX itself. This
directory holds product and application prompts under evaluation, alongside a small
number of AgentX runtime prompts such as `dream-consolidation.md`, which
[scripts/dream.ps1](../scripts/dream.ps1) reads at run time.