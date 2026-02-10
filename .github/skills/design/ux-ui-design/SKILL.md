---
name: "ux-ui-design"
description: "Concise guide for UX/UI design: wireframing, prototyping, user flows, accessibility, and production-ready HTML prototypes."
metadata:
  author: "AgentX"
  version: "2.0.0"
  created: "2025-01-15"
  updated: "2025-01-15"
compatibility:
  agents: ["ux-designer", "agent-x"]
  frameworks: ["html-css", "figma", "tailwind", "bootstrap"]
  output-formats: ["html", "css", "markdown", "mermaid"]
allowed-tools: "read_file create_file run_in_terminal semantic_search grep_search file_search"
---

# UX/UI Design & Prototyping

> **Purpose**: Create user-centered designs, wireframes, prototypes, and production-ready HTML/CSS interfaces.

---

## Decision Tree

Use this to pick the right UX approach for your task:

```
Start: What is the deliverable?
│
├─ New feature / epic?
│  └─ 1. User Research → 2. IA → 3. Wireframes → 4. User Flows
│     → 5. Hi-Fi Mockups → 6. HTML Prototype → 7. Usability Test
│
├─ Bug fix / small change?
│  └─ Skip to step 5 (Hi-Fi) or 6 (HTML Prototype)
│
├─ Design system update?
│  └─ Jump to § Design Systems — update tokens + components
│
├─ Accessibility audit?
│  └─ Jump to § Accessibility — run checklist + fix
│
└─ Responsive issue?
   └─ Jump to § Responsive Design — breakpoint check + fix
```

---

## Table of Contents

