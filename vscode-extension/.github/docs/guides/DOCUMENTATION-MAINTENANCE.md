# Documentation maintenance

## Mandatory implementation step

Every feature, user story and bug checks documentation drift after implementation
and validation, before independent review. This includes config, schema, workflow
and infrastructure-only changes. Internal fixes still need a reviewed impact
decision, but do not need artificial documentation edits.

```powershell
pwsh .agentx/agentx.ps1 doc-drift check -Json
```

The checker validates local Markdown references, including new untracked docs,
and current claims listed in a workspace's `.github/documentation-facts.json`.
AgentX CI supplies that policy explicitly so deleting it cannot skip the gate.
Generic user workspaces may omit AgentX-specific facts; link checks still run.

Exit codes: `0` structural checks pass, `1` drift/broken links, `2` invalid policy
or an incomplete check. A structural pass is not a semantic approval.

## Independent documentation review

Compare changed behavior with the owning documentation:

- README/getting-started instructions and prerequisites
- Public API/CLI usage, schemas, configuration and examples
- Operational/recovery guidance and compatibility limitations
- Agent/skill instructions, workflow steps and current inventory/version claims
- Plan/progress headers, navigation and packaged documentation

The existing quality report now requires `documentationReview`:

```json
{
  "documentationReview": {
    "status": "updated",
    "rationale": "Updated the owning CLI guide for the changed option and checked its examples.",
    "documents": [
      {"path": "docs/GUIDE.md", "sha256": "<current SHA-256>"}
    ]
  }
}
```

Use `no-impact` only with a specific reason and the documents actually reviewed.
If the project has no documentation, explain that explicitly rather than creating
a meaningless file. Missing evidence, stale hashes and unresolved structural
drift block the existing completion gate. Any later code or reviewed-doc edit
requires another review; never retimestamp old evidence.

## One source of truth

- Root README introduces AgentX; `docs/README.md` is the navigation hub.
- `docs/GUIDE.md` owns user operations; `docs/WORKFLOW.md` owns delivery flow.
- `AGENTS.md` routes roles; `.github/AGENT-PROTOCOL.md` owns shared requirements.
- `Skills.md` indexes product skills; skills retain only their specialized rules.
- `version.json`, filesystem inventories and registries supply current facts.
- Rebuild generated skill/template registries with
  `pwsh scripts/generate-registries.ps1` (Node.js required). Skill metadata uses
  the same YAML parser as skill scoring, in one batch. Invalid metadata fails
  generation instead of publishing partial or misleading skill descriptions;
  hand-authored routing and pipeline registries remain untouched.
- `vscode-extension/.github/**` is generated. Regenerate with
  `node vscode-extension/scripts/copy-assets.js`, never hand-edit mirrors.

Update the source and all consumers in the same change. Do not copy the same
instructions into new guides just to avoid maintaining a link.

Canonical reusable prompts under `.github/prompts` have a 1,500 estimated-token
budget in `.token-limits.json`. Run `agentx tokens check -Path .github/prompts`
after edits. Preserve routing metadata, required evidence and failure boundaries;
an uncovered file is not proof that a prompt is within budget.

## Retention and consolidation

Classify before removing:

| Class | Action |
|-------|--------|
| Current operations/instructions | Maintain and link from the documentation hub |
| Durable ADR/PRD/spec/review/learning | Retain with its original date and decision context; mark supersession explicitly |
| Completed execution plan/progress | Keep when referenced or carrying unique evidence; otherwise summarize durable lessons and prune redundant state |
| Runtime-generated snapshots | Keep in local state, not the tracked documentation corpus |
| Generated mirror | Regenerate from the canonical source |

Age alone is not evidence that a document is unwanted. For each deletion, verify
incoming links, test/packaging dependencies and unique content. Record the
retention decision, repair navigation, run the drift checker and validate the
installed/bundled layout. Git history remains available for deleted transient
notes; do not replace a useful historical record with a fake current one.

## Facts policy

The policy is versioned JSON with `claims` entries containing `document`, `fact`
and `pattern`. Patterns must capture the asserted text in `(?<value>...)`.
Supported source facts are agents, skills, recursive instructions, templates,
prompts, Claude commands and the version from `version.json`.

Keep policies targeted to current claims. Do not apply today's inventory to
historical release notes or archived decisions. A missing required claim fails
just like a mismatched value; deleting text must not hide drift.
