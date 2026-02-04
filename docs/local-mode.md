# Local Mode Guide

> **Purpose**: Use AgentX without GitHub - filesystem-based issue tracking and agent coordination.

---

## Overview

**Local Mode** enables AgentX to work without a GitHub repository by using local JSON files for issue tracking and status management.

### When to Use Local Mode

✅ **Good for:**
- Personal projects without GitHub
- Learning AgentX workflow
- Offline development
- Prototyping before pushing to GitHub
- Private projects not ready for cloud hosting

❌ **Not Recommended for:**
- Team collaboration (no shared state)
- CI/CD pipelines (no GitHub Actions)
- Code reviews (no PR process)
- Production workflows

---

## Installation

### During Initial Setup

When running `install.ps1`, choose option **[2] Use Local Mode** when prompted about GitHub remote:

```powershell
.\install.ps1
```

### Enabling Local Mode Later

If you installed AgentX with GitHub but want to switch to Local Mode:

```powershell
# Initialize local mode
New-Item -ItemType Directory -Path ".agentx/issues" -Force

# Create config
@{
    mode = "local"
    nextIssueNumber = 1
    created = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json | Set-Content ".agentx/config.json"
```

---

## Issue Management

### PowerShell Commands

```powershell
# Create issue
.\.agentx\local-issue-manager.ps1 -Action create `
    -Title "[Story] Add user login" `
    -Body "Implement user authentication" `
    -Labels "type:story"

# List all issues
.\.agentx\local-issue-manager.ps1 -Action list

# Get specific issue
.\.agentx\local-issue-manager.ps1 -Action get -IssueNumber 1

# Update issue status
.\.agentx\local-issue-manager.ps1 -Action update `
    -IssueNumber 1 `
    -Status "In Progress"

# Add comment
.\.agentx\local-issue-manager.ps1 -Action comment `
    -IssueNumber 1 `
    -Comment "Started implementation"

# Close issue
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber 1
```

### Bash Commands (Linux/Mac)

```bash
# Create issue
./.agentx/local-issue-manager.sh create "[Story] Add user login" "Implement auth" "type:story"

# List issues
./.agentx/local-issue-manager.sh list
```

### Create Aliases (Optional)

Add to your PowerShell profile (`$PROFILE`):

```powershell
function issue { .\.agentx\local-issue-manager.ps1 @args }
```

Then use:
```powershell
issue -Action create -Title "[Bug] Fix login" -Labels "type:bug"
issue -Action list
issue -Action close -IssueNumber 1
```

---

## Workflow

### Issue-First Workflow (Local Mode)

```
1. Create Issue → 2. Update Status → 3. Write Code → 4. Commit → 5. Close Issue
```

**Example:**

```powershell
# 1. Create issue
issue -Action create -Title "[Story] Add logout button" -Labels "type:story"
# Returns: Created issue #1

# 2. Start work (update status)
issue -Action update -IssueNumber 1 -Status "In Progress"

# 3. Write code
# (Make your changes)

# 4. Commit with issue reference
git add .
git commit -m "feat: add logout button (#1)"

# 5. Close issue
issue -Action update -IssueNumber 1 -Status "Done"
issue -Action close -IssueNumber 1
```

---

## Status Tracking

### Available Statuses

| Status | Meaning |
|--------|---------|
| `Backlog` | Issue created, not started (default) |
| `In Progress` | Active work by Engineer |
| `In Review` | Code review phase |
| `Ready` | Design/spec done, awaiting next phase |
| `Done` | Completed (set when closing) |

### Status Transitions

```
Backlog → In Progress → In Review → Done
        → Ready (for PM/Architect/UX phases)
```

---

## File Structure

```
.agentx/
├── config.json                    # Mode configuration
├── issues/
│   ├── 1.json                    # Issue #1 data
│   ├── 2.json                    # Issue #2 data
│   └── ...
├── local-issue-manager.ps1       # PowerShell CLI
└── local-issue-manager.sh        # Bash CLI
```

### Issue JSON Format

```json
{
  "number": 1,
  "title": "[Story] Add logout button",
  "body": "User should be able to logout",
  "labels": ["type:story"],
  "status": "In Progress",
  "state": "open",
  "created": "2026-02-04T10:00:00Z",
  "updated": "2026-02-04T11:30:00Z",
  "comments": [
    {
      "body": "Started implementation",
      "created": "2026-02-04T11:30:00Z"
    }
  ]
}
```

---

## Agent Coordination

### Manual Agent Handoffs

In Local Mode, agent coordination is **manual** (no automated workflows):

**Product Manager → Architect**
```powershell
# PM completes PRD
issue -Action update -IssueNumber 1 -Status "Ready"
issue -Action comment -IssueNumber 1 -Comment "PRD complete at docs/prd/PRD-1.md"

