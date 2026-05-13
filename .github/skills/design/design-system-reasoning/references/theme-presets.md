# Theme Presets

> Companion reference to `design-system-reasoning/SKILL.md`. Four named, ready-to-paste CSS custom-property packs that give a working prototype a polished baseline without inventing tokens per project. Pick one to start; modify after.

## How to use

1. Choose a preset that fits the product posture (technical, editorial, terminal, warm).
2. Paste the token block into `src/styles/tokens.css` (or equivalent).
3. Reference tokens through `var(--token-name)` everywhere. Never inline raw color values in components.
4. Switch themes by setting `data-theme="<name>"` on `<html>` and emitting alternate blocks under `[data-theme="<name>"]`.

All four presets define the same token surface so components stay theme-agnostic:

| Group | Tokens |
|-------|--------|
| Surfaces | `--bg`, `--surface`, `--surface-raised`, `--surface-sunken` |
| Brand | `--brand`, `--brand-hover`, `--accent`, `--accent-hover` |
| State | `--success`, `--warning`, `--danger`, `--info` |
| Text | `--text`, `--text-muted`, `--text-subtle`, `--text-inverse` |
| Borders | `--border`, `--border-strong`, `--focus-ring` |
| Gradients | `--gradient-hero`, `--gradient-surface` |
| Glass | `--glass-bg`, `--glass-blur`, `--glass-border` |
| Glow | `--glow-brand`, `--glow-accent` |
| Code | `--code-bg`, `--code-fg` |

## Preset 1: Slate Studio (dark technical)

Posture: serious, dense, developer-leaning. Pairs with `JetBrains Mono` for code and `Inter` for text.

```css
:root,
[data-theme="slate-studio"] {
  --bg: #0d1117;
  --surface: #161b22;
  --surface-raised: #1f2733;
  --surface-sunken: #0a0d12;

  --brand: #4f8cf7;
  --brand-hover: #7aa9f9;
  --accent: #3dd6c1;
  --accent-hover: #5be6d3;

  --success: #3fb950;
  --warning: #d29922;
  --danger: #f47174;
  --info: #79c0ff;

  --text: #e6edf3;
  --text-muted: #9aa6b2;
  --text-subtle: #6e7681;
  --text-inverse: #0d1117;

  --border: #2a3340;
  --border-strong: #3b4654;
  --focus-ring: #4f8cf7;

  --gradient-hero: linear-gradient(135deg, #4f8cf7 0%, #3dd6c1 100%);
  --gradient-surface: linear-gradient(180deg, rgba(79, 140, 247, 0.06), transparent 60%);

  --glass-bg: rgba(22, 27, 34, 0.72);
  --glass-blur: 14px;
  --glass-border: rgba(255, 255, 255, 0.06);

  --glow-brand: 0 0 24px rgba(79, 140, 247, 0.28);
  --glow-accent: 0 0 20px rgba(61, 214, 193, 0.22);

  --code-bg: #0a0d12;
  --code-fg: #e6edf3;
}
```

## Preset 2: Arctic Editorial (light editorial)

Posture: calm, readable, trust-leaning. Pairs with a serif display face (for example `Source Serif`) and `Inter` for body.

```css
[data-theme="arctic-editorial"] {
  --bg: #f7f8fa;
  --surface: #ffffff;
  --surface-raised: #ffffff;
  --surface-sunken: #eef1f5;

  --brand: #1f6feb;
  --brand-hover: #3a85f0;
  --accent: #0a8fa3;
  --accent-hover: #1aa6bb;

  --success: #1a7f37;
  --warning: #9a6700;
  --danger: #cf222e;
  --info: #0969da;

  --text: #1f2328;
  --text-muted: #545d68;
  --text-subtle: #8a939e;
  --text-inverse: #ffffff;

  --border: #d8dde3;
  --border-strong: #b8c0ca;
  --focus-ring: #1f6feb;

  --gradient-hero: linear-gradient(135deg, #1f6feb 0%, #0a8fa3 100%);
  --gradient-surface: linear-gradient(180deg, rgba(31, 111, 235, 0.04), transparent 70%);

  --glass-bg: rgba(255, 255, 255, 0.78);
  --glass-blur: 10px;
  --glass-border: rgba(15, 23, 42, 0.06);

  --glow-brand: 0 4px 20px rgba(31, 111, 235, 0.14);
  --glow-accent: 0 4px 20px rgba(10, 143, 163, 0.12);

  --code-bg: #f1f4f8;
  --code-fg: #1f2328;
}
```

