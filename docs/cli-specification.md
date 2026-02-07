# AgentX CLI Specification

> **Purpose**: Headless command-line interface for AgentX workflows.  
> **Issue**: #123

---

## Overview

The AgentX CLI enables running agent workflows without VS Code, for CI/CD pipelines and terminal-first users.

---

## Commands

### Core Commands

```bash
# Initialize AgentX in a repository
agentx init [--mode github|local]

# Route an issue to the appropriate agent
agentx route --issue <number>

# Manual handoff between agents
agentx handoff --issue <number> --to <agent>

# Check workflow status
agentx status [--issue <number>]

# Validate handoff prerequisites
agentx validate --issue <number> --role <agent>
```

### Analytics Commands

```bash
# Show weekly metrics summary
agentx metrics [--since YYYY-MM-DD]

# Generate analytics report
agentx report [--output docs/analytics/]
```

### Utility Commands

```bash
# List all agents
agentx agents

# Show agent details
agentx agents show <name>

# List skills
agentx skills [--category architecture|development|operations]
```

---

## Examples

```bash
# Route issue #123 to the right agent
$ agentx route --issue 123
✅ Routed #123 → Engineer (type:story, Status=Ready)

# Check status of all in-progress work
$ agentx status
#118 [Epic]    AgentX v3.0         Backlog
#119 [Feature] Analytics Dashboard  In Progress (Engineer)
#120 [Feature] Auto-Fix Reviewer    Ready (→ Architect)

# Validate before handoff
$ agentx validate --issue 119 --role reviewer
✅ Tests passing (85% coverage)
✅ Code committed with #119 reference
✅ Progress log updated
→ Ready for review

# Weekly metrics
$ agentx metrics
Issues completed: 10 | Rework: 15% | Avg cycle: 12.5h
```

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: Route issue
  run: agentx route --issue ${{ github.event.issue.number }}

- name: Validate handoff
  run: agentx validate --issue ${{ github.event.issue.number }} --role engineer
```

---

## Implementation Notes

- Built as a wrapper around existing scripts and `gh` CLI
- Requires: `gh` CLI authenticated, Git
- Config: reads `.agentx/config.json` and `.agentx/repos.json`
- Cross-platform: Windows (PowerShell), Mac/Linux (Bash)

---

**Related**: [AGENTS.md](../AGENTS.md) • [MCP Integration](mcp-integration.md)

**Last Updated**: February 7, 2026
