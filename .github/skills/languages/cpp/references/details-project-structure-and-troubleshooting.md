# cpp: Project Structure through Troubleshooting

> MUST read before work involving **project structure through troubleshooting**. This reference preserves complete source guidance relocated for context-budget compliance.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Language Standard](#language-standard)
3. [Ownership and Lifetime](#ownership-and-lifetime)
4. [Interfaces and Value Semantics](#interfaces-and-value-semantics)
5. [Error Handling](../SKILL.md#error-handling)
6. [Concurrency](#concurrency)
7. [Performance](#performance)
8. [Security](../SKILL.md#security)
9. [Checklist](../SKILL.md#checklist)

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