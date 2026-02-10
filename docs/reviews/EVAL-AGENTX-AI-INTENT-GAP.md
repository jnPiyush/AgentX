# AgentX Framework Evaluation: AI Intent Preservation Gap

> **Evaluation Date**: 2025  
> **Triggered By**: SalesAccountReviewAgent live test — user requested "AI agent" but AgentX produced a rule-based system  
> **Scope**: Framework-level root cause analysis (NOT a fix for SalesAgent)  
> **Verdict**: 5 systemic gaps identified, all addressable with targeted changes

---

## 1. Executive Summary

When a user requested "build an AI agent to review existing customer sales accounts," the AgentX pipeline (PM → Architect → Engineer) produced a pure rule-based system with hardcoded scoring formulas — **zero LLM integration**. The Architect explicitly rejected LLMs in the ADR alternatives table.

This is NOT a one-off mistake. It's a **systemic framework gap**: AgentX has no mechanism to detect, classify, preserve, or enforce AI/ML intent from user requests. The gap exists across all 4 pipeline agents (Agent X, PM, Architect, Engineer) and all 3 core templates (PRD, ADR, SPEC).

---

## 2. Decision Chain Trace

### What happened step-by-step

| Step | Agent | What Happened | What Should Have Happened |
|------|-------|---------------|---------------------------|
| 1 | **User** | Said "build AI agent to review sales accounts" | — |
| 2 | **Agent X** | Classified as `type:epic`, routed to PM | Should have detected "AI agent" keywords and added `needs:ai` flag |
| 3 | **PM** | Wrote PRD with contradictory content: Req #4 says "AI-powered analysis" BUT Section 7 Constraints says "No external AI API required (rule-based + statistical analysis)" | Should have classified domain as AI/ML, consulted `ai-agent-development` skill, added explicit "AI/ML Requirements" section |
| 4 | **Architect** | Read contradictory PRD, prioritized "deterministic/offline" constraint over "AI-powered" requirement. Explicitly rejected LLMs: `"LLM-based analysis \| Requires API, non-deterministic \| Rejected (for v1)"` | Should have flagged the PRD contradiction, consulted AI skill for architecture patterns, designed hybrid architecture (rule-based + LLM) |
| 5 | **Engineer** | Faithfully implemented rule-based scoring with hardcoded formulas. Built 19 source files, 49 tests — all passing | Would have implemented LLM integration if spec required it — Engineer followed spec correctly |
| 6 | **Reviewer** | Approved code quality, tests, documentation — all good | Should have checked "Does implementation match user's original AI intent?" |

### Root cause

The PM introduced a **constraint that contradicted the user's core intent**, and no downstream agent caught the contradiction. The Architect then made the rational choice given the contradictory PRD (chose determinism over AI). The pipeline has no "intent preservation" check at any stage.

---

## 3. Systemic Gaps Identified

### Gap 1: No Domain Classification in Agent X Routing

**Where**: `.github/agents/agent-x.agent.md` — Routing Logic (lines 220-290)

**Evidence**: The routing function classifies issues ONLY by structural type:
```javascript
const isEpic = labels.includes('type:epic');
const isFeature = labels.includes('type:feature');
const isStory = labels.includes('type:story');
const isBug = labels.includes('type:bug');
const isSpike = labels.includes('type:spike');
```

There is ZERO domain-aware classification. Agent X never checks if the user's request involves:
- AI/ML/LLM capabilities
- Web frontend vs backend vs data pipeline
- Infrastructure vs application code

**Impact**: When a user says "build AI agent," Agent X treats it identically to "build a CRUD app" — same routing, same templates, same workflow. No `needs:ai` label or flag is created.

**Contrast**: Agent X DOES have domain detection for UX (`needs:ux` label check), proving the pattern works — it just wasn't extended to AI/ML.

---

### Gap 2: No AI/ML Requirements Section in PRD Template

**Where**: `.github/templates/PRD-TEMPLATE.md` (347 lines)

**Evidence**: The PRD template has 12 sections:
1. Problem Statement
2. Target Users  
3. Goals & Metrics
4. Requirements (P0/P1/P2 functional + NFRs)
5. User Stories & Features
6. User Flows
7. Dependencies & Constraints
8. Risks & Mitigations
9. Timeline & Milestones
10. Out of Scope
11. Open Questions
12. Appendix

**Missing**: No "AI/ML Requirements" section that prompts the PM to:
- Classify whether the product involves AI/ML capabilities
- Specify model requirements (model type, provider, latency, cost)
- Define inference patterns (real-time vs batch, RAG vs fine-tuned)
- Document training data needs
- Set accuracy/quality thresholds

