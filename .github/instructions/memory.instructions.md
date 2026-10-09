---
description: 'Cross-session memory: read known facts at start, persist decisions at end.'
applyTo: '**'
---

# Cross-Session Memory

## At Session Start

Use supplied notes first; read only missing task-relevant memory. Do not reload
all notes each turn. Missing memory does not block work. `/memories/` belongs to
the host memory tool, not an assumed filesystem root.

## During Work

Save verified decisions and pitfalls, not tool transcripts. Read the target before
writing; deduplicate and preserve concurrent edits. Keep repository facts in repo
memory, preferences in user memory, and temporary progress in session memory.

## At Session End

Verify each save before claiming "saved". On failure/timeout, allow at most one
bounded retry after diagnosis, never an unchanged retry loop. Defer optional
memory and continue authorized work. Do not bypass storage restrictions.

AGENTS.md still governs required Compound Capture: use a repository learning
artifact when host memory is unavailable, without inventing success or a skip.
`lessons promote` explicitly promotes artifacts; it does not replace host saves.

## Memory File Format

Use short factual bullets with a date and evidence/source; label uncertainty.

