# Model Council: 401-domain-agents

**Convened:** 2026-08-07T08:52:07Z
**Mode:** agent-internal (calling agent adopts each role and writes responses below)
**Purpose pack:** adr-options

## Question

This council deliberates on 2 related topics. Address EACH topic explicitly and keep them distinct.

Topic 1: Should AgentX add a visible Fabric Engineer while preserving Power BI Analyst and Data Scientist boundaries?
Topic 2: Should AgentX promote the pack-only Low-Code Builder into a visible core Power Platform Builder?

## Supporting Context

Current AgentX has 13 visible and 11 internal agents. Thirteen Power Platform skills point to a pack-only low-code-builder that emits unpacked solution source and forbids tenant mutation. Three Fabric skills cover analytics, data agents, and forecasting, but no agent owns Fabric Lakehouse, Warehouse, notebook, pipeline, data quality, lineage, or deployment documentation. Power BI Analyst owns PBIP/TMDL/DAX/report work; Data Scientist owns models, forecasting algorithms, evaluation, and drift.

## Council Roster

| Role | Model |
|------|-------|
| Analyst | openai/gpt-5.5 |
| Strategist | anthropic/claude-opus-4.8 |
| Skeptic | google/gemini-3.1-pro |

## Member Responses

### Analyst - openai/gpt-5.5

#### Topic 1

**Position**

Create a visible Fabric Engineer because the current roles leave Fabric data-platform artifacts without an accountable owner. Preserve Power BI Analyst ownership of semantic models and reports, and Data Scientist ownership of model and evaluation decisions.

**Key Reasoning**

- Fabric Lakehouse, Warehouse, notebook, pipeline, OneLake, quality, and lineage work has a distinct artifact and validation contract.
- Routing Fabric engineering to Data Scientist would expand an AI/ML role into general data engineering.
- Routing it to Power BI Analyst would collapse upstream data products and downstream report products into one role.
- The agent should own only local, reviewable Fabric source and documentation unless the user explicitly authorizes a live workspace operation.

**What Could Make Me Wrong**

- If Fabric assets cannot be represented or validated in source control, a dedicated implementation agent may add little value.
- If almost every Fabric request is only Power BI modeling, the existing analyst could remain sufficient.

#### Topic 2

**Position**

Promote the existing builder rather than create another competing Power Platform role. Its solution-tree deliverable, `pac solution pack` gate, and prohibition on tenant mutation already form a coherent specialist contract.

**Key Reasoning**

- Thirteen skills already identify Low-Code Builder as their intended surface.
- A pack-only agent is undiscoverable to core routing and packaged chat-agent contributions.
- The promotion should use the core name Power Platform Builder while retaining `low-code-builder` only as a compatibility phrase in skills and pack documentation.
- The role should remain source-generation-only; DevOps or a human maker owns environment deployment.

**What Could Make Me Wrong**

- If the pack is intentionally isolated for licensing or maturity reasons, core promotion may be premature.
- If `pac solution pack` cannot validate preview component shapes, the role must clearly report partial validation rather than imply import readiness.

### Strategist - anthropic/claude-opus-4.8

#### Topic 1

**Position**

Add one Fabric Engineer, not agents for each Fabric workload. This establishes one upstream data-platform owner and keeps Power BI and Data Science as explicit downstream collaborators.

**Key Reasoning**

- One role per deliverable contract is simpler than product-by-product agents.
- The handoff boundary is stable: Fabric Engineer produces governed Gold data; Power BI Analyst consumes it for semantic/report work; Data Scientist consumes it for forecasting or AI.
- The role should use `type:fabric`, a dedicated workflow pipeline, and file boundaries under `fabric/**`, `docs/fabric/**`, and `tests/fabric/**`.
- Live Fabric mutation should be conditional and approval-aware because workspace and capacity operations can incur cost and alter shared state.

**What Could Make Me Wrong**

- If AgentX later gains separate operational lifecycles for Real-Time Intelligence or Data Factory, this umbrella role may need reevaluation.
- A broad role without strict boundaries could become another general Engineer.

#### Topic 2

**Position**

Power Platform Builder belongs in core because it already has an end-to-end local artifact workflow. Promotion should consolidate, not duplicate: the pack file becomes a thin pointer to the canonical core definition or is removed from agent inventory.

**Key Reasoning**

- Core routing and extension contribution make the capability discoverable without changing its safe execution model.
- One builder should own Dataverse, apps, flows, Power Pages, PCF, plugins, security, variables, and Copilot Studio components because they share one solution manifest and packaging gate.
- The role should collaborate with Architect for platform-fit decisions and DevOps for ALM, not absorb either function.
- Pack documentation must identify the canonical core agent to prevent two contracts from drifting.

