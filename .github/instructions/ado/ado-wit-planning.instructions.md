---
name: 'ADO Work Item Planning'
description: 'Reference specification for Azure DevOps work item planning files, templates, field definitions, and search protocols -- adapted for AgentX.'
applyTo: '**/.copilot-tracking/workitems/**'
---

# Azure DevOps Work Items Planning File Instructions

## Purpose and Scope

This file is a reference specification that defines templates, field conventions,
and search protocols for work item planning files. Workflow files consume this
specification by including a cross-reference at the top of their content.

Cross-reference pattern for consuming files:

```markdown
Follow all instructions from
#file:.github/instructions/ado/ado-wit-planning.instructions.md while executing
this workflow.
```

## MCP ADO Tools

Work item operations reference these MCP ADO tools:

Discovery and retrieval:

- `mcp_ado_search_workitem`: Search work items by text, project, type, or state.
  Key params: `searchText` (required), `project`, `workItemType`, `state`, `top`, `skip`.
- `mcp_ado_wit_get_work_item`: Retrieve a single work item.
  Key params: `id` (required), `project` (required), `expand`, `fields`.
- `mcp_ado_wit_get_work_items_batch_by_ids`: Retrieve multiple work items.
  Key params: `ids` (required), `project` (required), `fields`.
- `mcp_ado_wit_my_work_items`: Retrieve work items assigned to or modified by the
  current user. Key params: `project` (required), `type` (assignedtome or myactivity),
  `includeCompleted` (boolean, default false), `top` (default 50).
- `mcp_ado_wit_get_work_items_for_iteration`: Retrieve work items for a specific sprint.
  Key params: `project` (required), `iterationId` (required), `team`.
- `mcp_ado_wit_list_backlog_work_items`: List backlog items not assigned to an iteration.
  Key params: `project` (required), `team`, `backlogId`.
- `mcp_ado_wit_list_backlogs`: List available backlogs for a project.
  Key params: `project` (required), `team`.
- `mcp_ado_wit_get_query_results_by_id`: Execute a saved ADO query by ID or path.
  Key params: `id` (required), `project`, `team`, `responseType` (full or ids), `top`.

Iteration:

- `mcp_ado_work_list_team_iterations`: List team iterations and sprints.
  Key params: `project` (required), `team`, `timeframe`.

Creation and updates:

- `mcp_ado_wit_create_work_item`: Create a new work item.
  Key params: `project` (required), `workItemType` (required),
  `fields` (required array of name/value pairs).
- `mcp_ado_wit_add_child_work_items`: Add child items to a parent.
  Key params: `parentId` (required), `project` (required), `workItemType` (required),
  `items` (required array).
- `mcp_ado_wit_update_work_item`: Update a single work item.
  Key params: `id` (required), `updates` (required array with path/value).
- `mcp_ado_wit_update_work_items_batch`: Batch update multiple items.
  Key params: `updates` (required array with id/path/value).

Relationships and linking:

- `mcp_ado_wit_work_items_link`: Link work items together.
  Key params: `project` (required), `updates` (required array with id/linkToId/type).
- `mcp_ado_wit_add_artifact_link`: Add artifact links (branch, commit, build).
  Key params: `workItemId` (required), `project` (required), `linkType`.

History and comments:

- `mcp_ado_wit_list_work_item_comments`: List comments on a work item.
  Key params: `workItemId` (required), `project` (required).
- `mcp_ado_wit_list_work_item_revisions`: Get revision history.
  Key params: `workItemId` (required), `project` (required), `top`.
- `mcp_ado_wit_add_work_item_comment`: Add a comment.
  Key params: `workItemId` (required), `project` (required), `comment` (required).

Identity:

- `mcp_ado_core_get_identity_ids`: Resolve identity GUIDs from email or name.
  Key params: `searchFilter` (required, email or name string).

## Planning File Definitions and Directory Conventions

Root planning workspace structure:

```
.copilot-tracking/
  workitems/
    <planning-type>/
      <artifact-normalized-name>/
        artifact-analysis.md    # Human-readable table + recommendations
        work-items.md           # Human/Machine-readable plan (source of truth)
        handoff.md              # Handoff for work item execution
        planning-log.md         # Structured operational and state log
```

