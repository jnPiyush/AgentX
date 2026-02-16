# Dependency Selection & Monorepo Patterns

## Dependency Selection

### Evaluation Criteria

```
Before Adding a Dependency:

[PASS] Check:
 - Maintenance status (recent commits, active maintainers)
 - Security history (past vulnerabilities, response time)
 - License compatibility (MIT, Apache OK; GPL may not be)
 - Download/usage statistics (popular = battle-tested)
 - API stability (frequent breaking changes?)
 - Bundle size (for frontend packages)
 - Transitive dependencies (brings in how many others?)

[FAIL] Red Flags:
 - No updates in 2+ years
 - Many open security issues
 - Single maintainer, no bus factor
 - Excessive transitive dependencies
 - Unclear or restrictive license
```

### Minimize Dependencies

```
Questions Before Adding:
 1. Can I implement this myself in < 100 lines?
 2. Does the standard library provide this?
 3. Do I need the whole package or just one function?
 4. Is this a core feature or rarely used?

Alternatives:
 - Copy small utility functions (with attribution)
 - Use standard library alternatives
 - Write custom implementation for simple needs
```

---

## Monorepo Dependencies

### Shared Dependencies

```
Central Package Management:

 /project-root
 /packages.props (or package.json workspace)
 - Define versions once
 - All projects use same versions
 
 /service-a
 - References packages (no version)
 
 /service-b
 - References packages (no version)

Benefits:
 - Consistent versions across all services
 - Single place to update
 - Easier security patching
```

---
