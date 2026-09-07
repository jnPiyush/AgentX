---
name: "model-fine-tuning"
description: 'Fine-tune foundation models for domain-specific tasks. Use when adapting LLMs with LoRA/QLoRA/PEFT, full fine-tuning, knowledge distillation, or designing training data pipelines for model customization.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-06-15"
  updated: "2025-06-15"
compatibility:
  frameworks: ["huggingface-transformers", "peft", "unsloth", "axolotl", "azure-ml", "openai-fine-tuning"]
  languages: ["python"]
---

# Model Fine-Tuning

> **Purpose**: Adapt pre-trained foundation models to domain-specific tasks through parameter-efficient and full fine-tuning techniques.

---

## When to Use This Skill

- Adapting an LLM to follow domain-specific instructions or style
- Improving model accuracy on specialized tasks (classification, extraction, generation)
- Reducing inference cost by distilling a large model into a smaller one
- Building training data pipelines for fine-tuning datasets
- Choosing between fine-tuning approaches (LoRA, QLoRA, full, distillation)

## Prerequisites

- Base model selection (open-source or API-based)
- Training dataset (instruction pairs, labeled examples, or preference data)
- GPU compute (local or cloud)

## Decision Guide

Fine-tune only after prompt, retrieval, and tool fixes plateau on a measured gap. Default to LoRA or QLoRA for open-weight adaptation, and use provider-native fine-tuning only when data governance and evaluation gates are ready. If the real problem is knowledge freshness, prefer RAG.

## Why This Is a Skill

Teams waste time and leak risk when they fine-tune without a baseline, clean data, or promotion gate. This skill keeps tuning attached to measurable gaps and evidence-based rollout.

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-fine-tuning-approaches.md#decision-tree).

## Fine-Tuning Approaches

MUST read before selection: [Decision Tree details](references/details-decision-tree-fine-tuning-approaches.md#fine-tuning-approaches).

## LoRA / QLoRA Deep Dive

MUST read before selection: [Decision Tree details](references/details-decision-tree-fine-tuning-approaches.md#lora-qlora-deep-dive).

<a id="key-hyperparameters"></a>

<a id="qlora-specifics"></a>

## Training Data Preparation

MUST read before selection: [Decision Tree details](references/details-decision-tree-fine-tuning-approaches.md#training-data-preparation).

<a id="data-formats"></a>

<a id="data-quality-rules"></a>

<a id="data-size-guidelines"></a>

## Training Pipeline

MUST read before selection: [Decision Tree details](references/details-decision-tree-fine-tuning-approaches.md#training-pipeline).

## Evaluation During Training

MUST read before selection: [Decision Tree details](references/details-decision-tree-fine-tuning-approaches.md#evaluation-during-training).

## Provider-Specific Fine-Tuning

MUST read before selection: [Decision Tree details](references/details-decision-tree-fine-tuning-approaches.md#provider-specific-fine-tuning).

<a id="openai-fine-tuning-api"></a>

<a id="azure-openai-fine-tuning"></a>

<a id="hugging-face-local"></a>

## Core Rules

1. **Benchmark base model first** - Evaluate the base model on your task before fine-tuning to establish an improvement baseline
2. **Start with LoRA** - Use LoRA or QLoRA as the default approach; only consider full fine-tuning when LoRA results are insufficient
3. **Validate data format** - Training data MUST match the model's expected chat template or completion format exactly
4. **Deduplicate rigorously** - Remove duplicate and near-duplicate examples from training data to prevent memorization
5. **Watch validation loss** - Stop training when validation loss plateaus or increases; do not rely on training loss alone
6. **80/10/10 split** - Use 80% train, 10% validation, 10% test split; never evaluate on training data
7. **Include refusal examples** - Add safety refusal examples in training data so the model retains the ability to decline harmful requests
8. **Merge adapters for inference** - Merge LoRA adapters into the base model for production serving to avoid inference overhead

---

## Anti-Patterns

| Mistake | Fix |
|---------|-----|
| Training too many epochs | Use early stopping; watch validation loss |
| Learning rate too high | Start low (1e-4), use warmup |
| Insufficient data diversity | Augment with varied examples, cover edge cases |
| Not evaluating on held-out set | Always split data; never train on eval set |
| Overfitting to training format | Include diverse prompt styles in training |
| Skipping base model evaluation | Benchmark base model first to measure improvement |
| Not merging LoRA adapters | Merge for inference speed; keep separate for composition |

---

## Scripts

MUST read before selection: [Decision Tree details](references/details-decision-tree-fine-tuning-approaches.md#scripts).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Out of memory during training | Reduce batch size, use gradient checkpointing, switch to QLoRA |
| Model generates repetitive text | Lower temperature, add repetition penalty, check for data duplication |
| Performance worse than base model | Check data quality, reduce epochs, verify data format |
| Loss not decreasing | Increase learning rate, check data format matches model's chat template |
| Fine-tuned model forgets general knowledge | Use lower rank, fewer epochs, or add general data |

---

## References

- [Decision Tree details](references/details-decision-tree-fine-tuning-approaches.md) - must read before selection.
- [Rag Pipelines skill](../rag-pipelines/SKILL.md)
- [Ai Evaluation skill](../ai-evaluation/SKILL.md)


- [Source and related-reading index](references/details-source-reference-index.md)
