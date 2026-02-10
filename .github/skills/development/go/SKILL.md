---
name: "go"
description: "Go programming language best practices, patterns, and standards for building reliable, efficient software."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-01-15"
  updated: "2025-01-15"
compatibility:
  languages: ["go"]
  platforms: ["windows", "linux", "macos"]
allowed-tools: "read_file semantic_search grep_search file_search replace_string_in_file create_file run_in_terminal get_errors"
---

# Go Development

> **Purpose**: Best practices for Go development including project structure, concurrency, error handling, and testing.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Code Style](#code-style)
3. [Error Handling](#error-handling)
4. [Concurrency](#concurrency)
5. [Testing](#testing)
6. [Interfaces](#interfaces)
7. [Performance](#performance)
8. [Security](#security)
9. [Best Practices](#best-practices)

---

## Project Structure

### Standard Layout

```
project/
├── cmd/
│   └── myapp/
│       └── main.go          # Application entry point
├── internal/
│   ├── config/              # Configuration handling
│   ├── handlers/            # HTTP handlers
│   ├── models/              # Domain models
│   ├── repository/          # Data access
│   └── service/             # Business logic
├── pkg/
│   └── utils/               # Reusable packages
├── api/
│   └── openapi.yaml         # API specification
├── configs/
│   └── config.yaml          # Configuration files
├── scripts/
│   └── setup.sh             # Build/deploy scripts
├── go.mod
├── go.sum
└── README.md
```

### Package Naming

```go
// Package names should be lowercase, short, and descriptive
package user       // Good
package userService // Bad - no camelCase
package user_svc    // Bad - no underscores

// Import path should match directory structure
import "myapp/internal/service"
```

---

## Code Style

### Naming Conventions

```go
// Exported names start with uppercase
type UserService struct {}
func GetUser(id string) {}

// Unexported names start with lowercase
type userRepository struct {}
func validateEmail(email string) bool {}

// Use MixedCaps, not underscores
var maxRetryCount = 3    // Good
var max_retry_count = 3  // Bad

// Acronyms should be all caps or all lowercase
var userID string   // Good
var userId string   // Bad
type HTTPClient struct {} // Good
type HttpClient struct {} // Bad
```

### Formatting

```go
// Always use gofmt or goimports
// go fmt ./...

// Group imports: std lib, external, internal
import (
    "context"
    "fmt"
    "net/http"

    "github.com/gorilla/mux"
    "go.uber.org/zap"

    "myapp/internal/config"
    "myapp/internal/service"
)
```

### Comments

```go
// Package level comment (required for exported packages)
// Package user provides user management functionality.
package user

// Exported function comment (required)
// GetByID retrieves a user by their unique identifier.
// It returns ErrNotFound if the user doesn't exist.
func GetByID(ctx context.Context, id string) (*User, error) {
    // Implementation
}

// Don't comment obvious code
x++ // increment x - BAD
```

---

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
    Field   string
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
    mu    sync.Mutex
    value int
}

func (c *Counter) Increment() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.value++
}

// Use RWMutex for read-heavy workloads
type Cache struct {
    mu    sync.RWMutex
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

## Testing

### Test Structure

```go
// File: user_test.go
package user

import (
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestGetUser(t *testing.T) {
    // Arrange
    repo := NewMockRepository()
    service := NewService(repo)

    // Act
    user, err := service.GetUser(context.Background(), "123")

    // Assert
    require.NoError(t, err)
    assert.Equal(t, "John", user.Name)
}
```

### Table-Driven Tests

```go
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name    string
        email   string
        wantErr bool
    }{
        {"valid email", "test@example.com", false},
        {"missing @", "testexample.com", true},
        {"empty", "", true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateEmail(tt.email)
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

### Benchmarks

```go
func BenchmarkProcess(b *testing.B) {
    data := generateTestData()

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        Process(data)
    }
}
```

---

## Interfaces

### Interface Design

```go
// Keep interfaces small (1-3 methods)
type Reader interface {
    Read(p []byte) (n int, err error)
}

// Define interfaces where they're used, not implemented
// consumer.go
type UserRepository interface {
    GetByID(ctx context.Context, id string) (*User, error)
}

type UserService struct {
    repo UserRepository // Accept interface
}
```

### Interface Composition

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type ReadWriter interface {
    Reader
    Writer
}
```

---

## Performance

### Memory Allocation

```go
// Preallocate slices when size is known
users := make([]User, 0, expectedCount)

// Use sync.Pool for frequent allocations
var bufferPool = sync.Pool{
    New: func() interface{} {
        return make([]byte, 1024)
    },
}

func process() {
    buf := bufferPool.Get().([]byte)
    defer bufferPool.Put(buf)
    // Use buffer
}
```

### Strings

```go
// Use strings.Builder for concatenation
var builder strings.Builder
for _, s := range items {
    builder.WriteString(s)
}
result := builder.String()

// Avoid string to []byte conversion in loops
data := []byte(s) // Do once outside loop
```

---

## Security

### Input Validation

```go
func CreateUser(input UserInput) error {
    // Validate all input
    if len(input.Name) == 0 || len(input.Name) > 100 {
        return &ValidationError{Field: "name"}
    }

    if !emailRegex.MatchString(input.Email) {
        return &ValidationError{Field: "email"}
    }

    return nil
}
```

### SQL Injection Prevention

```go
// Always use parameterized queries
row := db.QueryRow("SELECT * FROM users WHERE id = $1", userID)

// Never concatenate user input
// query := "SELECT * FROM users WHERE id = " + userID // NEVER DO THIS
```

### Secrets Handling

```go
// Use environment variables
apiKey := os.Getenv("API_KEY")

// Clear sensitive data after use
defer func() {
    for i := range password {
        password[i] = 0
    }
}()
```

---

## Best Practices

### ✅ DO

- Use `gofmt` and `golint`
- Handle all errors
- Use context for cancellation
- Write table-driven tests
- Keep interfaces small
- Document exported functions
- Use meaningful variable names

### ❌ DON'T

- Ignore errors
- Use global variables for state
- Use `init()` functions unnecessarily
- Create huge interfaces
- Use naked returns in long functions
- Use `panic` for normal errors
- Premature optimization

---

## References

- [Effective Go](https://golang.org/doc/effective_go)
- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Standard Library Documentation](https://pkg.go.dev/std)

---

**Version**: 1.0
**Last Updated**: February 5, 2026
