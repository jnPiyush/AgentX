# Agent Communication Protocol

> Structured handoff messages for agent-to-agent communication in AgentX.
> Schema: `.github/schemas/handoff-message.schema.json`

---

## Overview

Every agent handoff produces a JSON message conforming to the handoff schema.
This ensures traceability, validates prerequisites, and prevents incomplete transitions.

---

## Message Structure

```json
{
  "version": "1.0",
  "handoff": {
    "fromAgent": "pm",
    "toAgent": "architect",
    "issueNumber": 42,
    "timestamp": "2025-01-15T10:30:00Z",
    "status": "Ready",
    "context": {
      "summary": "PRD complete for health endpoint feature",
      "artifacts": [
        { "path": "docs/prd/PRD-42.md", "type": "prd", "description": "Product requirements" }
      ],
      "decisions": ["REST over gRPC for simplicity"],
      "openQuestions": [],
      "blockers": [],
      "labels": ["type:feature", "priority:p1"]
    },
    "validation": {
      "handoffChecked": true,
      "contextCaptured": true,
      "deliverablesCommitted": true,
      "loopCompleted": true,
      "scoreResult": { "score": 36, "maxScore": 40, "tier": "high" }
    }
  }
}
```

---

## Agent Roles (15 valid slugs)

| Slug | Agent |
|------|-------|
| `agent-x` | Hub Coordinator |
| `pm` | Product Manager |
| `ux` | UX Designer |
| `architect` | Architect |
| `data-scientist` | Data Scientist |
| `engineer` | Engineer |
| `reviewer` | Reviewer |
| `reviewer-auto` | Auto-Fix Reviewer |
| `devops` | DevOps Engineer |
| `tester` | Tester |
| `powerbi` | Power BI Analyst |
| `consulting-research` | Consulting Research |
| `agile-coach` | Agile Coach |
| `github-ops` | GitHub Ops |
| `ado-ops` | ADO Ops |

---

## Status Transitions

| Status | Meaning |
|--------|---------|
| `Backlog` | Created, not started |
| `Ready` | Design/spec complete, awaiting next phase |
| `In Progress` | Active work |
| `In Review` | Code review phase |
| `Validating` | Post-review validation |
| `Done` | Completed |

---

## Generating a Handoff

```powershell
# Generate + validate handoff message
scripts/validate-handoff.ps1 -IssueNumber 42 -FromAgent pm -ToAgent architect -Summary "PRD complete"

# Output JSON to stdout
scripts/validate-handoff.ps1 -IssueNumber 42 -FromAgent pm -ToAgent architect -Json
```

The script:
1. Checks deliverable files exist for the `fromAgent` role
2. Reads loop state from `.agentx/state/loop-<n>.json`
3. Generates a schema-compliant JSON message
4. Validates against all schema rules
5. Saves to `.agentx/handoffs/handoff-<n>-<from>-to-<to>.json`

---

## Validating an Existing Handoff

```powershell
scripts/validate-handoff.ps1 -Validate .agentx/handoffs/handoff-42-pm-to-architect.json
```

---

## Artifact Types

| Type | Produced By |
|------|-------------|
| `prd` | Product Manager |
| `adr` | Architect |
| `spec` | Architect |
| `ux` | UX Designer |
| `code` | Engineer |
| `test` | Engineer, Tester |
| `review` | Reviewer |
| `pipeline` | DevOps Engineer |
| `certification` | Tester |
| `report` | Power BI Analyst |
| `other` | Any agent |

---

## Handoff Flow

```
PM --[handoff]--> Architect --[handoff]--> Engineer --[handoff]--> Reviewer
                                                                       |
                                                       [handoff] ------+
                                                       |               |
                                                    DevOps          Tester
```

Each arrow represents a validated handoff message.

---

## Integration Points

| Tool | Purpose |
|------|---------|
| `scripts/validate-handoff.ps1` | Generate + validate handoff JSON |
| `.agentx/agentx.ps1 validate` | CLI deliverable validation |
| `.github/schemas/handoff-message.schema.json` | JSON Schema (draft-07) |
| `.agentx/handoffs/` | Handoff message storage |
| `quality-gates.yml` | CI validation of handoff artifacts |

---

**See Also**: [AGENTS.md](../../AGENTS.md) | [WORKFLOW.md](../../docs/WORKFLOW.md)
