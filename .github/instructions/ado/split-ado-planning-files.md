# split-ado-planning-files

> Source: [ado-wit-planning.instructions.md](ado-wit-planning.instructions.md)
> Source hash (LF-normalized original file): `CC5F33115F6FDDD9D1A8C5DE0F3DD141FD06933AD875E11BF0142C1FAAA7AE15`
> Relocation manifest:
- `## Planning File Definitions and Directory Conventions` -> original lines 85-207
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

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
* **Project**: [ADO project name]
* **Area Path**: [(Optional) area path]
* **Iteration Path**: [(Optional) iteration path]
* **Repository**: [(Optional) repository name]

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
