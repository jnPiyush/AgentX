---
name: "ai-evaluation"
description: 'Evaluate AI/ML model quality, safety, and reliability. Use when designing evaluation frameworks, implementing automated evals, running benchmarks, measuring RAG quality (RAGAS), or establishing quality gates for model deployment.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-06-15"
  updated: "2025-06-15"
compatibility:
  frameworks: ["ragas", "deepeval", "promptfoo", "azure-ai-evaluation", "openai-evals", "langsmith"]
  languages: ["python", "typescript"]
---

# AI Evaluation

> **Purpose**: Systematically measure and validate AI/ML model quality across accuracy, safety, and reliability dimensions.

---

## When to Use This Skill

- Designing evaluation frameworks for LLM-based applications
- Implementing automated evaluation pipelines (CI/CD for AI)
- Measuring RAG pipeline quality (retrieval + generation)
- Running benchmarks for model selection or fine-tuning validation
- Establishing quality gates before model deployment
- Evaluating safety, bias, and alignment properties

## Prerequisites

- Test dataset with ground truth (or human evaluation plan)
- Access to the model/system under test
- Evaluation metrics selected for the task type

## Decision Tree

```
What are you evaluating?
+- Text generation quality?
|  +- Open-ended? -> Human eval + LLM-as-judge
|  +- Structured output? -> Exact match + schema validation
|  +- Summarization? -> ROUGE + faithfulness + LLM-as-judge
+- RAG pipeline?
|  +- Retrieval quality -> Context relevance, recall, precision
|  +- Generation quality -> Faithfulness, answer relevancy
|  +- End-to-end -> RAGAS framework
+- Classification / extraction?
|  +- Use standard ML metrics (accuracy, F1, precision, recall)
+- Safety / alignment?
|  +- Toxicity detection, jailbreak resistance, bias testing
+- Agent / tool use?
|  +- Tool call accuracy, task completion rate, step efficiency
+- Comparing models?
|  +- Side-by-side with same test set and metrics
```

---

## Evaluation Dimensions

| Dimension | What It Measures | Key Metrics |
|-----------|-----------------|-------------|
| **Correctness** | Factual accuracy of outputs | Accuracy, F1, exact match |
| **Faithfulness** | Grounded in provided context (no hallucination) | Faithfulness score, hallucination rate |
| **Relevance** | Output addresses the question asked | Answer relevancy, context relevancy |
| **Coherence** | Logical flow and readability | Coherence score, fluency |
| **Safety** | Free from harmful, biased, or toxic content | Toxicity rate, bias scores |
| **Robustness** | Consistent across paraphrases and edge cases | Variance across perturbations |
| **Latency** | Response time | P50, P95, P99 latency |
| **Cost** | Token usage and compute cost | Tokens per request, cost per query |

---

## RAG Evaluation (RAGAS Framework)

### Core Metrics

| Metric | Measures | Range | Target |
|--------|----------|-------|--------|
| **Faithfulness** | Is the answer grounded in retrieved context? | 0-1 | > 0.85 |
| **Answer Relevancy** | Does the answer address the question? | 0-1 | > 0.80 |
| **Context Precision** | Are retrieved chunks relevant? (ranked) | 0-1 | > 0.75 |
| **Context Recall** | Are all needed facts retrieved? | 0-1 | > 0.80 |
| **Answer Correctness** | Does the answer match ground truth? | 0-1 | > 0.75 |

### RAG Evaluation Pipeline

```
Test Dataset: [(question, ground_truth, contexts)]
                    |
                    v
            [RAG System Under Test]
                    |
                    v
            [Generated Answers + Retrieved Contexts]
                    |
                    v
            [RAGAS / DeepEval Scorer]
                    |
                    v
            [Metric Reports per Question]
                    |
                    v
            [Aggregate Scores + Failure Analysis]
```

### Component-Level Evaluation

