# ADR: AgentX Multi-Agent Architecture

**Status**: Approved  
**Date**: January 28, 2026  
**Decision Makers**: Product Team, Engineering  
**Related**: [PRD-AGENTX.md](../prd/PRD-AGENTX.md)

---

## Context

### Background

AgentX is a multi-agent orchestration framework enabling AI coding assistants to work as a structured software team. The current implementation (v2.2) has:
- 8 agent definitions (Agent X, Agent X Auto, PM, UX, Architect, Engineer, Reviewer, DevOps)
- Template-driven deliverables with clear separation
- Universal tool access for maximum flexibility
- Pre-handoff validation strategy
- Hub-and-spoke coordination via Agent X

### Problem

Phase 2 requires architectural clarity to:
1. **Eliminate duplication** - Agent files repeat template content
2. **Clarify roles** - What each agent produces vs. how they coordinate
3. **Define tool access** - Which tools each agent needs
4. **Establish handoff protocol** - How agents trigger each other
5. **Standardize validation** - When/where validation occurs

### Requirements (from PRD)

**FR-1**: 7 specialized agents (PM, Architect, UX, Engineer, Reviewer, DevOps) + Agent X Auto
**FR-3**: Workflow enforcement (issue-first, status tracking, prerequisites)
**FR-6**: Agent handoffs (automatic triggering, context preservation)
**NFR-3**: Usability (self-documenting, clear error messages)

### Constraints

- **Serverless**: GitHub-only architecture (no backend)
- **Tool Availability**: Limited to VS Code agent framework tools
- **Platform**: GitHub Issues, Projects V2, Actions, MCP Server
- **Open Source**: Public repository, community contributions

---

## Decision

We will implement a **Hub-and-Spoke Architecture** with:

1. **Agent X (Hub)** - Central coordinator routing all work
2. **Agent X Auto** - Autonomous mode for simple tasks (bugs, docs)
3. **7 Specialized Agents (Spokes)** - PM, Architect, UX, Engineer, Reviewer, DevOps
4. **Universal Tool Access** - All agents can use all tools
5. **Template-Driven Deliverables** - Agents reference templates, don't duplicate
6. **Pre-Handoff Validation** - Validation occurs before status transitions
7. **Status-Based Workflow** - GitHub Projects V2 Status field drives orchestration

### Architecture Diagram

```
                    ┌─────────────────┐
                    │   Agent X       │
                    │   (YOLO)        │
                    │  Coordinator    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐         ┌────▼────┐        ┌────▼────┐
    │   PM    │         │  Arch   │        │   UX    │
    │  Agent  │         │  Agent  │        │  Agent  │
    └────┬────┘         └────┬────┘        └────┬────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Engineer      │
                    │   Agent         │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │                             │
     ┌────────▼────────┐          ┌────────▼────────┐
     │   Reviewer      │          │    DevOps       │
     │   Agent         │          │    Agent        │
     └─────────────────┘          └─────────────────┘

Agent X Auto: Autonomous mode for bugs/docs (bypasses full workflow)

GitHub Projects V2 Status Flow:
Backlog → In Progress → In Review → Ready → Done
```

---

## Options Considered

### Option 1: Peer-to-Peer Direct Handoffs

**Description**: Agents trigger each other directly without central coordinator.

**Pros:**
- Faster handoffs (no intermediary)
- Simpler implementation per agent
- Less coupling to Agent X

**Cons:**
- No central logging/audit trail
- Difficult to enforce workflow order
- Each agent must know next agent
- Hard to debug workflow failures
- Circular dependency risk

**Effort**: Medium  
**Risk**: High (workflow violations)

### Option 2: Hub-and-Spoke (Agent X Coordinator) ⭐ CHOSEN

**Description**: Agent X routes all work, agents focus only on their deliverables.

**Pros:**
- Centralized control and logging
- Easy to enforce prerequisites
- Clear workflow visualization
- Single point for error recovery
- Agents decoupled from each other

**Cons:**
- Agent X becomes critical path
- Slight delay in handoffs
- Agent X complexity increases

**Effort**: Medium  
**Risk**: Low (well-understood pattern)

