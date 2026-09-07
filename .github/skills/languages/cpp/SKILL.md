---
name: "cpp"
description: 'Write modern, maintainable C++ using C++23-era practices. Use when building native libraries, performance-sensitive services, desktop applications, game/engine components, or systems software that benefits from RAII, strong types, templates, and zero-cost abstractions.'
metadata:
 author: "AgentX"
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

## Error Handling

- Use exceptions only where the codebase policy allows and invariants are preserved.
- For explicit non-exception flows, prefer `std::expected`-style results.
- Do not mix ad hoc booleans, sentinel values, and exceptions in the same API surface.

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

## Workflow

1. Define value, ownership, error, and ABI contracts.
2. Implement with RAII and narrow interfaces.
3. Compile under required compilers with strict warnings.
4. Run tests, sanitizers, static analysis, and benchmarks where claimed.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Project Structure through Troubleshooting](references/details-project-structure-and-troubleshooting.md) - MUST read before work involving project structure through troubleshooting.