# Architect picks up
issue -Action update -IssueNumber 1 -Status "In Progress"
# (Create ADR/Spec)
issue -Action update -IssueNumber 1 -Status "Ready"
```

**Architect → Engineer**
```powershell
# Engineer picks up
issue -Action update -IssueNumber 1 -Status "In Progress"
# (Write code)
issue -Action update -IssueNumber 1 -Status "In Review"
```

**Engineer → Reviewer**
```powershell
# Reviewer picks up
# (Review code)
issue -Action update -IssueNumber 1 -Status "Done"
issue -Action close -IssueNumber 1
```

---

## Limitations

### What Local Mode Doesn't Support

❌ **GitHub-Specific Features:**
- GitHub Actions workflows (no CI/CD)
- Pull requests and code reviews
- Projects V2 board
- Issue labels (stored but not enforced)
- GitHub CLI integration

❌ **Collaboration:**
- No shared state between team members
- No remote issue tracking
- No automated notifications

### Workarounds

| Missing Feature | Local Mode Alternative |
|-----------------|------------------------|
| **GitHub Actions** | Run scripts manually: `.github/scripts/validate-handoff.sh` |
| **Pull Requests** | Manual code review using `docs/reviews/` |
| **Projects Board** | Track status in issue JSON files |
| **Labels** | Use labels in issue JSON (not enforced) |
| **Notifications** | Manual check with `issue -Action list` |

---

## Migration to GitHub

### Switching from Local to GitHub Mode

When ready to move to GitHub:

```powershell
# 1. Add GitHub remote
git remote add origin https://github.com/owner/repo.git

# 2. Create GitHub labels
gh label create "type:epic" --color "5319E7"
gh label create "type:feature" --color "A2EEEF"
gh label create "type:story" --color "0E8A16"
gh label create "type:bug" --color "D73A4A"
gh label create "type:spike" --color "FBCA04"
gh label create "type:docs" --color "0075CA"

# 3. Migrate open issues to GitHub
Get-ChildItem .agentx/issues/*.json | ForEach-Object {
    $issue = Get-Content $_.FullName | ConvertFrom-Json
    if ($issue.state -eq "open") {
        gh issue create --title "$($issue.title)" --body "$($issue.body)" --label ($issue.labels -join ',')
    }
}

# 4. Push to GitHub
git push -u origin master

# 5. Update mode in config
$config = Get-Content .agentx/config.json | ConvertFrom-Json
$config.mode = "github"
$config | ConvertTo-Json | Set-Content .agentx/config.json
```

---

## Best Practices

### DO

✅ Commit frequently with issue references: `git commit -m "feat: xyz (#1)"`  
✅ Update issue status as work progresses  
✅ Use descriptive issue titles with type prefix: `[Story]`, `[Bug]`, etc.  
✅ Add comments to track progress  
✅ Follow the Issue-First workflow

### DON'T

❌ Work without creating an issue first  
❌ Forget to close issues when done  
❌ Skip status updates (breaks agent coordination)  
❌ Create retroactive issues (defeats audit trail)  

---

## Troubleshooting

### Issue Numbers Out of Sync

**Problem**: Issue numbers skip or duplicate

**Solution**: Check and fix `nextIssueNumber` in config:

```powershell
$config = Get-Content .agentx/config.json | ConvertFrom-Json
$maxIssue = (Get-ChildItem .agentx/issues/*.json | ForEach-Object { 
    [int]($_.BaseName) 
} | Measure-Object -Maximum).Maximum
$config.nextIssueNumber = $maxIssue + 1
$config | ConvertTo-Json | Set-Content .agentx/config.json
```

### Can't Find Issue Manager Script

**Problem**: Script not found at `.agentx/local-issue-manager.ps1`

**Solution**: Re-run installation:

```powershell
.\install.ps1 -Force
```

### Commit Hook Fails

**Problem**: Git commit hook requires GitHub issue number

**Solution**: Local mode still validates issue references. Ensure commit message includes `(#N)`:

```bash
git commit -m "feat: description (#1)"  # ✅ Valid
git commit -m "feat: description"      # ❌ Invalid
```

---

## FAQ

**Q: Can I use Local Mode with a team?**  
A: Not recommended. Local issues are not shared. Use GitHub mode for collaboration.

**Q: Can I sync local issues to GitHub later?**  
A: Yes! See [Migration to GitHub](#migration-to-github) above.

**Q: Do agents work in Local Mode?**  
A: Yes, but coordination is manual. No automated workflow triggers.

**Q: Can I use both Local and GitHub modes?**  
A: Not simultaneously. Choose one mode per project.

**Q: How do I backup local issues?**  
A: Commit `.agentx/` directory to Git:
```bash
git add .agentx/
git commit -m "chore: backup local issues"
```

---

## Reference

**Mode Configuration**: `.agentx/config.json`  
**Issue Storage**: `.agentx/issues/*.json`  
**CLI Tool**: `.agentx/local-issue-manager.ps1`  
**Workflow**: [AGENTS.md](../AGENTS.md)  
**Standards**: [Skills.md](../Skills.md)

---

**See Also**: [docs/mcp-integration.md](mcp-integration.md) for GitHub MCP Server integration (GitHub mode only)

