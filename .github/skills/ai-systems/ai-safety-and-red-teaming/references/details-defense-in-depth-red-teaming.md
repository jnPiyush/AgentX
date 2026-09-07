# AI Safety and Red-Teaming Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

## Defense in Depth

```
[User input] -> [Input guardrails] -> [System prompt + RAG]
                                              |
                                              v
                              [Indirect-injection scrubber on retrieved content]
                                              |
                                              v
                                       [Model inference]
                                              |
                                              v
                          [Tool-call policy gate (allowlist + arg validation)]
                                              |
                                              v
                              [Output guardrails] -> [User]
```

No single layer is sufficient. Each layer must fail closed.

---

## Red-Teaming

Continuous, not one-off. Run before release and on a schedule.

| Tool | Use For |
|------|---------|
| **Microsoft PyRIT** | Automated multi-turn attacks, framework |
| **Garak** | Probes for known LLM vulnerabilities (DAN, prompt leaks, encoding tricks) |
| **promptfoo redteam** | CI-runnable adversarial test suites |
| **Stanford HELM Safety**, **HarmBench** | Benchmarks |
| Manual red team | Domain-specific harms regulators care about |

Required release artifact: red-team report covering each row of the threat model with pass/fail and evidence.

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| Quality measurement (incl. safety scores) | `ai-evaluation` |
| Prompt-level guardrail wording | `prompt-engineering` |
| Tool argument hardening | `tool-use-and-function-calling` |
| RAG-specific injection points | `rag-pipelines` |
| Tracing blocks and reasons | `agent-observability` |
