---
name: "feedback-loops"
description: 'Design and implement feedback loops for continuous AI/ML improvement. Use when building RLHF/RLAIF pipelines, user feedback collection systems, reward modeling, iterative model refinement workflows, or online learning strategies.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-06-15"
  updated: "2025-06-15"
compatibility:
  frameworks: ["trl", "openai", "azure-ml", "langsmith", "argilla", "label-studio"]
  languages: ["python", "typescript"]
---

# Feedback Loops

> **Purpose**: Build systems that continuously improve AI/ML models through structured human and automated feedback mechanisms.

---

## When to Use This Skill

- Collecting and integrating user feedback into model improvement
- Implementing RLHF (Reinforcement Learning from Human Feedback) pipelines
- Designing reward models for preference-based training
- Building automated feedback systems (RLAIF - AI feedback)
- Creating annotation pipelines for training data refinement
- Establishing continuous improvement cycles for production AI systems

## Prerequisites

- Deployed AI system with feedback collection capability
- Storage for feedback data (structured database)
- Annotation pipeline or LLM-as-judge for automated feedback
- Retraining pipeline (connects to Model Fine-Tuning skill)

## Decision Tree

```
Setting up feedback?
+- What type of feedback?
|  +- User signals (thumbs up/down, ratings)?
|     -> Implicit feedback collection
|  +- User corrections (edited responses)?
|     -> Explicit feedback with preference pairs
|  +- Expert annotations (labeled data)?
|     -> Annotation pipeline
|  +- Automated (LLM-as-judge)?
|     -> RLAIF pipeline
+- What is the improvement goal?
|  +- Alignment (safety, helpfulness)?
|     -> RLHF / DPO with preference data
|  +- Accuracy (factual correctness)?
|     -> Curated fine-tuning data from corrections
|  +- Style / format?
|     -> Supervised fine-tuning on preferred outputs
|  +- Coverage (new topics)?
|     -> RAG index expansion from feedback gaps
+- How often to improve?
   +- Continuous (online learning)? -> Real-time feedback pipeline
   +- Periodic (batch retraining)? -> Scheduled feedback aggregation
   +- On-demand (triggered)? -> Threshold-based retraining
```

---

## Feedback Loop Architecture

### Full-Cycle Pipeline

```
[Users / Operators]
       |
       v
[AI System (Inference)]
       |
       v
[Response + Feedback UI]
       |
       v
[Feedback Collection]
       |
       +-- [Structured Storage (DB)]
       |        |
       |        v
       |   [Feedback Aggregation]
       |        |
       |        v
       |   [Quality Filter]
       |        |
       |        v
       |   [Training Data Builder]
       |        |
       |        v
       |   [Fine-Tuning / RLHF Pipeline]
       |        |
       |        v
       |   [Evaluation Gate]
       |        |
       |        v
       |   [Model Registry]
       |
       +-- [Analytics Dashboard]
       |        |
       |        v
       |   [Insights: Failure Patterns, Gaps, Trends]
       |
       +-- [RAG Index Update] (if feedback reveals knowledge gaps)
```

---

## Feedback Types

### User Feedback Signals

| Signal Type | Collection Method | Data Generated | Use For |
|-------------|------------------|----------------|---------|
| **Binary** | Thumbs up/down | (query, response, positive/negative) | Preference pairs |
| **Rating** | 1-5 stars | (query, response, score) | Reward model training |
| **Correction** | User edits response | (query, original, corrected) | Supervised fine-tuning |
| **Comparison** | Side-by-side preference | (query, chosen, rejected) | DPO / RLHF |
| **Free-text** | Comment box | (query, response, comment) | Root cause analysis |
| **Implicit** | Retry, copy, session length | Behavioral signals | Engagement proxy |

### Automated Feedback (RLAIF)

| Method | Description | Quality | Scale |
|--------|-------------|---------|-------|
| **LLM-as-Judge** | Stronger model scores weaker model | High | High |
| **Constitutional AI** | Model self-critiques against principles | Medium | Very High |
| **Rule-Based** | Automated checks (format, safety, length) | Varies | Very High |
| **Cross-Validation** | Multiple models score each other | Medium | High |
| **Retrieval-Based** | Check answer against known facts | High for factual | Medium |

---

## RLHF / DPO Pipeline

### Standard RLHF

