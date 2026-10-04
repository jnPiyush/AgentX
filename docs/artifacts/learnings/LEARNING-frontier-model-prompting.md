---
title: Tune Agent Contracts for Literal Frontier Models
description: What changed when agents moved to Claude Opus 5.5 and GPT-6 Astra, and how to keep prompts compatible.
---

## Cause and correction

- GPT-6 Astra and Claude Opus 5.5 follow agent, skill and `AGENTS.md` text
  literally. Contradictions stall them: the old pre-edit gate said "absolute
  first tool call" while also allowing reads first. State the rule once, give
  the reason, and remove emphasis that adds no information.
- Astra asks clarifying questions more readily. Blanket rules such as "clarify
  ANY ambiguity" become stop points. Limit clarification to answers that change
  behavior, contracts, acceptance, security or cost, and name the consent gates
  that are legitimate stops.
- Opus 5.5 can end a long agentic turn with a text-only progress update. The
  protocol now says a progress summary is not completion.
- Opus 5.5 can refuse prompts that ask it to write out its reasoning
  (`reasoning_extraction`). Replace "think step by step" or "show your
  reasoning" with requests for conclusions, evidence and a short rationale.
- Wall-clock rules ("no response in 15 minutes") are meaningless to a model.
  Tie fallbacks to observable events such as an unanswered clarification.

## Runtime boundary

- Opus 5.5 rejects disabled or budgeted thinking, non-default sampling values,
  forced `tool_choice` and assistant prefill. The runner registers
  `claude-opus-5.5` (Copilot) and `claude-opus-5-5` (Anthropic API, Claude Code),
  forces adaptive thinking (even when a disabled mode is requested), sends effort
  on the Anthropic API path, defaults `max_tokens` to 16384 when omitted, and
  omits `temperature`. Explicit caller limits remain binding, including the
  compaction helper's 700-token cap; a small cap can truncate the answer.
- Persist replay transport alongside opaque response blocks. Replay them
  unchanged on the matching transport, but translate normalized text and tool
  calls when switching transports. Infer the format of older untagged records
  so both Anthropic thinking and Responses reasoning survive native replay.
- Opus 5.5 at `medium` matches Opus 5 at `high`, so authoring agents moved from
  `high` to `medium`. Reviewer, Auto-Fix Reviewer and Architecture Reviewer stay at `high`.
- The runner runs under `Set-StrictMode`; read optional capability flags with
  `$capability['flag']`, not `$capability.flag`, or absent keys throw.
- Engineer, Architect and UX Designer prefer Astra; the other roles prefer
  Opus 5.5. Cross-family review requires a separately invoked reviewer and
  host-confirmed models. CLI automatic self-review uses the author's model and
  effort. Astra resolves only on Copilot; other roles retain their documented
  provider mappings. Opus-authored work reviewed by Opus agents has no family
  diversity; use the Model Council where it matters.

## Verification boundary

- Frontmatter validation, token budgets, a TypeScript typecheck and a stubbed
  runner smoke check cover the change. The runner behavior suite and live
  provider calls were not run; account-level model availability is unverified.
