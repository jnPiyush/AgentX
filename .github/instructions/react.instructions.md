---
description: 'React and TypeScript specific coding instructions for frontend development.'
applyTo: '**.tsx, **.jsx, **/components/**, **/hooks/**'
---

# React / TypeScript Instructions

## Component Structure

```typescript
// [PASS] Functional components with TypeScript
interface UserCardProps {
 user: User;
 onSelect?: (user: User) => void;
 className?: string;
}

export function UserCard({ user, onSelect, className }: UserCardProps) {
 const handleClick = useCallback(() => {
 onSelect?.(user);
 }, [user, onSelect]);

 return (
 <div className={cn("user-card", className)} onClick={handleClick}>
 <h3>{user.name}</h3>
 <p>{user.email}</p>
 </div>
 );
}
```

## Hooks

```typescript
// [PASS] Custom hooks with proper typing
function useUser(userId: string) {
 const [user, setUser] = useState<User | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<Error | null>(null);

 useEffect(() => {
 let cancelled = false;

 async function fetchUser() {
 try {
 setLoading(true);
 const data = await api.getUser(userId);
 if (!cancelled) {
 setUser(data);
 }
 } catch (err) {
 if (!cancelled) {
 setError(err instanceof Error ? err : new Error('Unknown error'));
 }
 } finally {
 if (!cancelled) {
 setLoading(false);
 }
 }
 }

 fetchUser();
 return () => { cancelled = true; };
 }, [userId]);

 return { user, loading, error };
}
```

## State Management

- Use React Query / TanStack Query for server state
- Use Zustand or Jotai for client state
- Avoid prop drilling - use context sparingly

## Performance

```typescript
// [PASS] Memoize expensive computations
const sortedItems = useMemo(
 () => items.sort((a, b) => a.name.localeCompare(b.name)),
 [items]
);

// [PASS] Memoize callbacks passed to children
const handleSubmit = useCallback(
 (data: FormData) => {
 onSubmit(data);
 },
 [onSubmit]
);

// [PASS] Use React.memo for pure components
const ExpensiveList = React.memo(function ExpensiveList({ items }: Props) {
 return items.map(item => <ExpensiveItem key={item.id} item={item} />);
});
```

## Testing

- Use React Testing Library
- Test behavior, not implementation
- Use MSW for API mocking

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('submits form with user data', async () => {
 const onSubmit = vi.fn();
 render(<UserForm onSubmit={onSubmit} />);

 await userEvent.type(screen.getByLabelText(/name/i), 'John Doe');
 await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com');
 await userEvent.click(screen.getByRole('button', { name: /submit/i }));

 expect(onSubmit).toHaveBeenCalledWith({
 name: 'John Doe',
 email: 'john@example.com',
 });
});
```

## Accessibility

- Always include alt text for images
- Use semantic HTML elements
- Ensure keyboard navigation works
- Test with screen readers

