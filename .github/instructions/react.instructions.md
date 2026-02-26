---
description: 'React and TypeScript specific coding instructions for frontend development.'
applyTo: '**.tsx, **.jsx, **/components/**, **/hooks/**'
---

# React / TypeScript Instructions

> Auto-loads when editing React files. For comprehensive standards, load the skill.

**Skill**: [.github/skills/development/react/SKILL.md](../skills/development/react/SKILL.md)

## Key Rules

- Functional components only, with TypeScript interfaces for props
- Destructure props in function signature
- Custom hooks: extract reusable logic, prefix with `use`
- useCallback for callbacks passed to children
- useMemo for expensive computations
- React.memo for pure components
- React Query / TanStack Query for server state
- Zustand or Jotai for client state (avoid prop drilling)
- React Testing Library -- test behavior, not implementation
- MSW for API mocking in tests
- Always include alt text, use semantic HTML, ensure keyboard navigation

