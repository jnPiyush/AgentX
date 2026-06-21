# Auto-Fix Review: Model Version Sweep

Date: 2026-06-20
Mode: reviewer-auto
Decision: APPROVED

## Scope

Sweep live GPT and Claude model-version references to the current GPT-5.5 and Claude Opus 4.8 defaults without rewriting historical council artifacts or ignored runtime/session data.

## Auto-Applied Fixes

- Updated `.agentx/agentic-runner.ps1` default model metadata and provider alias maps to use `gpt-5.5` as the active OpenAI default.
- Updated extension-side OpenAI defaults in `vscode-extension/src/chat/adapterSetup.ts` and `vscode-extension/src/commands/llmAdaptersCommandInternals.ts`.
- Updated active PowerShell and extension tests that asserted the superseded default model ids.
- Updated active council fixtures and current-facing prototype content to use `openai/gpt-5.5` and `anthropic/claude-opus-4.8`.
- Updated `.github` source content and regenerated bundled extension assets with `node vscode-extension/scripts/copy-assets.js`.

## Suggested Changes

- None.

## Blocked Findings

- None.

## Validation

- PASS: `pwsh -NoProfile -File tests/agentic-runner-behavior.ps1`
- PASS: `Push-Location vscode-extension; npm test -- out/test/commands/llmAdapters.test.js out/test/chat/chatParticipant.test.js out/test/commands/runCouncil.test.js; Pop-Location`
- PASS: targeted residue scan shows no remaining old-version references in active source, tests, or bundled extension assets.
- PASS: curated-learning retrieval now has focused behavior coverage for bullet parsing, category/date metadata, ranking, limits, filtering, and no-match results in `tests/agentic-runner-behavior.ps1`.

## Residual Notes

- Remaining `gpt-5.4` and `claude-opus-4.7` strings are confined to historical ADR council artifacts under `docs/artifacts/adr/COUNCIL-400.md` and `docs/artifacts/adr/COUNCIL-401.md`, plus ignored runtime/session files under `.agentx/state/**` and `.agentx/sessions/**`.
