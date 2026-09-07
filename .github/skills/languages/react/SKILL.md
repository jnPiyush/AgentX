---
name: "react"
description: 'Build React applications with modern hooks, TypeScript, and performance best practices. Use when creating React components, implementing custom hooks, optimizing React rendering performance, managing application state, or testing React components.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 languages: ["typescript", "javascript"]
 frameworks: ["react", "nextjs", "vite"]
 platforms: ["windows", "linux", "macos"]
---

# React Framework Development

> **Purpose**: Production-ready React development for building modern, performant web applications. 
> **Audience**: Frontend engineers building React applications with TypeScript and modern tooling. 
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) React patterns.

---

## When to Use This Skill

- Creating React components with TypeScript
- Implementing custom hooks
- Optimizing React rendering performance
- Managing application state
- Testing React components with Testing Library

## Decision Tree

```
React Decision
+-- Starting a new project?
|   +-- Full-stack / SSR? -> Next.js (App Router)
|   +-- SPA / client only? -> Vite + React
|   +-- Static site? -> Astro or Next.js static export
+-- State management?
|   +-- Local component state? -> useState / useReducer
|   +-- Shared across siblings? -> Lift state up or Context API
|   +-- Complex global state? -> Zustand or Redux Toolkit
|   +-- Server state / caching? -> TanStack Query (React Query)
+-- Styling approach?
|   +-- Utility-first? -> Tailwind CSS
|   +-- Component library? -> shadcn/ui or Radix
|   +-- CSS-in-JS? -> styled-components or vanilla-extract
+-- Form handling?
|   +-- Simple forms? -> Controlled components
|   +-- Complex validation? -> React Hook Form + Zod
```

## Prerequisites

- Node.js 24+ and npm/yarn/pnpm
- TypeScript fundamentals
- React 18+ with hooks API

## Core Rules

1. **Functional Components Only** - Use function components with hooks; never use class components for new code
2. **Type All Props** - Define TypeScript interfaces for all component props; avoid `any` type
3. **Complete Dependency Arrays** - Always include all referenced variables in `useEffect` / `useMemo` / `useCallback` dependency arrays
4. **Unique Keys on Lists** - Provide stable, unique `key` props on list items; never use array index as key for dynamic lists
5. **Cleanup Effects** - Return cleanup functions from `useEffect` for subscriptions, timers, and event listeners
6. **Lift State Minimally** - Keep state as close to where it is used as possible; lift up only when siblings need it
7. **Memoize Expensive Computations** - Use `useMemo` for costly calculations and `React.memo` for pure components that re-render often
8. **Extract Custom Hooks** - Move reusable stateful logic into `useXxx` custom hooks instead of duplicating across components

---

## Anti-Patterns

| Issue | Problem | Solution |
|-------|---------|----------|
| **Missing keys** | List items without key prop | Add unique `key` prop |
| **Stale closures** | Accessing old state in callbacks | Use functional updates |
| **Unnecessary re-renders** | Components rendering too often | Use React.memo, useMemo |
| **Memory leaks** | Subscriptions not cleaned up | Return cleanup function in useEffect |
| **Missing dependencies** | useEffect with incomplete deps | Add all dependencies or use ESLint |
| **Prop drilling** | Passing props through many layers | Use Context API or state management |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Infinite re-render loop | Check useEffect dependency array, avoid setting state that triggers re-render |
| Stale closure in useCallback | Add all referenced variables to dependency array, or use useRef |
| Component not updating | Ensure state is updated immutably (spread operator or structuredClone) |

## Workflow

1. Define user states and component ownership.
2. Implement semantic markup and typed data flow.
3. Add focused component tests for primary interactions.
4. Render in a browser and run accessibility checks.

## Verification Checklist

- [ ] Type check and tests pass.
- [ ] Primary keyboard interaction works.
- [ ] Axe reports no blocking violation.
- [ ] No avoidable effect or render loop exists.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Quick Reference through Internationalization (i18n)](references/details-quick-reference-and-internationalization-i18n.md) - MUST read before work involving quick reference through internationalization (i18n).

Existing focused references are reused, not duplicated:

- [React Forms, Testing & Common Patterns](references/forms-testing-patterns.md) - MUST read before applying the focused react forms, testing & common patterns guidance.
- [React Hooks, Performance & State Management](references/hooks-perf-state.md) - MUST read before applying the focused react hooks, performance & state management guidance.