Valid `<planning-type>` values:

- `discovery`: Work item discovery from artifacts, PRDs, or user requests
- `prds`: PRD-driven work item hierarchy planning
- `pr`: Pull request work item linking and validation
- `sprint`: Sprint planning and work item organization
- `triage`: Backlog refinement and prioritization
- `execution`: Direct work item create/update operations
- `current-work`: Active task planning

Normalization rules for `<artifact-normalized-name>`:

- Use lower-case, hyphenated base filename without extension.
  Example: `docs/artifacts/prd/Customer Onboarding.md` becomes
  `docs--customer-onboarding-prd`.
- Replace spaces and punctuation with hyphens.
- Choose the primary artifact when multiple artifacts are provided.

## Planning File Requirements

Planning markdown files start with:

```markdown
<!-- markdownlint-disable-file -->
<!-- markdown-table-prettify-ignore-start -->
```

Planning markdown files end with:

```markdown
<!-- markdown-table-prettify-ignore-end -->
```

## artifact-analysis.md

Create artifact-analysis.md when beginning work item discovery from PRDs, user
requests, or codebase artifacts. This file captures the human-readable analysis of
planned work items before finalizing in work-items.md.

### Template

```markdown
# [Planning Type] Work Item Analysis - [Summarized Title]
* **Artifact(s)**: [e.g., docs/artifacts/prd/PRD-42.md]
* **Project**: [Project Name]
* **Area Path**: [(Optional) Area Path]
* **Iteration Path**: [(Optional) Iteration Path]

## Planned Work Items

### WI[Reference Number] - [Create|Update|No Change] - [Summarized Work Item Title]
* **Working Title**: [Single line value]
* **Working Type**: [Supported Work Item Type]
* **Key Search Terms**: [Keyword groups for finding related items]
* **Working Description**:
  ```markdown
  [Evolving description content]
  ```
* **Working Acceptance Criteria**:
  ```markdown
  * [Acceptance criterion 1]
  * [Acceptance criterion 2]
  ```
* **Found Work Item Field Values**:
  * [Work Item Field]: [Value]
* **Suggested Work Item Field Values**:
  * [Work Item Field]: [Value]

#### WI[Reference Number] - Related and Discovered Information
* [Functional or Non-Functional Requirements blocks]
* [Key Details blocks]
* [(Optional) Related Codebase blocks]

## Notes
* [(Optional) Notes worth mentioning]
```

## work-items.md

work-items.md is the source of truth for planned work item operations. Capture the
`System.State` field for every referenced work item, highlighting `Resolved` items.
When a `Resolved` User Story satisfies the requirement without updates, keep the
action as No Change and add a `Related` link from any new stories back to that item.

### Template

```markdown
# Work Items
* **Project**: [projects field for mcp ado tool]
* **Area Path**: [(Optional) areaPath field for mcp ado tool]
* **Iteration Path**: [(Optional) iterationPath field for mcp ado tool]
* **Repository**: [(Optional) repository field for mcp ado tool]

## WI[Reference Number] - [Action: Create|Update|No Change] - [Summarized Title]
[1-5 Sentence Explanation of Change]

[(Optional) WI[Reference Number] - Similarity: [System.Id=Category]]

* WI[Reference Number] - [Single-line fields]: [Value]

### WI[Reference Number] - [Multi-line fields]
```[format: markdown or html]
[Multi Line Value]
```

### WI[Reference Number] - Relationships
* WI[Reference Number] - [Link Type] - [Relation ID]: [Reason]
```

## planning-log.md

planning-log.md is a living document with sections that are routinely added,
updated, extended, and removed in-place.

Phase tracking applies when the consuming workflow file defines phases:

- Track all new, in-progress, and completed steps for each phase.
- Update the Status section with in-progress review of completed and proposed steps.
- Update Previous Phase when moving to any other phase.
- Update Current Phase and Previous Phase when transitioning phases.

### Template

