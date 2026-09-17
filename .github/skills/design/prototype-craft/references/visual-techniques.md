---
description: 'Conditional palette, typography, elevation, motion and component recipes for prototype craft.'
---

# Visual Techniques and Component Patterns

MUST read before applying these techniques. The target `DESIGN.md`, product
posture, [accessibility](../../accessibility/SKILL.md) and
[anti-slop](../../anti-slop/SKILL.md) override every example. Fonts, viewport
scaling, glass, gradients and 12-16px card radii are demonstrations, not defaults
or exceptions to target rules. Reject conflicting techniques; do not waive user
needs. Motion must honor reduced motion and preserve keyboard/focus behavior.

## Visual Techniques

### Color Palette Construction

```css
:root {
  /* Primary with tints and shades */
  --color-primary-50: hsl(220, 90%, 96%);
  --color-primary-100: hsl(220, 85%, 90%);
  --color-primary-500: hsl(220, 80%, 50%);
  --color-primary-700: hsl(220, 75%, 35%);
  --color-primary-900: hsl(220, 70%, 20%);

  /* Neutral scale */
  --color-neutral-50: hsl(220, 10%, 97%);
  --color-neutral-100: hsl(220, 10%, 93%);
  --color-neutral-200: hsl(220, 10%, 85%);
  --color-neutral-500: hsl(220, 10%, 50%);
  --color-neutral-800: hsl(220, 10%, 20%);
  --color-neutral-900: hsl(220, 10%, 10%);

  /* Semantic colors */
  --color-success: hsl(145, 65%, 42%);
  --color-warning: hsl(38, 95%, 50%);
  --color-error: hsl(0, 75%, 55%);
}
```

### Typography Scale

```css
:root {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Plus Jakarta Sans', var(--font-sans);
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Type scale (1.25 major third) */
  --text-xs: clamp(0.64rem, 0.6vw, 0.75rem);
  --text-sm: clamp(0.8rem, 0.75vw, 0.875rem);
  --text-base: clamp(1rem, 1vw, 1.125rem);
  --text-lg: clamp(1.25rem, 1.25vw, 1.375rem);
  --text-xl: clamp(1.563rem, 1.5vw, 1.75rem);
  --text-2xl: clamp(1.953rem, 2vw, 2.25rem);
  --text-3xl: clamp(2.441rem, 2.5vw, 3rem);
}
```

### Elevation System

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
}
```

### Smooth Transitions

```css
:root {
  --ease-out: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
}

/* Apply to all interactive elements */
button, a, input, select, textarea, [role="button"] {
  transition: all var(--duration-fast) var(--ease-out);
}

button:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
button:active { transform: translateY(0); }
```

### Glass and Gradient Effects

```css
/* Frosted glass card */
.card-glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
}

/* Gradient backgrounds */
.bg-gradient-primary {
  background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700));
}

/* Mesh gradient hero */
.hero-mesh {
  background-color: var(--color-primary-50);
  background-image:
    radial-gradient(at 40% 20%, hsla(220, 80%, 70%, 0.3) 0px, transparent 50%),
    radial-gradient(at 80% 0%, hsla(189, 80%, 60%, 0.2) 0px, transparent 50%),
    radial-gradient(at 0% 50%, hsla(260, 80%, 60%, 0.15) 0px, transparent 50%);
}
```

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