# User Flows, Mockups & Interactive Prototypes

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
[Decision?] -> diamond
(Action) -> rectangle
{System Event} -> rounded
Start/End -> pill shape
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

**Component States - design ALL of these:**
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

1. **Trigger** -> what the user does (click, hover, keypress)
2. **State transitions** -> Default -> Loading -> Success / Error
3. **Timing** -> duration of animations, auto-dismiss delays
4. **Feedback** -> visual change, toast, redirect

---

## HTML/CSS Prototypes

**All prototypes MUST be production-ready HTML/CSS.** This is mandatory per AgentX UX Designer role.

### Prototype Structure

```
prototype/
+-- index.html # Semantic HTML5, ARIA landmarks
+-- css/
| +-- variables.css # Design tokens (colors, spacing, type)
| +-- reset.css # Normalize browser defaults
| +-- components.css # Buttons, cards, forms, modals
| -- main.css # Page-specific layout
+-- js/
| -- main.js # Modal, form validation, toasts
+-- images/
-- README.md # Setup & usage instructions
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

- **Buttons** - primary, secondary, ghost, disabled, loading states
- **Forms** - inputs, selects, textareas with validation + error display
- **Cards** - image, content, footer layout with hover elevation
- **Modals** - backdrop, focus trap, ESC-to-close, ARIA dialog role
- **Toast notifications** - auto-dismiss, type variants (info/success/error)

> ** Full HTML/CSS/JS code** -> [references/html-prototype-code.md](references/html-prototype-code.md)

---
