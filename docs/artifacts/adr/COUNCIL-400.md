# COUNCIL-400: AgentX integration model for the VS Code Agents Window

**Topic:** adr-400-vscode-agents-window 
**Question:** Given Options A-D in ADR-400, which option is the right choice for integrating AgentX with the VS Code Agents Window, and what is the strongest case AGAINST the recommended option? 
**Purpose:** adr-options 
**Convened:** 2026-05-29 
**Council members (illustrative diversity slots, see project-conventions):**

| Role | Model slot | Lens |
|------|------------|------|
| Analyst | `openai/gpt-5.4` | Decompose options against differentiating criteria; demand evidence |
| Strategist | `anthropic/claude-opus-4.7` | Recommend what a senior architect would pick; explain the trade-off accepted |
| Skeptic | `google/gemini-3.1-pro` | Argue against the front-runner; surface 18-month failure modes and vendor risk |

> Per AgentX convention, the model names above are diversity slots and the deliberation is model-agnostic. The Architect agent generated each perspective in turn and synthesized below.

---

## Analyst perspective

The four options differ primarily on three axes: (1) where orchestration lives, (2) what the user sees in the Agents Window dropdown, and (3) what AgentX has to maintain in TypeScript vs Markdown vs PowerShell.

**Decomposition against the differentiating criteria:**

| Differentiator | A (Customizations-only) | B (Dual-surface) | C (Native + CLI bridge) | D (MCP-only) |
|----------------|--------------------------|-------------------|--------------------------|---------------|
| AgentX agents appear in Agents Window dropdown | Yes | **No** (chat participant invisible) | Yes | No (only tools) |
| Editor-window tree view preserved | No | Yes | Yes | Yes |
| Quality-loop gate firing point | Hooks only | Pre-commit only | Hooks + pre-commit + CLI | Hooks only |
| Lines of code to remove from `vscode-extension/` | ~50% | 0% | ~30% | ~40% |
| New artifact types AgentX must ship | Plugin bundle | None | Plugin bundle + Hooks bundle | MCP server |
| Coordinator + Worker subagent pattern expressible | Yes | Partial | Yes | No |
| Works offline / on non-GitHub repos | Yes (Local agent only) | Yes | Yes | Yes |

**Evidence demanded:** The decisive evidence is the documented fact that the Agents Window dropdown reads `.agent.md` files, not `chatParticipants` registrations -- this is on the Custom Agents and Agents Overview docs verified 2026-05-29. Option B therefore *cannot* surface AgentX agents in the Agents Window without also adopting `.agent.md`, at which point it is a strictly worse Option C (two code paths instead of one).

**Analyst recommendation:** C is the only option that simultaneously satisfies "AgentX agents visible in Agents Window" and "editor-window UX preserved" without doubling the maintenance surface. Option A is a defensible runner-up but pays a real UX cost. Option D is wrong for AgentX's product framing (agents become invisible).

---

## Strategist perspective

A senior architect making this call in 2026 has to weigh **strategic alignment with the VS Code platform direction** against **migration cost for the existing user base**. The Agents Window is the publicly stated agent-first direction; chat participants are not going away, but they are being repositioned as the editor-window-only surface.

The right strategic move is to **invest where the platform is going** without burning the user base that lives where the platform is now. That is exactly Option C:

- It puts AgentX's centre of gravity into `.agent.md` + Customizations + Hooks, which is where VS Code is investing.
- It keeps the extension as a thin adapter for the editor window, so today's users see no regression.
- It collapses orchestration to a single CLI -- which is the same shape the AgentX team has been pushing toward independently (the `agentic-runner.ps1` and `agentx.ps1` work in v8.x is already CLI-shaped).
- It accepts a near-term refactor cost in exchange for removing the long-term ambiguity of "where does AgentX live".

The trade-off accepted is **dependency on Preview-era APIs**: Customizations programmatic registration is still evolving. The senior-architect call is that this is acceptable because (a) the `.agent.md` and Hooks pieces work without any extension API at all -- you can install AgentX by cloning `.github/agents/` and `.agentx/`, the extension is sugar -- and (b) the platform has committed publicly to the Agents Window direction.

