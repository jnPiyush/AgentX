## What's New in v8.4.43

### New: Backlog Template + Live AgentX Backlog
- **New `.github/templates/BACKLOG-TEMPLATE.md`** -- 15-section canonical backlog with RICE/WSJF/MoSCoW/Kano/ICE prioritization, INVEST, DoR/DoD, Epic/Feature/Story/Bug/Spike hierarchy, capacity, dependency graph, release plan, flow metrics, state machine, refinement cadence, and Local Mode CLI wiring (7 Mermaid diagrams).
- **New `docs/artifacts/backlog/BACKLOG.md`** -- live AgentX backlog instantiated from the template (4 epics, 7 features, 4 stories) mapped to real tech-debt items (TD-001, TD-005, TD-012/013/015, TD-014).

### Existing Templates Upgraded
- All 12 existing templates (PRD, ADR, Spec, UX, Review, Arch Review, Security Plan, Progress, Roadmap, Exec Plan, Contract, Evidence Summary) upgraded with industry-best-practice content and **47 new Mermaid diagrams**.
- Template registry expanded from 12 to 13 in `AGENTS.md` and `docs/artifacts/README.md`.

### Other Improvements (from prior unreleased work)
- New `product/prd` skill usable by non-PM agents
- New `diagrams/diagram-as-code` skill (Mermaid, PlantUML, C4, draw.io, BPMN, Visio interop)
- New internal `diagram-specialist` sub-agent
- Model Council multi-perspective review pack
- `karpathy-guidelines` skill wired across roles
- Summary-based context compaction in the runner
- Per-agent `reasoning` frontmatter (GPT-5, Claude 4.6 mappings)
- User-visible Clarification Discussion blocks in VS Code chat
- Architect/PM and Engineer/Architect cross-role validation checkpoints

### Install
```powershell
irm https://raw.githubusercontent.com/jnPiyush/AgentX/v8.4.43/install.ps1 | iex
```

```bash
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/v8.4.43/install.sh | bash
```

### VS Code Extension
Install the bundled VSIX (attached) or via Marketplace: `jnPiyush.agentx`.