```markdown
# [Planning Type] - Work Item Planning Log
* **Project**: [projects field for mcp ado tool]
* **Repository**: [(Optional) repository field for mcp ado tool]
* **Previous Phase**: [(Optional) Phase-1, Phase-2, N/A, Just Started]
* **Current Phase**: [Phase-1, Phase-2, N/A, Just Started]

## Status
[e.g., 1/20 docs reviewed, 0/10 code files reviewed, 2/5 ado wit searched]

**Summary**: [e.g., Searching for ADO Work Items based on keywords]

## Discovered Artifacts and Related Files
* AT[Reference Number] [relative/path/to/file] - [Not Started|In-Progress|Complete] - [Processing|Related|N/A]

## Discovered ADO Work Items
* ADO-[ADO Work Item ID] - [Not Started|In-Progress|Complete] - [Processing|Related|N/A]

## Work Items
### **WI[Reference Number]** - [WorkItemType] - [In-Progress|Complete]
* WI[Reference Number] - Work Item Section (see artifact-analysis.md)
* Working Search Keywords: [Keywords]
* Related ADO Work Items - Similarity: [System.Id=Category (Rationale)]
* Suggested Action: [Create|Update|No Change]
```

## handoff.md

### Template

```markdown
# Work Item Handoff
* **Project**: [projects field for mcp ado tool]
* **Repository**: [(Optional) repository field for mcp ado tool]

## Planning Files:
  * .copilot-tracking/workitems/<planning-type>/<artifact-normalized-name>/handoff.md
  * .copilot-tracking/workitems/<planning-type>/<artifact-normalized-name>/work-items.md
  * .copilot-tracking/workitems/<planning-type>/<artifact-normalized-name>/planning-log.md

## Summary
* Total Items: [N]
* Actions: create [N], update [N], no change [N]
* Types: [Work Item Type] [N]

## Work Items - work-items.md
* [ ] (Create) [(Optional) **Needs Review**] WI[Reference Number] [Work Item Type]
  * [(Optional) WI[Reference Number] Relationships]
  * [Summary]
* [ ] (Update) [(Optional) **Needs Review**] WI[Reference Number] [Work Item Type] - System.Id [ADO Work Item ID]
  * [(Optional) WI[Reference Number] Relationships]
  * [Summary]
* [ ] (No Change) WI[Reference Number] [Work Item Type] - System.Id [ADO Work Item ID]
  * [Summary]
```

Handoff file requirements:

- Include a reference to each work item defined in work-items.md.
- Order entries with Create actions first, Update actions second, No Change last.
- Include a markdown checkbox next to each work item with a summary.
- Include project-relative paths to all planning files.
- Update the Summary section whenever the Work Items section changes.

## Work Item Fields

Core: System.Id, System.WorkItemType, System.Title, System.State, System.Reason,
System.Parent, System.AreaPath, System.IterationPath, System.TeamProject,
System.Description, System.AssignedTo, System.CreatedBy, System.CreatedDate,
System.ChangedBy, System.ChangedDate, System.CommentCount

Board: System.BoardColumn, System.BoardColumnDone, System.BoardLane

Classification: System.Tags

Common Extensions: Microsoft.VSTS.Common.AcceptanceCriteria,
Microsoft.VSTS.TCM.ReproSteps, Microsoft.VSTS.Common.Priority,
Microsoft.VSTS.Common.StackRank, Microsoft.VSTS.Common.ValueArea,
Microsoft.VSTS.Common.BusinessValue, Microsoft.VSTS.Common.Risk,
Microsoft.VSTS.Common.Severity

Estimation: Microsoft.VSTS.Scheduling.StoryPoints,
Microsoft.VSTS.Scheduling.OriginalEstimate, Microsoft.VSTS.Scheduling.RemainingWork,
Microsoft.VSTS.Scheduling.CompletedWork, Microsoft.VSTS.Scheduling.Effort

