---
name: "c"
description: 'Write safe, portable, and efficient C code using modern C23-era practices. Use when building systems software, embedded components, native libraries, POSIX tooling, or FFI boundaries where precise control over memory, layout, and runtime cost matters.'
metadata:
 author: "AgentX"
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

## Workflow

1. Define ownership, error, and ABI contracts.
2. Implement the smallest portable unit.
3. Compile across required toolchains with warnings enabled.
4. Run unit tests, sanitizers, and platform checks.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Project Structure through Troubleshooting](references/details-project-structure-and-troubleshooting.md) - MUST read before work involving project structure through troubleshooting.