### Option 3: Workflow-Driven Automation

**Description**: GitHub Actions workflows orchestrate everything, no agent coordination.

**Pros:**
- No Agent X needed
- GitHub-native solution
- Simple to understand

**Cons:**
- Limited flexibility (YAML configs)
- Hard to customize workflows
- No dynamic routing
- Poor error messages
- Cannot adapt to context

**Effort**: Low  
**Risk**: Medium (inflexible)

---

## Rationale

We chose **Option 2 (Hub-and-Spoke)** because:

1. **Centralized Control**: Agent X provides single point for workflow enforcement, logging, and error recovery
2. **Role Clarity**: Each specialized agent focuses only on producing deliverables (PRD, ADR, Code, Review)
3. **Scalability**: Easy to add new agents without changing existing ones
4. **Debugging**: All routing logic in one place makes troubleshooting easier
5. **Flexibility**: Agent X can make dynamic routing decisions based on issue state
6. **Audit Trail**: All workflow transitions logged in Agent X

### Key Architectural Principles

**Principle 1: Strict Role Separation**
- PM → PRD + Backlog creation
- UX → Wireframes + Flows + Prototypes
- Architect → ADR + Tech Specs
- Engineer → Code + Tests
- Reviewer → Review + Quality Gates
- DevOps → CI/CD + Deployment configs

**Principle 2: Universal Tool Access**
- All agents have access to all tools for maximum flexibility
- Tool restrictions would limit agent effectiveness
- Agents self-regulate tool usage based on role

**Principle 3: Template References, Not Duplication**
- Agent files reference templates (e.g., "Use PRD-TEMPLATE.md")
- Templates define structure and required sections
- Agents focus on execution steps, not template details

**Principle 4: Pre-Handoff Validation**
- Validation occurs before Status transition
- Validation scripts check artifacts exist and are complete
- Pre-commit hooks removed (too restrictive, breaks flow)

**Principle 5: Status-Driven Orchestration**
- GitHub Projects V2 Status field is source of truth
- Agent X reads Status to determine next agent
- Status transitions: Backlog → In Progress → In Review → Ready → Done

---

## Consequences

### Positive

✅ **Clear Responsibilities**: Each agent knows exactly what to produce  
✅ **Reduced Duplication**: Agent files are concise (no template copies)  
✅ **Better Debugging**: Agent X logs all routing decisions  
✅ **Flexible Execution**: Universal tool access allows creative solutions  
✅ **Maintainable**: Adding/modifying agents doesn't affect others  
✅ **Testable**: Can test agents independently  

### Negative

⚠️ **Agent X Complexity**: More logic in coordinator (state machine, routing, validation)  
⚠️ **Single Point of Failure**: If Agent X fails, workflow stops  
⚠️ **Handoff Latency**: ~30s delay through Agent X vs. direct handoff  
⚠️ **Learning Curve**: Users must understand Agent X role  

### Neutral

○ **Agent File Size**: Smaller agent files (good), but more cross-references (complexity shifts)  
○ **Tool Permissions**: No restrictions means agents must self-regulate  
○ **Validation Timing**: Pre-handoff validation is sufficient but requires discipline  

---

## Implementation

### Phase 2.1: Agent Refactoring (Week 3-4)

**Agent X (YOLO)**
- Remove detailed execution templates
- Focus on routing logic, prerequisite validation, error recovery
- Implement state machine for Status transitions
- Add structured logging for all routing decisions

**Product Manager Agent**
- Remove duplicate PRD template sections
- Reference PRD-TEMPLATE.md with quick start command
- Simplify tool descriptions (no extensive examples)
- Focus on workflow: Research → Create PRD → Create Issues → Handoff

**Architect Agent**
- Remove code examples (violates "NO CODE" policy)
- Reference ADR-TEMPLATE.md and SPEC-TEMPLATE.md
- Emphasize diagrams over implementation details
- Simplify completion checklist (remove redundant items)

**UX Designer Agent**
- Remove duplicate UX-TEMPLATE.md sections
- Add prototype creation step (PROTOTYPE-{id}.md)
- Remove lengthy completion checklist (100+ lines)
- Focus on deliverables: Wireframes + Flows + Prototypes

