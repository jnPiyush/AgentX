# Rust Concurrency, Testing & Performance

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
