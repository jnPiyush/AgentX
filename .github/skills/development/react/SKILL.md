---
description: 'React framework development with modern hooks, TypeScript, and performance best practices'
---

# React Framework Development

> **Purpose**: Production-ready React development for building modern, performant web applications.  
> **Audience**: Frontend engineers building React applications with TypeScript and modern tooling.  
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) React patterns.

---

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
// ✅ GOOD: Typed functional component
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

// ✅ GOOD: Component with children
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

// ❌ BAD: Class components (legacy)
class UserCard extends React.Component {
    // Don't use class components anymore
}
```

---

## Hooks

### useState

```typescript
// ✅ GOOD: Basic state
function Counter() {
    const [count, setCount] = useState(0);
    
    return (
        <button onClick={() => setCount(count + 1)}>
            Count: {count}
        </button>
    );
}

// ✅ GOOD: State with complex objects
interface FormState {
    email: string;
    password: string;
}

function LoginForm() {
    const [form, setForm] = useState<FormState>({
        email: '',
        password: ''
    });
    
    const updateField = (field: keyof FormState, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };
    
    return (
        <form>
            <input 
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
            />
            <input 
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
            />
        </form>
    );
}
```

### useEffect

```typescript
// ✅ GOOD: Effect with cleanup
function UserProfile({ userId }: { userId: number }) {
    const [user, setUser] = useState<User | null>(null);
    
    useEffect(() => {
        let cancelled = false;
        
        async function fetchUser() {
            const data = await api.getUser(userId);
            if (!cancelled) {
                setUser(data);
            }
        }
        
        fetchUser();
        
        // Cleanup function
        return () => {
            cancelled = true;
        };
    }, [userId]); // Dependency array
    
    return <div>{user?.name}</div>;
}

// ✅ GOOD: Effect for subscriptions
function ChatRoom({ roomId }: { roomId: string }) {
    useEffect(() => {
        const connection = createConnection(roomId);
        connection.connect();
        
        return () => {
            connection.disconnect();
        };
    }, [roomId]);
    
    return <div>Chat Room: {roomId}</div>;
}

// ❌ BAD: Missing dependencies
useEffect(() => {
    fetchData(userId); // userId not in deps!
}, []); // Missing dependency
```

### Custom Hooks

```typescript
// ✅ GOOD: Custom hook for data fetching
function useUser(userId: number) {
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
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err as Error);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }
        
        fetchUser();
        
        return () => {
            cancelled = true;
        };
    }, [userId]);
    
    return { user, loading, error };
}

// Usage
function UserProfile({ userId }: { userId: number }) {
    const { user, loading, error } = useUser(userId);
    
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error.message}</div>;
    if (!user) return <div>User not found</div>;
    
    return <div>{user.name}</div>;
}
```

---

## Performance Optimization

### React.memo

```typescript
// ✅ GOOD: Memoize expensive components
interface UserCardProps {
    user: User;
    onClick: (id: number) => void;
}

export const UserCard = React.memo(function UserCard({ user, onClick }: UserCardProps) {
    return (
        <div onClick={() => onClick(user.id)}>
            <h3>{user.name}</h3>
            <p>{user.email}</p>
        </div>
    );
});

// Custom comparison function
export const ExpensiveComponent = React.memo(
    function ExpensiveComponent({ data }: { data: ComplexData }) {
        // Expensive rendering
        return <div>...</div>;
    },
    (prevProps, nextProps) => {
        // Return true if props are equal (skip re-render)
        return prevProps.data.id === nextProps.data.id;
    }
);
```

### useMemo and useCallback

```typescript
// ✅ GOOD: Memoize expensive calculations
function UserList({ users, filter }: { users: User[]; filter: string }) {
    // Only recalculate when users or filter changes
    const filteredUsers = useMemo(() => {
        return users.filter(u => 
            u.name.toLowerCase().includes(filter.toLowerCase())
        );
    }, [users, filter]);
    
    return (
        <ul>
            {filteredUsers.map(user => (
                <li key={user.id}>{user.name}</li>
            ))}
        </ul>
    );
}

