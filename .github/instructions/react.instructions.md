---
description: 'React and TypeScript specific coding instructions for frontend development.'
applyTo: '**.tsx, **.jsx, **/components/**, **/hooks/**'
---

# React / TypeScript Instructions

> Auto-loads when editing React files. For comprehensive standards, load the skill.

**Skill**: [.github/skills/languages/react/SKILL.md](../skills/languages/react/SKILL.md)

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

## Critical Rules (Embedded -- Always Active)

### Testing
- 80%+ code coverage required
- React Testing Library: query by role/label, NEVER by test-id unless no alternative
- Test user behavior (clicks, types, submits) not implementation details
- Use `screen.getByRole()`, `userEvent.click()`, `waitFor()` for async
- MSW for API mocking -- intercept at network level, not in component

### Accessibility
- All images MUST have descriptive `alt` text
- All interactive elements MUST be keyboard-accessible
- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<article>`)
- Color contrast MUST meet WCAG 2.1 AA (4.5:1 for text)
- Test with `axe-core` or `jest-axe` in automated tests

### Security
- Sanitize any user-generated HTML (use `DOMPurify`)
- Never use `dangerouslySetInnerHTML` without sanitization
- Validate all form inputs with `zod` schemas at the boundary
- Never store secrets or tokens in client-side code

