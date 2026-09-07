# split-ado-planning-log-and-handoff

> Source: [ado-wit-planning.instructions.md](ado-wit-planning.instructions.md)
> Source hash (LF-normalized original file): `CC5F33115F6FDDD9D1A8C5DE0F3DD141FD06933AD875E11BF0142C1FAAA7AE15`
> Read routing: load this companion before editing `planning-log.md` or `handoff.md`, and for the exact cross-section fence that starts in the `work-items.md` template and closes in the planning-log template block.
> Relocation manifest:
- `## planning-log.md` -> original lines 209-285
> - Cross-section template fence -> original lines 207-247
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

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
* **Project**: [ADO project name]
* **Repository**: [(Optional) repository name]
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
* **Project**: [ADO project name]
* **Repository**: [(Optional) repository name]

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

## Cross-Section Fence Preservation

The original `work-items.md` template includes a fence that opens before the
`planning-log.md` heading and closes after the planning-log template. That full
fence is retained verbatim below so fence-aware preservation checks can account
for the original boundary without splitting inside code.

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
* **Project**: [ADO project name]
* **Repository**: [(Optional) repository name]
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
