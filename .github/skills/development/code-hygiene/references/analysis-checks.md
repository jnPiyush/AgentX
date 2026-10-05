# Parallel Analysis Checks

Reference for the [code-hygiene skill](../SKILL.md).

Launch three analysis sub-tasks IN PARALLEL. Each receives the file list and diff content, and returns structured findings as text.

### Pass 1: Code Quality

Analyze for complexity and abstraction issues:

1. **Unnecessary complexity**
   - Deep nesting (>3 levels) that could use early returns
   - Nested ternary operators
   - Dense one-liners sacrificing readability

2. **Redundant abstractions**
   - Interfaces/types used only once -- inline them
   - Wrapper functions adding no logic
   - Abstract base classes with a single implementation
   - Premature generalization

3. **YAGNI violations**
   - Features not required by current use cases
   - Configuration options nobody uses
   - Generic solutions for specific problems

4. **Dead weight**
   - Commented-out code blocks (>3 lines)
   - Unused imports, variables, or functions
   - Duplicate error checks (caller already validates)
   - Defensive code that can never trigger

5. **Over-engineering**
   - Factory patterns for creating a single type
   - Strategy patterns with one strategy
   - Event systems for synchronous single-consumer flows
   - Dependency injection where direct instantiation is clearer

**Output format:** Structured findings with file, line, issue, severity, fix_safe flag, and suggested fix.

### Pass 2: Comment Quality

Analyze for comment issues:

1. **Obvious restatements**
   - `// increment counter` above `counter++`
   - Comments repeating the function/variable name in prose

2. **AI-generated filler phrases** (hard bans)
   - "This function is responsible for handling..."
   - "The following code implements..."
   - "This is a comprehensive solution that..."
   - "This method provides a robust and scalable..."
   - "leverages" or "utilizes" (when "uses" works)
   - "seamlessly integrates"
   - "This class encapsulates the logic for..."

3. **Factual inaccuracy**
   - Documented parameters not matching the signature
   - Return type descriptions not matching the actual return
   - Edge case documentation for cases not handled

4. **Stale comments**
   - TODOs/FIXMEs for completed work
   - References to removed/renamed functions
   - Version-specific notes for unsupported versions
   - "Temporary" markers on permanent code

5. **Over-documentation**
   - JSDoc/docstrings on trivial getters/setters
   - Multi-line comments on self-explanatory one-liners
   - Repeating type information already in the signature

### Pass 3: UI Quality (only when UI files in scope)

Analyze UI files for generic, templated patterns:

1. **Generic color patterns**
   - Purple-to-blue gradients (AI default palette)
   - Gratuitous gradients on everything
   - Unintentional color usage (decorative, not semantic)

2. **Template layouts**
   - Default card grids with uniform spacing and no hierarchy
   - Generic hero sections with no point of view
   - Uniform radius, spacing, and shadows across every component

3. **Missing interaction states**
   - No hover states on interactive elements
   - No focus states (accessibility gap)
   - No loading/empty/error states

4. **Lazy defaults**
   - Unmodified library defaults with no customization
   - Default font stacks with no intentional pairing
   - Excessive scroll-triggered animations

5. **No visual hierarchy**
   - Flat layouts with no layering or depth
   - Uniform emphasis on everything
   - No intentional rhythm in spacing
