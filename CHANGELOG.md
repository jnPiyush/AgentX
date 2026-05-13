# Changelog

## [8.4.45](https://github.com/jnPiyush/AgentX/compare/v8.4.44...v8.4.45) (2026-05-13)


### Features

* **vs-extension:** ship first Marketplace-ready Preview of the AgentX Visual Studio extension - 5-tab tool window (Status / Workflows / Loop / Council / Agents) with auto-refresh and CLI command wiring; Status tab uses typed DTOs and structured WPF panels with TextBox fallback when JSON is missing or malformed; targets VS 17.14+ on amd64 and arm64; Apache-2.0; 37/37 unit tests pass against `agentx-cli --json` fixtures.

### Documentation

* **vs-extension:** add Marketplace publish dry-run report (CONDITIONAL PASS) at `docs/artifacts/reviews/2026-05-12-vs-extension-marketplace-dryrun.md` and 11-section smoke-test checklist with sign-off block at `docs/ux/vs-extension-smoke-test.md`.
* **vs-extension:** add `release-notes-8.4.45.md` matching the format of prior `release-notes-*.md` files.

### Build

* **vs-extension:** stage the `AgentX.VisualStudio.vsix` artifact in `azure-pipelines.yml`.
* **vs-extension:** add opt-in `vsixsigntool` wrapper at `vs-extension/scripts/Sign-Vsix.ps1` and document the signing flow in `vs-extension/README.md`.

### Chores

* widen `.gitignore` from narrow `.vs/CopilotSnapshots/` to `.vs/` and add `.copilot-tracking/` so agent session state stays out of commits.

## [8.5.0](https://github.com/jnPiyush/AgentX/compare/v8.4.36...v8.5.0) (2026-04-24)


### Features

* enhance cosmos-db skill with correctness fixes and index entry … ([b2dda19](https://github.com/jnPiyush/AgentX/commit/b2dda190a0d7c97ab0f93d38bfa9e1c7c0a7e6b5))
* enhance cosmos-db skill with correctness fixes and index entry [skip-issue] ([df039b4](https://github.com/jnPiyush/AgentX/commit/df039b4b067484f20c158f0e7051eff706b5e3da))
