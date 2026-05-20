# Changelog

## [8.6.0](https://github.com/jnPiyush/AgentX/compare/v8.5.0...v8.6.0) (2026-05-20)


### Features

* add 11 AI-systems skills + standalone arch-doc review (93 skills total) [skip-issue] ([4f38ce8](https://github.com/jnPiyush/AgentX/commit/4f38ce817a8b5d19e36299c0583e5328af1f1144))
* add BACKLOG-TEMPLATE.md and upgrade all templates with rich content + Mermaid diagrams [skip-issue] ([6264b1b](https://github.com/jnPiyush/AgentX/commit/6264b1b7504cc7a25915ef550036a7de21b9c9e9))
* add convert-slides plugin and wire plugin awareness into agents [skip-issue] ([9f84f5e](https://github.com/jnPiyush/AgentX/commit/9f84f5ef790234d49c5d669a061a64bc03dea798))
* add experimentation-loop skill and agentx doctor command [skip-issue] ([21e2bfe](https://github.com/jnPiyush/AgentX/commit/21e2bfe220756e298cdbb85fc480514d53585119))
* add inbound reader plugins (read-docs, read-slides, read-pdf) and wire 5-plugin block into all 23 agents [skip-issue] ([118df3d](https://github.com/jnPiyush/AgentX/commit/118df3d6809eeafce732aeb4400a5a3a40132f37))
* add initialize cli symlink mode and tests [skip-issue] ([80f21f7](https://github.com/jnPiyush/AgentX/commit/80f21f7e9afd28f629afeb9e72e6e0419fc77bc4))
* add low-code-vs-pro-code architecture review skill [skip-issue] ([93c25b4](https://github.com/jnPiyush/AgentX/commit/93c25b412f991898aaf8b484deef0fff1fb1ba99))
* ADO provider now MCP-first with az CLI fallback (Option B) [skip-issue] ([e79c937](https://github.com/jnPiyush/AgentX/commit/e79c9371f45c08090decba6a12c3235ab15021ad))
* adopt design workflow upgrades and prune stale artifacts [skip-issue] ([4703a79](https://github.com/jnPiyush/AgentX/commit/4703a79218b513fd8c18a925b57dd1430129eff4))
* **agents:** wire scrub/learn/promote/patterns/ship into Engineer, Reviewer, Agent X [skip-issue] ([b6ab2d1](https://github.com/jnPiyush/AgentX/commit/b6ab2d1ba9bdf8940853791993a7c7e11fea1288))
* bundle .agentx/plugins in VSIX and upgrade convert-slides/convert-docs to v1.1.0 with Mermaid rendering [skip-issue] ([94f883d](https://github.com/jnPiyush/AgentX/commit/94f883d7969c42dfbd93c378edde2fc39d713b0b))
* **chat:** add NL intents for scrub, research, learn, promote, patterns, ship [skip-issue] ([95efb69](https://github.com/jnPiyush/AgentX/commit/95efb6919107ffb60a5b92a79caf83b7826c133c))
* **chat:** LM-classifier path for NL intent router with regex fallback [skip-issue] ([8432755](https://github.com/jnPiyush/AgentX/commit/843275546208a2ba7b9522e6feb6a1d1b7dc2ef5))
* **cli:** add unslop scanner, autoresearch loop, ship orchestrator, install manifest, and learn/evolve/instincts aliases ([9dcd085](https://github.com/jnPiyush/AgentX/commit/9dcd085662cd22383b8ba28a6077426238739d98))
* **companions:** WhatsApp companion bot with voice and push [skip-issue] ([5555c20](https://github.com/jnPiyush/AgentX/commit/5555c20fe7e1a9cd0cf8d63c306136a2572a4378))
* **extension:** seed Copilot CLI assets during Initialize Local Runtime by default [skip-issue] ([d5db343](https://github.com/jnPiyush/AgentX/commit/d5db343f85ee099fea3e5727b3d429a19766ff6d))
* **governance:** front-load 4 workflow Hard Rules in routers + add pre-commit gates [skip-issue] ([8fc694f](https://github.com/jnPiyush/AgentX/commit/8fc694f793a907b5624b1f72ec0060f509964598))
* harden agentx doctor and experimentation-loop revert guidance [skip-issue] ([1c1ff57](https://github.com/jnPiyush/AgentX/commit/1c1ff577e214a49153462bf36bd3f1928dc055b3))
* loop rollback command + NL intent router + task class improvements [skip-issue] ([af5aa31](https://github.com/jnPiyush/AgentX/commit/af5aa31316f684e0c4757b810e9c240fe016e794))
* rename sidebar 'ADO Provider' to 'ADO MCP' (v8.4.40) [skip-issue] ([53f14d9](https://github.com/jnPiyush/AgentX/commit/53f14d93cff1d0c89a73d0424add41b18a28c2d3))
* require pro-code vs low-code analysis in arch review for AI solutions [skip-issue] ([7f726cf](https://github.com/jnPiyush/AgentX/commit/7f726cf3cf7f7ade00ce7ce134a012b9055a904d))
* ship ECC adoption items - iterative-retrieval, strategic-compaction skills, scan/stocktake/model-route CLI, dashboard webview [skip-issue] ([6c28d61](https://github.com/jnPiyush/AgentX/commit/6c28d61825a6c837c37060a73a16d84b84d5b328))
* **skills:** UI prototype adoption pack -- accessibility, working-prototype-app, prototype-audit, theme presets, animation recipes, prototype-auditor sub-agent, deploy-prototype plugin [skip-issue] ([ca8ed6a](https://github.com/jnPiyush/AgentX/commit/ca8ed6a1fc99fcfe7cec803cea3d4be817b10796))
* **ux:** add usability-heuristics, content-design, visual-regression skills + tighten UX Designer contract [skip-issue] ([173370f](https://github.com/jnPiyush/AgentX/commit/173370f84777da8e6e4082ef45a517ea8db4b761))


### Bug Fixes

* agentx issue list under StrictMode + sidebar empty-CLI fallback (v8.4.42) [skip-issue] ([f55151c](https://github.com/jnPiyush/AgentX/commit/f55151c6a477c05c4db48ee23b219080960acafb))
* **deploy-prototype:** cleanup removes directories, copy preserves dotfiles [skip-issue] ([5c63679](https://github.com/jnPiyush/AgentX/commit/5c636795f315dc8b88efd8743be3f52b529fce1b))
* **extension:** use VS Code-native scaffolders for addAgent and addSkill [skip-issue] ([551385f](https://github.com/jnPiyush/AgentX/commit/551385f25aaec8c91530acb256786ba65895286d))
* honor pre-set AGENTX_WORKSPACE_ROOT in CLI wrappers [skip-issue] ([6882e5b](https://github.com/jnPiyush/AgentX/commit/6882e5b2977d24aadfb56107a20ed1f9d53f6fc8))
* **loop:** auto-reset on loop start, never block on healthy loop [skip-issue] ([406f63c](https://github.com/jnPiyush/AgentX/commit/406f63c89217ffff7d6a1511edf7eddf2005f416))
* **plugins:** resolve 3 code-review findings in inbound reader plugins [skip-issue] ([b007ad3](https://github.com/jnPiyush/AgentX/commit/b007ad327c1cbcb02a0d425fc62eb0574ccc5445))
* **reviewer:** enforce ARCH-REVIEW-TEMPLATE.md and REVIEW-TEMPLATE.md as hard rules [skip-issue] ([c0bdab7](https://github.com/jnPiyush/AgentX/commit/c0bdab7cc59f35a6fa4fe7aeb9e31502f4efd2dc))
* route natural-language 'initialize agentx' phrasings to initializeLocalRuntime (v8.4.41) [skip-issue] ([0beafcd](https://github.com/jnPiyush/AgentX/commit/0beafcd05e2cb1d55620675fd8627fb769ead978))
* **skill-creator:** align init-skill.ps1 Category ValidateSet with actual 12 skill folders [skip-issue] ([3cd8cfb](https://github.com/jnPiyush/AgentX/commit/3cd8cfb446e770983e457509cea39d90b5b4518d))
* **ux:** correct prototype-auditor description to eight passes and dedupe skills-to-load [skip-issue] ([4936bdf](https://github.com/jnPiyush/AgentX/commit/4936bdffe0634dcc0dad3cdd61a63dcc777e8dd6))

## 8.4.53

### Workflow Determinism Hardening

- **Quality Loop Hard Rule** front-loaded as body prose into `.github/copilot-instructions.md`, `CLAUDE.md`, `.github/instructions/ai.instructions.md`, and `.github/instructions/project-conventions.instructions.md`. Frontmatter-only enforcement was being routinely ignored by runtime models; body prose carries decisively more weight.
- **Pre-edit gate** (`loop start` as ABSOLUTE FIRST tool call before any file edit) and **Honesty rule** (run `loop status` before claiming completion) added near the top of every agent definition's Iterative Quality Loop section.
- **Four Mandatory Workflow Gates** added to router surfaces with matching mechanical enforcement in `.github/hooks/pre-commit`:
  - **Compound Capture (Check 11)** — APPROVED review staged -> matching `LEARNING-<issue>.md` required, or `[skip-capture]` token in commit message.
  - **Model Council (Check 13)** — New `ADR-*.md` staged -> matching `COUNCIL-*.md` required (3 diverse models + Synthesis), or `[skip-council]` token.
  - **Execution Plan (Check 14)** — Commits changing >= 8 code files require a matching `EXEC-PLAN-*.md` under `docs/execution/plans/`, or `[skip-plan]` token.
  - **Brainstorm (reviewer-enforced)** — Engineer pipeline requires a `brainstorm` ledger entry or `## Alternatives Considered` block in the execution plan before Plan is written.
- New project convention: loop-honesty pitfall captured in `memories/conventions.md` and `docs/artifacts/learnings/LEARNING-loop-honesty.md`.

### ECC Adoption

- Shipped `iterative-retrieval` and `strategic-compaction` skills.
- Added `scan`, `stocktake`, and `model-route` CLI subcommands plus dashboard webview.

## [8.5.0](https://github.com/jnPiyush/AgentX/compare/v8.4.36...v8.5.0) (2026-04-24)


### Features

* enhance cosmos-db skill with correctness fixes and index entry … ([b2dda19](https://github.com/jnPiyush/AgentX/commit/b2dda190a0d7c97ab0f93d38bfa9e1c7c0a7e6b5))
* enhance cosmos-db skill with correctness fixes and index entry [skip-issue] ([df039b4](https://github.com/jnPiyush/AgentX/commit/df039b4b067484f20c158f0e7051eff706b5e3da))