| Component | Metrics | How to Test |
|-----------|---------|-------------|
| **Chunking** | Chunk coherence, information preservation | Compare answer quality across strategies |
| **Embedding** | Retrieval accuracy (NDCG, MRR) | Query known docs, measure rank |
| **Retrieval** | Precision@K, Recall@K, MRR | Known relevant docs per query |
| **Reranking** | NDCG improvement over base retrieval | Compare reranked vs. original order |
| **Generation** | Faithfulness, relevance, correctness | LLM-as-judge + human eval |

---

## LLM-as-Judge

### When to Use

- Open-ended generation where exact match is not possible
- Subjective quality assessment (style, helpfulness, clarity)
- Scaling evaluation beyond human annotator capacity
- Preliminary screening before human review

### Design Principles

- **MUST** use a stronger model as judge than the model being evaluated
- **MUST** provide clear rubric with scoring criteria in the judge prompt
- **MUST** test for judge bias (position bias, verbosity bias)
- **SHOULD** use structured output (JSON with score + reasoning)
- **SHOULD** calibrate with human agreement rate (>80% target)
- **MAY** use multiple judges and aggregate scores

### Judge Prompt Structure

```
You are evaluating an AI assistant's response.

## Criteria
- Correctness: Is the answer factually accurate? (1-5)
- Completeness: Does it address all parts of the question? (1-5)
- Clarity: Is the response well-organized and clear? (1-5)

## Context
Question: {question}
Reference Answer: {ground_truth}
AI Response: {generated_answer}

## Instructions
Rate the AI response on each criterion. Provide brief justification.
Output JSON: {"correctness": N, "completeness": N, "clarity": N, "reasoning": "..."}
```

---

## Evaluation Pipeline Architecture

```
[Test Dataset] --> [System Under Test] --> [Predictions]
                                               |
                                               v
                        [Automated Metrics] + [LLM-as-Judge] + [Human Eval]
                                               |
                                               v
                                        [Score Aggregation]
                                               |
                                               v
                                        [Quality Gate]
                                          |         |
                                        Pass       Fail
                                          |         |
                                       Deploy    Block + Report
```

### Quality Gate Thresholds

| Metric | Minimum | Target | Blocking? |
|--------|---------|--------|-----------|
| Faithfulness | 0.80 | 0.90 | Yes |
| Answer Relevancy | 0.75 | 0.85 | Yes |
| Context Recall | 0.70 | 0.85 | No |
| Toxicity Rate | < 0.01 | 0.00 | Yes |
| Latency P95 | < 5s | < 2s | No |
| Task Completion | 0.80 | 0.90 | Yes |

---

## Core Rules

1. **Baseline before changes** - Always evaluate the current system before making changes to establish a comparison point
2. **Ground truth required** - Every evaluation dataset MUST include verified ground truth or human-validated reference answers
3. **Stronger judge model** - LLM-as-judge MUST use a stronger model than the model being evaluated
4. **Separate eval data** - Evaluation datasets MUST NOT overlap with training or fine-tuning data
5. **Multiple dimensions** - Evaluate across correctness, faithfulness, relevance, safety, and latency -- never a single metric
6. **Reproducible runs** - Pin model versions, temperatures, and random seeds so evaluation runs are deterministic
7. **Human calibration** - LLM-as-judge scores MUST be calibrated against human agreement (target >80%)
8. **Fail-fast gates** - Blocking metrics (faithfulness, safety, task completion) MUST fail the pipeline on regression

---

## Evaluation Types

### Offline Evaluation (Pre-Deployment)

| Type | Description | Cadence |
|------|-------------|---------|
| **Regression Test** | Fixed test suite, compare across versions | Every model change |
| **Benchmark Suite** | Standard benchmarks (MMLU, HumanEval, etc.) | Model selection |
| **A/B Comparison** | Side-by-side model comparison | Before model swap |
| **Red Team** | Adversarial testing for safety | Before major release |
| **Bias Audit** | Test across demographic groups | Quarterly or before release |

