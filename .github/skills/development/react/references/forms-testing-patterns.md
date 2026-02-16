# React Forms, Testing & Common Patterns

## Forms

```typescript
// [PASS] GOOD: Controlled form with validation
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