| Type       | Key Fields                                                                                      |
|------------|-------------------------------------------------------------------------------------------------|
| Epic       | System.Title, System.Description, System.AreaPath, System.IterationPath, Microsoft.VSTS.Common.BusinessValue, Microsoft.VSTS.Common.ValueArea, Microsoft.VSTS.Common.Priority, Microsoft.VSTS.Scheduling.Effort |
| Feature    | System.Title, System.Description, System.AreaPath, System.IterationPath, Microsoft.VSTS.Common.ValueArea, Microsoft.VSTS.Common.BusinessValue, Microsoft.VSTS.Common.Priority |
| User Story | System.Title, System.Description, Microsoft.VSTS.Common.AcceptanceCriteria, Microsoft.VSTS.Scheduling.StoryPoints, Microsoft.VSTS.Common.Priority, Microsoft.VSTS.Common.ValueArea |
| Bug        | System.Title, Microsoft.VSTS.TCM.ReproSteps, Microsoft.VSTS.Common.Severity, Microsoft.VSTS.Common.Priority, Microsoft.VSTS.Common.StackRank, Microsoft.VSTS.Common.ValueArea, System.AreaPath, System.IterationPath |
| Task       | System.Title, System.Description, System.AssignedTo, Microsoft.VSTS.Scheduling.RemainingWork, Microsoft.VSTS.Scheduling.OriginalEstimate, Microsoft.VSTS.Scheduling.CompletedWork |

Rules:

- Feature requires Epic parent.
- User Story requires Feature parent.
- Bug links are optional; add relationships when they provide helpful traceability.

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

Execute `mcp_ado_search_workitem` with a page size of 50.

Filter results to identify candidates for similarity assessment:

- Search highlights contain terms matching the planned item core concepts
- Work item type is the same or one level above/below
- Work item is not already linked to the planned item

Assess the candidates by relevance. For each candidate:

1. Fetch full work item using `mcp_ado_wit_get_work_item` and update planning-log.md.
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

## Content Sanitization Guards

Apply these guards before any ADO API call that writes user-visible content
(work item descriptions, comments, field updates).

### Local-Only Path Guard

Detect `.copilot-tracking/` paths in outbound content. When found:

1. Read the referenced file to extract relevant details.
2. Replace the path with an inline summary of the extracted details.
3. Never send `.copilot-tracking/` paths to ADO APIs.

### Planning Reference ID Guard

Detect `WI` followed by digits (WI001, WI002, etc.) in outbound content. When found:

1. If the WI reference maps to a known ADO work item ID, replace with the ADO ID
   (for example, `#12345`).
2. If the WI reference has no known mapping, replace with a descriptive phrase.
3. If the WI reference is self-referential, remove it entirely.

Never send planning reference IDs (`WI[NNN]`) to ADO APIs.

## Content Format Detection

Azure DevOps supports two rendering formats for rich-text fields:

| Format   | ADO Version                             | format Parameter Value |
|----------|-----------------------------------------|------------------------|
| Markdown | Azure DevOps Services (dev.azure.com)   | "Markdown"             |
| HTML     | Azure DevOps Server (visualstudio.com)  | "Html"                 |

### Detection Protocol

1. When the user provides a `contentFormat` input, use it directly.
2. When the organization URL contains `dev.azure.com`, use Markdown.
3. When the organization URL contains a custom domain or `visualstudio.com`, use HTML.
4. When the format cannot be determined, default to Markdown and inform the user.

The detected format applies to all `format` parameters in MCP ADO tool calls for
rich-text fields. Record the detected format in planning-log.md.

### Format Conversion

When the detected format is HTML, convert markdown template content to HTML before
writing to ADO fields.

| Markdown              | HTML Equivalent                          |
|-----------------------|------------------------------------------|
| `## Heading`          | `<h2>Heading</h2>`                       |
| `* list item`         | `<ul><li>list item</li></ul>`            |
| `1. ordered item`     | `<ol><li>ordered item</li></ol>`         |
| `- [ ] checkbox item` | `<ul><li>&#9744; checkbox item</li></ul>`|
| `- [x] checked item`  | `<ul><li>&#9745; checked item</li></ul>` |
| `**bold**`            | `<strong>bold</strong>`                  |
| `*italic*`            | `<em>italic</em>`                        |
| `> blockquote`        | `<blockquote>blockquote</blockquote>`    |
