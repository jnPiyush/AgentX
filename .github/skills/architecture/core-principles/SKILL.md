---
name: "core-principles"
description: 'Apply fundamental coding principles (SOLID, DRY, KISS) and structure projects for maintainability with clean architecture and separation of concerns. Use when refactoring, reviewing patterns, setting up project structure, or organizing modules.'
user-invocable: false
metadata:
 author: "AgentX"
 version: "2.0.0"
 created: "2025-01-15"
 updated: "2026-02-27"
compatibility:
 languages: ["csharp"]
---

# Core Principles & Code Organization

> **Purpose**: Fundamental principles guiding production code development and project structure. 
> **Focus**: SOLID, DRY, KISS, design patterns, project organization.

---

## When to Use This Skill

- Reviewing code for SOLID principle compliance
- Refactoring code for maintainability
- Choosing appropriate design patterns
- Teaching or evaluating engineering standards
- Setting up a new project structure
- Refactoring monolithic codebases
- Implementing dependency injection
- Organizing modules for team collaboration
- Choosing between architectural patterns

## Prerequisites

- Basic OOP programming knowledge

## Decision Guide

Reach for structure only when it reduces a real maintenance cost. Use SRP and composition when responsibilities are mixed, DRY after the second real duplication, and KISS or YAGNI when the design is drifting toward speculative flexibility.

## Why This Is a Skill

Architecture advice becomes harmful when it turns into pattern cargo cults. This skill keeps SOLID, DRY, KISS, and organization choices tied to concrete change cost, readability, and testability.

## Workflow

1. Identify the maintenance pain: mixed responsibilities, duplication, hidden dependencies, or scattered feature code.
2. Choose the smallest structural change that removes that pain.
3. Preserve behavior with tests or equivalent verification.
4. Stop once the code is easier to change and reason about.

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-solid-principles.md#decision-tree).

## SOLID Principles

MUST read before selection: [Decision Tree details](references/details-decision-tree-solid-principles.md#solid-principles).

<a id="single-responsibility-srp"></a>

<a id="openclosed-ocp"></a>

<a id="liskov-substitution-lsp"></a>

<a id="interface-segregation-isp"></a>

<a id="dependency-inversion-dip"></a>

## DRY (Don't Repeat Yourself)

MUST read before selection: [Decision Tree details](references/details-decision-tree-solid-principles.md#dry-dont-repeat-yourself).

## KISS (Keep It Simple, Stupid)

MUST read before selection: [Decision Tree details](references/details-decision-tree-solid-principles.md#kiss-keep-it-simple-stupid).

## YAGNI (You Aren't Gonna Need It)

MUST read before selection: [Decision Tree details](references/details-decision-tree-solid-principles.md#yagni-you-arent-gonna-need-it).

## Core Rules

### [PASS] DO

- **Follow SOLID** - Especially SRP and DIP
- **Keep functions small** - One thing, well
- **Use meaningful names** - Self-documenting code
- **Favor composition** - Over inheritance
- **Write tests** - Design for testability
- **Refactor regularly** - Improve as you go
- **Document complex logic** - Why, not what

### [FAIL] DON'T

- **Violate SOLID** - Leads to rigid, fragile code
- **Duplicate code** - Extract to methods/classes
- **Overcomplicate** - Simple solutions first
- **Build unused features** - YAGNI
- **Skip code reviews** - Catch issues early
- **Ignore tech debt** - Pay it down regularly

---

## Code Organization

MUST read before selection: [Decision Tree details](references/details-decision-tree-solid-principles.md#code-organization).

<a id="organization-decision-tree"></a>

<a id="c-project-structure"></a>

<a id="single-responsibility-examples"></a>

<a id="naming-conventions"></a>

<a id="code-organization-troubleshooting"></a>

## Anti-Patterns

- **God Class**: One class handles persistence, validation, and notifications -> Split into focused classes per SRP
- **Speculative Generality**: Building abstract factories and plugin systems for one implementation -> Start concrete, abstract when a second case appears (YAGNI)
- **Premature DRY**: Merging two vaguely similar functions into one with flag parameters -> Tolerate minor duplication until the pattern is clear
- **Deep Inheritance**: 4+ level inheritance hierarchies -> Flatten with composition and interfaces
- **Service Locator**: Resolving dependencies at runtime from a global container -> Use constructor injection (DIP)
- **Copy-Paste Architecture**: Duplicating entire classes instead of extracting shared behavior -> Extract base class or shared utility

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Over-engineering with patterns | Apply YAGNI - only use patterns when complexity warrants them |
| DRY violation detected | Extract shared logic into a utility method or base class |

## References

- [Decision Tree details](references/details-decision-tree-solid-principles.md) - must read before selection.
- [code-org-patterns](references/code-org-patterns.md)
- [design-patterns](references/design-patterns.md)


- [Source and related-reading index](references/details-source-reference-index.md)
