---
name: "security-roles"
description: 'Author Microsoft Dataverse security roles and related access control -- privilege depth (User/BU/Parent/Org), table-level CRUD privileges, field security profiles, business units, and teams -- inside an unpacked solution so an agent can generate least-privilege access that pac solution pack accepts. Covers the Dataverse authorization model that every app, flow, and portal honors.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["power-platform", "dataverse", "security"]
---

# Dataverse Security Roles

> Purpose: emit Dataverse security roles + field security that enforce least privilege across every surface (model-driven, canvas, flows, plugins, portals all honor them).

## When to Use

- Defining who can read/write each table for an app from a PRD-LOWCODE
- Adding a least-privilege role for a new persona
- Reviewing whether a role over-grants Org-wide access

## The Model: Privilege x Access Level

A role grants, per table, a set of **privileges** (Create, Read, Write, Delete, Append, AppendTo, Assign, Share) each at an **access level (depth)**:

| Level | Symbol | Scope |
|-------|--------|-------|
| None | (none) | No access |
| User | Basic | Own records + shared with the user |
| Business Unit | Local | Records in the user's BU |
| Parent: Child BU | Deep | User's BU + child BUs |
| Organization | Global | All records |

Least privilege = the smallest depth that meets the requirement. Default to User/Basic; escalate only with justification.

## On-Disk Layout

```
src/
  Roles/<rolename>/<rolename>.xml   # RolePrivileges: table + privilege + accessright(level)
  FieldSecurityProfiles/<name>.xml  # column-level read/update/create permissions
```

```xml
<Role>
  <RoleName>Issue Contributor</RoleName>
  <RolePrivileges>
    <RolePrivilege name="prvCreateagx_issue" level="Basic" />
    <RolePrivilege name="prvReadagx_issue"   level="Local" />
    <RolePrivilege name="prvWriteagx_issue"  level="Basic" />
  </RolePrivileges>
</Role>
```

Privilege names follow `prv<Action><tablelogicalname>`. `level` is `Basic|Local|Deep|Global`.

## Field Security (Column Level)

For sensitive columns (set `IsSecured=true` on the column in `Entity.xml`), a **Field Security Profile** grants per-column Read/Update/Create to users/teams. A table-level Read does not reveal a secured column unless the profile grants it.

## Business Units & Teams

- **Business units**: the ownership hierarchy that Local/Deep depths key off. Keep the BU tree shallow and meaningful.
- **Teams** (owner or access): grant roles/records to groups; use for cross-BU sharing without escalating to Org depth.

## Anti-Patterns

- Granting Org/Global depth "to make it work" -- the most common over-grant; start at Basic and raise only as needed.
- One mega-role for all personas -- compose small roles instead; users can hold several.
- Ignoring Append/AppendTo -- relating records (e.g. notes, child rows) needs both sides; missing them causes silent failures.
- Securing a column without a field security profile -- nobody (including makers) can see it.
- Editing roles for tables outside the solution -- import dependency errors.

## Verify

```bash
pac solution pack ...   # role + FSP XML must pack
# Assign the role to a test user and confirm they can do exactly what is intended -- no more.
```

## Related

- [dataverse-schema](../dataverse-schema/SKILL.md) -- tables/columns and IsSecured
- [solution-anatomy](../solution-anatomy/SKILL.md) -- Roles/ and FieldSecurityProfiles/ placement
- [power-pages](../power-pages/SKILL.md) -- portal web roles vs Dataverse roles