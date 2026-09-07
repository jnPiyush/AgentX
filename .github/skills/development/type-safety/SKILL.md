---
name: "type-safety"
description: 'Apply type safety patterns including nullable types, validation, static analysis, and strong typing. Use when adding type annotations, implementing nullable reference types, validating inputs with value objects, configuring static analysis tools, or designing type-safe APIs.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
---

# Type Safety

> **Purpose**: Use type systems to catch errors at compile/analysis time rather than runtime. 
> **Goal**: Prevent null errors, type mismatches, and invalid states. 
> **Note**: For implementation, see [C# Development](../../languages/csharp/SKILL.md) or [Python Development](../../languages/python/SKILL.md).

---

## When to Use This Skill

- Adding type annotations to existing code
- Implementing nullable reference types
- Building type-safe APIs with value objects
- Configuring static analysis tools
- Designing strongly-typed data transfer objects

## Prerequisites

- Language with type system support

## Decision Tree

```
Type safety concern?
+-- Adding types to existing code?
|   +-- Greenfield? -> Enable strict mode from day one
|   +-- Legacy codebase? -> Enable strict incrementally (file-by-file)
|   +-- Third-party input? -> Validate at boundary, trust internally
+-- Choosing a type strategy?
|   +-- Primitive obsession? -> Introduce value objects (Email, Money, UserId)
|   +-- Magic strings/numbers? -> Replace with enums or constants
|   +-- Nullable confusion? -> Enable nullable reference types, annotate everything
+-- Handling unknown data?
|   +-- API response -> Parse and validate into typed model (Pydantic, Zod, etc.)
|   +-- User input -> Validate at boundary, reject invalid shapes early
|   +-- Config values -> Bind to typed config class at startup
+-- Compiler/analyzer errors?
    +-- Too many `any`/`object`? -> Replace with generics or specific types
    +-- Null warnings? -> Add explicit null checks or use non-null assertions with care
    +-- False positive? -> Suppress with inline comment explaining why
```

## Core Rules

| Practice | Description |
|----------|-------------|
| **Annotate everything** | Types on all function parameters and returns |
| **Enable strict mode** | Turn on all null safety and type checks |
| **Avoid `any`/`object`** | Use specific types instead of escape hatches |
| **Validate at boundaries** | Check external input, trust internal data |
| **Use enums** | Replace magic strings/numbers with enums |
| **Prefer immutability** | Use readonly/final where possible |
| **Run analyzers in CI** | Fail builds on type errors |
| **Document nullable intent** | Explicit `?` for nullable, no `?` for required |

---

## Anti-Patterns

- **Any Escape Hatch**: Using `any`, `object`, or `dynamic` to bypass the type system -> Use generics, union types, or specific interfaces instead
- **Primitive Obsession**: Passing raw strings for emails, IDs, or money amounts -> Wrap in value objects (EmailAddress, UserId, Money) with built-in validation
- **Nullable Everywhere**: Making every field nullable "just in case" -> Only mark fields nullable when null is a valid domain state; prefer required by default
- **Stringly Typed Enums**: Using plain strings where a finite set of values exists -> Define enums or literal union types for known value sets
- **Ignoring Analyzer Warnings**: Suppressing all static analysis warnings to get a clean build -> Fix warnings or suppress individually with documented justification
- **Unsafe Casts**: Using force-casts to silence type errors without validation -> Validate the shape first, then let the type system narrow naturally
- **Missing Return Types**: Relying on type inference for public API return types -> Explicitly annotate return types on all public functions and methods

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Too many any/Object types | Replace with specific types or generics, enable strict mode incrementally |
| Generic type inference fails | Add explicit type parameters at call site, check constraint compatibility |
| Static analysis too noisy | Configure severity levels, suppress false positives with inline comments, fix incrementally |

## Workflow

1. Locate untyped or nullable boundaries.
2. Define the narrowest truthful type and runtime validator.
3. Propagate types through callers without coercion.
4. Compile and test valid plus invalid inputs.

## Verification Checklist

- [ ] Strict compiler checks pass.
- [ ] No new unchecked escape hatch exists.
- [ ] External data is validated before use.
- [ ] Null and error paths are tested.

## Rationalization Table

| Temptation | Why reject it |
|------------|---------------|
| use a cast to silence a real mismatch. | Avoid unchecked casts, broad any-like types, and null suppression. |
| confuse static types with runtime input validation. | Use static types for trusted internal state, runtime validation at external boundaries, and explicit nullable or result types for absence and failure. |

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Why Type Safety Matters through Type Safety Tools](references/details-why-type-safety-matters-and-type-safety-tools.md) - MUST read before work involving why type safety matters through type safety tools.

Existing focused references are reused, not duplicated:

- [Static Analysis & Generics Patterns](references/static-analysis-generics.md) - MUST read before applying the focused static analysis & generics patterns guidance.
- [Value Objects, Enums & Validation Patterns](references/value-objects-enums-validation.md) - MUST read before applying the focused value objects, enums & validation patterns guidance.
