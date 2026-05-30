---
inputs:
  epic_title:
    description: 'Title of the low-code solution'
    required: true
    default: ''
  publisher_prefix:
    description: 'Customization prefix (3-8 lowercase chars, e.g. agx)'
    required: true
    default: 'agx'
  author:
    description: 'PRD author'
    required: false
    default: 'Product Manager Agent'
  date:
    description: 'Creation date'
    required: false
    default: '${current_date}'
---

# PRD-LOWCODE: ${epic_title}

**Status**: Draft | Review | Approved
**Author**: ${author}
**Date**: ${date}
**Publisher Prefix**: ${publisher_prefix}

> This is the LOW-CODE PRD variant. Use it when the Architect has chosen Power Platform (Dataverse + Power Automate + optionally Power Apps / Copilot Studio) over pro-code. The low-code-builder agent reads this PRD and emits a deterministic unpacked solution tree.

---

## 1. Problem Statement

What business problem does this solution solve? Who is the maker? Who is the end user?

## 2. Target Users

| Role | Permissions Needed | License |
|------|---------------------|---------|
| (e.g. Issue Reporter) | Create + Read own | Power Apps per-user |
| (e.g. Triager) | Read all, Update Status/Priority | Power Apps per-user |

## 3. Goals & Success Metrics

- (e.g.) Reduce issue triage time from 24h to 1h
- (e.g.) >=80% of new issues notified within 5 minutes

## 4. Tables (Dataverse)

For each table, declare schema name, primary name, ownership, and columns. Schema names MUST start with `<prefix>_`.

### Table: ${publisher_prefix}_<noun>

- **Display Name**:
- **Plural Display Name**:
- **Ownership**: UserOwned | OrganizationOwned
- **Audit Enabled**: yes | no
- **Primary Name Attribute**: `_name` (text, MaxLength 200)

| Column Schema | Display | Type | Required | Notes |
|---------------|---------|------|----------|-------|
| `_<col>` | (e.g. Status) | choice / text / int / lookup / datetime / money | yes/no | choice values, lookup target, MaxLength, etc. |

### Relationships

| From -> To | Cardinality | Cascade on Delete |
|------------|-------------|-------------------|
| `_issue` -> `systemuser` (AssignedTo) | N:1 | RemoveLink |

## 5. Flows (Power Automate)

For each cloud flow:

### Flow: ${publisher_prefix}_<VerbObject>

- **Trigger**: manual | dataverse-row-added | dataverse-row-modified | recurrence | http
- **Trigger Source**: (e.g. `_issue` row added)
- **Connectors Used**: (e.g. shared_commondataserviceforapps, shared_office365)
- **Steps** (high level):
  1. Get full row
  2. Look up assigned user
  3. Send email (or Teams message)
  4. Update row status (if applicable)
- **Error Handling**: scope + runAfter failure handler? yes | no
- **Environment Variables Used**: (e.g. `_NotificationFromAddress`)

## 6. Choices (Global Option Sets)

| Choice Schema | Values |
|---------------|--------|
| `_priority` | Low (10001), Medium (10002), High (10003) |

## 7. Security Roles

| Role | Tables | Privileges |
|------|--------|------------|
| (e.g. Issue Reporter) | `_issue` | Create (user), Read (user), Append (user) |

MVP MAY rely on out-of-box roles. Document custom roles only if needed.

## 8. Environment Variables

| Name | Type | Default Value | Purpose |
|------|------|---------------|---------|
| `_NotificationFromAddress` | string | (none) | Sender for email notifications |

## 9. Connection References

| Logical Name | Connector | Purpose |
|--------------|-----------|---------|
| `_sharedoffice365` | shared_office365 | Outlook email |
| `_sharedcommondataserviceforapps` | shared_commondataserviceforapps | Dataverse |

## 10. DLP and Licensing

- **Target Environment Type**: production | sandbox | trial
- **DLP Policy**: list connectors and their business/non-business classification
- **License Requirements**: Power Apps per-user / per-app / pay-as-you-go; premium connectors if any

## 11. Out of Scope

- Canvas app (deferred to Phase 2)
- Copilot Studio agent (deferred to Phase 2)
- Custom plug-ins / web resources

## 12. Open Questions

- (List anything blocking the builder)