**Impact**: PM wrote a PRD that says "AI-powered" in the description but "rule-based, no API" in constraints — because nothing in the template prompted them to explicitly resolve this tension.

---

### Gap 3: No AI Architecture Section in ADR/SPEC Templates

**Where**: `.github/templates/ADR-TEMPLATE.md` (219 lines), `.github/templates/SPEC-TEMPLATE.md` (1052 lines)

**ADR Template Evidence**: The Options Considered table is generic:
```
| Option | Pros | Cons | Effort | Risk |
```

No guidance to include AI/ML-specific options (LLM integration, model selection, inference infrastructure) when the project involves AI capabilities.

**SPEC Template Evidence**: 13 sections covering API, Data Models, Service Layer, Security, Performance, Testing, Implementation, Monitoring — but NO:
- AI/ML Architecture section (model selection, prompt engineering, context management)
- Inference Pipeline design (request flow, model invocation, response parsing)
- Agent Orchestration patterns (single agent, multi-agent, workflows)
- Evaluation Strategy (quality metrics, ground truth, evaluation datasets)

**Impact**: The Architect had no template guidance to design an AI architecture, so defaulted to familiar patterns (rule-based engines, scoring algorithms).

---

### Gap 4: Dead AI Skill — Exists but Never Triggered

**Where**: `.github/skills/ai-systems/ai-agent-development/SKILL.md` (376 lines)

