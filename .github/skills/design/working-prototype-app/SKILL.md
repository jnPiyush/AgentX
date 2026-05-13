---
name: "working-prototype-app"
description: 'Build a runnable, multi-page UX prototype as a real SPA when static HTML is insufficient. Use when the prototype must demonstrate routing, state persistence, dynamic data, or interactive flows that exceed what plain HTML/CSS can convey. Provides a Vite + React + Tailwind + Framer Motion + Lucide scaffold, data-driven page layout, debounced localStorage state, and a clean file structure for `src/`.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-12"
  updated: "2026-05-12"
compatibility:
  agents: ["ux-designer", "engineer", "prototype-auditor"]
  frameworks: ["react", "vite", "tailwind", "framer-motion"]
  output-formats: ["spa", "static-build"]
---

# Working Prototype App

> WHEN: A static HTML/CSS deliverable cannot answer the question being asked of the prototype. Typical triggers: multi-screen flow with routing, state that must persist across reloads, data-driven views, or an interactive demo for stakeholder validation. Below that bar, prefer plain HTML/CSS via `prototype-craft`.

## Choosing static vs working app

| Need | Use |
|------|-----|
| Single page or short flow, visual review only | `prototype-craft` static HTML |
| Up to 3 screens with simple click-through | `prototype-craft` + plain anchor links |
| Routing, persisted state, dynamic lists, or filtering | This skill |
| Real backend integration | A product spike, not a UX prototype |

If in doubt, start with static. Promote to a working app only after the static answer becomes hand-wavy.

## Default stack (modify with reason)

- Vite (build + dev server)
- React 18 (component model)
- React Router (routing) -- optional; can stay single-page
- Tailwind CSS (utility styling on top of theme tokens)
- Framer Motion (motion recipes from `prototype-craft`)
- Lucide React (icon set, tree-shakeable)

Substitute Vue, Svelte, or Solid where the team is more fluent; the skill is framework-agnostic in spirit. The folder structure and rules below still apply.

## Scaffold

```sh
npm create vite@latest my-prototype -- --template react-ts
cd my-prototype
npm install
npm install react-router-dom framer-motion lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Wire Tailwind to read `src/**/*.{ts,tsx,html}` in `tailwind.config.js`. Import the design tokens (from the `theme-presets.md` reference) into `src/styles/tokens.css` and load that before Tailwind's `@tailwind` directives so utilities can reference token values via `bg-[var(--surface)]`.

## File structure

```
src/
  components/        # presentational, reusable, no routing
  pages/             # route-level views; one file per route
  hooks/             # custom hooks (useDebouncedStorage, useReducedMotionSafe, ...)
  lib/               # pure helpers (formatters, validators, parsers)
  data/              # static JSON / TypeScript data the prototype renders
  styles/
    tokens.css       # scaffolded from design-system-reasoning
    globals.css      # @tailwind base/components/utilities + a11y resets
  App.tsx
  main.tsx
```

Rules:

- `pages/` files render via the router and own page-level state and data fetching.
- `components/` files must be storyboard-ready in isolation (no router hooks).
- `data/` is the single source of truth for prototype content. Do not hard-code lists inside components.
- `hooks/` are pure; side effects only inside `useEffect`.

## Data-driven page pattern

```tsx
// src/data/courses.ts
export type Course = { id: string; title: string; level: "intro" | "core" | "advanced"; mins: number };
export const courses: Course[] = [
  { id: "c1", title: "Foundations", level: "intro", mins: 25 },
  { id: "c2", title: "Patterns", level: "core", mins: 40 },
];

// src/pages/Catalog.tsx
import { courses } from "@/data/courses";
export default function Catalog() {
  return (
    <main>
      <h1>Catalog</h1>
      <ul>
        {courses.map((c) => <li key={c.id}>{c.title} -- {c.mins} min</li>)}
      </ul>
    </main>
  );
}
```

Why: changes to "what the prototype shows" never require touching components. The data file is also where stakeholders edit copy without help.

## Debounced localStorage persistence

```ts
// src/hooks/useDebouncedStorage.ts
import { useEffect, useRef, useState } from "react";

export function useDebouncedStorage<T>(key: string, initial: T, delayMs = 250) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
    }, delayMs);
    return () => window.clearTimeout(timer.current);
  }, [key, value, delayMs]);
  return [value, setValue] as const;
}
```

Use for: filter selections, theme preference, "completed lesson" flags. Do not use for anything sensitive -- localStorage is plain text and same-origin.

## Routing pattern

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
```

A catch-all `<Route path="*">` is mandatory. Prototypes routinely have broken links until late; a real 404 page prevents stakeholder confusion.

## Performance discipline

- Route-split heavy pages with `React.lazy` + `Suspense`. Show a skeleton, not a spinner.
- Use `loading="lazy"` on every `<img>` below the fold.
- Bundle target: under 250 KB gzip for the initial route.
- Never import the whole `lucide-react` namespace; import the specific icons.

## Accessibility hooks built in

- Wrap the entire app in a `<SkipToContent />` component that targets `#main`.
- Every page renders inside a single `<main id="main" tabIndex={-1}>`.
- Apply the reduced-motion guard CSS from `theme-presets.md` globally; the motion hook from `prototype-craft/references/animation-recipes.md` covers JS-driven motion.
- Add an `ErrorBoundary` at the route level; render a recoverable empty state, never a blank screen.

## Verification

- `npm run build` succeeds with zero TypeScript errors and zero Vite warnings.
- `npm run dev` serves the prototype with hot reload; routes navigate correctly.
- axe-core run on each route (use the `accessibility` skill and `prototype-audit` checklist).
- Lighthouse on the production preview reports Performance >= 85 and Accessibility >= 95.
- Touch every route plus an invented path to confirm the 404 page renders.

## Done Criteria

- Stack scaffolded, tokens wired, Tailwind compiling.
- File structure follows the layout above; no business logic in `components/`.
- All prototype content lives in `src/data/`.
- Debounced localStorage hook in place wherever state must survive a reload.
- Routing covers every screen plus a `*` 404 fallback.
- `prototype-audit` passes all six audit passes.

## Skills to Compose With

- `design/design-system-reasoning` for tokens and theme selection.
- `design/prototype-craft` for visual polish and motion recipes.
- `design/accessibility` for WCAG checklist applied to each route.
- `design/prototype-audit` to run the mechanical 6-pass audit.
- `languages/react` and `languages/typescript` for component-level depth.