### Online Evaluation (Post-Deployment)

| Type | Description | Cadence |
|------|-------------|---------|
| **User Feedback** | Thumbs up/down, ratings, corrections | Continuous |
| **Implicit Signals** | Click-through, retry rate, session length | Continuous |
| **Shadow Evaluation** | Score live traffic with eval pipeline | Continuous sample |
| **A/B Testing** | Split traffic between model versions | During rollout |

---

## Safety Evaluation

### Test Categories

| Category | Examples | Testing Approach |
|----------|---------|-----------------|
| **Toxicity** | Hate speech, profanity, threats | Toxicity classifier on outputs |
| **Bias** | Gender, racial, religious bias | Counterfactual testing |
| **Jailbreak Resistance** | Prompt injection, role-play attacks | Red team prompt library |
| **PII Leakage** | Training data extraction | Canary token detection |
| **Hallucination** | Fabricated facts, citations | Fact verification pipeline |

---

## Tools and Frameworks

| Tool | Capabilities | When to Use |
|------|-------------|-------------|
| **RAGAS** | RAG evaluation (faithfulness, relevance, recall) | RAG pipeline evaluation |
| **DeepEval** | LLM evaluation with 14+ metrics | Comprehensive LLM testing |
| **Promptfoo** | Prompt testing, red teaming, comparison | Prompt iteration and CI/CD |
| **Azure AI Evaluation** | Managed evaluation for Azure AI | Azure-native workflows |
| **LangSmith** | Tracing + evaluation for LangChain | LangChain-based systems |
| **OpenAI Evals** | Evaluation framework for OpenAI models | OpenAI model customization |
| **Inspect AI** | UK AISI evaluation framework | Safety and capability testing |

---

## Anti-Patterns

- **Single metric evaluation**: Relying only on accuracy or F1 -> Measure multiple dimensions (faithfulness, relevance, safety, latency)
- **Evaluating on training data**: Using fine-tuning examples as eval data -> Maintain a held-out test set that never touches training
- **Weak judge model**: Using the same or weaker model as judge -> Always use a stronger model for LLM-as-judge
- **No human calibration**: Trusting LLM-as-judge without human agreement checks -> Calibrate with human annotators (>80% agreement)
- **Static test sets**: Never updating evaluation datasets as the domain evolves -> Refresh test sets quarterly with new edge cases
- **Ignoring safety evals**: Skipping toxicity and jailbreak testing -> Run red-team and safety evaluations before every release
- **Vanity metrics**: Reporting only best-case results -> Report P50, P95, and worst-case performance

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scaffold-eval-pipeline.py` | Generate evaluation pipeline scaffold | `python scaffold-eval-pipeline.py --type rag --framework ragas` |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Evaluation scores inconsistent | Increase test set size; check for judge model randomness (set temperature=0) |
| LLM judge disagrees with humans | Recalibrate rubric; check for judge bias (position, verbosity) |
| High faithfulness but low correctness | Retrieved context is irrelevant; improve retrieval |
| Good metrics but bad user experience | Add user-facing evaluation (feedback loops, A/B tests) |
| Evaluation too slow for CI/CD | Sample test set; parallelize scoring; cache embeddings |

---

## References

- [RAGAS Documentation](https://docs.ragas.io/)
- [DeepEval Documentation](https://docs.deepeval.com/)
- [Promptfoo Documentation](https://www.promptfoo.dev/docs/)
- [Azure AI Evaluation](https://learn.microsoft.com/azure/ai-studio/how-to/evaluate-generative-ai-app)

---

**Related**: [Model Drift Management](../model-drift-management/SKILL.md) for production monitoring | [Feedback Loops](../feedback-loops/SKILL.md) for continuous improvement | [RAG Pipelines](../rag-pipelines/SKILL.md) for retrieval systems
