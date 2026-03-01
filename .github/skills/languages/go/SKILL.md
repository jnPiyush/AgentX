---
name: "go"
description: 'Write reliable, efficient Go code following idiomatic patterns and best practices. Use when building Go applications, implementing error handling with error wrapping, writing concurrent code with goroutines, designing Go interfaces, or structuring Go project layouts.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 languages: ["go"]
 platforms: ["windows", "linux", "macos"]
---

# Go Development

> **Purpose**: Best practices for Go development including project structure, concurrency, error handling, and testing.

---

## When to Use This Skill

- Building Go applications and microservices
- Implementing error handling with wrapping and sentinel errors
- Writing concurrent code with goroutines and channels
- Designing Go interfaces for testability
- Structuring Go project layouts

## Decision Tree

```
Go Project Decision
+-- Building a CLI tool?
|   +-- Simple? -> Single cmd/main.go
|   +-- Multi-command? -> cobra or urfave/cli
+-- Building a web service?
|   +-- Standard library sufficient? -> net/http + http.ServeMux
|   +-- Need middleware/routing? -> chi, gorilla/mux, or gin
+-- Need concurrency?
|   +-- Fan-out/fan-in? -> Goroutines + channels
|   +-- Shared state? -> sync.Mutex or sync.RWMutex
|   +-- Cancellation? -> context.Context
+-- Data access?
|   +-- SQL database? -> database/sql + sqlx
|   +-- ORM preferred? -> GORM (with caution)
+-- Reusable library? -> pkg/ directory, keep interfaces small
```

## Prerequisites

- Go 1.21+ installed
- Go modules enabled

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
+-- cmd/
| -- myapp/
| -- main.go # Application entry point
+-- internal/
| +-- config/ # Configuration handling
| +-- handlers/ # HTTP handlers
| +-- models/ # Domain models
| +-- repository/ # Data access
| -- service/ # Business logic
+-- pkg/
| -- utils/ # Reusable packages
+-- api/
| -- openapi.yaml # API specification
+-- configs/
| -- config.yaml # Configuration files
+-- scripts/
| -- setup.sh # Build/deploy scripts
+-- go.mod
+-- go.sum
-- README.md
```

### Package Naming

```go
// Package names should be lowercase, short, and descriptive
package user // Good
package userService // Bad - no camelCase
package user_svc // Bad - no underscores

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
var maxRetryCount = 3 // Good
var max_retry_count = 3 // Bad

// Acronyms should be all caps or all lowercase
var userID string // Good
var userId string // Bad
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

## Core Rules

### [PASS] DO

- Use `gofmt` and `golint`
- Handle all errors
- Use context for cancellation
- Write table-driven tests
- Keep interfaces small
- Document exported functions
- Use meaningful variable names

### [FAIL] DON'T

- Ignore errors
- Use global variables for state
- Use `init()` functions unnecessarily
- Create huge interfaces
- Use naked returns in long functions
- Use `panic` for normal errors
- Premature optimization

---

## Anti-Patterns

- **Ignored Errors**: Discarding error return values with `_` -> Always check and handle or propagate errors
- **Goroutine Leak**: Starting goroutines without exit conditions -> Use context.Context for cancellation and timeouts
- **Global Mutable State**: Package-level variables for shared state -> Pass dependencies explicitly via function parameters or structs
- **Fat Interfaces**: Interfaces with many methods -> Keep interfaces small (1-3 methods); compose as needed
- **Naked Returns in Long Functions**: Using bare `return` in functions longer than a few lines -> Use explicit named returns only in short functions
- **Panic for Control Flow**: Using `panic` for expected error conditions -> Return `error` values; reserve panic for truly unrecoverable situations

---

## References

- [Effective Go](https://golang.org/doc/effective_go)
- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Standard Library Documentation](https://pkg.go.dev/std)

---

**Version**: 1.0
**Last Updated**: February 5, 2026

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Goroutine leak | Use context.Context for cancellation, ensure goroutines have exit conditions |
| Race condition detected | Run go test -race, use mutexes or channels for shared state |
| Import cycle | Extract shared types into a separate package, use interfaces to break dependencies |