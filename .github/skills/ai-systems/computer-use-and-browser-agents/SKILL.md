---
name: "computer-use-and-browser-agents"
description: 'Build agents that operate browsers and desktop GUIs via screenshots and actions. Covers Anthropic Computer Use, OpenAI Operator / Computer-Using Agent (CUA), browser-use, Playwright-based agents, sandboxing (containers, VM, ephemeral profiles), permissions and approvals, failure recovery, and testing patterns.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["anthropic-computer-use", "openai-operator", "openai-cua", "browser-use", "playwright", "selenium", "puppeteer", "browserbase", "e2b", "scrapybara"]
  languages: ["python", "typescript"]
---

# Computer Use and Browser Agents

> **Purpose**: Drive a browser or desktop reliably from an LLM, without leaking credentials, taking unsafe actions, or stalling on unfamiliar UI.

---

## When to Use This Skill

- Automating workflows in apps that have no API
- Web scraping behind login, multi-step forms, captchas (where allowed)
- QA / test automation by LLM
- Internal RPA replacements
- Research agents that browse the open web

## When NOT to Use

- A stable API exists -> use it; computer-use is slow, costly, brittle
- High-frequency / sub-second tasks -> too slow
- Strict legal / ToS constraints on automation

---

## Approach Spectrum

```
[Screenshot + LLM]         <----- visual grounding ----->        [DOM + LLM]
  Anthropic Computer Use                                            browser-use
  OpenAI CUA / Operator                                             Playwright + LLM
  Most desktop agents                                               Most web-only agents
```

Visual approach: works on any UI but expensive (vision tokens, latency).
DOM approach: cheaper and more reliable on web; fails on canvas/PDF/video.

Hybrid is common: DOM where possible, screenshot fallback for non-DOM regions.

---

## Tool Surface

Typical action set:

| Action | Args |
|--------|------|
| `screenshot` | (returns image) |
| `click` | x, y or selector |
| `type` | text |
| `key` | key combo (Ctrl+L, Tab, Enter) |
| `scroll` | direction, amount |
| `navigate` | url |
| `wait` | ms or until-condition |
| `read_page` | (returns DOM-text or accessibility tree) |

Anthropic Computer Use exposes `computer`, `text_editor`, `bash`. OpenAI CUA exposes `computer`. browser-use exposes a richer DOM-aware set.

---

## Sandboxing (Required)

Never run computer-use against your own session, machine, or production browser profile.

| Sandbox | Use |
|---------|-----|
| **E2B**, **Browserbase**, **Scrapybara**, **Hyperbrowser** | Managed sandboxed browsers/desktops |
| Docker container with Chrome + Xvfb | Self-hosted, ephemeral |
| Dedicated VM | Strongest isolation |
| Ephemeral browser profile | Per-task, deleted after |

Required:

- Fresh profile per task
- Network egress allowlist (block known data-exfil targets, advertising, telemetry)
- No host credential injection
- Time-boxed lifetime
- Recording for audit (video + DOM snapshots)

---

## Permissions and Approvals

- Classify each action: **safe** (read, scroll), **mutating** (form submit, click "Buy"), **destructive** (delete, send)
- Mutating + destructive: require explicit confirmation (HITL or rule-based pre-approval)
- Sensitive sites (banking, gov, email admin): require hard-coded human approval, no auto-approve
- Honor robots.txt and ToS; legal review for production scrapers

---

## Reliability Patterns

| Failure | Mitigation |
|---------|------------|
| UI changed, selector missed | Screenshot fallback; retry with vision grounding |
| Modal / cookie banner blocks flow | Pre-action handler closes known dialogs |
| Page slow to load | Wait-for-network-idle and wait-for-element; bound retries |
| Captcha / bot detection | Stop and surface to human; do not bypass abusively |
| Infinite loop on same screen | Detect repeated screenshots / actions; break with error |
| Lost session | Detect login page; pause for re-auth |

---

## Cost and Latency

- Screenshots are large vision-token inputs
- Each turn is 2-10s typical
- A 20-step task can cost more than one full RAG query
- Mitigations: DOM-first when possible, lower-resolution screenshots when readable, caching of stable element bounding boxes

---

## Testing Patterns

- Record golden traces (screenshots + actions) for regression
- Replay against staging env on every release
- Eval suite: task-success rate, mean steps, error categories
- Add deterministic seeds where the framework supports them

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| Tool schemas and error contracts | `tool-use-and-function-calling` |
| Action observability | `agent-observability` |
| Safety review for destructive tools | `ai-safety-and-red-teaming` |
| Multi-step planning | `multi-agent-orchestration` |

## References

- Anthropic Computer Use docs
- OpenAI CUA / Operator docs
- browser-use, Playwright agent recipes
- Browserbase, E2B, Scrapybara, Hyperbrowser
