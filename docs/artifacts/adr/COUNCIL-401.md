# Model Council: ADR-401 CLI Runtime Selection

**Topic**: adr-401-cli-runtime
**Purpose**: adr-options
**Date**: 2026-05-29
**ADR**: [ADR-401.md](ADR-401.md)
**Question**: Given the four options (A keep PowerShell, B port core to TypeScript/Node shared runtime, C port to Go static binary, D hybrid = TS core + retained PowerShell tooling), which is the right choice for *effective execution and enforcement* in the Agents Window, and what is the strongest case AGAINST the recommended option?

**Context supplied to council**: enforcement already spans 3 languages around `loop-state.json` (PowerShell writer, TypeScript editor-time reader, bash commit-time gate); core = ~11.9K LOC (`agentx-cli.ps1` 7,458 + `agentic-runner.ps1` 4,427); `agentx-cli.ps1` already "Replaces cli.mjs" (a prior Node->PS migration); ADR-341 forbids a third runtime stack and chose a Node host because MCP SDK is Node/Python-first; Copilot CLI/Cloud preinstall Node, not pwsh.

---

## Analyst -- openai/gpt-5.4

*Lens: decompose options against differentiating criteria; demand evidence.*

The criteria that actually differentiate the options are exactly two: (1) is the runtime guaranteed present where the gate must run, and (2) does the runtime share code with the surfaces that already consume the loop state. Everything else (startup latency, footprint) is second-order because hooks are not in a tight loop measured in milliseconds.

On criterion (1): PowerShell 7 is an *extra install* on Copilot CLI/Cloud; Node and a Go binary are both "always available" (Node preinstalled, Go self-contained). So A is dominated -- the gate it enforces can no-op on the very surfaces ADR-400 targets, which defeats the purpose of the enforcement layer.

On criterion (2): the editor-time enforcement is *already* TypeScript and the contract is JSON. TypeScript is the only option that lets the extension call the loop core in-process and reuse the MCP SDK natively. Go scores well on (1) but zero on (2) and worse than PowerShell on MCP. Therefore the ranking is **D ≈ B > C > A**. I prefer D over B only because B's blast radius (full 11.9K LOC including the agent engine in one go) is unnecessary; D ring-fences the rewrite to the gate first, with the agent engine following.

Evidence demand for whoever implements this: a golden-file parity test is non-negotiable. Run the existing PowerShell `loop iterate/complete` and the new TypeScript implementation against the same fixtures and diff the resulting `loop-state.json` byte-for-byte (modulo timestamps). The min-iteration gate, the "review" history-string check, and stale/stuck detection are the three behaviors that must not drift. **Ranking: D first, B close second.**

## Strategist -- anthropic/claude-opus-4.7

*Lens: what a senior architect actually picks, and the trade-off accepted.*

A senior architect looks at ADR-341 and stops debating Go immediately. ADR-341 already paid the strategic cost of choosing a single non-PowerShell runtime for the always-on surface and wrote down "no third runtime stack." Choosing Go here re-litigates a settled decision and forks the maintenance surface forever -- the extension is TypeScript, the daemon is Node, and a Go CLI would be the odd one out paying the worst MCP tax of all three. That is not a runtime choice, it is a strategy reversal, and it is the wrong one.

The real choice is B vs D, and the senior move is D. The trade-off I am consciously accepting with D is that the repository stays bilingual: TypeScript on the hot path, PowerShell for dev/CI tooling. That is acceptable because the tooling is off the gate path and non-blocking -- a contributor who never touches CI scripts never needs PowerShell. What I am buying with that trade-off is a *bounded* migration: the gate moves to Node now (closing the enforcement gap), the agent engine follows on its own schedule, and the 4,299 LOC of scripts never have to be rewritten under deadline pressure. Big-bang rewrites of validated enforcement code are how you regress enforcement. D avoids the big bang.

I would also hold the line on scope: the SPEC must enumerate the exact files that constitute "the core." The failure mode of every hybrid is that the boundary erodes and six months later half the tooling is on the hot path. **Recommendation: D, accepting a deliberate bilingual repo to bound migration risk.**

## Skeptic -- google/gemini-3.1-pro

*Lens: argue against the front-runner; surface failure modes over 18 months.*