The senior architect would NOT pick Option B; it is the seductive "lowest cost today" answer that buys you eighteen months of "why is AgentX in the editor chat picker but not in the Agents Window picker?" support tickets.

**Strategist recommendation:** C, with the explicit acceptance that we pay a near-term refactor cost to align with the platform direction.

---

## Skeptic perspective

The case against Option C is real and worth recording. Three failure modes in the next 18 months:

1. **Customizations panel programmatic registration shifts under us.** This is a Preview-era API. If Microsoft changes how plugins register themselves into Agents/Skills/Hooks categories, AgentX's polish breaks. *Severity: Medium.* *Mitigation: keep manual install via `.agentx/plugins/` as the always-works fallback; do not let the extension API path be the only install method.*
2. **`.agent.md` frontmatter schema churn.** The frontmatter (`user-invocable`, `disable-model-invocation`, `agents`, `tools`) is documented but still evolving. A schema change forces a 24-file rewrite. *Severity: Low-Medium.* *Mitigation: write a `validate-frontmatter.ps1` extension that fails fast on schema drift; treat the 24 files as machine-generated where possible.*
3. **Hooks runtime portability.** Hooks run as shell commands. AgentX currently has `.ps1` everywhere and `.sh` only for some entry points. If a mac/Linux user installs AgentX and a hook is `.ps1`-only, the session fails. *Severity: Medium.* *Mitigation: enforce that every hook ships both `.ps1` and `.sh` variants; cover this with a CI check (`scripts/check-harness-compliance.ps1` already exists -- extend it).*

The Skeptic also notes one **vendor risk**: the Cloud agent runtime only works for GitHub-backed repositories. AgentX's `local` provider is the default for many users; if we describe the Agents Window experience as "use Cloud sessions for the full AgentX loop", we lock out the local-mode user base. *Mitigation: treat the Copilot CLI session as the default Agents Window runtime; the Cloud session is an enhancement, not a requirement.*

The Skeptic does NOT argue for B or D as the right call -- B has the visibility problem already noted, and D destroys the agent-persona framing. The Skeptic's argument is "C is right, but front-load these four mitigations or you will regret it within a year."

**Skeptic recommendation:** C, conditional on the four mitigations above being part of the Consequences and Spec risk register.

---

## Synthesis

**Consensus on the recommended option:** All three perspectives (Analyst, Strategist, Skeptic) converge on **Option C**. The Analyst rules out B and D on hard evidence; the Strategist rules out B on platform-direction grounds; the Skeptic accepts C but demands explicit mitigations.

**Divergences on option ranking or criteria weighting:** None on the top pick. There is mild divergence on the *runner-up*: Analyst would pick A if C were unavailable, Strategist would also pick A, Skeptic would pick B for the lower migration risk. Recorded in ADR-400 Consequences as: "If Option C proves too costly to implement, fall back to Option A; do not fall back to B."

**Failure modes and vendor risks surfaced (promoted to ADR Consequences and Spec risk register):**

- Preview-era Customizations programmatic registration may shift -- keep manual install fallback (Skeptic, Medium severity).
- `.agent.md` frontmatter schema may evolve -- enforce schema validation in CI (Skeptic, Low-Medium severity).
- Hooks portability between PowerShell and POSIX shells -- enforce both variants in CI (Skeptic, Medium severity).
- Cloud agent runtime is GitHub-only -- treat Copilot CLI session as the default Agents Window runtime (Skeptic, Low severity for AgentX, since Local Mode users already do not depend on cloud).
- Chat participant UX mismatch in Agents Window -- explicitly mark `agentx.chat` as editor-window-only in docs (Analyst, Low severity once documented).

**Net adjustment to ADR:**

- ADR Decision: unchanged (Option C).
- ADR Consequences: added the four Skeptic-raised mitigations as Negative/Neutral items.
- Tech Spec risk register: copy all four mitigations as explicit risks with mitigation paths.
- Fallback rule: documented that if Option C proves unworkable, the planned fallback is Option A, not Option B.

**Confidence in the synthesis:** HIGH on the option choice; MEDIUM on the exact implementation cost until the first prototype lands.