// ✅ GOOD: Memoize callbacks
function Parent() {
    const [count, setCount] = useState(0);
    
    // Callback won't change between renders
    const handleClick = useCallback(() => {
        console.log('Clicked!');
    }, []); // No dependencies
    
    return <Child onClick={handleClick} />;
}
```

### Code Splitting

```typescript
// ✅ GOOD: Lazy load components
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <HeavyComponent />
        </Suspense>
    );
}

// ✅ GOOD: Route-based code splitting
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

---

## State Management

### Context API

```typescript
// ✅ GOOD: Create typed context
interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    
    const login = async (email: string, password: string) => {
        const userData = await api.login(email, password);
        setUser(userData);
    };
    
    const logout = () => {
        setUser(null);
    };
    
    const value = { user, login, logout };
    
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// Custom hook to use context
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

// Usage
function Profile() {
    const { user, logout } = useAuth();
    return <button onClick={logout}>Logout {user?.name}</button>;
}
```

---

## Forms

```typescript
// ✅ GOOD: Controlled form with validation
function ContactForm() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    
    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        
        if (!email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Email is invalid';
        }
        
        if (!message) {
            newErrors.message = 'Message is required';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) return;
        
        setSubmitting(true);
        try {
            await api.sendMessage({ email, message });
            setEmail('');
            setMessage('');
            alert('Message sent!');
        } catch (error) {
            alert('Failed to send message');
        } finally {
            setSubmitting(false);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="email">Email</label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                    <p className="text-red-500 text-sm">{errors.email}</p>
                )}
            </div>
            
            <div>
                <label htmlFor="message">Message</label>
                <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={errors.message ? 'border-red-500' : ''}
                />
                {errors.message && (
                    <p className="text-red-500 text-sm">{errors.message}</p>
                )}
            </div>
            
            <button 
                type="submit" 
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded"
            >
                {submitting ? 'Sending...' : 'Send'}
            </button>
        </form>
    );
}
```

---

## Testing

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
    it('renders user name', () => {
        const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
        render(<UserProfile user={user} />);
        
        expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    it('calls onSelect when clicked', () => {
        const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
        const handleSelect = jest.fn();
        
        render(<UserProfile user={user} onSelect={handleSelect} />);
        
        fireEvent.click(screen.getByText('John Doe'));
        expect(handleSelect).toHaveBeenCalledWith(user);
    });
    
    it('loads user data on mount', async () => {
        render(<UserProfileContainer userId={1} />);
        
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        
        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });
    });
});
```

---

## Common Patterns

### Compound Components

```typescript
interface TabsProps {
    defaultValue: string;
    children: React.ReactNode;
}

interface TabsContextType {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

export function Tabs({ defaultValue, children }: TabsProps) {
    const [activeTab, setActiveTab] = useState(defaultValue);
    
    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div>{children}</div>
        </TabsContext.Provider>
    );
}

export function TabsList({ children }: { children: React.ReactNode }) {
    return <div className="flex space-x-2">{children}</div>;
}

export function Tab({ value, children }: { value: string; children: React.ReactNode }) {
    const context = useContext(TabsContext);
    if (!context) throw new Error('Tab must be used within Tabs');
    
    const isActive = context.activeTab === value;
    
    return (
        <button
            onClick={() => context.setActiveTab(value)}
            className={isActive ? 'bg-blue-600 text-white' : 'bg-gray-200'}
        >
            {children}
        </button>
    );
}

// Usage
<Tabs defaultValue="tab1">
    <TabsList>
        <Tab value="tab1">Tab 1</Tab>
        <Tab value="tab2">Tab 2</Tab>
    </TabsList>
</Tabs>
```

---

## Common Pitfalls

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

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026
