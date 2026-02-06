# GitHub MCP Server Integration

> **Purpose**: Replace CLI-based GitHub operations with MCP Server for direct API access, eliminating `workflow_dispatch` caching issues.

## Overview

The GitHub MCP Server provides direct API access to GitHub, bypassing browser/CDN caching that affects `workflow_dispatch` events. This integration enables:

- **Immediate workflow triggers** - No waiting for cache refresh
- **Structured JSON responses** - Better for agent parsing
- **Unified tooling** - Issues, PRs, Actions in one interface
- **Agent-native design** - Built for AI workflows

## Configuration

### Prerequisites

Choose one of:
- **Go** (for native binary) - `go install github.com/github/github-mcp-server@latest`
- **Docker** (alternative) - [docker.com](https://docker.com)

Plus:
- **GitHub Personal Access Token** with scopes:
  - `repo` (full repository access)
  - `workflow` (workflow management)
  - `read:org` (if working with org repos)

### MCP Server Setup

Configuration file: `.vscode/mcp.json`

#### Option 1: Remote Server (Recommended)

**No installation required!** GitHub hosts the MCP Server for you.

**Requirements:**
- VS Code 1.101+
- GitHub Copilot subscription

```json
{
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

With OAuth, VS Code handles authentication automatically. No PAT needed!

**Alternative with PAT:**
```json
{
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${input:github_token}"
      }
    }
  }
}
```

#### Option 2: Native Binary (Local)

```bash
# Install the MCP server
go install github.com/github/github-mcp-server@latest
```

```json
{
  "servers": {
    "github": {
      "command": "github-mcp-server",
      "args": ["stdio"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_token}",
        "GITHUB_TOOLSETS": "actions,issues,pull_requests,repos,users,context"
      }
    }
  }
}
```

#### Option 3: Docker (Local)

```json
{
  "servers": {
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "-e", "GITHUB_TOOLSETS=actions,issues,pull_requests,repos,users,context",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_token}"
      }
    }
  }
}
```

### Which to Choose?

| Aspect | Remote (GitHub-hosted) | Native Binary | Docker |
|--------|------------------------|---------------|--------|
| **Setup** | None! | `go install` once | Docker must be running |
| **Dependencies** | VS Code 1.101+, Copilot | Go toolchain | Docker Desktop |
| **Authentication** | OAuth (automatic) | PAT required | PAT required |
| **Startup** | Instant | Instant | Container delay |
| **Maintenance** | GitHub maintains it | You update it | You update it |

## Available Toolsets

| Toolset | Description |
|---------|-------------|
| `actions` | GitHub Actions workflows and CI/CD operations |
| `issues` | Issue creation, updates, comments |
| `pull_requests` | PR management |
| `repos` | Repository operations |
| `users` | User information |
| `context` | Current user/repo context |

## Actions Tools

### Triggering Workflows

#### `run_workflow`
Trigger a workflow via `workflow_dispatch` event.

```json
{
  "tool": "run_workflow",
  "args": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "workflow_id": "run-product-manager.yml",
    "ref": "master",
    "inputs": {
      "issue_number": "48"
    }
  }
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner` | string | ✅ | Repository owner |
| `repo` | string | ✅ | Repository name |
| `workflow_id` | string | ✅ | Workflow filename (e.g., `ci.yml`) or numeric ID |
| `ref` | string | ✅ | Branch/tag to run on |
| `inputs` | object | ❌ | Workflow inputs |

### Monitoring Workflows

#### `list_workflow_runs`
List workflow runs with optional filters.

```json
{
  "tool": "list_workflow_runs",
  "args": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "workflow_id": "run-product-manager.yml",
    "status": "in_progress"
  }
}
```

**Status values:** `queued`, `in_progress`, `completed`, `requested`, `waiting`

#### `get_workflow_run`
Get details of a specific workflow run.

```json
{
  "tool": "get_workflow_run",
  "args": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "run_id": 12345678
  }
}
```

### Workflow Control

#### `cancel_workflow_run`
Cancel a running workflow.

```json
{
  "tool": "cancel_workflow_run",
  "args": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "run_id": 12345678
  }
}
```

#### `rerun_workflow_run`
Re-run an entire workflow.

```json
{
  "tool": "rerun_workflow_run",
  "args": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "run_id": 12345678
  }
}
```

#### `rerun_failed_jobs`
Re-run only failed jobs (more efficient).

```json
{
  "tool": "rerun_failed_jobs",
  "args": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "run_id": 12345678
  }
}
```

## Issue Tools

### `create_issue`
```json
{
  "tool": "create_issue",
  "args": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "title": "[Feature] New capability",
    "body": "## Description\n...",
    "labels": ["type:feature"]
  }
}
```

### `update_issue`
```json
{
  "tool": "update_issue",
  "args": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "issue_number": 50,
    "labels": ["type:story"]
  }
}
```

> ⚠️ **Status Tracking**: Use GitHub Projects V2 **Status** field, NOT labels. Update status via Projects board UI or GraphQL.

### `add_issue_comment`
```json
{
  "tool": "add_issue_comment",
  "args": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "issue_number": 50,
    "body": "Progress: Completed implementation phase"
  }
}
```

## Agent Orchestration Workflow

### Using Projects V2 Status for Agent Handoffs

Agents coordinate via the **Status** field in GitHub Projects V2:

```
1. PM Agent completes → Status = Ready → UX/Architect picks up
2. Architect completes → Status = Ready → Engineer picks up  
3. Engineer completes → Status = In Review → Reviewer picks up
4. Reviewer approves → Status = Done + Close issue
```

### Status Values

| Status | Meaning |
|--------|--------|
| `Backlog` | Issue created, not started |
| `In Progress` | Active work by current agent |
| `In Review` | Code review phase |
| `Ready` | Design/spec done, awaiting next phase |
| `Done` | Completed and closed |

### Example: Triggering Next Workflow

```json
// Agent completes work and triggers next workflow
{
  "tool": "run_workflow",
  "args": {
    "owner": "<OWNER>",
    "repo": "<REPO>",
    "workflow_id": "run-architect.yml",
    "ref": "master",
    "inputs": { "issue_number": "50" }
  }
}
```

> **Note**: Status updates are done manually in Projects board or via GraphQL API.

## Troubleshooting

### Docker Not Running
```
Error: Cannot connect to Docker daemon
```
**Solution**: Start Docker Desktop or the Docker daemon.

### Authentication Failed
```
Error: 401 Unauthorized
```
**Solution**: Check your PAT has correct scopes (`repo`, `workflow`).

### Workflow Not Found
```
Error: Could not find workflow
```
**Solution**: Verify workflow filename matches exactly (e.g., `run-pm.yml` not `run-pm`).

### Rate Limiting
```
Error: 403 rate limit exceeded
```
**Solution**: Wait for rate limit reset or use authenticated requests.

## Comparison: MCP vs CLI

| Aspect | GitHub CLI | GitHub MCP Server |
|--------|------------|-------------------|
| Caching | Subject to GitHub caching | Direct API (no cache) |
| Response | Text output | Structured JSON |
| Agent Integration | Parse stdout | Native tool calls |
| Error Handling | Exit codes | Detailed error objects |
| Concurrent Ops | Sequential | Can batch requests |

---

## References

- [GitHub MCP Server Repository](https://github.com/github/github-mcp-server)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [GitHub Actions API](https://docs.github.com/en/rest/actions)

---

**Last Updated**: February 5, 2026
