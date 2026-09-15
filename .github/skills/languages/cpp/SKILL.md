---
name: "cpp"
description: 'Write modern, maintainable C++ using C++23-era practices. Use when building native libraries, performance-sensitive services, desktop applications, game/engine components, or systems software that benefits from RAII, strong types, templates, and zero-cost abstractions.'
metadata:
 author: "Frontier"
 version: "1.0.0"
 created: "2026-04-04"
 updated: "2026-04-04"
compatibility:
 languages: ["cpp"]
 platforms: ["windows", "linux", "macos"]
---

# C++ Development

> WHEN: Writing or reviewing modern C++ for native libraries, back-end services, desktop apps, game/engine code, or high-performance systems where RAII, value semantics, and type safety matter.

## When to Use This Skill

- Building modern C++ libraries and executables
- Refactoring legacy pointer-heavy C++ toward safer ownership
- Designing ABI-conscious native interfaces
- Applying templates, ranges, spans, and concurrency utilities responsibly
- Hardening performance-sensitive code without sacrificing maintainability

## Decision Tree

```
C++ Project Decision
+-- New codebase?
|   +-- General application/library? -> C++23 default
|   +-- ABI-constrained or older platform? -> C++20 minimum with explicit constraints
+-- Ownership model?
|   +-- Single owner? -> std::unique_ptr / value types
|   +-- Shared ownership truly required? -> std::shared_ptr sparingly
+-- API design?
|   +-- Read-only view? -> std::string_view / std::span<const T>
|   +-- Mutable buffer view? -> std::span<T>
+-- Error handling?
|   +-- Exceptions allowed? -> throw only across layers that can preserve invariants
|   +-- Exceptions forbidden? -> std::expected or status/result type
+-- Polymorphism?
|   +-- Runtime dispatch needed? -> small abstract interfaces
|   +-- Compile-time composition? -> templates/concepts
-- Concurrency? -> std::jthread, futures, atomics only with clear ownership and cancellation rules
```

## Prerequisites

- C++23-capable compiler such as GCC 15.2+ or Clang 22.1+
- CMake 3.30+ or another modern build system with compile-features support
- Sanitizers and static analysis available in development/CI builds

## Table of Contents

1. [Project Structure](#project-structure)
2. [Language Standard](#language-standard)
3. [Ownership and Lifetime](#ownership-and-lifetime)
4. [Interfaces and Value Semantics](#interfaces-and-value-semantics)
5. [Error Handling](#error-handling)
6. [Concurrency](#concurrency)
7. [Performance](#performance)
8. [Security](#security)
9. [Checklist](#checklist)

---

## Project Structure

```text
project/
+-- include/
| -- mylib/
|    -- api.hpp
+-- src/
| -- api.cpp
| -- parser.cpp
| -- main.cpp
+-- tests/
| -- parser_tests.cpp
+-- CMakeLists.txt
-- README.md
```

## Language Standard

**Current standard target**: C++23
**Portable minimum for constrained environments**: C++20

### Modern C++ Features to Prefer

```cpp
#include <expected>
#include <span>
#include <string_view>

struct user_record {
    std::uint32_t id;
    std::string name;
};

std::expected<user_record, parse_error>
parse_user(std::string_view input);
```

## Ownership and Lifetime

- Prefer values by default.
- Use `std::unique_ptr` to model ownership transfer.
- Use `std::span` and `std::string_view` for non-owning views.
- Avoid raw owning pointers in new code.
- Keep object lifetime simple enough that destruction order is obvious.

## Interfaces and Value Semantics

- Prefer small, intention-revealing types over primitive parameter lists.
- Use concepts or constrained templates when generic code is part of the public API.
- Keep headers stable and minimize transitive includes.
- Design for move efficiency, not shared mutable state.

## Error Handling

- Use exceptions only where the codebase policy allows and invariants are preserved.
- For explicit non-exception flows, prefer `std::expected`-style results.
- Do not mix ad hoc booleans, sentinel values, and exceptions in the same API surface.

## Concurrency

- Prefer `std::jthread` over raw `std::thread` when cancellation or scope-bound joining matters.
- Avoid detached threads.
- Keep shared state minimal and synchronized with clear invariants.
- Prefer immutable messages and queues over free-form shared ownership.

## Performance

- Measure first; do not guess.
- Prefer contiguous storage and clear ownership.
- Use `reserve` when capacity is knowable.
- Pass read-only data as views where lifetime is safe.

## Core Rules

### [PASS] DO

- Target C++23 by default for new work
- Prefer RAII and value semantics
- Use `std::span` and `std::string_view` for non-owning parameters
- Enable sanitizers and warnings in CI
- Keep templates constrained and readable
- Use standard-library facilities before custom abstractions

### [FAIL] DON'T

- Introduce raw owning pointers in new code
- Use `new`/`delete` directly in application logic without a strong reason
- Return references/views to temporaries
- Use inheritance where composition is simpler
- Detach threads casually
- Optimize based on intuition alone

## Anti-Patterns

- **Shared Ownership Everywhere**: Defaulting to `std::shared_ptr` -> Use values or `std::unique_ptr` first
- **View Lifetime Bugs**: Returning `std::string_view` or `std::span` into destroyed storage -> Tie views only to caller-owned or object-owned storage with clear lifetime
- **Template Explosion**: Over-generalizing simple logic into unreadable templates -> Constrain generics and prefer straightforward types unless reuse is proven
- **Header-Only Bloat**: Putting implementation everywhere -> Move stable implementations to source files when compile time or ABI matters
- **Exception Policy Drift**: Some layers throw while others assume no-throw APIs -> Make the policy explicit at module boundaries
- **Detached Work**: Fire-and-forget threads without ownership or shutdown control -> Use scoped threads, executors, or queues

## Security

- Validate sizes before allocation or copy
- Treat integer conversions as potential bugs
- Avoid undefined behavior shortcuts for performance
- Prefer standard containers and algorithms over manual buffer arithmetic

## Checklist

- [ ] New code targets C++23 unless constrained otherwise
- [ ] Ownership is modeled with values, references, spans, or smart pointers explicitly
- [ ] APIs avoid dangling-view risks
- [ ] Error handling strategy is consistent across the module
- [ ] Concurrency paths have explicit shutdown/join behavior
- [ ] Sanitizers and warnings are enabled in validation builds

## References

- [GCC Releases](https://gcc.gnu.org/)
- [LLVM Releases](https://releases.llvm.org/)
- [C++ reference](https://en.cppreference.com/)

**Version**: 1.0
**Last Updated**: April 4, 2026

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Lifetime bugs around views/references | Replace the risky view with a value or tie it to object-owned storage with documented lifetime |
| Unclear ownership in old code | Introduce value types, `std::unique_ptr`, and narrow interfaces incrementally |
| Template-heavy compile errors | Reduce template depth, add concepts/static assertions, and isolate the generic boundary |