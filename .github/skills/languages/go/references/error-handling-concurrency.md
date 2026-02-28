# Go Error Handling & Concurrency Patterns

## Error Handling

### Error Creation

```go
// Use errors.New for simple errors
var ErrNotFound = errors.New("user not found")

// Use fmt.Errorf for contextual errors
func GetUser(id string) (*User, error) {
 user, err := repo.FindByID(id)
 if err != nil {
 return nil, fmt.Errorf("get user %s: %w", id, err)
 }
 return user, nil
}

// Custom error types for structured errors
type ValidationError struct {
 Field string
 Message string
}

func (e *ValidationError) Error() string {
 return fmt.Sprintf("validation failed: %s - %s", e.Field, e.Message)
}
```

### Error Handling Patterns

```go
// Always handle errors
result, err := doSomething()
if err != nil {
 return fmt.Errorf("do something: %w", err)
}

// Don't ignore errors
_ = file.Close() // Bad - error ignored
if err := file.Close(); err != nil {
 log.Printf("close file: %v", err)
}

// Check error types
if errors.Is(err, ErrNotFound) {
 // Handle not found
}

var validationErr *ValidationError
if errors.As(err, &validationErr) {
 // Handle validation error
}
```

---

## Concurrency

### Goroutines

```go
// Use goroutines for concurrent work
func processItems(items []Item) {
 var wg sync.WaitGroup

 for _, item := range items {
 wg.Add(1)
 go func(item Item) {
 defer wg.Done()
 process(item)
 }(item) // Pass item as parameter to avoid closure issues
 }

 wg.Wait()
}
```

### Channels

```go
// Use channels for communication
func worker(jobs <-chan Job, results chan<- Result) {
 for job := range jobs {
 results <- process(job)
 }
}

// Always close channels from the sender side
func producer(ch chan<- int) {
 defer close(ch)
 for i := 0; i < 10; i++ {
 ch <- i
 }
}

// Use select for multiple channel operations
select {
case result := <-resultCh:
 handleResult(result)
case <-ctx.Done():
 return ctx.Err()
case <-time.After(5 * time.Second):
 return errors.New("timeout")
}
```

### Context

```go
// Always pass context as first parameter
func GetUser(ctx context.Context, id string) (*User, error) {
 // Check for cancellation
 select {
 case <-ctx.Done():
 return nil, ctx.Err()
 default:
 }

 // Use context for timeouts
 ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
 defer cancel()

 return repo.FindByID(ctx, id)
}
```

### Mutex

```go
type Counter struct {
 mu sync.Mutex
 value int
}

func (c *Counter) Increment() {
 c.mu.Lock()
 defer c.mu.Unlock()
 c.value++
}

// Use RWMutex for read-heavy workloads
type Cache struct {
 mu sync.RWMutex
 items map[string]Item
}

func (c *Cache) Get(key string) (Item, bool) {
 c.mu.RLock()
 defer c.mu.RUnlock()
 item, ok := c.items[key]
 return item, ok
}
```

---