**What Could Make Me Wrong**

- A thin pack pointer may not be supported by every external host; distribution tests must prove the canonical agent ships.
- Existing users may depend on the Low-Code Builder display name, so migration wording should preserve discoverability.

### Skeptic - google/gemini-3.1-pro

#### Topic 1

**Position**

The largest risk is creating a Fabric-branded agent that only repeats skills. Approve it only if routing, runtime IDs, workflow gates, file ownership, extension packaging, and regression tests are all implemented.

**Key Reasoning**

- A Markdown file alone is not a capability; all distribution and runtime surfaces must recognize it.
- Fabric Data Agent creation and forecasting cross into Data Scientist territory and require explicit consultation boundaries.
- Fabric workspace mutation is not comparable to writing local notebooks; accidental live execution can change shared data or consume capacity.
- The role must not claim successful runtime validation when no Fabric workspace was available.

**What Could Make Me Wrong**

- If routing and packaging are generated automatically from the agent directory, fewer manual integrations may be necessary.
- If the role is documentation-only by design, live-operation constraints may be less important, but that limitation must be explicit.

#### Topic 2

**Position**

Promotion is valid only if the old pack-local contract stops being a second source of truth. Duplicating the full agent body would create immediate drift.

**Key Reasoning**

- Existing skills use the old `low-code-builder` surface name, while the proposed runtime ID is `power-platform-builder`; compatibility must be intentional.
- The agent currently tells makers how to authenticate and import, so generated documentation could be mistaken for agent authorization. The prohibition must remain prominent.
- Preview or export-shaped schemas cannot be invented; the agent should block or ask for a verified export.
- Core status, handoff validators, CLI role maps, host wrappers, and packaged manifests can all silently omit a newly added role.

**What Could Make Me Wrong**

- If parity tests enumerate every canonical agent and generated bundle, drift risk is substantially reduced.
- If the pack-local agent is removed from shipped artifacts, the duplicate-source concern is resolved.

## Synthesis

### Consensus on the Recommended Approach

- Topic 1: All members support one visible Fabric Engineer if it receives a distinct artifact contract, `type:fabric` routing, explicit Power BI/Data Scientist boundaries, and truthful local-versus-live validation.
- Topic 2: All members support promoting the pack-only Low-Code Builder into one canonical visible Power Platform Builder while retaining the no-tenant-mutation boundary.
- Both roles must be integrated across canonical agents, routing, workflow pipelines, runtime aliases, host wrappers, extension contributions, distribution manifests, and tests.

### Divergences on Approach Ranking or Criteria Weighting

- Topic 1: The Analyst and Strategist treat the ownership gap as sufficient for a new agent; the Skeptic conditions approval on proving the role is more than a skill wrapper through executable integration tests.
- Topic 2: The Strategist prefers a thin pack pointer to the canonical agent; the Skeptic would accept removal of the pack-local agent instead. The selected approach is a thin compatibility wrapper because the pack remains useful but must not own a second full contract.

### Failure Modes and Vendor Risks Surfaced

| Topic | Risk | Required mitigation |
|-------|------|---------------------|
| 1 | Fabric role becomes a branded generalist | Constrain owned paths, phases, deliverables, and handoffs |
| 1 | Live workspace or capacity mutation occurs without consent | Default to local artifacts; require explicit target and approval before live mutation |
| 1 | Forecasting or Data Agent work bypasses Data Scientist | Require Data Scientist alignment when model/eval contracts change |
| 2 | Pack and core agent definitions drift | Keep one canonical core contract and a thin pack compatibility pointer |
| 2 | Generated import commands imply agent authority | Preserve explicit prohibition on auth/import/publish/delete operations |
| 2 | Preview component schemas are fabricated | Require a verified live export or report a blocked/partial state |
| Both | Agent exists in docs but not packaged runtime | Add inventory, routing, runtime, extension, manifest, and parity tests |

### Net Adjustment to ADR

No new ADR is required because the user explicitly selected the two-agent topology after a prior architecture review. The council narrows implementation in four ways:

1. Use canonical runtime IDs `power-platform-builder` and `fabric-engineer` with `low-code-builder` retained only as a compatibility phrase.
2. Keep the Power Platform pack agent as a thin pointer instead of a duplicated full contract.
3. Make live Fabric operations approval-aware and report local-only validation honestly.
4. Treat cross-surface parity tests as acceptance criteria, not optional documentation cleanup.


