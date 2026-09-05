# Coding harness research and design council

**Retrieved**: 2026-09-05. Public primary sources; no private code submitted.

## Findings and adoption

| Primary source | Supported practice | AgentX decision |
|---------------|--------------------|-----------------|
| [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Just-in-time retrieval, compact system instructions, retained decisions after compaction | Keep paths/evidence in handoffs; load active skills, not entire catalogs |
| [Long-running agent harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Explicit feature state, incremental work, regression checks; premature completion is a known failure | Requirements remain incomplete until execution evidence exists |
| [OpenAI code verification](https://alignment.openai.com/scaling-code-verification/) | Verify findings with repository context and execution; precision matters for reviewer trust | Prioritize actionable findings, no issue quotas or cosmetic scores masquerading as correctness |
| [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system) | Delegation can improve breadth but multiplies token use; coding has fewer independent tasks | Bound workers, output and retries; parallelize only independent ownership |
| [Skill authoring](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | Metadata first, body on activation, reference material on demand | Optimize existing skills; preserve mandatory gates and concrete acceptance tests |
| [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) | Cache writes and cache reads have different pricing and eligibility | Explicit rate fields; stable prefixes are useful, cache hits are never assumed |
| [Copilot billing](https://docs.github.com/en/billing/concepts/product-billing/github-copilot-billing) | Billing depends on plan and current usage model | Keep host credits separate from API-dollar estimates; no universal conversion |
| [Model availability](https://docs.github.com/en/copilot/reference/ai-models/supported-models) | Available model/host combinations change | Resolve actual capabilities from the active host; record source/date for limits and pricing |

The research agent could verify metadata but not the rendered body of
[OpenAI harness engineering](https://openai.com/index/harness-engineering/).
It is background reading, not the basis for a quoted implementation requirement.
Vendor reported improvements are not AgentX performance benchmarks.

## Three-perspective Model Council

### Architecture: GPT-5.4 (`harness-design`)

Extend existing deterministic tools. Keep provider selection with adapters.
Require explicit unknown/unpriced states, installed-boundary tests and accurate
coverage reports. No second paid routing authority.

### Economics/evaluation: Gemini 3.7 Flash (`harness-economics-design`)

Prefer explicit usage, limits and rate cards to hardcoded model/pricing tables.
Include retries/delegated attempts and cache-write costs. Evaluate cost per
verified success, not tokens per answer. Evidence beats model-brand prestige.

### Research: Claude Sonnet 5 (`harness-public-research`)

Primary-source practices favor bounded context, explicit task state and executed
verification. Multi-agent research gains do not automatically transfer to coding;
measure representative tasks and report false positives.

## Synthesis

Select deterministic preflight plus improved existing gates, with compact
model-adaptive guidance. Reject docs-only enforcement and an autonomous provider
rewrite. Override the economics example that labelled subscription calls `$0`:
missing dollar prices stay unknown. Its illustrative model prices are not used.
No newest-model superiority claim or automatic cheap-model downgrade is adopted.

## Quality and economics contract

- Verify requirements and correctness before optimizing spend.
- Preserve security rules, tool-result pairing, open defects and ownership
  through compaction. Reserve response/tool headroom before truncation.
- Prefer measured provider token usage; character estimates are explicitly
  approximate and are not invoices or exact context occupancy.
- Normalize provider counters before costing: input includes cached subsets;
  output includes reasoning tokens when the provider counts them together.
- Separate cache reads, writes, uncached input, output and provider credits.
- Missing price/capability/usage means unknown, not zero or approved.
- Count all attempts, retries and delegated calls in cost totals.
- Cost per verified task includes failed attempt costs; a zero-success run has
  no valid cost-per-success denominator.
- Evaluate models with representative held-out tasks and report failures,
  repeatability and reviewer disagreement; a larger model is not automatically
  a calibrated judge.
- Never refresh evidence by modifying timestamps, copying old reports or
  declaring a skipped check passed.