The front-runner is D (TypeScript core). My strongest objection is not about the language -- it is that **this is the second re-migration of the same component**. `agentx-cli.ps1` literally says "Replaces cli.mjs". Someone already migrated this brain *off* Node and *onto* PowerShell, presumably for a reason. Nobody in this council has produced the original cli.mjs post-mortem. If you port back to TypeScript without first recovering *why* Node was abandoned, you will rediscover the original pain in 18 months and there will be a future ADR-450 proposing a port back to PowerShell. The language is not the risk; the institutional amnesia is.

Concrete failure modes I expect:
1. **Behavior drift during the port.** 11.9K LOC of enforcement logic has implicit edge cases (partial writes, concurrent `loop iterate` from extension and CLI, stale-lock recovery). A reimplementation that passes the happy-path tests will still drift on the edges that actually matter when the gate is under pressure.
2. **Node version skew.** "Node is preinstalled" hides that Copilot Cloud, Copilot CLI, and a developer laptop may run different Node majors. Pin an LTS floor and preflight it, or the gate breaks on exactly one surface and nobody notices until a commit slips through.
3. **Boundary creep** (Strategist already named it) -- the bilingual split only stays cheap if it is policed.
4. **Reviewer/runtime gap regression.** Today three independent languages cross-check the state; collapsing the writer and reader into one TS runtime removes a (accidental) defense-in-depth. If the TS runtime has a bug, both the writer and the reader share it.

My demand before I would approve D: SPEC-401 MUST contain a recovered cli.mjs->ps1 post-mortem proving the new design does not reintroduce the original failure, plus the golden-file parity suite the Analyst described. Without those, D is faster-horse optimism. **I do not block D, but I condition it on the post-mortem and parity tests.**

---

## Synthesis

### Consensus on the recommended option

All three members rank the **TypeScript shared runtime ahead of Go and PowerShell**. Analyst: D first, B close second. Strategist: D. Skeptic: does not block D, conditions it. There is unanimous rejection of **Go (C)** -- not on technical merit but on the ADR-341 third-stack constraint, the worse MCP tax, and zero code reuse with the extension. **PowerShell status quo (A)** is rejected by Analyst and Strategist as dominated on the two highest-weighted attributes. **The ADR Decision (Option D) matches the council consensus.**

### Divergences on ranking / weighting

The only divergence is B vs D ordering, and even that is narrow: Analyst sees them as near-equal and picks D to bound blast radius; Strategist picks D outright; Skeptic is indifferent to B vs D and focused on the conditions. No member prefers a full big-bang (pure B) over the bounded hybrid. Recorded in ADR Consequences as an accepted trade-off (bilingual repo) rather than an open question.

### Failure modes & vendor risks surfaced (promoted to ADR risk register + SPEC-401)

| Risk | Raised by | Disposition |
|------|-----------|-------------|
| Re-migration silently reintroduces the cli.mjs-era problem | Skeptic | **Hard condition**: SPEC-401 must recover the cli.mjs->ps1 post-mortem before cutover |
| Gate behavior drift during port (min-iteration, review-history, stale/stuck, concurrent writes) | Analyst + Skeptic | **Hard condition**: golden-file parity suite against `loop-state.json` |
| Node version skew across Cloud/CLI/local | Skeptic | Pin Node LTS floor + preflight; document in SPEC-401 Selected Tech Stack |
| Core/tooling boundary creep | Strategist + Skeptic | SPEC-401 enumerates exact core files; everything else stays tooling |
| Loss of accidental 3-language defense-in-depth | Skeptic | Keep the bash commit-time gate independent of the TS runtime as a second check |

### Net adjustment to the ADR

1. ADR Decision retained as **Option D** (matches consensus) -- no change.
2. Consequences updated to record the **second re-migration** explicitly and require the cli.mjs post-mortem in SPEC-401 (Skeptic).
3. Risk register inherits all five Skeptic/Analyst/Strategist failure modes above.
4. Confidence kept at **MEDIUM-HIGH** for direction but the two Skeptic *hard conditions* (post-mortem + parity suite) are made gating prerequisites in SPEC-401 -- the port does not start until both exist.
5. Keep the bash commit-time gate independent of the TS runtime to preserve defense-in-depth (new, from Skeptic point 4).
