# UX Spec: AgentX Public Landing Page

> Prototype: [docs/ux/prototypes/landing/index.html](prototypes/landing/index.html)

## Product Posture

- **Primary posture:** workflow-led
- **Secondary posture:** trust-led
- **Page archetype:** workflow demo with proof-led supporting sections
- **Audience:** developers, engineering leads, architects, and platform teams evaluating structured AI delivery rather than another autocomplete tool

## Reference Boundary

The provided Orbit URL was inspected on 2026-08-08. It exposes a concise sign-in entry page and redirects to Microsoft/GitHub authentication. Its internal product content was not available to the agent browser and is not inferred here.

The only adopted cues are:

- state the product name and next action immediately
- keep the entry path focused
- progressively disclose detail after the first decision

All AgentX claims come from repository evidence.

## User Jobs

1. Understand what AgentX is within one viewport.
2. See how the workflow differs from ad hoc prompting.
3. Find the relevant specialist roles and supported platforms.
4. Understand security and evidence controls before granting autonomy.
5. Install the extension and initialize a workspace.

## Information Architecture

1. **Sticky navigation:** Workflow, Team, Platforms, Security, Install, GitHub.
2. **Hero:** current version, concise promise, two actions, verified inventory.
3. **Why AgentX:** repository context, evidence, and compounded learning.
4. **Operating loop:** Brainstorm -> Plan -> Work -> Review -> Capture -> Done.
5. **Specialist team:** six role families covering all visible agents.
6. **Platforms:** VS Code/Copilot, Claude/OpenAI/local models, CLI/editors, WhatsApp.
7. **Security:** mechanical controls and Model Council.
8. **Install:** Marketplace command and first-workspace steps.
9. **Footer:** repository, security, release, and contribution routes.

The obsolete `/v2` page redirects permanently to `/` so the public site has one current source of truth.

## Content Rules

- Use only verified counts: 26 agents, 15 visible roles, 130 skills, 5+ required passes.
- Do not claim adoption, install counts, speed, productivity multipliers, or customer logos.
- Treat model names as adapter options, not guarantees of one provider.
- Explain controls near autonomy claims.
- Use direct, neutral actions: "Install AgentX", "Explore the repository", "Read the guide".

## Design System

The page uses the Clawpilot theme contract required for standalone HTML artifacts:

- warm neutral light surfaces and charcoal dark surfaces
- one deep rose accent
- Segoe UI/Aptos prose and Consolas code
- 10px controls, 16px cards, subtle borders and shadows
- no gradients, aurora blobs, glass body surfaces, fake metrics, testimonials, or emoji
- 4px-based spacing and restrained transitions

## Responsive Behavior

- **Desktop:** two-column section headings, multi-column proof/role/platform grids, six-step workflow.
- **Tablet:** two-column cards, three-column workflow, collapsible navigation.
- **Mobile:** single-column content, full-width actions, stacked release facts and workflow.
- No horizontal scrolling at 360, 640, 1024, 1440, or 1920px.

## Accessibility

- First focusable element is a skip link.
- Semantic `header`, `nav`, `main`, `section`, `aside`, and `footer` landmarks.
- One H1 followed by sequential H2/H3 levels.
- Mobile menu exposes `aria-expanded`, `aria-controls`, and descriptive labels.
- Copy feedback uses an `aria-live="polite"` status region.
- Focus rings meet contrast requirements; touch targets are at least 44px.
- Reduced motion collapses transition and animation durations.
- Information is never communicated through color alone.

## Performance and Security

- Same-origin static HTML/CSS/JavaScript; no Tailwind CDN, remote font, analytics, or telemetry.
- No render-blocking external dependencies.
- Vercel applies a same-origin CSP plus `nosniff`, referrer, permissions, and frame-denial headers.
- The clipboard is the only browser capability requested, and failure has an honest fallback.
- Escape closes the mobile menu and returns focus; clipboard failure selects the command text.

## Acceptance Checklist

- [ ] Desktop and mobile screenshots reviewed
- [ ] Primary route has no browser console errors
- [ ] `/v2` redirects to `/`
- [ ] Mobile menu opens, closes, and returns to a collapsed state after navigation
- [ ] Copy button reports success or manual fallback
- [ ] Keyboard path covers skip link, menu, nav, CTAs, and footer links
- [ ] axe-core reports zero serious or critical findings
- [ ] No T1-T10 anti-slop finding or invented metric remains
- [ ] Production Vercel URL serves AgentX 8.7.0 content

## References

- AgentX guide: [docs/GUIDE.md](../GUIDE.md)
- Workflow reference: [docs/WORKFLOW.md](../WORKFLOW.md)
- Security policy: [SECURITY.md](../../SECURITY.md)
- Skills index: [Skills.md](../../Skills.md)
