# split-ado-search-and-state

> Source: [ado-wit-planning.instructions.md](ado-wit-planning.instructions.md)
> Source hash (LF-normalized original file): `CC5F33115F6FDDD9D1A8C5DE0F3DD141FD06933AD875E11BF0142C1FAAA7AE15`
> Relocation manifest:
- `## Search Keyword and Search Text Protocol` -> original lines 322-437
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

## Search Keyword and Search Text Protocol

Goal: Deterministic, resumable discovery of existing work items.

### Step 1: Maintain Active Keyword Groups

Build an ordered list where each group contains 1-4 specific terms
(multi-word phrases allowed) joined by OR.

### Step 2: Compose Search Text

Format the `searchText` parameter:

- Single group: `(term1 OR "multi word")`
- Multiple groups: `(group1) AND (group2)`

### Step 3: Execute Search and Process Results

Execute a WIQL-backed Azure CLI search and limit downstream review to roughly 50 results.

Filter results to identify candidates for similarity assessment:

- Search highlights contain terms matching the planned item core concepts
- Work item type is the same or one level above/below
- Work item is not already linked to the planned item

Assess the candidates by relevance. For each candidate:

1. Fetch full work item using `az boards work-item show` and update planning-log.md.
2. Perform similarity assessment.
3. Assign action using the Similarity Categories table.
4. Record the assessment in planning-log.md.

### Similarity Assessment

Analyze the relationship between the planned work item and each discovered item:

1. Title comparison: Identify the core intent. Determine whether they describe the
   same goal or outcome.
2. Description comparison: Examine whether they address the same problem or user need.
3. Acceptance criteria comparison: Evaluate whether completing one would satisfy the
   requirements of the other.

### Similarity Categories

| Category  | Meaning                                              | Action                           |
|-----------|------------------------------------------------------|----------------------------------|
| Match     | Same work item; creating both would duplicate effort | Update existing item             |
| Similar   | Related enough that consolidation may be appropriate | Review with user before deciding |
| Distinct  | Different items with minimal overlap                 | Create new item                  |
| Uncertain | Insufficient information or conflicting signals      | Request user guidance            |

### Human Review Triggers

Request user guidance when:

- Either item lacks a title or description
- Discovered item lacks acceptance criteria and is a different work item type
- Title suggests alignment but acceptance criteria diverge significantly
- Work item types differ by more than one abstraction level
- Domain-specific terminology requires expert interpretation
- The relationship is genuinely ambiguous after analysis

## State Persistence Protocol

Update planning-log.md as information is discovered to ensure continuity when context
is summarized.

### Pre-Summarization Capture

Before summarization occurs, capture in planning-log.md:

- Full paths to all working files with a summary of each file purpose
- Any uncaptured information that belongs in planning files
- Work item IDs already reviewed and pending review
- Current phase and remaining steps
- Outstanding search criteria

### Post-Summarization Recovery

When context contains a summary with only one tool call, recover state before
continuing:

1. List the working folder under
   `.copilot-tracking/workitems/<planning-type>/<artifact-normalized-name>/`.
2. Read planning-log.md to rebuild context.
3. Notify the user that context is being rebuilt and confirm the approach.

Recovery notification format:

```markdown
## Resuming After Context Summarization

Context history was summarized. Rebuilding from planning files:

[ANALYZING]: [planning-log.md summary]

Next steps:
* [Planned actions]

Proceed with this approach?
```

## Three-Tier Autonomy Model

| Mode              | Create | Update | Link | State Change |
|-------------------|--------|--------|------|--------------|
| Full              | Auto   | Auto   | Auto | Auto         |
| Partial (default) | Gate   | Auto   | Auto | Gate         |
| Manual            | Gate   | Gate   | Gate | Gate         |

Gate means the agent presents its recommendation and waits for user confirmation
before executing. Auto means the agent executes without prompting.

Autonomy applies to all MCP tool calls that create, modify, or delete ADO entities.
Read-only queries (search, get, list) never require gating.
