# Feedback Loops Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

## Continuous Improvement Cadence

| Cycle | Frequency | Actions | Trigger |
|-------|-----------|---------|---------|
| **Real-time** | Per-request | Guardrail updates, prompt adjustments | Safety flags |
| **Daily** | Every 24h | Feedback dashboard review, trend analysis | Scheduled |
| **Weekly** | Every 7 days | RAG index updates, prompt refinements | Enough new data |
| **Monthly** | Every 30 days | Model fine-tuning, A/B test new model | Sufficient preference data |
| **Quarterly** | Every 90 days | Full model evaluation, architecture review | Scheduled |

### Retraining Triggers

- **MUST** retrain when negative feedback rate exceeds 20% over 7 days
- **MUST** update RAG index when knowledge gap feedback exceeds 10/week
- **SHOULD** retrain when 5K+ new preference pairs accumulated
- **SHOULD** A/B test new model before full deployment
- **MAY** implement continuous learning for low-risk, high-volume use cases

---

## Metrics and Monitoring

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Positive feedback rate** | > 80% | < 70% |
| **Correction rate** | < 10% | > 20% |
| **Safety flag rate** | < 0.1% | > 0.5% |
| **Feedback collection rate** | > 15% of interactions | < 5% |
| **Time-to-improvement** | < 7 days for prompt fixes | > 14 days |
| **Model improvement after retraining** | > 3% on eval metrics | No improvement |

---

## Tools and Frameworks

| Tool | Capabilities | When to Use |
|------|-------------|-------------|
| **Argilla** | Annotation, feedback collection, dataset curation | Building training datasets from feedback |
| **Label Studio** | Multi-modal annotation, labeling workflows | Expert annotation pipelines |
| **LangSmith** | Tracing, feedback, evaluation | LangChain-based systems |
| **TRL (Transformers RL)** | RLHF, DPO, PPO training | Open-source alignment training |
| **Azure AI Studio** | Managed annotation, evaluation, deployment | Azure-native ML workflows |
| **Weights & Biases** | Experiment tracking, feedback visualization | Training monitoring |

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scaffold-feedback-loop.py` | Generate feedback collection and processing pipeline | `python scaffold-feedback-loop.py --type preference --storage postgres` |

---

## Anti-Patterns

- **No feedback collection**: Deploying AI systems without any user feedback mechanism -> Add at minimum inline thumbs up/down on every response
- **Unfiltered training data**: Using raw user feedback directly for fine-tuning without quality checks -> Filter, deduplicate, and score feedback before training
- **Feedback without context**: Storing ratings without the associated query and response -> Always store full context with every feedback signal
- **Ignoring negative signals**: Only acting on positive feedback -> Prioritize negative feedback for failure analysis and prompt fixes
- **Delayed improvement cycles**: Accumulating feedback for months without acting -> Process safety flags in real-time, prompt fixes weekly
- **Gaming vulnerability**: No protection against adversarial or automated feedback -> Add spam filters and weight by user trust score

---
