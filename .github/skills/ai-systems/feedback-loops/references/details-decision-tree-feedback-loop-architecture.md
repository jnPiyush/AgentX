# Feedback Loops Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

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

<a id="rlhf-dpo-pipeline"></a>

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
