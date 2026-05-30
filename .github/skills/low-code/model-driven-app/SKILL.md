---
name: "model-driven-app"
description: 'Author Microsoft Power Apps model-driven app source (AppModule, SiteMap, FormXml, SavedQuery views) inside an unpacked Power Platform solution so an agent can generate the navigation, forms, and views that pac solution pack will accept and Dataverse will render. Covers the component-driven UI metadata model that sits on top of Dataverse tables.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["power-platform", "power-apps", "model-driven-apps", "dataverse"]
---

# Power Apps Model-Driven App

> Purpose: emit the metadata that turns a set of Dataverse tables into a navigable model-driven app -- AppModule, SiteMap, forms, and views -- in a form `pac solution pack` accepts.

## When to Use

- Generating a model-driven app (records, forms, views, dashboards over Dataverse) from a PRD-LOWCODE
- Adding a table area/group/subarea to an app's navigation
- Authoring a main form or a public view for a table

## Model-Driven vs Canvas

| | Model-driven | Canvas |
|--|--------------|--------|
| Layout | Component-driven, metadata renders the UI | Pixel-precise, maker draws controls |
| Data | Dataverse only | Dataverse + 1000+ connectors |
| Source | AppModule + SiteMap + FormXml + SavedQuery | *.fx.yaml + CanvasManifest |
| Use for | Process/CRUD apps, dashboards | Tailored task UX, mixed sources |

## On-Disk Layout

```
src/
  AppModules/
    <prefix>_<appname>/
      AppModule.xml          # app shell: name, client type, components
  SiteMaps/
    <sitemapname>.xml        # navigation: Area > Group > SubArea
  Entities/<prefix>_<table>/
    FormXml/
      main/<formid>.xml      # main form layout (tabs, sections, cells)
    SavedQueries/
      <queryid>.xml          # public views (columns, filters, sort)
```

## AppModule.xml (shell)

```xml
<AppModule>
  <UniqueName>agx_issuetrackerapp</UniqueName>
  <Name>Issue Tracker</Name>
  <ClientType>4</ClientType>
  <NavigationType>1</NavigationType>
  <AppComponents>
    <AppComponent type="1" schemaName="agx_issue" />        <!-- table -->
    <AppComponent type="62" schemaName="agx_issue_sitemap" /> <!-- sitemap -->
  </AppComponents>
</AppModule>
```

Every table, form, and view the app shows MUST be listed as an `AppComponent` (or be reachable via the sitemap) or the app errors at runtime with "component not in app".

## SiteMap (navigation)

```xml
<SiteMap>
  <Area Id="agx_area_main" Title="Work">
    <Group Id="agx_group_issues" Title="Issues">
      <SubArea Id="agx_sub_issue" Entity="agx_issue" />
    </Group>
  </Area>
</SiteMap>
```

`SubArea Entity=` binds a nav item to a table's default view + forms. Order of Area/Group/SubArea is the nav order.

## FormXml (main form)

A main form is `tabs > sections > rows > cells`, each cell bound to a column:

```xml
<form>
  <tabs>
    <tab name="general" verticallayout="true">
      <labels><label description="General" languagecode="1033" /></labels>
      <columns>
        <column width="100%">
          <sections>
            <section name="summary" showlabel="false">
              <rows>
                <row><cell><control id="agx_name" classid="{...}" datafieldname="agx_name" /></cell></row>
              </rows>
            </section>
          </sections>
        </column>
      </columns>
    </tab>
  </tabs>
</form>
```

`datafieldname` MUST match a column logical name in the table's `Entity.xml`. `classid` is the well-known control GUID for the column type (text, optionset, lookup, datetime).

## SavedQuery (public view)

```xml
<savedquery>
  <name>Active Issues</name>
  <returnedtypecode>agx_issue</returnedtypecode>
  <querytype>0</querytype>
  <isdefault>1</isdefault>
  <layoutxml>
    <grid name="resultset" object="1">
      <row name="result" id="agx_issueid">
        <cell name="agx_name" width="300" />
        <cell name="agx_status" width="120" />
      </row>
    </grid>
  </layoutxml>
  <fetchxml>
    <fetch>
      <entity name="agx_issue">
        <attribute name="agx_name" />
        <attribute name="agx_status" />
        <filter><condition attribute="statecode" operator="eq" value="0" /></filter>
        <order attribute="agx_name" descending="false" />
      </entity>
    </fetch>
  </fetchxml>
</savedquery>
```

`layoutxml` columns SHOULD be a subset of `fetchxml` attributes. Mismatch renders blank cells.

## Solution Integration

- Add `RootComponent type="80"` (AppModule), `type="62"` (SiteMap) to `Solution.xml`.
- Forms (`type="60"`) and SavedQueries (`type="26"`) usually travel with their table as subcomponents; list them explicitly if added independently.

## Anti-Patterns

- Showing a table/form/view not declared as an AppComponent -- runtime "component not in app" error.
- `datafieldname` / `cell name` that does not match a column logical name -- blank cells.
- Invented `classid` GUIDs -- form fails to render the control.
- Editing form/view metadata for tables not in the same solution -- dependency import failure.

## Related

- [solution-anatomy](../solution-anatomy/SKILL.md) -- AppModules/SiteMaps/Entities placement
- [dataverse-schema](../dataverse-schema/SKILL.md) -- the columns forms and views bind to
- [canvas-app-yaml](../canvas-app-yaml/SKILL.md) -- the canvas alternative