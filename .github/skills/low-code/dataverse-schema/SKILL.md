---
name: "dataverse-schema"
description: 'Author Dataverse table schema (Entity.xml) for unpacked Power Platform solutions. Covers tables, columns, choices, relationships, primary name attribute, ownership, and Solution.xml RootComponent registration.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["dataverse", "power-platform"]
---

# Dataverse Schema (Entity.xml)

> Purpose: emit valid Dataverse table source so `pac solution pack` accepts it and the import creates the table, columns, relationships, and forms cleanly.

## When to Use

- A PRD or spec lists business entities that map to Dataverse tables
- An existing solution needs a new table, column, or relationship
- Reviewing a generated Entity.xml before packaging

## File Layout per Table

```
src/Entities/<prefix>_<tablename>/
  Entity.xml                # the table definition
  FormXml/                  # main form, quick create form, card form
  SavedQueries/             # system views
  Views/                    # advanced find views
```

Folder name MUST match the table `Name` (lowercase, prefixed).

## Entity.xml -- Minimum Skeleton

| Block | Required | Purpose |
|-------|----------|---------|
| `<Entity Name="agx_issue">` | yes | Root, the table schema name. |
| `<EntityInfo>` | yes | Display name, plural display name, description. |
| `<attributes>` | yes | One `<attribute>` per column. Primary name required. |
| `<EntitySetName>` | yes | OData collection name, plural snake. |
| `<IsActivity>` | yes | `0` for normal tables, `1` for activity tables. |
| `<OwnershipTypeMask>` | yes | `1` = UserOwned, `8` = OrganizationOwned. |
| `<IsAuditEnabled>` | recommended | `1` to keep change history. |

## Column (Attribute) Types

Pick the narrowest type that fits. Wrong types are painful to migrate.

| Type | XML `Type` | When to Use | Notes |
|------|------------|-------------|-------|
| Single line of text | `nvarchar` | Short labels, names, ids | `MaxLength` default 100. |
| Multiline text | `ntext` | Descriptions, notes, JSON | `MaxLength` up to 1,048,576. |
| Whole number | `int` | Counts, quantities | Set `MinValue`/`MaxValue`. |
| Decimal | `decimal` | Precision numbers | Set `Precision`. |
| Currency | `money` | Money | Pair with transaction currency. |
| Date and time | `datetime` | Timestamps | `DateTimeBehavior` UserLocal/DateOnly/TimeZoneIndependent. |
| Yes/No | `bit` | Booleans | Provide True/False labels. |
| Choice | `picklist` | Fixed list of options | Local or global option set. |
| MultiSelect Choice | `multiselectpicklist` | Multi-pick fixed list | Global option set only. |
| Lookup | `lookup` | FK to another table | Creates 1:N implicitly. |
| Owner | `owner` | The records owner | Auto-added on UserOwned. |
| File | `file` | Binary blob up to 128 MB | Costs storage. |
| Image | `image` | Profile/cover image | Resized server-side. |

## Primary Name Attribute Rule

Every table MUST declare ONE `<attribute PrimaryName="1">`:

- Type: `nvarchar`, MaxLength 100-300
- Schema name convention: `<prefix>_name`
- Cannot be removed after creation.

## Choice Column (Picklist) Authoring

- **Local picklist**: inline in the table. Use when choices are unique to one table.
- **Global option set**: defined in `src/OptionSets/<prefix>_<name>.xml`. Use when multiple tables share choices.

Each option needs `Value` (5-digit integer starting with `CustomizationOptionValuePrefix`) and a `LocalizedLabel`.

## Relationships

| Cardinality | Mechanism | Where Authored |
|-------------|-----------|----------------|
| 1:N | Lookup column on the N side | Entity.xml on child + `Relationships.xml` entry |
| N:1 | Same as 1:N viewed from the other side | Same |
| N:N | Intersect table | `Relationships.xml` with `ManyToMany` type |

`Relationships.xml` entry MUST include `Name`, `ReferencingEntityName`, `ReferencedEntityName`, and a `Cascade` block. Default safe: `Delete=RemoveLink`, others `NoCascade`. Use `Delete=Cascade` only for true ownership.

## Solution.xml Registration

Every emitted table MUST also add to `src/Other/Solution.xml`:

```xml
<RootComponent type="1" schemaName="agx_issue" behavior="0" />
```

Plus a `type="2"` RootComponent per column. Forgetting this is the number-one cause of "table imports but columns are missing".

## Anti-Patterns

| Anti-Pattern | Why It Fails |
|--------------|--------------|
| `string` instead of `picklist` for fixed lists | No validation; analytics break. |
| `Delete=Cascade` on a reference relationship | Deleting a lookup target wipes unrelated records. |
| Float for currency | Rounding errors compound. |
| Forgetting `EntitySetName` | OData/Power Automate cannot query the table. |
| Local picklist that should have been global | Cannot be reused; values drift. |
| Column schema name without prefix | Cannot be exported back into the solution. |

## Skill Outputs

1. One `Entity.xml` per requested table with correct primary name, ownership, audit settings.
2. Column entries with the narrowest correct type.
3. `Relationships.xml` updates for 1:N and N:N.
4. `RootComponent` entries appended to `Solution.xml`.
5. Optional `OptionSets/<name>.xml` for global choices.

## See Also

- `low-code/solution-anatomy` for Solution.xml structure.
- `low-code/power-automate-flow-json` for flows that trigger on table changes.
- `low-code/pac-cli` for pack/unpack validation.