# Rust Ownership, Error Handling & Traits

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