1. [User Research & Analysis](#user-research--analysis)
2. [Information Architecture](#information-architecture)
3. [Wireframing](#wireframing)
4. [User Flows](#user-flows)
5. [High-Fidelity Mockups](#high-fidelity-mockups)
6. [Interactive Prototypes](#interactive-prototypes)
7. [HTML/CSS Prototypes](#htmlcss-prototypes)
8. [Design Systems](#design-systems)
9. [Accessibility (A11y)](#accessibility-a11y)
10. [Responsive Design](#responsive-design)
11. [Usability Testing](#usability-testing)
12. [Best Practices](#best-practices)
13. [Tools & Resources](#tools--resources)

---

## User Research & Analysis

### User Personas

Define **primary** and **secondary** personas covering: demographics, goals, pain points, behaviors, and a representative quote. Keep personas to one page each.

> **📄 Full template** → [references/research-templates.md](references/research-templates.md)

### User Journey Mapping

Map the end-to-end experience across these stages:

| Stage | Focus | Capture |
|-------|-------|---------|
| Awareness | How they find you | Channel, emotion |
| Consideration | Evaluating value | Features reviewed, hesitations |
| Sign Up | Registration | Friction points, drop-off |
| Onboarding | First use | Time to value, confusion |
| First Value | Goal achieved | Success signal, delight |

**Key output**: A list of **recommendations** with specific, actionable changes (e.g., "Reduce required fields to 3").

> **📄 Full journey template** → [references/research-templates.md](references/research-templates.md)

---

## Information Architecture

### Site Map

Organize content into a clear hierarchy. Every page needs: priority (P0–P3), content type, and status.

**Rules:**
- Max 7 ± 2 top-level items (Miller's Law)
- 3 clicks max to any content
- Group by user mental model, not org structure
- Authenticated vs. public areas clearly separated

### Content Inventory

| Page | Priority | Content Type | Status |
|------|----------|--------------|--------|
| Home | P0 | Marketing | ✅ Done |
| Dashboard | P0 | Application | 🚧 In Progress |
| Settings | P1 | Application | ⏳ Pending |
| Docs | P1 | Content | ✅ Done |

---

## Wireframing

### Fidelity Levels

| Level | Purpose | Tools | When |
|-------|---------|-------|------|
| **Lo-fi** | Explore layout/structure | Pen & paper, Excalidraw | Early ideation |
| **Mid-fi** | Real labels, content structure | Balsamiq, Whimsical | After IA is set |
| **Hi-fi** | Pixel-perfect design | Figma, Sketch | Before dev handoff |

### Wireframe Checklist

- [ ] Content areas proportionally sized
- [ ] Navigation labels are real (not placeholder)
- [ ] Form fields have labels and hint text
- [ ] Button text describes the action (not "Click here")
- [ ] Annotations explain interactions
- [ ] Edge cases noted (empty state, overflow)

---

## User Flows

Document every decision path a user can take. Use flowcharts (Mermaid recommended).

**Task flow must include:**
- **Actor** + **Goal** + **Entry point**
- Each step: location, state, validation
- **Success** path with feedback
- **Error** path with recovery
- **Edge cases** (network error, quota exceeded, duplicates)

### Flow Diagram Notation

```
[Decision?]     → diamond
(Action)        → rectangle
{System Event}  → rounded
Start/End       → pill shape
```

---

## High-Fidelity Mockups

### Mockup Checklist

**Visual Design:**
- [ ] Brand colors applied consistently
- [ ] Typography hierarchy clear (H1 > H2 > body)
- [ ] 8px spacing grid followed
- [ ] Icons use consistent style/weight
- [ ] Images are high quality with correct aspect ratio

**Component States — design ALL of these:**
- [ ] Default
- [ ] Hover / Focus
- [ ] Active / Selected
- [ ] Disabled
- [ ] Loading / Skeleton
- [ ] Error
- [ ] Success
- [ ] Empty state

---

## Interactive Prototypes

### Prototype Types

| Type | Fidelity | Use Case |
|------|----------|----------|
| **Click-through** | Low | Validate navigation flow |
| **Interactive** | Medium | Test form validation, menus, tabs |
| **Code prototype** | High | Production-ready HTML/CSS/JS |

### Interaction Spec Pattern

For every interactive element, document:

1. **Trigger** → what the user does (click, hover, keypress)
2. **State transitions** → Default → Loading → Success / Error
3. **Timing** → duration of animations, auto-dismiss delays
4. **Feedback** → visual change, toast, redirect

---

## HTML/CSS Prototypes

**All prototypes MUST be production-ready HTML/CSS.** This is mandatory per AgentX UX Designer role.

### Prototype Structure

```
prototype/
├── index.html          # Semantic HTML5, ARIA landmarks
├── css/
│   ├── variables.css   # Design tokens (colors, spacing, type)
│   ├── reset.css       # Normalize browser defaults
│   ├── components.css  # Buttons, cards, forms, modals
│   └── main.css        # Page-specific layout
├── js/
│   └── main.js         # Modal, form validation, toasts
├── images/
└── README.md           # Setup & usage instructions
```

### Design Tokens (Key Variables)

Use CSS custom properties for all values. Key token categories:

| Category | Examples | Grid |
|----------|----------|------|
| **Colors** | `--color-primary`, `--color-error` | Semantic names |
| **Typography** | `--font-size-base`, `--font-weight-semibold` | Rem-based scale |
| **Spacing** | `--space-1` through `--space-16` | 8px grid |
| **Radius** | `--radius-sm` through `--radius-full` | Consistent rounding |
| **Shadows** | `--shadow-sm` through `--shadow-xl` | Elevation system |
| **Z-index** | `--z-dropdown` through `--z-tooltip` | Layering order |
| **Transitions** | `--transition-fast` (150ms) | Consistent motion |

### Core Components

Every prototype must include these reusable components:

- **Buttons** — primary, secondary, ghost, disabled, loading states
- **Forms** — inputs, selects, textareas with validation + error display
- **Cards** — image, content, footer layout with hover elevation
- **Modals** — backdrop, focus trap, ESC-to-close, ARIA dialog role
- **Toast notifications** — auto-dismiss, type variants (info/success/error)

> **📄 Full HTML/CSS/JS code** → [references/html-prototype-code.md](references/html-prototype-code.md)

---

## Design Systems

### Component Library Structure

```
Foundations          Components          Patterns
├── Colors           ├── Buttons          ├── Navigation
├── Typography       ├── Forms            ├── Form Patterns
├── Spacing          ├── Cards            ├── Data Display
├── Icons            ├── Modals           └── Empty States
└── Grid             ├── Navigation
                     ├── Tables
                     └── Alerts
```

### Design Token Rules

| ✅ DO | ❌ DON'T |
|-------|---------|
| Use primary for main CTAs | Use primary for large backgrounds |
| Use primary-light for card hovers | Mix primary + secondary in same component |
| Maintain 4.5:1 contrast with white text | Use brand colors for error/warning states |
| Document every token with usage notes | Hardcode hex values in component CSS |

---

## Accessibility (A11y)

### WCAG 2.1 AA Checklist

**Perceivable:**
- [ ] Text contrast ≥ 4.5:1 (body) / ≥ 3:1 (large text)
- [ ] All images have meaningful `alt` text
- [ ] Color is never the **sole** indicator of meaning
- [ ] Text resizes to 200% without content loss

**Operable:**
- [ ] All interactive elements keyboard-reachable
- [ ] Focus indicators always visible
- [ ] No keyboard traps
- [ ] Skip-navigation link present
- [ ] Sufficient time limits (or adjustable)

**Understandable:**
- [ ] `<html lang="en">` declared
- [ ] Every `<input>` has a `<label>`
- [ ] Error messages are specific and helpful
- [ ] Navigation is consistent across pages

**Robust:**
- [ ] HTML validates (no duplicate IDs, proper nesting)
- [ ] ARIA used correctly (roles, states, properties)
- [ ] Screen reader tested (VoiceOver / NVDA)
- [ ] Status messages use `aria-live` regions

### Key Patterns (Summary)

| Pattern | Implementation |
|---------|---------------|
| Skip link | `<a href="#main-content" class="skip-link">` |
| Landmarks | `<nav aria-label="...">`, `<main>`, `<aside>` |
| Form hints | `aria-describedby` pointing to hint `<p>` |
| Live regions | `role="alert" aria-live="polite"` |
| Icon buttons | `aria-label` on button, `aria-hidden` on SVG |
| Focus trap | Cycle Tab between first/last focusable in modal |

> **📄 Full accessibility markup & JS** → [references/accessibility-patterns.md](references/accessibility-patterns.md)

---

## Responsive Design

### Breakpoint System

| Token | Width | Target |
|-------|-------|--------|
| `--breakpoint-sm` | 640px | Phones (landscape) |
| `--breakpoint-md` | 768px | Tablets |
| `--breakpoint-lg` | 1024px | Desktops |
| `--breakpoint-xl` | 1280px | Large desktops |
| `--breakpoint-2xl` | 1536px | Ultra-wide |

### Mobile-First Strategy

1. Write base styles for mobile (no media query)
2. Add `@media (min-width: ...)` for larger screens
3. Use `repeat(auto-fit, minmax(300px, 1fr))` for auto-responsive grids

### Responsive Checklist

- [ ] Navigation collapses to hamburger on mobile
- [ ] Touch targets ≥ 44×44px
- [ ] No horizontal scrolling at any breakpoint
- [ ] Images use `loading="lazy"` and responsive `srcset`
- [ ] Font sizes scale appropriately (clamp or media queries)
- [ ] Modals are full-screen on mobile

> **📄 Full breakpoint CSS & grid code** → [references/responsive-patterns.md](references/responsive-patterns.md)

---

## Usability Testing

### Quick Test Plan

| Element | Details |
|---------|---------|
| **Objective** | Validate users can complete [primary task] |
| **Participants** | 5–8 users, mix of new + existing |
| **Tasks** | 3–5 realistic scenarios |
| **Metrics** | Completion rate, time, error count, satisfaction (1–5) |

### Test Script Essentials

- **Intro**: "We're testing the feature, not you. Think aloud. No wrong answers."
- **During**: Observe silently; note confusion points; ask follow-ups only after task attempt
- **Debrief**: "What was hardest?", "What would you change?", "Rate 1–5"

### Results Table

| Task | Completion | Avg Time | Errors | Satisfaction |
|------|-----------|----------|--------|--------------|
| Task 1 | 5/5 (100%) | 1m 23s | 0.4 | 4.6/5 |
| Task 2 | 4/5 (80%) | 2m 45s | 1.2 | 3.8/5 |

> **📄 Full test plan template** → [references/usability-testing-template.md](references/usability-testing-template.md)

---

## Best Practices

### ✅ DO

**Research & Wireframing:**
- Start with lo-fi sketches; iterate on paper first
- Use real content, never lorem ipsum in final designs
- Annotate interactions on every wireframe
- Test with diverse user demographics

**Design & Prototyping:**
- Follow the 8px spacing grid
- Design for ALL states: empty, loading, error, success
- Build production-ready HTML/CSS prototypes (mandatory)
- Use semantic HTML5 + ARIA attributes from the start
- Use CSS custom properties for all design tokens
- Validate HTML & CSS

**Collaboration:**
- Document every design decision
- Share prototypes early and gather developer feedback
- Version-control design files
- Hand off with detailed specifications

### ❌ DON'T

- Skip user research or design in isolation
- Leave placeholder content in final deliverables
- Ignore edge cases and error states
- Forget mobile/tablet breakpoints
- Neglect accessibility until the end
- Hardcode values instead of using design tokens
- Use large unoptimized images
- Inline all styles (use external stylesheets)
- Block rendering with synchronous scripts

---

## Tools & Resources

### Design & Wireframing

| Tool | Use Case | Link |
|------|----------|------|
| Figma | Collaborative design | [figma.com](https://figma.com) |
| Sketch | Mac design | [sketch.com](https://sketch.com) |
| Penpot | Open-source design | [penpot.app](https://penpot.app) |
| Balsamiq | Quick wireframes | [balsamiq.com](https://balsamiq.com) |
| Whimsical | Flowcharts + wireframes | [whimsical.com](https://whimsical.com) |
| Excalidraw | Hand-drawn diagrams | [excalidraw.com](https://excalidraw.com) |

### Prototyping

| Tool | Use Case | Link |
|------|----------|------|
| CodePen | Quick HTML/CSS/JS | [codepen.io](https://codepen.io) |
| Tailwind CSS | Utility-first CSS | [tailwindcss.com](https://tailwindcss.com) |
| Bootstrap | Component framework | [getbootstrap.com](https://getbootstrap.com) |

### Accessibility

| Tool | Use Case | Link |
|------|----------|------|
| WAVE | Accessibility checker | [wave.webaim.org](https://wave.webaim.org) |
| axe DevTools | Browser extension | [deque.com/axe](https://www.deque.com/axe) |
| WCAG Quick Ref | Guidelines | [w3.org/WAI](https://www.w3.org/WAI/WCAG21/quickref/) |

### Inspiration

[Dribbble](https://dribbble.com) · [Behance](https://behance.net) · [awwwards](https://awwwards.com)

---

## Reference Files

Detailed code blocks and templates are extracted into dedicated reference files:

| Reference | Contents |
|-----------|----------|
| [html-prototype-code.md](references/html-prototype-code.md) | Full HTML/CSS/JS prototype code (dashboard, modals, forms, tokens) |
| [research-templates.md](references/research-templates.md) | Persona template, user journey map template |
| [accessibility-patterns.md](references/accessibility-patterns.md) | Screen reader markup, keyboard navigation JS, ARIA patterns |
| [responsive-patterns.md](references/responsive-patterns.md) | Breakpoint CSS, responsive grid, mobile-first examples |
| [usability-testing-template.md](references/usability-testing-template.md) | Full usability test plan, script, and results template |

---

**Related Skills:**
- [Frontend/UI Development](../development/frontend-ui/SKILL.md)
- [React Framework](../development/react/SKILL.md)
- [Accessibility](../architecture/accessibility/SKILL.md)

---

**Version**: 2.0.0 · **Last Updated**: February 10, 2026
