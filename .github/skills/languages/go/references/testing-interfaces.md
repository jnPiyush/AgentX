# Go Testing & Interface Patterns

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
 name string
 email string
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
