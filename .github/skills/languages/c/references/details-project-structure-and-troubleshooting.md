# c: Project Structure through Troubleshooting

> MUST read before work involving **project structure through troubleshooting**. This reference preserves complete source guidance relocated for context-budget compliance.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Language Standard](#language-standard)
3. [Memory and Ownership](#memory-and-ownership)
4. [Error Handling](../SKILL.md#error-handling)
5. [Interfaces and ABI Safety](#interfaces-and-abi-safety)
6. [Concurrency](#concurrency)
7. [Testing and Tooling](#testing-and-tooling)
8. [Security](../SKILL.md#security)
9. [Checklist](../SKILL.md#checklist)

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

## Interfaces and ABI Safety

- Prefer opaque structs in public headers to reduce ABI breakage.
- Do not expose internal array capacities or layout-sensitive fields unless required.
- Use `extern "C"` wrappers when headers must be consumed by C++.
- Keep public headers free of unnecessary platform macros and transitive dependencies.

## Concurrency

- Use threads only when the workload is demonstrably parallelizable and synchronization cost is justified.
- Prefer message passing, work queues, or ownership transfer over shared mutable state.
- Use atomics for simple counters/flags, not as a substitute for clear design.

## Testing and Tooling

- Use unit tests for parsing, validation, and ownership-sensitive helpers
- Run ASan and UBSan regularly in CI
- Use static analysis such as `clang-tidy` where available
- Compile with both GCC and Clang when portability matters

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