## Preset 3: Pine Terminal (dark CLI / DevOps)

Posture: command-line aesthetic. Pairs with a single mono face for everything.

```css
[data-theme="pine-terminal"] {
  --bg: #0a0f0a;
  --surface: #121912;
  --surface-raised: #1a221a;
  --surface-sunken: #060906;

  --brand: #4ade80;
  --brand-hover: #6ee696;
  --accent: #a3e635;
  --accent-hover: #c1ee5e;

  --success: #4ade80;
  --warning: #facc15;
  --danger: #fb7185;
  --info: #38bdf8;

  --text: #d5dad5;
  --text-muted: #94a394;
  --text-subtle: #6b7a6b;
  --text-inverse: #0a0f0a;

  --border: #1f2a1f;
  --border-strong: #2c3a2c;
  --focus-ring: #4ade80;

  --gradient-hero: linear-gradient(135deg, #4ade80 0%, #a3e635 100%);
  --gradient-surface: linear-gradient(180deg, rgba(74, 222, 128, 0.05), transparent 60%);

  --glass-bg: rgba(18, 25, 18, 0.78);
  --glass-blur: 14px;
  --glass-border: rgba(74, 222, 128, 0.15);

  --glow-brand: 0 0 24px rgba(74, 222, 128, 0.3);
  --glow-accent: 0 0 18px rgba(163, 230, 53, 0.22);

  --code-bg: #060906;
  --code-fg: #d5dad5;
}
```

## Preset 4: Parchment Lab (warm research / notebook)

Posture: warm, exploratory, research-leaning. Pairs with a serif display face plus `Inter` for body.

```css
[data-theme="parchment-lab"] {
  --bg: #fbf7ee;
  --surface: #ffffff;
  --surface-raised: #fffdf7;
  --surface-sunken: #f4ecd9;

  --brand: #7c3aed;
  --brand-hover: #9259f0;
  --accent: #d97706;
  --accent-hover: #e98c1a;

  --success: #15803d;
  --warning: #b45309;
  --danger: #b91c1c;
  --info: #1d4ed8;

  --text: #2a241b;
  --text-muted: #5c5142;
  --text-subtle: #8a7a63;
  --text-inverse: #ffffff;

  --border: #e6dcc2;
  --border-strong: #c9bb98;
  --focus-ring: #7c3aed;

  --gradient-hero: linear-gradient(135deg, #7c3aed 0%, #d97706 100%);
  --gradient-surface: linear-gradient(180deg, rgba(124, 58, 237, 0.04), transparent 70%);

  --glass-bg: rgba(255, 255, 255, 0.82);
  --glass-blur: 10px;
  --glass-border: rgba(124, 58, 237, 0.08);

  --glow-brand: 0 4px 20px rgba(124, 58, 237, 0.16);
  --glow-accent: 0 4px 20px rgba(217, 119, 6, 0.14);

  --code-bg: #f4ecd9;
  --code-fg: #2a241b;
}
```

## Shared spacing, radius, motion, and shadow scales

These do not change per theme. Paste once.

```css
:root {
  /* Spacing scale, 4 px base */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;

  /* Radius scale */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* Shadow scale */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.10);
  --shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.14);
  --shadow-xl: 0 20px 50px rgba(0, 0, 0, 0.18);

  /* Motion */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-emphasised: cubic-bezier(0.2, 0, 0, 1);
  --duration-fast: 120ms;
  --duration-normal: 220ms;
  --duration-slow: 360ms;
}
```

## Universal reduced-motion guard

Always include this once. Token consumers do not need to repeat it.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Composition rules

- Never reference raw hex values in component code; always go through `var(--token)`.
- Components consume `--glass-bg` and `--glass-border` rather than hard-coding alpha values.
- Gradients exist for hero zones only. Body surfaces stay flat.
- Glow tokens are reserved for hover or active states. Do not glow idle surfaces.
- All four presets pass WCAG 2.1 AA at body sizes against their own `--bg`. Verify with the accessibility skill before shipping a fifth preset.
