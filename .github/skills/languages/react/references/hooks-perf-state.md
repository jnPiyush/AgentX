# React Hooks, Performance & State Management

## Hooks

### useState

```typescript
// [PASS] GOOD: Basic state
function Counter() {
 const [count, setCount] = useState(0);
 
 return (
 <button onClick={() => setCount(count + 1)}>
 Count: {count}
 </button>
 );
}

// [PASS] GOOD: State with complex objects
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
// [PASS] GOOD: Effect with cleanup
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

// [PASS] GOOD: Effect for subscriptions
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

// [FAIL] BAD: Missing dependencies
useEffect(() => {
 fetchData(userId); // userId not in deps!
}, []); // Missing dependency
```

### Custom Hooks

```typescript
// [PASS] GOOD: Custom hook for data fetching
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
// [PASS] GOOD: Memoize expensive components
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
// [PASS] GOOD: Memoize expensive calculations
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

// [PASS] GOOD: Memoize callbacks
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
// [PASS] GOOD: Lazy load components
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
 return (
 <Suspense fallback={<div>Loading...</div>}>
 <HeavyComponent />
 </Suspense>
 );
}

// [PASS] GOOD: Route-based code splitting
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

---

## State Management

### Context API

```typescript
// [PASS] GOOD: Create typed context
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
