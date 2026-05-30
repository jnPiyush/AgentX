---
name: "canvas-app-yaml"
description: 'Author Microsoft Power Apps canvas app source as unpacked *.fx.yaml + CanvasManifest.json so an agent can generate Power Fx screens that pac canvas pack and pac solution pack will accept. Covers the Src/ YAML control tree, Power Fx formula syntax, App OnStart, screens, data sources, components, and the round-trip with pac canvas unpack/pack.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["power-platform", "power-apps", "canvas-apps", "power-fx"]
---

# Power Apps Canvas App YAML

> Purpose: emit canvas app source that round-trips through `pac canvas unpack` / `pac canvas pack` and packs into a solution under `CanvasApps/`.

## When to Use

- Generating a canvas app (forms, galleries, screens over Dataverse or other data) from a PRD-LOWCODE
- Editing screen logic or controls in an existing unpacked app
- Reviewing Power Fx before packaging

## On-Disk Layout (after `pac canvas unpack`)

```
CanvasApps/
  <prefix>_<appname>_<DocumentUri>/
    CanvasManifest.json     # app metadata, dependencies, data sources, app-level Power Fx
    Src/
      App.fx.yaml           # App.OnStart, App.Formulas, named formulas
      <ScreenName>.fx.yaml  # one file per screen, control tree + Power Fx
      Component/            # reusable canvas components
    Assets/                 # images, media
    Connections/            # data source connection metadata
    DataSources/            # *.json per data source (table, connector)
```

`pac canvas pack --sources ./Src --msapp build/app.msapp` rebuilds the `.msapp`, which `pac solution pack` then embeds.

## The Src YAML Control Tree

Each screen is a YAML tree. Indentation defines nesting. Each control has `Control:` and a properties block. Power Fx expressions are prefixed with `=`.

```yaml
Screens:
  HomeScreen:
    Properties:
      Fill: =RGBA(248, 249, 250, 1)
    Children:
      - TitleLabel:
          Control: Label@2.5.1
          Properties:
            Text: ="Issues"
            Size: =24
            FontWeight: =FontWeight.Semibold
      - IssueGallery:
          Control: Gallery@2.15.0
          Variant: galleryVertical
          Properties:
            Items: =SortByColumns(Filter(Issues, Status.Value = "Open"), "agx_duedate")
            OnSelect: =Set(varSelected, ThisItem)
          Children:
            - TitleRow:
                Control: Label@2.5.1
                Properties:
                  Text: =ThisItem.agx_name
```

Rules:
- `Control: <Name>@<version>` -- the version must match a control the target environment ships. Use current GA versions; do not invent.
- Property values are Power Fx, always `=`-prefixed.
- `Children:` is an ordered list; z-order follows list order.

## Power Fx Essentials

| Need | Pattern |
|------|---------|
| App state | `Set(varName, value)` (global), `UpdateContext({x: 1})` (screen-scoped) |
| Named formula (preferred over OnStart) | In `App.Formulas`: `varTheme = RGBA(...);` |
| Filter a table | `Filter(Issues, Status.Value = "Open")` |
| Sort | `SortByColumns(source, "col", SortOrder.Ascending)` |
| Lookup single row | `LookUp(Issues, agx_issueid = varId)` |
| Patch (create/update) | `Patch(Issues, Defaults(Issues), {agx_name: txtTitle.Text})` |
| Navigate | `Navigate(DetailScreen, ScreenTransition.Cover)` |
| Choice column value | `ThisItem.Status.Value` (display), bind via the choice record |

Prefer **named formulas** (`App.Formulas`) and **delegable** queries (Filter/Sort on Dataverse columns) over `OnStart` + `ClearCollect` of whole tables, which breaks past 2000 rows.

## CanvasManifest.json (key fields)

```json
{
  "FormatVersion": "0.24",
  "Properties": { "Id": "<guid>", "Name": "<prefix>_<appname>" },
  "PublishInfo": { "AppName": "Issue Tracker" },
  "AppPreviewFlagsMap": { "delegationforalltabularsources": true },
  "DataSources": [ { "Name": "Issues", "Type": "NativeCDSDataSourceInfo" } ]
}
```

## Solution Integration

- The app folder name embeds a `DocumentUri` GUID -- keep it stable across regenerations.
- Add a `RootComponent type="300"` (Canvas App) entry to `Solution.xml`.
- Data sources that point at Dataverse tables create implicit dependencies; ensure those tables are in the same solution or referenced.

## Anti-Patterns

- Inventing `Control@version` numbers -- packing fails or the control renders blank.
- `ClearCollect(coll, Filter(BigTable, ...))` of large tables in `OnStart` -- delegation warning + truncation at 2000 rows.
- Hardcoding environment-specific GUIDs in formulas -- use connection references and environment variables.
- Editing the `.msapp` binary directly -- always edit `Src/*.fx.yaml` and re-pack.

## Verify

```bash
pac canvas pack --sources ./Src --msapp build/app.msapp   # must succeed
```

## Related

- [solution-anatomy](../solution-anatomy/SKILL.md) -- where CanvasApps/ sits in the tree
- [dataverse-schema](../dataverse-schema/SKILL.md) -- the tables a canvas app binds to
- [pac-cli](../pac-cli/SKILL.md) -- pac canvas unpack/pack