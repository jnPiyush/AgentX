# Design Systems, Accessibility & Responsive Design

## Design Systems

### Component Library Structure

```
Foundations Components Patterns
+-- Colors +-- Buttons +-- Navigation
+-- Typography +-- Forms +-- Form Patterns
+-- Spacing +-- Cards +-- Data Display
+-- Icons +-- Modals -- Empty States
-- Grid +-- Navigation
 +-- Tables
 -- Alerts
```

### Design Token Rules

| [PASS] DO | [FAIL] DON'T |
|-------|---------|
| Use primary for main CTAs | Use primary for large backgrounds |
| Use primary-light for card hovers | Mix primary + secondary in same component |
| Maintain 4.5:1 contrast with white text | Use brand colors for error/warning states |
| Document every token with usage notes | Hardcode hex values in component CSS |

---

## Accessibility (A11y)

### WCAG 2.1 AA Checklist

**Perceivable:**
- [ ] Text contrast 4.5:1 (body) / 3:1 (large text)
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

> ** Full accessibility markup & JS** -> [references/accessibility-patterns.md](references/accessibility-patterns.md)

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
- [ ] Touch targets 4444px
- [ ] No horizontal scrolling at any breakpoint
- [ ] Images use `loading="lazy"` and responsive `srcset`
- [ ] Font sizes scale appropriately (clamp or media queries)
- [ ] Modals are full-screen on mobile

> ** Full breakpoint CSS & grid code** -> [references/responsive-patterns.md](references/responsive-patterns.md)

---

## Usability Testing

### Quick Test Plan

| Element | Details |
|---------|---------|
| **Objective** | Validate users can complete [primary task] |
| **Participants** | 5-8 users, mix of new + existing |
| **Tasks** | 3-5 realistic scenarios |
| **Metrics** | Completion rate, time, error count, satisfaction (1-5) |

### Test Script Essentials

- **Intro**: "We're testing the feature, not you. Think aloud. No wrong answers."
- **During**: Observe silently; note confusion points; ask follow-ups only after task attempt
- **Debrief**: "What was hardest?", "What would you change?", "Rate 1-5"

### Results Table

| Task | Completion | Avg Time | Errors | Satisfaction |
|------|-----------|----------|--------|--------------|
| Task 1 | 5/5 (100%) | 1m 23s | 0.4 | 4.6/5 |
| Task 2 | 4/5 (80%) | 2m 45s | 1.2 | 3.8/5 |

> ** Full test plan template** -> [references/usability-testing-template.md](references/usability-testing-template.md)

---
