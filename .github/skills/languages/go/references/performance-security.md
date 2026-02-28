# Go Performance & Security Patterns

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
