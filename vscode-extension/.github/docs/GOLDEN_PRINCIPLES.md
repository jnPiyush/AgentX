# Golden Principles - Mechanical Rules

> Rules that are enforced mechanically by linters, validators, and agents.
> Every rule here MUST be automatically checkable -- no subjective judgments.

---

## Frontmatter Consistency

Every customization file MUST have valid YAML frontmatter between `---` delimiters.

| File Type | Required Fields | Validated By |
|-----------|----------------|--------------|
| `.agent.md` | `description`, `model` | `validate-frontmatter.ps1` |
| `.instructions.md` | `description`, `applyTo` | `validate-frontmatter.ps1` |
| `.prompt.md` | `name`, `description` | `validate-frontmatter.ps1` |
| `.claude/commands/*.md` | `description` | `validate-frontmatter.ps1` |
| `SKILL.md` | `name` (kebab-case), `description` (50+ chars) | `validate-frontmatter.ps1` |

**Rule**: No file passes review without valid frontmatter.

---

## Skill Structure Compliance

Every skill MUST follow the directory structure:

```
.github/skills/{category}/{skill-name}/
  SKILL.md              # Required. <5K tokens.
  scripts/*.ps1         # Optional. Automation scripts.
  references/*.md       # Optional. Extended docs.
  assets/               # Optional. Templates, configs.
```

**Rule**: `skill-name` MUST be kebab-case. SKILL.md MUST be under 5,000 tokens.

---

## Instruction File Token Limits

Instruction files are auto-loaded into every matching conversation. Large files waste context budget.

| File | Max Size | Enforcement |
|------|----------|-------------|
| `.instructions.md` | ~3,000 tokens | Manual review (no automated check yet) |
| `copilot-instructions.md` | ~2,000 tokens | Manual review |

**Rule**: If an instruction file exceeds its limit, extract the excess into a skill or a referenced doc.

---

## Template Input Requirements

Every template MUST declare its input variables in a comment block at the top:

```markdown
<!-- Inputs: {issue_number}, {title}, {date}, {author} -->
```

**Rule**: Templates without declared inputs cannot be used by agents reliably.

---

## Execution Plan Requirement

Complex work MUST have a living execution plan.

| Work Type | Requirement | Source of Truth |
|-----------|-------------|-----------------|
| Simple task | Plan optional | Issue + changed files |
| Complex / multi-phase task | Execution plan required before implementation | Execution plan document in `docs/execution/plans/` derived from `.github/templates/EXEC-PLAN-TEMPLATE.md` |
| Resumable long-running task | Execution plan and progress updates required | Execution plan in `docs/execution/plans/` + progress log in `docs/execution/progress/` |

**Rule**: If a task is complex enough to require multiple phases, meaningful design decisions, or resumable context, it does not pass review without a current execution plan.

---

## Living Plan Sections

Every execution plan for a complex task MUST include and maintain these sections:

- Purpose / Big Picture
- Progress
- Surprises & Discoveries
- Decision Log
- Context and Orientation
- Plan of Work
- Concrete Steps
- Validation and Acceptance
- Idempotence and Recovery
- Artifacts and Notes
- Outcomes & Retrospective

**Rule**: A plan that exists but is not updated as work proceeds is considered invalid.

---

## Evidence-Backed Validation

Validation for complex tasks MUST be backed by observable evidence, not only narrative claims.

| Validation Type | Minimum Evidence |
|-----------------|------------------|
| Build or test claim | Command output, summary, or linked result artifact |
| Review claim | Structured findings or approval result |
| Multi-phase completion claim | Updated progress log with completed and remaining items |
| Recovery safety claim | Rollback or retry guidance recorded in the plan |

**Rule**: For complex work, "done" means both the change and the proof of the change are present in repo-local artifacts.

---

## Documentation And Runtime Consistency

Architecture and workflow documentation MUST NOT materially overstate implemented runtime behavior.

| Artifact Type | Consistency Expectation |
|---------------|-------------------------|
| ADR / Spec | Distinguish current state from target state clearly |
| Workflow doc | Reflect actual enforced behavior or mark future behavior explicitly |
| Quality score | Grades must match current implementation maturity |

**Rule**: If documentation describes a capability as current when it is only planned or partial, the documentation fails review.

---

## Doc Count Accuracy

Documented counts of agents, skills, instructions, templates, and prompts MUST match actual file counts.

| Count | Source of Truth | Documented In |
|-------|----------------|---------------|
| Agents | `ls .github/agents/**/*.agent.md` | AGENTS.md, README.md, Skills.md |
| Skills | `ls .github/skills/**/SKILL.md` | Skills.md, AGENTS.md |
| Instructions | `ls .github/instructions/*.instructions.md` | AGENTS.md |
| Templates | `ls .github/templates/*-TEMPLATE.md` | AGENTS.md |
| Prompts | `ls .github/prompts/*.prompt.md` | AGENTS.md |

**Rule**: Use the `doc-gardener.prompt.md` prompt periodically to verify counts.

---

## Cross-Reference Validity

Every internal `[link](path)` in Markdown files MUST point to an existing file.

**Rule**: Broken links are CI failures. Run link validation before commits.

---

## Commit Message Format

Every commit MUST follow:

```
type: description (#issue-number)
```

- `type` is one of: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`
- `#issue-number` is optional in Local Mode (unless `enforceIssues` is `true`)
- Description is imperative mood, lowercase start, no period

**Rule**: CI or pre-commit hook rejects non-conforming messages in GitHub Mode.

---

## Security Non-Negotiables

These rules are absolute -- no exceptions, no bypass:

1. **No hardcoded secrets** -- secrets in env vars or Key Vault only
2. **Parameterized SQL** -- NEVER concatenate user input into SQL strings
3. **Input validation** -- all external inputs validated at system boundaries
4. **Dependency scanning** -- `npm audit` / `dotnet list package --vulnerable` before merge
5. **Blocked commands** -- `rm -rf /`, `git reset --hard`, `git push --force`, `DROP DATABASE/TABLE`, `TRUNCATE`

**Rule**: Any violation blocks merge. No exceptions.

---

## ASCII-Only Rule

All source files MUST use ASCII characters only (U+0000-U+007F).

- No emoji, Unicode symbols, box-drawing characters, or smart quotes
- Use `[PASS]`/`[FAIL]` not checkmarks/crosses
- Use `->` not arrows, `-` not em-dashes

**Rule**: CI can enforce via `grep -P '[\x80-\xFF]'` on all tracked files.

---

## Test Coverage Gate

- **80% minimum** code coverage for all production code
- **Test pyramid**: 70% unit, 20% integration, 10% e2e
- **No compiler warnings or linter errors** in CI

**Rule**: PR blocked if coverage drops below 80%.

---

## Error Handling Standards

- Catch **specific** exceptions (never bare `catch` or `except:`)
- Log with context (agent name, issue number, operation)
- Retry with exponential backoff for transient failures
- Fail fast on invalid input at system boundaries

**Rule**: Bare catch blocks are flagged by static analysis.

---

**See Also**: [AGENTS.md](../AGENTS.md) | [QUALITY_SCORE.md](QUALITY_SCORE.md) | [tech-debt-tracker.md](tech-debt-tracker.md)
