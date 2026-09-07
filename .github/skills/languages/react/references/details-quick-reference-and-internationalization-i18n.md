# react: Quick Reference through Internationalization (i18n)

> MUST read before work involving **quick reference through internationalization (i18n)**. This reference preserves complete source guidance relocated for context-budget compliance.

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

## Resources

- **React Docs**: [react.dev](https://react.dev)
- **TypeScript**: [typescriptlang.org](https://www.typescriptlang.org)
- **Testing Library**: [testing-library.com](https://testing-library.com/react)
- **React DevTools**: Browser extension
- **Awesome Copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

---

**See Also**: [Skills.md](../../../../../Skills.md) - [AGENTS.md](../../../../../AGENTS.md)

**Last Updated**: January 27, 2026

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

- [Hooks Perf State](hooks-perf-state.md)
- [Forms Testing Patterns](forms-testing-patterns.md)