---
description: 'Cross-session memory: read known facts at start, persist decisions at end.'
applyTo: '**'
---

# Cross-Session Memory

## At Session Start

Read `/memories/*.md` files to restore project context, past decisions, and known
pitfalls before beginning any work.

If no memory files exist yet, proceed without them -- they will be created as work
progresses.

## During Work

Note significant decisions, failed approaches, and key facts in `/memories/` as they
occur -- not just at session end. Create or update files as needed:

- `/memories/decisions.md` -- architectural and design decisions
- `/memories/pitfalls.md` -- approaches that failed and why
- `/memories/conventions.md` -- project-specific patterns discovered
- `/memories/session/` -- temporary in-progress notes for this session

## At Session End

Update `/memories/` with:

- Decisions made and rationale (append to `decisions.md`)
- Approaches that failed and why (append to `pitfalls.md`)
- Current state and next steps (update `session/progress.md`)
- Any new project conventions discovered (append to `conventions.md`)

## Memory File Format

Keep entries short and concise -- use brief bullet points, not lengthy prose:

```markdown
<!-- decisions.md -->
- 2025-01-15: Chose PostgreSQL over MongoDB for relational data model (#42)
- 2025-01-16: Using Playwright for E2E tests, not Cypress (team preference)
```

