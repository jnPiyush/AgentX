# AgentX 5-Minute Quickstart

> **Build your first feature with AgentX in 5 minutes.**  
> For full setup, see [SETUP.md](SETUP.md). For agent roles, see [AGENTS.md](../AGENTS.md).

---

## What You'll Do

1. Install AgentX into your project
2. Create your first issue
3. Run the PM → Engineer → Reviewer pipeline
4. Ship a reviewed, tested feature

**Time**: ~5 minutes (with an existing project)

---

## Step 1: Install (30 seconds)

```powershell
# PowerShell — into an existing project directory
cd your-project
irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
```

```bash
# Bash
cd your-project
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

**What happens**: AgentX copies agents, skills, templates, and CLI into your project. Your existing code is untouched.

> **No GitHub?** Add `-Local` (PowerShell) or `--local` (Bash) for offline mode.

---

## Step 2: Create Your First Issue (30 seconds)

Open VS Code with Copilot Chat. Type:

```
@agent-x Create a story to add a /health endpoint to our API
```

**Or via CLI** (GitHub mode):
```bash
gh issue create --title "[Story] Add /health endpoint" --label "type:story"
```

**Or via CLI** (Local mode):
```powershell
.\.agentx\local-issue-manager.ps1 -Action create -Title "[Story] Add /health endpoint" -Labels "type:story"
```

Agent X classifies this as a `type:story` (simple, ≤3 files) and routes it **directly to Engineer** — skipping PM and Architect.

---

## Step 3: Implement with Engineer Agent (2 minutes)

Switch to the **Engineer** agent in Copilot Chat:

```
@Engineer Implement the health endpoint for issue #1
```

The Engineer agent will:

1. **Read the issue** and check prerequisites
2. **Load the right skills** automatically (`api-design`, `testing`, `error-handling`)
3. **Generate code** that follows your project's instruction guardrails
4. **Write tests** (enforced: ≥80% coverage)
5. **Commit** with proper format: `feat: add health endpoint (#1)`

### What Guardrails Are Active?

| If you're editing... | Auto-loaded instruction | Enforces |
|----------------------|------------------------|----------|
| `*.py` | `python.instructions.md` | Type hints, PEP 8, Google docstrings |
| `*.cs` | `csharp.instructions.md` | Nullable types, async patterns, XML docs |
| `*.ts` | `typescript.instructions.md` | Strict mode, Zod validation, ESM imports |
| `*.tsx` | `react.instructions.md` | Hooks, TypeScript props, accessibility |

You don't configure this — it's automatic via `applyTo` glob matching.

---

## Step 4: Review with Reviewer Agent (1 minute)

Once the Engineer moves the issue to `In Review`:

```
@Reviewer Review the code for issue #1
```

The Reviewer will:

1. **Check code quality** (naming, patterns, SOLID principles)
2. **Verify tests** (80% coverage, test pyramid)
3. **Security scan** (no hardcoded secrets, parameterized SQL)
4. **Create review doc** at `docs/reviews/REVIEW-1.md`
5. **Approve** → Status moves to `Done`

---

## Step 5: Done! What Just Happened?

```
📝 Issue Created → 🔧 Engineer Coded → ✅ Tests Written → 🔍 Reviewer Approved → ✅ Done
```

AgentX enforced:
- **Code standards** via auto-loaded instruction files
- **Test coverage** (80%+ required by Engineer constraints)
- **Security** (blocked commands, secrets scanning)
- **Process** (issue-first, status tracking, review before merge)

---

## Next: Try a Complex Feature

For larger work, use the **full pipeline**:

```
@agent-x Create an epic for user authentication with OAuth
```

This triggers the full flow:

```
📋 PM (creates PRD)
 → 🎨 UX Designer (wireframes + prototypes)
 → 🏗️ Architect (ADR + Tech Spec)
 → 🔧 Engineer (implementation)
 → 🔍 Reviewer (code review)
```

Each agent produces a deliverable, validates it, and hands off to the next.

---

## Common Commands

| What | Command |
|------|---------|
| **See pending work** | `.\.agentx\agentx.ps1 ready` |
| **Check agent states** | `.\.agentx\agentx.ps1 state` |
| **View workflow steps** | `.\.agentx\agentx.ps1 workflow -Type story` |
| **Check dependencies** | `.\.agentx\agentx.ps1 deps -IssueNumber 1` |
| **Scaffold an AI agent** | `python .github/skills/ai-systems/ai-agent-development/scripts/scaffold-agent.py --name my-agent` |
| **Scaffold RAG/Memory** | `python .github/skills/ai-systems/cognitive-architecture/scripts/scaffold-cognitive.py --name my-agent` |
| **Run security scan** | `.github/skills/architecture/security/scripts/scan-secrets.ps1` |
| **Check test coverage** | `.github/skills/development/testing/scripts/check-coverage.ps1` |

---

## Useful Links

| Resource | Description |
|----------|-------------|
| [AGENTS.md](../AGENTS.md) | Agent roles, workflow, classification rules |
| [Skills.md](../Skills.md) | 42 production skills index + workflow scenarios |
| [SETUP.md](SETUP.md) | Full installation, GitHub Projects setup, troubleshooting |
