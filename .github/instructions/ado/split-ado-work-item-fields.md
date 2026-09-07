# split-ado-work-item-fields

> Source: [ado-wit-planning.instructions.md](ado-wit-planning.instructions.md)
> Source hash (LF-normalized original file): `CC5F33115F6FDDD9D1A8C5DE0F3DD141FD06933AD875E11BF0142C1FAAA7AE15`
> Relocation manifest:
- `## Work Item Fields` -> original lines 287-320
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

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
