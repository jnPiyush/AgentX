---
name: "power-automate-flow-json"
description: 'Author Power Automate cloud flow source (Workflows/<name>-FLOW.json) for unpacked Power Platform solutions. Covers triggers, actions, connection references, expressions, runAfter error handling, and the flow GUID convention.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["power-automate", "power-platform", "dataverse"]
---

# Power Automate Cloud Flow JSON

> Purpose: emit a valid Power Automate cloud flow JSON file that `pac solution pack` accepts and the importer turns into a working flow once connections are bound.

## When to Use

- A PRD specifies automation (notify on row create, schedule a job, webhook, send email/Teams message)
- An existing solution needs a new flow added
- Reviewing a generated flow before packaging

## File Naming and Location

```
src/Workflows/<prefix>_<FlowName>-<GUID>.json
```

- `<GUID>`: lowercase hyphenated UUID v4. Generate ONCE per flow and keep it stable across regenerations.
- `<FlowName>`: PascalCase verb + object (`NotifyOnIssueCreated`).
- Every flow MUST be registered in `Solution.xml` with `<RootComponent type="29" schemaName="<guid>" behavior="0" />`.

## Flow JSON Top-Level Shape

```json
{
  "properties": {
    "connectionReferences": { },
    "definition": {
      "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
      "contentVersion": "1.0.0.0",
      "parameters": { },
      "triggers": { },
      "actions": { }
    }
  },
  "schemaVersion": "1.0.0.0"
}
```

The `definition` block is Logic Apps Workflow Definition Language.

## Trigger Shapes

| Trigger | `kind` | Use When |
|---------|--------|----------|
| Manual / button | `Request` / `Button` | User-initiated runs, testing |
| Dataverse row added | `OpenApiConnectionWebhook` (`SubscribeWebhookTrigger`, scope=4) | React to new rows |
| Dataverse row modified | Same with `filteringAttributes` | React to specific column changes |
| Dataverse row deleted | Same with `message=Delete` | Cleanup workflows |
| Recurrence (scheduled) | `Recurrence` with `frequency` + `interval` | Daily, hourly |
| HTTP request | `Request` / `Http` with body `schema` | Webhooks, external callers |

## Action Shapes

| Action | `type` | Notes |
|--------|--------|-------|
| Dataverse - Get row | `OpenApiConnection` / `GetItem` | `entityName` plural, `recordId` from trigger |
| Dataverse - Add row | `CreateRecord` | `item` object with columns |
| Dataverse - Update row | `UpdateRecord` | Pass only changed columns |
| Send email (Outlook) | `shared_office365` / `SendEmailV2` | Use connection reference |
| Post Teams message | `shared_teams` / `PostMessageToConversation` | Channel/chat id from prior step |
| HTTP | `Http` | Use env variables for URLs |
| Condition | `If` | `expression` block |
| Apply to each | `Foreach` | Iterate arrays |
| Compose | `Compose` | Inspect intermediate values |
| Initialize variable | `InitializeVariable` | Do not put inside a loop |
| Scope | `Scope` | Group actions, attach error handling via `runAfter` |
| Terminate | `Terminate` | End with `Succeeded`, `Failed`, `Cancelled` |

## Connection References

Flows MUST NOT hardcode a connection. Each connector usage references a symbolic name at the flow root:

```json
"connectionReferences": {
  "shared_office365": {
    "connection": { "connectionReferenceLogicalName": "agx_sharedoffice365" },
    "api": { "name": "shared_office365" }
  }
}
```

The matching `connectionreferences.json` at the solution root maps each logical name to a display name and connector id. The importer prompts the maker to bind each one.

## Expressions

Power Automate uses Workflow Definition Language expressions inside `@{...}`:

| Need | Expression |
|------|------------|
| Trigger output column | `@triggerOutputs()?['body/agx_severity']` |
| Action output column | `@outputs('Get_Issue')?['body/agx_name']` |
| Current UTC | `@utcNow()` |
| String concat | `@concat('Issue ', triggerOutputs()?['body/agx_name'])` |
| Conditional | `@if(equals(...), 'High', 'Normal')` |
| Environment variable | `@parameters('agx_NotificationEmail')` |

Never hardcode user emails, URLs, or env-specific values. Use environment variables.

## runAfter and Error Handling

Every action has a `runAfter` block declaring dependencies and outcomes (`Succeeded`, `Failed`, `Skipped`, `TimedOut`):

```json
"Send_Failure_Email": {
  "runAfter": { "Update_Issue": ["Failed", "TimedOut"] },
  "type": "OpenApiConnection"
}
```

Pattern: wrap risky work in a `Scope`; add a sibling `Scope` named `Handle_Errors` with `runAfter` failure outcomes. That is the equivalent of try/catch.

## Anti-Patterns

| Anti-Pattern | Why It Fails |
|--------------|--------------|
| Hardcoded user email in `To` | Breaks on import; not GDPR-safe. |
| Inline connection instead of connection reference | Cannot be exported back; flow breaks across envs. |
| Mutating GUID across regenerations | Creates a duplicate flow on import; original orphaned. |
| Polling with `Until` against Dataverse | Burns API calls; use `SubscribeWebhookTrigger`. |
| `Initialize variable` inside a loop | Errors on second iteration. |
| Hardcoded HTTP URL | Use environment variables. |
| Missing `runAfter` failure handler | Silent failures. |

## Skill Outputs

1. One `<prefix>_<FlowName>-<GUID>.json` per requested flow.
2. Connection references for every connector used.
3. Updates to root `connectionreferences.json`.
4. `RootComponent type="29"` entry in `Solution.xml`.
5. Environment variable definitions for any external endpoint or recipient.

## See Also

- `low-code/solution-anatomy` for connection reference and env variable plumbing.
- `low-code/dataverse-schema` for tables that flow triggers/actions reference.
- `low-code/pac-cli` for validation.