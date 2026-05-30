---
name: "copilot-studio-agents"
description: 'Design Microsoft Copilot Studio agents (formerly Power Virtual Agents) -- topics, trigger phrases, generative answers, knowledge sources, connector and MCP actions, authentication, channels, and agent flows -- so an agent can author the conversational logic that ships as a Bot component inside a Power Platform solution. Covers the topic/node dialog model and the generative-orchestration option.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "copilot-studio-builder", "agent-x"]
  platforms: ["power-platform", "copilot-studio", "power-virtual-agents", "dataverse"]
---

# Copilot Studio Agents

> Purpose: design a Copilot Studio agent -- topics, knowledge, actions, channels -- that packs as a Bot component in a solution. This is Tier-3 of the Power Platform stack (conversational AI over Dataverse + connectors).

> Note: Copilot Studio source schema is newer and less stable than Dataverse/canvas source. `pac copilot` is preview; the maker portal (or solution export/import) is the primary round-trip. Treat on-disk YAML shapes below as guidance, and always verify against an actual export before packing.

## When to Use

- Building a conversational agent (support, FAQ, task automation) over Dataverse + enterprise knowledge
- Adding topics or generative answers to an existing agent
- Wiring an agent to actions (Power Automate flows, connectors, MCP servers) and channels (Teams, web, etc.)

## Two Authoring Modes

| Mode | How it routes | Use for |
|------|---------------|---------|
| Classic topics | Trigger phrases match user input to a topic; you draw the dialog tree | Deterministic flows, compliance-bound paths |
| Generative orchestration | LLM picks topics/actions/knowledge to fulfill the goal | Open-ended assistants, many tools |

Most production agents combine both: generative orchestration for flexibility, plus authored topics for paths that must be deterministic.

## On-Disk Layout (Bot Component)

```
src/
  bots/<schemaname>/
    bot.yaml                  # agent metadata, default culture, settings
    topics/
      <topic>.yaml            # trigger + dialog nodes
    knowledge/
      <source>.yaml           # knowledge source binding (public URL, SharePoint, Dataverse)
```

The Bot is a Dataverse component (`RootComponent` for the bot) plus related `botcomponent` rows for topics/knowledge.

## Topic Anatomy

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnRecognizedIntent
  intent:
    triggerQueries:
      - track my issue
      - what is the status of my ticket
  actions:
    - kind: Question
      id: askId
      prompt: What is your issue number?
      property: Topic.IssueNumber
      entity: NumberPrebuiltEntity
    - kind: InvokeFlowAction          # call a Power Automate flow as an action
      flowId: <flow-guid>
      inputs:
        issueNumber: =Topic.IssueNumber
      outputs:
        status: Topic.Status
    - kind: SendActivity
      activity: Your issue is currently {Topic.Status}.
```

Key node kinds: `Question` (collect a slot via prebuilt/custom entity), `SendActivity` (respond), `InvokeFlowAction` / `InvokeConnectorAction` (tools), `ConditionGroup` (branch), `BeginDialog` (call another topic), `SearchAndSummarizeContent` (generative answers over knowledge).

## Generative Answers & Knowledge Sources

Bind knowledge so the agent can answer from content instead of authored topics:
- Public website URL, SharePoint/OneDrive, Dataverse tables, uploaded files, or custom search.
- Generative answers MUST be grounded -- scope sources tightly and enable in-domain-only responses to reduce hallucination.
- Order matters: authored topics win over generative answers when a trigger matches.

## Actions: Flows, Connectors, MCP

- **Power Automate flow action**: the agent calls a cloud flow (inputs/outputs typed) -- the standard way to read/write Dataverse or external systems.
- **Connector action**: invoke a (custom) connector operation directly.
- **MCP / agent tools**: connect Model Context Protocol servers / tools so generative orchestration can call them. Declare inputs/outputs and least-privilege scopes.

## Authentication & Channels

- **Authentication**: No auth / Microsoft Entra ID (user identity flows to actions) / manual OAuth. Choose Entra when actions act as the signed-in user.
- **Channels**: Teams, Microsoft 365 Copilot, custom website, Direct Line, etc. Publish per channel; secure the Direct Line secret.

## Anti-Patterns

- Broad, overlapping trigger phrases across topics -- ambiguous routing; keep phrases distinct and specific.
- Ungrounded generative answers over the open web -- hallucination + data-leak risk; scope knowledge sources.
- Over-privileged action connections -- actions should use least-privilege; prefer Entra user-context over a shared service account.
- Putting deterministic compliance steps in generative orchestration -- author them as explicit topics.
- Hand-editing exported bot YAML without re-importing to validate -- preview schema drifts.

## Verify

- Export the solution after maker-portal edits and confirm the Bot + botcomponents round-trip, OR `pac copilot` (preview) where available. Test in the maker test pane and at least one published channel.

## Related

- [power-automate-flow-json](../power-automate-flow-json/SKILL.md) -- flows the agent calls as actions
- [dataverse-schema](../dataverse-schema/SKILL.md) -- tables knowledge sources and actions read
- [solution-anatomy](../solution-anatomy/SKILL.md) -- Bot component packaging
- [pac-cli](../pac-cli/SKILL.md) -- solution export/import, pac copilot (preview)