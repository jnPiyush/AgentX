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

- Node.js 18+ and npm/yarn/pnpm
- TypeScript fundamentals
- React 18+ with hooks API

## Quick Reference

| Need | Solution | Pattern |
|------|----------|---------|
| **Component** | Functional with TypeScript | `export function MyComponent({ prop }: Props) {}` |
| **State** | useState hook | `const [count, setCount] = useState(0)` |
| **Effects** | useEffect hook | `useEffect(() => {}, [deps])` |
| **Custom hook** | Extract reusable logic | `function useUser() {}` |
| **Form handling** | Controlled components | `<input value={value} onChange={handleChange} />` |
| **Performance** | React.memo, useMemo | `const MemoComponent = React.memo(Component)` |

---

## React Version

**Current**: React 19+ 
**Minimum**: React 18+

### Modern React Features

```typescript
// React 19 - No need to import React for JSX
import { useState, useEffect } from 'react';

// Functional components (always use these)
export function UserProfile({ userId }: { userId: number }) {
 const [user, setUser] = useState<User | null>(null);
 
 return <div>{user?.name}</div>;
}

// React 19 - use() hook for promises
import { use } from 'react';

function UserData({ userPromise }: { userPromise: Promise<User> }) {
 const user = use(userPromise); // Suspends until resolved
 return <div>{user.name}</div>;
}

// React 19 - Actions for forms
function ContactForm() {
 async function handleSubmit(formData: FormData) {
 'use server'; // Server action
 await saveContact(formData);
 }
 
 return <form action={handleSubmit}>...</form>;
}
```

---

## Component Patterns

### Functional Components with TypeScript

```typescript
// [PASS] GOOD: Typed functional component
interface UserCardProps {
 user: User;
 onSelect?: (user: User) => void;
 className?: string;
}

export function UserCard({ user, onSelect, className }: UserCardProps) {
 return (
 <div 
 className={`p-4 border rounded ${className}`}
 onClick={() => onSelect?.(user)}
 >
 <h3>{user.name}</h3>
 <p>{user.email}</p>
 </div>
 );
}

// [PASS] GOOD: Component with children
interface ContainerProps {
 children: React.ReactNode;
 title?: string;
}

export function Container({ children, title }: ContainerProps) {
 return (
 <div>
 {title && <h2>{title}</h2>}
 {children}
 </div>
 );
}

// [FAIL] BAD: Class components (legacy)
class UserCard extends React.Component {
 // Don't use class components anymore
}
```

---

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

## Resources

- **React Docs**: [react.dev](https://react.dev)
- **TypeScript**: [typescriptlang.org](https://www.typescriptlang.org)
- **Testing Library**: [testing-library.com](https://testing-library.com/react)
- **React DevTools**: Browser extension
- **Awesome Copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

---

**See Also**: [Skills.md](../../../../Skills.md) - [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Infinite re-render loop | Check useEffect dependency array, avoid setting state that triggers re-render |
| Stale closure in useCallback | Add all referenced variables to dependency array, or use useRef |
| Component not updating | Ensure state is updated immutably (spread operator or structuredClone) |

## Internationalization (i18n)

| Library | When to Use |
|---------|-------------|
| `react-intl` | Full ICU support, plurals, dates, mature ecosystem |
| `next-intl` | Next.js App Router with server components |
| `react-i18next` | Lightweight, good DX, namespace support |

**Best Practices**:
- Extract all user-facing strings (never hardcode in JSX)
- Use ICU message format for plurals: `{count, plural, one {# item} other {# items}}`
- Co-locate translations: `src/locales/{lang}/common.json`
- Use `<FormattedMessage>` or `useIntl()` hook
- Set `lang` attribute on `<html>` element
- Test with pseudo-localization to catch layout issues early

## References

- [Hooks Perf State](references/hooks-perf-state.md)
- [Forms Testing Patterns](references/forms-testing-patterns.md)