**Engineer Agent**
- Remove code examples (reference Skills.md instead)
- Simplify test/documentation sections
- Focus on workflow: Read Spec → Design → Implement → Test → Handoff
- Add "Pick up Story issue, Update Status" to workflow

**Reviewer Agent**
- Remove duplicate REVIEW-TEMPLATE.md sections
- Simplify approval/rejection paths
- Remove redundant label update logic
- Focus on: Review → Approve/Reject → Handoff

### Phase 2.2: Tool Access Implementation

**Tool Mapping** (All tools available to all agents):

```yaml
common_tools:
  - issue_read
  - list_issues
  - update_issue
  - add_issue_comment
  - read_file
  - semantic_search
  - grep_search
  - file_search
  - list_dir
  - manage_todo_list
  - runSubagent

agent_x_tools:
  - run_workflow
  - list_workflow_runs
  - get_errors
  - get_changed_files

creation_tools:
  - issue_write (PM)
  - create_file (PM, Architect, UX, Engineer)
  - replace_string_in_file (Engineer)
  - multi_replace_string_in_file (Engineer)

execution_tools:
  - run_in_terminal (Engineer, Reviewer)
  - test_failure (Engineer, Reviewer)
```

### Phase 2.3: Validation Strategy

**Pre-Handoff Validation Script**

```bash
#!/bin/bash
# .github/scripts/validate-handoff.sh

ISSUE=$1
ROLE=$2

case $ROLE in
  pm)
    # Check PRD exists
    [ -f "docs/prd/PRD-${ISSUE}.md" ] || exit 1
    # Check Feature/Story issues created
    gh issue list --search "parent:#${ISSUE}" --limit 1 || exit 1
    ;;
  
  ux)
    # Check UX doc exists
    [ -f "docs/ux/UX-${ISSUE}.md" ] || exit 1
    # Check prototype exists (if applicable)
    ;;
  
  architect)
    # Check ADR exists
    [ -f "docs/adr/ADR-${ISSUE}.md" ] || exit 1
    # Check Tech Spec exists
    find docs/specs -name "SPEC-*.md" | grep -q . || exit 1
    ;;
  
  engineer)
    # Check code committed
    git log --oneline | grep -q "#${ISSUE}" || exit 1
    # Check tests exist
    find . -name "*Test*.cs" -o -name "*test*.py" | grep -q . || exit 1
    # Check coverage ≥80%
    ;;
  
  reviewer)
    # Check review doc exists
    [ -f "docs/reviews/REVIEW-${ISSUE}.md" ] || exit 1
    ;;
esac
```

### Phase 2.4: Status Transition Logic

**Agent X Routing Logic**

```typescript
async function routeIssue(issue: Issue): Promise<Agent> {
  const status = await getProjectStatus(issue.number);
  const labels = issue.labels.map(l => l.name);
  
  // Route based on type + status
  if (labels.includes('type:epic') && status === 'Backlog') {
    return 'product-manager';
  }
  
  if (status === 'Ready' && labels.includes('needs:ux')) {
    return 'ux-designer';
  }
  
  if (status === 'Ready' && !hasUXDesign(issue)) {
    return 'architect';
  }
  
  if (status === 'Ready' && hasArchitecture(issue)) {
    return 'engineer';
  }
  
  if (status === 'In Review') {
    return 'reviewer';
  }
  
  throw new Error(`Cannot route issue #${issue.number} with status ${status}`);
}
```

### Phase 2.5: Template Alignment

**Agent File Structure** (Standardized):

```markdown
# {Agent Name} Agent

## Role
{Single paragraph: what this agent produces}

## Workflow
{Diagram: Input → Process → Output → Handoff}

## Execution Steps
1. Check prerequisites
2. Read context
3. Research (if needed)
4. Create deliverable
5. Self-review
6. Commit changes
7. Update Status

## Tools & Capabilities
{Brief list of tools with use cases}

## Handoff Protocol
{Steps to hand off to next agent}

## Enforcement
{Validation requirements before handoff}

