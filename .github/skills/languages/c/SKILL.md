---
name: "c"
description: 'Write safe, portable, and efficient C code using modern C23-era practices. Use when building systems software, embedded components, native libraries, POSIX tooling, or FFI boundaries where precise control over memory, layout, and runtime cost matters.'
metadata:
 author: "Frontier"
 version: "1.0.0"
 created: "2026-04-04"
 updated: "2026-04-04"
compatibility:
 languages: ["c"]
 platforms: ["windows", "linux", "macos"]
---

# C Development

> WHEN: Writing or reviewing C code, native libraries, embedded components, POSIX tools, or C interfaces where memory layout, portability, and deterministic runtime behavior matter.

## When to Use This Skill

- Building native C libraries and command-line tools
- Implementing embedded or systems-level components
- Designing FFI-safe interfaces for other languages
- Hardening pointer-heavy or buffer-heavy code
- Modernizing legacy C to safer, clearer patterns

## Decision Tree

```
C Project Decision
+-- Hosted application?
|   +-- Portable CLI? -> ISO C23 + small platform abstraction layer
|   +-- POSIX-only tooling? -> C23 + POSIX APIs with portability notes
+-- Embedded / firmware?
|   +-- No allocator allowed? -> static storage + arena/fixed buffers
|   +-- ISR / hard real-time? -> avoid blocking, heap, and hidden copies
+-- Public API?
|   +-- Cross-language FFI? -> opaque handles + explicit ownership rules
|   +-- Internal only? -> expose structs only when layout coupling is acceptable
+-- Error handling?
|   +-- Recoverable runtime errors? -> status codes + out parameters
|   +-- Fatal init/config errors? -> fail fast at process boundary
+-- Build system?
|   +-- Small library/app? -> CMake
|   +-- Toolchain-heavy or embedded? -> CMake or Meson with toolchain files
-- Need concurrency? -> C11/C23 atomics and threads only when platform support is explicit
```

## Prerequisites

- C23-capable compiler such as GCC 15.2+ or Clang 22.1+
- Build system such as CMake 3.30+ or Meson
- AddressSanitizer and UndefinedBehaviorSanitizer available in CI/dev builds

## Table of Contents

1. [Project Structure](#project-structure)
2. [Language Standard](#language-standard)
3. [Memory and Ownership](#memory-and-ownership)
4. [Error Handling](#error-handling)
5. [Interfaces and ABI Safety](#interfaces-and-abi-safety)
6. [Concurrency](#concurrency)
7. [Testing and Tooling](#testing-and-tooling)
8. [Security](#security)
9. [Checklist](#checklist)

---

## Project Structure

```text
project/
+-- include/
| -- mylib/
|    -- api.h
+-- src/
| -- api.c
| -- parse.c
| -- platform_posix.c
+-- tests/
| -- test_api.c
+-- CMakeLists.txt
-- README.md
```

## Language Standard

**Current standard target**: C23
**Portable minimum for mixed toolchains**: C17 where required by downstream constraints

### Modern C Features to Prefer

```c
// Use fixed-width integers for externally visible data.
#include <stdint.h>

typedef struct {
    uint32_t id;
    const char *name;
} user_record;

// Use size_t for counts and lengths.
int parse_users(const char *buffer, size_t length);
```

## Memory and Ownership

### Ownership Rules

- Every pointer parameter must have one of these contracts: borrowed read-only, borrowed mutable, transferred ownership, or output buffer.
- Document who allocates and who frees for every heap-backed object.
- Prefer stack allocation or caller-owned buffers when sizes are bounded and practical.
- Initialize storage deterministically before use.

### Preferred Pattern

```c
typedef struct user_store user_store;

user_store *user_store_create(void);
void user_store_destroy(user_store *store);
int user_store_add(user_store *store, const char *name, uint32_t *out_id);
```

## Error Handling

- Return explicit status codes from library boundaries.
- Use `enum` or named constants for nontrivial error sets.
- Preserve errno only when interacting with APIs that define it.
- Log or format human-readable diagnostics at the boundary layer, not deep utility layers.

### Example

```c
typedef enum {
    USER_OK = 0,
    USER_ERR_INVALID_ARGUMENT,
    USER_ERR_NOT_FOUND,
    USER_ERR_IO
} user_status;
```

## Interfaces and ABI Safety

- Prefer opaque structs in public headers to reduce ABI breakage.
- Do not expose internal array capacities or layout-sensitive fields unless required.
- Use `extern "C"` wrappers when headers must be consumed by C++.
- Keep public headers free of unnecessary platform macros and transitive dependencies.

## Concurrency

- Use threads only when the workload is demonstrably parallelizable and synchronization cost is justified.
- Prefer message passing, work queues, or ownership transfer over shared mutable state.
- Use atomics for simple counters/flags, not as a substitute for clear design.

## Core Rules

### [PASS] DO

- Target C23 by default for new code when the toolchain allows it
- Compile with warnings enabled and treat warnings as errors in CI
- Use sanitizers in debug/test builds
- Validate all pointer, size, and index inputs at the boundary
- Use `const` aggressively for borrowed read-only data
- Keep headers minimal and stable

### [FAIL] DON'T

- Return heap ownership ambiguously
- Cast away `const` without a documented reason
- Use unbounded string functions
- Hide allocation or deallocation in surprising helper functions
- Depend on undefined behavior for performance
- Expose internal struct layout unnecessarily in public APIs

## Anti-Patterns

- **Implicit Ownership**: Returning or storing pointers without documenting who frees them -> Make ownership explicit in naming and comments
- **Buffer Size Guessing**: Using fixed arrays without passing length -> Always pair pointer + length
- **Unchecked Arithmetic**: Computing sizes without overflow consideration -> Validate multiplication/addition before allocation
- **Header Bloat**: Including platform/system headers everywhere -> Keep public headers narrow and implementation details private
- **String API Risk**: Using `strcpy`, `sprintf`, or similar unbounded APIs -> Use bounded alternatives and explicit lengths
- **Sentinel-Only Error Signaling**: Returning `NULL` or `-1` for every failure -> Use named status codes for clarity

## Testing and Tooling

- Use unit tests for parsing, validation, and ownership-sensitive helpers
- Run ASan and UBSan regularly in CI
- Use static analysis such as `clang-tidy` where available
- Compile with both GCC and Clang when portability matters

## Security

- Validate lengths before copying or indexing
- Zero sensitive buffers when lifecycle rules require it
- Avoid integer truncation across API boundaries
- Treat all external input as hostile, including environment variables and file contents

## Checklist

- [ ] Public APIs define ownership rules explicitly
- [ ] Pointer/length pairs are validated at boundaries
- [ ] Build uses warnings-as-errors in CI
- [ ] Sanitizers are enabled for non-release validation builds
- [ ] Public headers avoid layout leakage unless intentional
- [ ] Error codes are specific enough for callers to react correctly

## References

- [GCC Releases](https://gcc.gnu.org/)
- [LLVM Releases](https://releases.llvm.org/)
- [C23 draft and committee resources](https://www.open-std.org/jtc1/sc22/wg14/)

**Version**: 1.0
**Last Updated**: April 4, 2026

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Heap corruption or crashes | Reproduce with ASan enabled and reduce to the smallest allocation/copy path |
| ABI break after a library update | Re-check public header layout, packing assumptions, and exported symbol changes |
| Non-portable behavior across compilers | Test under both GCC and Clang; remove compiler-extension assumptions from shared code |