**Evidence**: This skill is **comprehensive** and contains exactly what was needed:
- Agent Framework installation (Python/C#)
- Model selection table (gpt-5.2, claude-opus-4-5, o3, etc.)
- Single agent and multi-agent orchestration patterns
- Tracing/observability setup
- Evaluation workflows with built-in evaluators
- Production checklist
- Security and performance best practices

**BUT**: Zero agent definitions reference this skill. Searching all `.agent.md` files for "skill", "SKILL.md", "ai-agent-development", or "ai-systems" returns:
- `devops.agent.md` → References Skills #26, #27, #28, #04 (DevOps-specific skills)
- `reviewer.agent.md` → References Skills #04 (Security)
- `product-manager.agent.md` → **No skill references**
- `architect.agent.md` → **No skill references**  
- `engineer.agent.md` → **No skill references**

The DevOps agent has explicit skill references proving the pattern works. The core pipeline agents (PM, Architect, Engineer) simply don't reference the AI skill.

**Additional irony**: All agents have AITK tools listed in their `tools:` frontmatter (`aitk_get_agent_code_gen_best_practices`, `aitk_get_ai_model_guidance`, etc.) but NO instructions or conditions that tell agents WHEN to use these tools.

---

### Gap 5: No Intent Preservation Check in Self-Reviews

**Where**: All agent self-review checklists

**PM Self-Review** (`product-manager.agent.md` lines 137-155):
```
- Did I fully understand the user's problem?
- Are all functional requirements captured?
- Did I miss any user stories or edge cases?
- Are acceptance criteria specific and testable?
```
Missing: "Did I preserve the user's stated technology intent (AI/ML/LLM)?"

**Architect Self-Review** (`architect.agent.md` lines 155-172):
```
- Did I cover ALL Features and Stories in backlog?
- Are API contracts fully specified?
- Is the architecture scalable and maintainable?
- Did I follow SOLID principles?
```
Missing: "Did I honor the user's core technology intent? If user said 'AI agent,' does my architecture include AI/ML components?"

**Engineer Self-Review**: Follows spec faithfully — not the root cause, but could add: "Does the implementation match the user's original request (not just the spec)?"

**Reviewer Checklist**: Reviews code quality, tests, security — but not alignment with user's original intent.

**Impact**: The PM introduced a constraint that contradicted the user's intent, and neither the PM's own self-review nor any downstream agent's review caught it.

---

## 4. Comparative Evidence

### Skills that ARE triggered vs. skills that AREN'T

| Agent | Skills Referenced | AI Skill Referenced? |
|-------|-------------------|----------------------|
| DevOps | #26 GitHub Actions, #27 CI/CD, #28 Releases, #04 Security | N/A (not in pipeline) |
| Reviewer | #04 Security, Code Review & Audit | ❌ No |
| PM | None | ❌ No |
| Architect | None | ❌ No |
| Engineer | None | ❌ No |

The pattern of referencing skills in agent definitions exists (DevOps does it extensively). It was simply never applied to the AI skill for the core pipeline agents.

### AITK Tools: Present but unguided

All 7 agents have these tools in their `tools:` frontmatter:
- `aitk_get_agent_code_gen_best_practices`
- `aitk_get_ai_model_guidance`
- `aitk_get_agent_model_code_sample`
- `aitk_get_tracing_code_gen_best_practices`
- `aitk_get_evaluation_code_gen_best_practices`
- `aitk_convert_declarative_agent_to_code`
- `aitk_evaluation_agent_runner_best_practices`
- `aitk_evaluation_planner`

But no agent has instructions saying: "When the user request involves AI/ML/LLM capabilities, invoke these tools." The tools are available but never triggered.

---

## 5. Improvement Recommendations

### R1: Add Domain Classification to Agent X (HIGH PRIORITY)

**File**: `.github/agents/agent-x.agent.md`

**Change**: Add a domain classification step before routing. When keywords like "AI", "LLM", "ML", "agent" (in AI context), "model", "GPT", "inference", "NLP" are detected in the user's request or issue body, add a `needs:ai` label.

**Proposed logic** (add to routing function):
```javascript
// Domain classification (after type classification)
const aiKeywords = /\b(AI|LLM|ML|machine learning|deep learning|GPT|model|inference|NLP|neural|agent framework|foundry|openai|anthropic|gemini)\b/i;
const isAIDomain = aiKeywords.test(issue.title + ' ' + issue.body);

if (isAIDomain && !labels.includes('needs:ai')) {
  await issue_write({ method: 'update', issue_number, labels: [...labels, 'needs:ai'] });
}
```

**Impact**: All downstream agents can check for `needs:ai` label and activate AI-specific workflows.

---

### R2: Add AI/ML Requirements Section to PRD Template (HIGH PRIORITY)

**File**: `.github/templates/PRD-TEMPLATE.md`

**Change**: Add a new section after "Requirements" (Section 4):

```markdown
## 4b. AI/ML Requirements (if applicable)

> **Trigger**: Include this section when the user request involves AI, ML, LLM, or intelligent automation.

### Technology Classification
- [ ] AI/ML powered (requires model inference)
- [ ] Rule-based / statistical (no model needed)
- [ ] Hybrid (rule-based + AI enhancement)

### Model Requirements
| Requirement | Specification |
|-------------|---------------|
| Model Type | LLM / Vision / Embedding / Custom |
| Provider | Microsoft Foundry / OpenAI / Anthropic / Local |
| Latency | Real-time (<2s) / Near-real-time (<10s) / Batch |
| Quality Threshold | Accuracy ≥ X% / Coherence ≥ Y |
| Cost Budget | $ per 1M tokens / per request / per month |

### Inference Pattern
- [ ] Real-time API (user-facing, low latency)
- [ ] Batch processing (offline, high throughput)
- [ ] RAG (retrieval-augmented generation)
- [ ] Fine-tuned model
- [ ] Agent with tools (function calling)

### Data Requirements
- Training/evaluation data source: {source}
- Data sensitivity: PII / Confidential / Public
- Volume: {requests per hour/day}
```

**Impact**: Forces PM to explicitly classify whether the project needs AI and capture model requirements, eliminating the contradiction problem.

---

### R3: Add AI Architecture Section to ADR and SPEC Templates (MEDIUM PRIORITY)

**File**: `.github/templates/ADR-TEMPLATE.md`

**Change**: Add conditional section:

```markdown
## AI/ML Architecture (if `needs:ai` label present)

### Model Selection Decision
| Model | Context Window | Cost | Latency | Selected? |
|-------|---------------|------|---------|-----------|
| | | | | |

### Agent Architecture Pattern
- [ ] Single Agent (simple tool use)
- [ ] Multi-Agent Orchestration (sequential/parallel)
- [ ] Human-in-the-Loop
- [ ] Reflection/Self-Correction

### Inference Pipeline
{Diagram: Request → Preprocessing → Model Call → Postprocessing → Response}

> **Reference**: Read `.github/skills/ai-systems/ai-agent-development/SKILL.md` for patterns
```

**File**: `.github/templates/SPEC-TEMPLATE.md`

**Change**: Add new section "13. AI/ML Specification":

```markdown
## 13. AI/ML Specification (if `needs:ai` label present)

### Model Configuration
- Model: {name}
- Endpoint: {url or environment variable}
- System prompt: {summary}
- Temperature / Top-P: {values}
- Max tokens: {value}
- Structured output schema: {if applicable}

### Agent Tools/Functions
| Tool Name | Purpose | Input | Output |
|-----------|---------|-------|--------|
| | | | |

### Evaluation Strategy
- Evaluators: {list from ai-agent-development skill}
- Test dataset: {source}
- Quality thresholds: {metrics}

> **Reference**: Read `.github/skills/ai-systems/ai-agent-development/SKILL.md` for implementation patterns
```

---

### R4: Wire AI Skill into Agent Definitions (HIGH PRIORITY)

**Files**: `product-manager.agent.md`, `architect.agent.md`, `engineer.agent.md`

**Change for PM** — Add to Research step:
```markdown
### 1b. Domain Classification

If the user's request contains AI/ML/LLM-related keywords:
1. Add `needs:ai` label to the issue
2. Read `.github/skills/ai-systems/ai-agent-development/SKILL.md`
3. Use the "AI/ML Requirements" section in the PRD template
4. Do NOT add constraints that contradict AI intent (e.g., "no external API" when user asked for AI agent)
```

**Change for Architect** — Add to Research step:
```markdown
### 2b. AI-Aware Research (if `needs:ai` label present)

When the issue has `needs:ai` label:
1. **MUST READ** `.github/skills/ai-systems/ai-agent-development/SKILL.md`
2. **MUST USE** AITK tools:
   - `aitk_get_ai_model_guidance` for model selection
   - `aitk_get_agent_code_gen_best_practices` for architecture patterns
3. **MUST INCLUDE** AI/ML Architecture section in ADR
4. **MUST CONSIDER** Agent Framework patterns (Single Agent, Multi-Agent, Workflows)
5. **MUST NOT** reject AI/ML approaches without explicit user confirmation
```

**Change for Engineer** — Add to Implementation step:
```markdown
### Implementation (if `needs:ai` label present)

When implementing AI-powered features:
1. Read `.github/skills/ai-systems/ai-agent-development/SKILL.md`
2. Use AITK tools for code generation:
   - `aitk_get_agent_model_code_sample` for agent code
   - `aitk_get_tracing_code_gen_best_practices` for observability
3. Follow the Production Checklist from the AI skill
4. Include evaluation setup if specified in tech spec
```

---

### R5: Add Intent Preservation to Self-Review Checklists (MEDIUM PRIORITY)

**Files**: All `.agent.md` files with self-review sections

**Add to PM self-review**:
```markdown
- Did I preserve the user's stated technology intent (AI/ML/LLM)?
- If user said "AI agent," does the PRD include AI/ML Requirements section?
- Are there any constraints that contradict the user's core intent?
```

**Add to Architect self-review**:
```markdown
- Does my architecture honor the user's original technology request?
- If `needs:ai` label is present, did I include AI/ML architecture?
- Did I consult the ai-agent-development skill?
- Did I flag any PRD contradictions (e.g., "AI-powered" vs "rule-based")?
```

**Add to Reviewer checklist**:
```markdown
- Does the implementation align with the user's original request?
- If user requested "AI agent," does the code include LLM integration?
- Were any user intent keywords (AI, ML, LLM) lost in the pipeline?
```

---

## 6. Priority Matrix

| # | Recommendation | Priority | Effort | Impact | Files Changed |
|---|---------------|----------|--------|--------|---------------|
| R1 | Domain Classification in Agent X | **HIGH** | Low | High | 1 file |
| R2 | AI/ML Requirements in PRD Template | **HIGH** | Low | High | 1 file |
| R4 | Wire AI Skill into Agent Definitions | **HIGH** | Medium | High | 3 files |
| R3 | AI Sections in ADR/SPEC Templates | **MEDIUM** | Medium | Medium | 2 files |
| R5 | Intent Preservation in Self-Reviews | **MEDIUM** | Low | Medium | 4-5 files |

**Total effort**: ~8 files modified, no new files needed (the AI skill already exists).

---

## 7. Validation Plan

After implementing the changes, re-run the SalesAccountReviewAgent test:

1. Same user request: "build an AI agent to review existing customer sales accounts"
2. **Expected Agent X behavior**: Detects "AI agent" keywords → adds `needs:ai` label
3. **Expected PM behavior**: Reads AI skill → fills AI/ML Requirements section → no contradictory constraints
4. **Expected Architect behavior**: Reads AI skill → designs LLM-integrated architecture → uses Agent Framework patterns
5. **Expected Engineer behavior**: Reads AI skill → implements with LLM integration (model calls, prompt templates, etc.)
6. **Success criteria**: The output project includes actual LLM integration (model API calls, prompt engineering, agent orchestration)

---

## 8. Broader Implications

This gap pattern likely affects other domain-specific capabilities beyond AI/ML:

- **Data Engineering** requests may lose ETL/pipeline intent
- **Real-time** requests may lose WebSocket/streaming intent  
- **Mobile** requests may lose native app intent

The solution (domain classification + conditional template sections + skill wiring) is extensible. The same `needs:ai` pattern can become `needs:realtime`, `needs:data-pipeline`, etc.

---

**Generated by**: AgentX Framework Evaluation  
**Version**: 1.0