## References
{Links to templates, Skills.md, AGENTS.md}
```

---

## Rollout Plan

### Week 3: Agent X + PM + Architect
1. Refactor Agent X (remove execution templates)
2. Refactor PM Agent (reference PRD-TEMPLATE.md)
3. Refactor Architect Agent (remove code examples)
4. Test: Epic → PM → Architect flow

### Week 4: UX + Engineer + Reviewer
1. Refactor UX Agent (add prototypes)
2. Refactor Engineer Agent (reference Skills.md)
3. Refactor Reviewer Agent (simplify approval path)
4. Test: Full workflow Epic → Done

### Week 5: Validation + Documentation
1. Implement validate-handoff.sh script
2. Update AGENTS.md with new architecture
3. Create example deliverables (PRD, ADR, Spec, Review)
4. Test end-to-end with real scenario

### Week 6: Final Testing + Release
1. Test on Windows, Linux, macOS
2. Update installation scripts
3. Create migration guide for existing users
4. Release Phase 2

---

## Monitoring & Success Criteria

### Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent file size reduction | -40% | Line count comparison |
| Template duplication | 0% | No template content in agent files |
| Handoff success rate | 99% | GitHub Actions workflow success |
| Validation failures | <5% | Pre-handoff validation script failures |
| User adoption | 80%+ | Issues following workflow |

### Success Indicators

✅ **Agent files are concise** - Each agent file <500 lines  
✅ **No template duplication** - grep finds no template sections in agent files  
✅ **Clear role boundaries** - Each agent produces exactly one deliverable type  
✅ **Validation works** - Pre-handoff validation catches issues before handoff  
✅ **Users understand workflow** - GitHub Discussions show comprehension  

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Agent X becomes bottleneck** | Optimize routing logic, add caching |
| **Validation too strict** | Allow manual override with `--force` flag |
| **Tool access abuse** | Add usage guidelines, monitor tool calls |
| **Breaking changes for users** | Provide migration guide, maintain backward compatibility for 1 release |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-28 | Hub-and-Spoke architecture | Centralized control, clear audit trail |
| 2026-01-28 | Universal tool access | Maximum flexibility for agents |
| 2026-01-28 | Pre-handoff validation only | Pre-commit too restrictive, breaks flow |
| 2026-01-28 | Status-driven orchestration | GitHub Projects V2 is source of truth |
| 2026-01-28 | Template references, not duplication | Reduce agent file size, single source of truth |

---

## Open Questions & Future Considerations

### Resolved in PRD

1. ✅ **Agent coordination**: Through Agent X (centralized control)
2. ✅ **Template customization**: Customization guide needed
3. ✅ **Parallel execution**: Use feature branches per Story
4. ✅ **Agent role clarity**: Strict separation (PM=PRD, Arch=ADR, Eng=Code)
5. ✅ **Status transitions**: Agents update via Projects board
6. ✅ **Validation timing**: Pre-handoff only
7. ✅ **Tool access**: All tools accessible to all agents

### Future Enhancements

- **Dynamic routing**: Agent X learns optimal routing from historical data
- **Parallel agent execution**: Multiple engineers work simultaneously
- **Agent performance metrics**: Track time per agent, quality of deliverables
- **Custom validation rules**: Users define project-specific validation
- **Agent plugins**: Third-party agents integrate with AgentX

---

## References

- **PRD**: [PRD-AGENTX.md](../prd/PRD-AGENTX.md)
- **Templates**: [.github/templates/](../../.github/templates/)
- **Skills**: [Skills.md](../../Skills.md)
- **Workflow**: [AGENTS.md](../../AGENTS.md)

### Related ADRs

- ADR-91: MCP Integration for GitHub API Access

### External Resources

- [Hub-and-Spoke Pattern](https://en.wikipedia.org/wiki/Spoke%E2%80%93hub_distribution_paradigm)
- [GitHub Projects V2 API](https://docs.github.com/en/graphql/reference/objects#projectv2)
- [Design Thinking (IDEO)](https://www.ideou.com/blogs/inspiration/what-is-design-thinking)

---

**Architect**: GitHub Copilot (Claude Sonnet 4.5)  
**Date**: January 28, 2026  
**Status**: Approved - Ready for Implementation
