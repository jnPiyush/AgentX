# Working Prototype App - Implementation Detail

> Read this when scaffolding or auditing the [working-prototype-app](../SKILL.md)
> approach. The detailed content below is relocated verbatim from the previous
> root so the root can stay concise without losing implementation guidance.

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
