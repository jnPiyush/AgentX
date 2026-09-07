# Prototype Craft - Layout and Patterns

> Read this when the [prototype-craft](../SKILL.md) root sends you here for the
> original component pattern catalog, responsive strategy, file layout, and
> anti-pattern list. The sections below are preserved verbatim from the
> original root.

## Component Patterns

### Card Component

- Rounded corners (12-16px)
- Subtle border OR shadow (not both)
- Consistent padding (24px body, 16px compact)
- Image container with aspect-ratio and object-fit
- Hover: lift with shadow increase

### Data Table

- Alternating row backgrounds (neutral-50/white)
- Sticky header with subtle bottom border
- Cell padding 12px 16px
- Sortable columns with icon indicators
- Row hover highlight

### Form Inputs

- Border-radius 8px
- Focus ring: 2px offset, primary color
- Error state: red border + inline message
- Label above input (not placeholder-as-label)
- Helper text below in neutral-500

### Navigation

- Fixed/sticky header with blur backdrop
- Active state: bold + underline or pill background
- Mobile: hamburger with slide-in panel or bottom sheet
- Breadcrumbs for deep hierarchy

### Dashboard Stats

- Icon + metric + label + trend indicator
- Grid layout (2 cols mobile, 4 cols desktop)
- Subtle background color coding per stat type
- Compact sparkline or progress bar

## Responsive Strategy

| Breakpoint | Target | Columns | Approach |
|-----------|--------|---------|----------|
| < 640px | Mobile | 1-2 | Stack, bottom nav, touch targets 44px+ |
| 640-1024px | Tablet | 2-3 | Sidebar collapses, grid adapts |
| > 1024px | Desktop | 3-4+ | Full layout, fixed sidebar |

Use `clamp()` for fluid typography and spacing. Prefer CSS Grid with `auto-fit` / `minmax()` for responsive cards.

## Prototype File Structure

```
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

```
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

## Anti-Patterns

- Placeholder-only content ("Lorem ipsum" everywhere) -- use realistic sample data
- Missing states: always design empty, loading, error, success states
- Flat/unstyled buttons without hover/active/focus states
- Fixed pixel widths that break on resize
- Color contrast below 4.5:1 for text
- Missing focus indicators on interactive elements
