---
name: "rust"
description: "Rust programming language best practices for building safe, concurrent, and performant systems."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-01-15"
  updated: "2025-01-15"
compatibility:
  languages: ["rust"]
  platforms: ["windows", "linux", "macos"]
allowed-tools: "read_file semantic_search grep_search file_search replace_string_in_file create_file run_in_terminal get_errors"
---

# Rust Development

> **Purpose**: Best practices for Rust development including ownership, error handling, concurrency, and safety patterns.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Ownership and Borrowing](#ownership-and-borrowing)
3. [Error Handling](#error-handling)
4. [Traits and Generics](#traits-and-generics)
5. [Concurrency](#concurrency)
6. [Testing](#testing)
7. [Performance](#performance)
8. [Security](#security)
9. [Best Practices](#best-practices)

---

## Project Structure

### Standard Layout

```
project/
├── src/
│   ├── main.rs              # Binary entry point
│   ├── lib.rs               # Library root
│   ├── config.rs            # Configuration
│   ├── error.rs             # Error types
│   ├── models/
│   │   ├── mod.rs
│   │   └── user.rs
│   └── services/
│       ├── mod.rs
│       └── user_service.rs
├── tests/
│   └── integration_tests.rs
├── benches/
│   └── benchmarks.rs
├── examples/
│   └── basic_usage.rs
├── Cargo.toml
├── Cargo.lock
└── README.md
```

### Cargo.toml

```toml
[package]
name = "myapp"
version = "0.1.0"
edition = "2021"
authors = ["Your Name <you@example.com>"]
description = "A brief description"

[dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
thiserror = "1"
anyhow = "1"

[dev-dependencies]
tokio-test = "0.4"

[profile.release]
lto = true
opt-level = 3
```

---

## Ownership and Borrowing

### Ownership Rules

```rust
fn main() {
    // Each value has exactly one owner
    let s1 = String::from("hello");

    // Ownership moves on assignment
    let s2 = s1;
    // println!("{}", s1); // Error: s1 is moved

    // Clone for deep copy
    let s3 = s2.clone();
    println!("{} {}", s2, s3); // Both valid
}
```

### Borrowing

```rust
// Immutable borrow - multiple allowed
fn calculate_length(s: &String) -> usize {
    s.len()
}

// Mutable borrow - only one at a time
fn append_world(s: &mut String) {
    s.push_str(" world");
}

fn main() {
    let mut s = String::from("hello");

    // Multiple immutable borrows OK
    let len1 = calculate_length(&s);
    let len2 = calculate_length(&s);

    // Mutable borrow
    append_world(&mut s);
}
```

### Lifetimes

```rust
// Explicit lifetime annotation
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

// Struct with lifetime
struct Context<'a> {
    data: &'a str,
}

impl<'a> Context<'a> {
    fn new(data: &'a str) -> Self {
        Context { data }
    }
}
```

---

## Error Handling

### Result and Option

```rust
use std::fs::File;
use std::io::{self, Read};

// Using Result
fn read_file(path: &str) -> Result<String, io::Error> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}

// Using Option
fn find_user(id: u32) -> Option<User> {
    users.iter().find(|u| u.id == id).cloned()
}

// Pattern matching
match find_user(42) {
    Some(user) => println!("Found: {}", user.name),
    None => println!("User not found"),
}
```

### Custom Errors with thiserror

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("User not found: {0}")]
    UserNotFound(u32),

    #[error("Validation failed: {field}")]
    Validation { field: String },

    #[error("Database error")]
    Database(#[from] sqlx::Error),

    #[error("IO error")]
    Io(#[from] std::io::Error),
}

fn get_user(id: u32) -> Result<User, AppError> {
    repository::find(id).ok_or(AppError::UserNotFound(id))
}
```

### Error Propagation

```rust
// Use ? operator for propagation
fn process() -> Result<(), AppError> {
    let config = load_config()?;
    let user = get_user(config.user_id)?;
    send_email(&user)?;
    Ok(())
}

// Use anyhow for application errors
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let config = load_config()
        .context("Failed to load configuration")?;
    Ok(())
}
```

---

## Traits and Generics

### Defining Traits

```rust
trait Repository<T> {
    fn find(&self, id: u32) -> Option<T>;
    fn save(&mut self, entity: T) -> Result<(), Error>;

    // Default implementation
    fn exists(&self, id: u32) -> bool {
        self.find(id).is_some()
    }
}

// Implement for specific type
impl Repository<User> for PostgresRepository {
    fn find(&self, id: u32) -> Option<User> {
        // Implementation
    }

    fn save(&mut self, user: User) -> Result<(), Error> {
        // Implementation
    }
}
```

### Generic Functions

```rust
// Generic with trait bounds
fn process<T: Display + Clone>(item: T) {
    println!("{}", item);
}

// Multiple bounds with where clause
fn complex<T, U>(t: T, u: U) -> String
where
    T: Display + Clone,
    U: Debug + Default,
{
    format!("{} {:?}", t, u)
}
```

### Trait Objects

```rust
// Dynamic dispatch with trait objects
trait Processor {
    fn process(&self, data: &str) -> String;
}

fn run_processors(processors: Vec<Box<dyn Processor>>, data: &str) {
    for processor in processors {
        println!("{}", processor.process(data));
    }
}
```

---

## Concurrency

### Threads

```rust
use std::thread;
use std::sync::{Arc, Mutex};

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            let mut num = counter.lock().unwrap();
            *num += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Result: {}", *counter.lock().unwrap());
}
```

### Async/Await with Tokio

```rust
use tokio;

#[tokio::main]
async fn main() {
    let result = fetch_data().await;
    println!("{:?}", result);
}

async fn fetch_data() -> Result<String, Error> {
    let response = reqwest::get("https://api.example.com/data")
        .await?
        .text()
        .await?;
    Ok(response)
}

// Concurrent execution
async fn fetch_all() -> Vec<Data> {
    let futures = urls.iter().map(|url| fetch(url));
    futures::future::join_all(futures).await
}
```

### Channels

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        for i in 0..10 {
            tx.send(i).unwrap();
        }
    });

    for received in rx {
        println!("Got: {}", received);
    }
}
```

---

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(2, 2), 4);
    }

    #[test]
    fn test_validation() {
        let result = validate("");
        assert!(result.is_err());
    }

    #[test]
    #[should_panic(expected = "empty input")]
    fn test_panic() {
        process("");
    }
}
```

### Async Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_async_function() {
        let result = fetch_data().await;
        assert!(result.is_ok());
    }
}
```

### Integration Tests

```rust
// tests/integration_test.rs
use myapp::App;

#[test]
fn test_full_workflow() {
    let app = App::new();
    let result = app.process("input");
    assert_eq!(result, "expected output");
}
```

---

## Performance

### Memory Efficiency

```rust
// Use iterators instead of collecting
let sum: i32 = numbers.iter().map(|x| x * 2).sum();

// Avoid unnecessary allocations
fn process(data: &[u8]) -> &[u8] {
    // Return slice instead of Vec
    &data[..10]
}

// Use Cow for flexible ownership
use std::borrow::Cow;

fn process(input: &str) -> Cow<str> {
    if input.contains("special") {
        Cow::Owned(input.replace("special", "normal"))
    } else {
        Cow::Borrowed(input)
    }
}
```

### Zero-Cost Abstractions

```rust
// Iterators compile to efficient loops
let result: Vec<_> = data
    .iter()
    .filter(|x| x.is_valid())
    .map(|x| x.transform())
    .collect();

// Generic functions are monomorphized
fn process<T: Process>(item: T) {
    // No runtime overhead
}
```

---

## Security

### Input Validation

```rust
fn validate_input(input: &str) -> Result<&str, ValidationError> {
    if input.is_empty() {
        return Err(ValidationError::Empty);
    }
    if input.len() > 1000 {
        return Err(ValidationError::TooLong);
    }
    if !input.chars().all(|c| c.is_alphanumeric()) {
        return Err(ValidationError::InvalidChars);
    }
    Ok(input)
}
```

### Safe Memory Handling

```rust
// Use zeroize for sensitive data
use zeroize::Zeroize;

let mut password = String::from("secret");
// Use password...
password.zeroize(); // Securely clear memory

// Use SecretString for secrets
use secrecy::{Secret, ExposeSecret};

let api_key: Secret<String> = Secret::new(key);
// Access only when needed
client.auth(api_key.expose_secret());
```

### SQL Safety with SQLx

```rust
// Compile-time checked queries
let user = sqlx::query_as!(
    User,
    "SELECT * FROM users WHERE id = $1",
    user_id
)
.fetch_one(&pool)
.await?;
```

---

## Best Practices

### ✅ DO

- Use `clippy` for linting: `cargo clippy`
- Format with `rustfmt`: `cargo fmt`
- Prefer `&str` over `String` for function parameters
- Use `#[derive]` for common traits
- Write documentation with `///`
- Use `Result` for recoverable errors
- Leverage the type system for safety

### ❌ DON'T

- Use `unwrap()` in production code
- Ignore compiler warnings
- Use `unsafe` without clear justification
- Clone unnecessarily
- Write overly complex lifetimes
- Panic for expected error conditions

---

## References

- [The Rust Book](https://doc.rust-lang.org/book/)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/)
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- [Tokio Tutorial](https://tokio.rs/tokio/tutorial)

---

**Version**: 1.0
**Last Updated**: February 5, 2026
