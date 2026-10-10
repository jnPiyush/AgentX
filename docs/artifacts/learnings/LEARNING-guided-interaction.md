---
title: Guided interaction authority and delivery boundaries
description: Keep questions, plan approval, progress and independent verification distinct across Frontier hosts.
---

## Context

The guided interaction capability implements the user-approved recommendation
under #411: useful clarification, an approved high-level plan, and milestone
updates. The implementation extends existing native sessions, CLI, chat and MCP
rather than adding a second orchestration framework.

## Reusable guidance

- A clarification answer is not approval. Bind a decision to the current pending
  input and the runtime-owned plan version/hash. A revised plan or consequential
  new uncertainty removes authorization.
- Keep session state outside model file access. Use scoped IDs, one writer,
  atomic writes, explicit corruption errors and workspace/role/model binding.
- Pause before batch-tail calls execute. Record declined results for every tool
  ID so a resumed provider conversation remains valid; never replay those calls.
- Persist transitions before publishing status. After interruption, missing tool
  results mean unknown outcomes, not successful or safely retryable actions.
- MCP form acceptance is not a plan decision. Require the explicit field, bind
  it to the displayed plan, and leave unsupported or dismissed input pending.
- Nonzero pending/cancellation exits need explicit transport handling. A shell
  wrapper that rejects every nonzero exit can hide the resumable state from chat.
- Progress is a report, not independent evidence or test consent. Retain the
  owner quality loop and separate post-loop suite decision.
- Check explicit runtime inventories as well as broad copy scripts. A module
  present in the repository or VSIX can still be missing from a standalone pack.
- Direct editor-host instructions are not proof of runtime enforcement.
  Document the surface that actually owns tool execution and input collection.

## Verification limits

The first independent review caught a completion check placed inside the
clarification branch. This both discarded resolved answers and let ordinary
final replies bypass milestone completion. The correction moves that check
to the final-delivery path and adds separate guided regressions for both cases.
Static parsing alone cannot detect a correctly parsed but misplaced gate.

The same review reproduced direct `frontier-cli.ps1 run --session-info` returning
JSON then failing because its exit status was uninitialized. Wrapper-only
inspection missed this boundary. Initialize run status at dispatch entry and
retain a real-process MCP continuation regression alongside transport mocks.

Syntax, type, frontmatter, installed-asset inspection and independent review
are separate from behavioral suites and live host/model qualification. Current
task evidence and the recorded post-loop suite decision remain authoritative.