```
1. Collect comparison data: (prompt, chosen_response, rejected_response)
2. Train reward model on preferences
3. Fine-tune policy model with PPO using reward model
4. Evaluate alignment improvements
5. Iterate
```

### DPO (Recommended for Simplicity)

```
1. Collect preference pairs: (prompt, chosen, rejected)
2. Fine-tune model directly on preferences (no reward model needed)
3. Evaluate against baseline
4. Iterate
```

### Preference Data Quality Rules

- **MUST** ensure clear quality difference between chosen and rejected
- **MUST** have diverse prompts covering the full task distribution
- **MUST** validate preference consistency (inter-annotator agreement > 80%)
- **SHOULD** include both easy and hard comparison pairs
- **SHOULD** balance topics and difficulty levels
- **SHOULD** remove ambiguous pairs where preference is unclear
- **MAY** use LLM-generated preferences as supplementary data (RLAIF)

---

## Feedback Collection Design

### UI Patterns

| Pattern | Friction | Quality | Best For |
|---------|---------|---------|----------|
| **Inline thumbs up/down** | Very Low | Low (binary) | High-volume, quick signal |
| **Star rating** | Low | Medium | General quality tracking |
| **Edit-in-place** | Medium | High (correction data) | Content generation, drafts |
| **Side-by-side comparison** | Medium | Very High (preference) | Model evaluation, A/B tests |
| **Flagging (report issue)** | Low | High (for negatives) | Safety, accuracy issues |
| **Post-session survey** | High | High (detailed) | Low-volume, premium users |

### Collection Rules

- **MUST** timestamp all feedback with session and query IDs
- **MUST** store the full context (query, response, model version, settings)
- **MUST** respect user privacy (anonymize where required)
- **MUST** handle feedback conflicts (same query, different ratings)
- **SHOULD** minimize user friction (1-click for common feedback)
- **SHOULD** provide optional detail input (not required)
- **MAY** incentivize feedback collection (better responses, prioritization)

---

## Feedback Processing Pipeline

### Aggregation and Filtering

```
Raw Feedback
     |
     v
[Deduplication] -> Remove duplicate feedback on same response
     |
     v
[Spam/Bot Filter] -> Remove automated or adversarial feedback
     |
     v
[Quality Scoring] -> Score feedback reliability (user history, agreement)
     |
     v
[Categorization] -> Group by failure type (accuracy, safety, format, relevance)
     |
     v
[Priority Ranking] -> Rank by severity and frequency
     |
     v
[Action Router]
     |
     +-- High-frequency accuracy issue -> Add to fine-tuning data
     +-- Safety concern -> Immediate guardrail update
     +-- Knowledge gap -> Update RAG index
     +-- Format issue -> Adjust prompt/template
     +-- Feature request -> Route to product backlog
```

### Training Data Generation from Feedback

| Feedback Type | Training Data Format | Pipeline |
|--------------|---------------------|----------|
| Corrections | `{prompt, corrected_response}` -> SFT data | Direct fine-tuning |
| Preferences | `{prompt, chosen, rejected}` -> DPO data | Preference optimization |
| Negative ratings | `{prompt, bad_response}` -> negative examples | Contrastive learning |
| Knowledge gaps | `{question, correct_answer}` -> RAG data | Index expansion |
| Safety flags | `{prompt, unsafe_response, safe_response}` -> safety data | Safety training |

---

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

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Low feedback collection rate | Reduce friction; use inline 1-click feedback; consider implicit signals |
| Feedback is noisy / contradictory | Implement quality scoring; require agreement threshold; filter outliers |
| Retraining does not improve metrics | Check data quality; ensure diverse coverage; verify evaluation methodology |
| Users game feedback system | Add anti-spam filters; weight by user trust score; cross-validate |
| Feedback loop creates bias | Monitor for distribution shift; include diverse user segments; audit regularly |

---

## References

- [Hugging Face TRL Documentation](https://huggingface.co/docs/trl)
- [Argilla Documentation](https://docs.argilla.io/)
- [Constitutional AI (Anthropic)](https://arxiv.org/abs/2212.08073)
- [DPO Paper](https://arxiv.org/abs/2305.18290)

---

**Related**: [Model Fine-Tuning](../model-fine-tuning/SKILL.md) for retraining | [AI Evaluation](../ai-evaluation/SKILL.md) for measuring improvements | [Model Drift Management](../model-drift-management/SKILL.md) for detecting degradation
