---
description: 'Conditional framework, responsive layout and file structure recipes for prototypes.'
---

# Framework and Layout Recipes

MUST read when choosing framework, breakpoints, file layout or screen archetype.
Apply only choices supported by target `DESIGN.md`, product posture,
[accessibility](../../accessibility/SKILL.md) and
[anti-slop](../../anti-slop/SKILL.md). The preserved examples do not authorize
network use, default fonts, viewport-scaled type, decorative heroes, fabricated
testimonials or metrics. Use approved dependencies and honest placeholders.

## CSS Framework Guidance

### Tailwind CSS (Preferred)

When using Tailwind, include via CDN for prototypes:

```html
<script src="https://cdn.tailwindcss.com"></script>
```

Use Tailwind's utility classes for rapid prototyping. Custom config for brand colors:

```html
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: { primary: { 500: '#3b82f6', 700: '#1d4ed8' } },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }
    }
  }
}
</script>
```

### Pure CSS (Fallback)

When Tailwind is not appropriate, use CSS custom properties for theming and BEM naming for structure. Single CSS file, organized: reset -> variables -> base -> layout -> components -> utilities.

## Responsive Strategy

| Breakpoint | Target | Columns | Approach |
|-----------|--------|---------|----------|
| < 640px | Mobile | 1-2 | Stack, bottom nav, touch targets 44px+ |
| 640-1024px | Tablet | 2-3 | Sidebar collapses, grid adapts |
| > 1024px | Desktop | 3-4+ | Full layout, fixed sidebar |

Use `clamp()` for fluid typography and spacing. Prefer CSS Grid with `auto-fit` / `minmax()` for responsive cards.

## Prototype File Structure

```text
docs/ux/prototypes/
  index.html          # Main entry point
  styles/
    variables.css     # Design tokens
    base.css          # Reset + base styles
    components.css    # Component styles
    layout.css        # Grid/layout
    utilities.css     # Helper classes
  scripts/
    main.js           # Interactions (modals, tabs, forms)
  assets/
    icons/            # SVG icons (inline preferred)
```

For quick prototypes, a single HTML file with embedded styles is acceptable.

## Decision Tree

```text
Need a prototype?
|
+-- Dashboard/data-heavy -> Use grid layout, stat cards, data tables
|
+-- Form/wizard -> Multi-step with progress, validation states, success feedback
|
+-- Landing/marketing -> Hero with gradient, feature grid, testimonials, CTA
|
+-- Settings/admin -> Sidebar nav, tabbed panels, toggle switches
|
+-- Mobile-first app -> Bottom nav, card-based content, swipe patterns
```