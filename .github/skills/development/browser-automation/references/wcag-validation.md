# WCAG 2.1 AA Validation via Playwright MCP + axe-core

> Reference for the [browser-automation](../SKILL.md) skill. Loaded only when an agent (typically UX Designer) needs to run an accessibility audit against an HTML/CSS prototype or rendered page.

## Why this exists

The UX Designer agent is required to claim WCAG 2.1 AA compliance for prototypes at `docs/ux/prototypes/`. Without browser automation, that claim is manual and untestable in agent loops. This reference defines a concrete, repeatable audit and how to map its output to AgentX review severities.

## Audit recipe

The Playwright MCP server does not bundle axe-core directly. Two paths work; pick the one that matches your MCP server version.

### Path 1: axe injected via `browser_evaluate` (preferred)

If the Playwright MCP server exposes a JavaScript evaluation tool:

1. `browser_navigate` to the prototype.
2. `browser_wait_for` network idle.
3. `browser_evaluate` to inject axe-core from CDN (`https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js`) and run `axe.run({ runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] })`.
4. Read the returned violations array.
5. `browser_close`.

If the network is restricted (controlled or restricted profile), inject from a local copy under `node_modules/axe-core/axe.min.js` instead. Document the path in the audit output.

### Path 2: axe via `@axe-core/playwright` runner (fallback)

If `browser_evaluate` is not available, run a small one-shot Node script that uses `@axe-core/playwright`. The script is invoked through the daemon ([SPEC-341](../../../../../docs/artifacts/specs/SPEC-341.md)) when available, or `run_in_terminal` otherwise. The script outputs JSON in the same shape as Path 1 so the severity mapping below stays unchanged.

## Severity mapping

axe-core reports `impact` per violation. AgentX review findings use HIGH / MEDIUM / LOW. Map as follows:

| axe `impact` | AgentX severity | Effect on UX handoff |
|--------------|-----------------|----------------------|
| `critical` | HIGH | Blocks UX -> Architect handoff. Must be fixed before status moves to `Ready`. |
| `serious` | MEDIUM | Blocks handoff. Must be fixed or explicitly waived in the UX deliverable's Open Questions section with rationale. |
| `moderate` | LOW | Logged in the UX deliverable. Does not block handoff but must be visible in the next review pass. |
| `minor` | LOW | Logged. Does not block. |

This mapping aligns with the existing AgentX self-review rubric: HIGH and MEDIUM block, LOW informs.

## Required audit output (attach to the UX deliverable)

```yaml
audit:
  url: file:///<workspace>/docs/ux/prototypes/<feature>.html
  ranAt: 2026-05-08T12:34:56Z
  axeVersion: 4.x
  ruleSet: [wcag2a, wcag2aa, wcag21a, wcag21aa]
  totals:
    critical: 0
    serious: 1
    moderate: 2
    minor: 0
  violations:
    - id: color-contrast
      impact: serious
      help: "Elements must have sufficient color contrast"
      helpUrl: "https://dequeuniversity.com/rules/axe/4.x/color-contrast"
      nodes:
        - target: ["button.primary"]
          failureSummary: "..."
```

The UX agent attaches this YAML block to the relevant UX spec under the Accessibility section. Reviewer cross-checks the totals against the severity mapping.

## Manual checks the audit does not cover

axe-core finds roughly 40-50% of WCAG issues automatically. The following still require manual confirmation by the UX agent and MUST appear in the UX deliverable's Accessibility checklist with PASS/FAIL:

- Keyboard navigation: every interactive element reachable via Tab, in a logical order, with a visible focus indicator. Use `browser_press_key("Tab")` + `browser_snapshot` repeatedly.
- Screen reader names: each interactive element has a non-empty accessible name. Verify in the snapshot.
- Color is not the only signal for state (error, required, selected). Verify by inspection.
- Motion / animation respects `prefers-reduced-motion`. Verify by toggling the OS-level setting and re-running the screenshot capture.

## Anti-patterns specific to a11y validation

- Do not run a single audit and call the prototype "WCAG 2.1 AA compliant" -- audit each meaningful state (default, hover, focus, error, success, empty, loading).
- Do not silently downgrade a `serious` finding to LOW. If a `serious` finding cannot be fixed in the current iteration, it is documented as an Open Question with explicit rationale.
- Do not screenshot a page with PII or secrets just to satisfy the screenshot step.

## References

- Skill: [browser-automation/SKILL.md](../SKILL.md)
- ADR: [docs/artifacts/adr/ADR-342.md](../../../../../docs/artifacts/adr/ADR-342.md)
- UX Designer agent: [.github/agents/ux-designer.agent.md](../../../../agents/ux-designer.agent.md)
