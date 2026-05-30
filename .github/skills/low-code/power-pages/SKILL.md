---
name: "power-pages"
description: 'Author Microsoft Power Pages site source (web pages, templates, content snippets, web roles, table permissions, Liquid templating, basic forms and lists) so an agent can generate an external-facing Dataverse-backed website that pac pages download/upload round-trips. Covers the website-as-data model where pages and styling are Dataverse rows.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["power-platform", "power-pages", "dataverse", "liquid"]
---

# Power Pages Site Source

> Purpose: emit Power Pages site source that `pac pages upload` accepts -- pages, templates, snippets, security -- backed by Dataverse, with Liquid templating and secure table access.

## When to Use

- Generating an external/partner/customer portal over Dataverse from a PRD-LOWCODE
- Adding a page, web template, or secured list/form to an existing site
- Reviewing table permissions and web roles before go-live

## Mental Model: The Site IS Data

Power Pages content lives in Dataverse tables (`adx_*` / `mspp_*`), not files. `pac pages download` materializes it to disk as YAML + content files; `pac pages upload` writes it back.

```
<site-root>/
  websites/<site>.website.yml
  web-pages/<page>/
    <page>.webpage.yml             # page metadata, parent, page template
    content-pages/<page>.<lang>.webpage.copy.html   # body HTML/Liquid
  web-templates/<name>.webtemplate.yml + .webtemplate.source.html
  content-snippets/<name>.contentsnippet.yml
  basic-forms/<name>.basicform.yml      # form over a table
  lists/<name>.list.yml                 # grid over a view
  table-permissions/<name>.tablepermission.yml
  web-roles/<name>.webrole.yml
  page-templates/<name>.pagetemplate.yml
```

## Liquid Templating

Power Pages renders Liquid server-side before HTML. Use it to read Dataverse and site objects.

```liquid
{% raw %}
<h1>{{ page.title }}</h1>
{% fetchxml issues %}
  <fetch top="10">
    <entity name="agx_issue">
      <attribute name="agx_name" />
      <filter><condition attribute="statecode" operator="eq" value="0" /></filter>
    </entity>
  </fetch>
{% endfetchxml %}
<ul>
  {% for row in issues.results.entities %}
    <li>{{ row.agx_name }}</li>
  {% endfor %}
</ul>
{% endraw %}
```

Key objects: `page`, `user`, `website`, `request`, `settings`, `snippets`, plus `entityform` / `entitylist` Liquid tags and the `fetchxml` tag. Liquid runs with the visitor's web roles -- it cannot bypass table permissions.

## Security Is Mandatory (Default Deny)

Power Pages denies all Dataverse access until you grant it. Two layers:

1. **Table Permissions** (`*.tablepermission.yml`): scope (Global / Contact / Account / Self / Parent), table, and privileges (Read/Create/Write/Delete/Append/AppendTo).
2. **Web Roles** (`*.webrole.yml`): map authenticated/anonymous users to a set of table permissions.

```yaml
# table-permissions/issues-read.tablepermission.yml
adx_name: Issues - Authenticated Read
adx_entitylogicalname: agx_issue
adx_scope: 756150000   # Global
adx_read: true
```

Never grant `adx_scope: Global` + Write/Delete to the anonymous web role. Default to Contact/Account scope so visitors see only their own rows.

## Basic Forms & Lists

- **Basic form** (`*.basicform.yml`): renders one Dataverse form (insert/edit/read) on a page; bind to a table + form name + mode.
- **List** (`*.list.yml`): renders a Dataverse view as a grid with optional search, filter, and row actions; bind to a table + view.

Both still require matching table permissions; the UI element does not grant access.

## Anti-Patterns

- Treating pages as static files -- they are Dataverse rows; always round-trip via pac pages.
- Shipping a site with no table permissions -- visitors see nothing (or, if mis-scoped Global, everything).
- Putting secrets in `content-snippets` or Liquid -- snippets are world-readable per role; use environment variables/Key Vault.
- Building heavy CRUD that belongs in a model-driven app -- Power Pages is for external, lightly-privileged audiences.

## Verify

```bash
pac pages upload --path ./<site-root>   # must succeed against a dev site
```

## Related

- [solution-anatomy](../solution-anatomy/SKILL.md) -- Power Pages can be solution-aware
- [dataverse-schema](../dataverse-schema/SKILL.md) -- the tables the portal reads/writes
- [security-roles](../security-roles/SKILL.md) -- Dataverse-side roles vs portal web roles