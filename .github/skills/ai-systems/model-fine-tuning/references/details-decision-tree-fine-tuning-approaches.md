# Model Fine-Tuning Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

## Decision Tree

```
Need model customization?
+- Task-specific behavior (format, style, domain)?
|  +- Small dataset (<1K examples)?
|     +- Use few-shot prompting first -> Good enough? -> Done
|     +- Not enough? -> LoRA fine-tuning (efficient, low data)
|  +- Medium dataset (1K-50K examples)?
|     +- Use LoRA or QLoRA -> Most cost-effective
|  +- Large dataset (50K+ examples)?
|     +- Full fine-tuning (if budget allows)
|     +- Or LoRA with longer training
+- Need smaller/faster model?
|  +- Knowledge distillation from large to small model
|  +- Prune and quantize after fine-tuning
+- Need alignment (safety, helpfulness)?
|  +- DPO (Direct Preference Optimization) on preference pairs
|  +- RLHF if reward model available
+- Using API-based model (OpenAI, Azure)?
   +- Use provider fine-tuning API
   +- Prepare JSONL format per provider spec
```

---

## Fine-Tuning Approaches

| Approach | Parameters Trained | VRAM Required | Data Needed | Best For |
|----------|-------------------|---------------|-------------|----------|
| **Full Fine-Tuning** | All | Very High (80GB+) | 10K-1M+ | Maximum performance, if budget allows |
| **LoRA** | Low-rank adapters (0.1-1%) | Medium (16-24GB) | 1K-50K | Most common; great cost/quality tradeoff |
| **QLoRA** | Quantized base + LoRA | Low (8-16GB) | 1K-50K | Constrained GPU budget |
| **Prefix Tuning** | Soft prefix tokens | Low | 500-10K | Simple task adaptation |
| **Adapter Tuning** | Small adapter layers | Low-Medium | 1K-50K | Multi-task with shared base |
| **Knowledge Distillation** | Student model (all) | Medium | Large unlabeled + teacher | Deploying smaller models |
| **DPO** | Full or LoRA | Medium-High | 5K-50K preference pairs | Alignment, safety, style |

---

<a id="lora-qlora-deep-dive"></a>

## LoRA / QLoRA Deep Dive

### Key Hyperparameters

| Parameter | Recommended Range | Notes |
|-----------|------------------|-------|
| **Rank (r)** | 8-64 | Higher = more capacity, more VRAM. Start with 16 |
| **Alpha** | 16-64 | Scaling factor. Common: alpha = 2 * rank |
| **Target Modules** | q_proj, v_proj, k_proj, o_proj | Attention layers. Add gate/up/down for MLP |
| **Learning Rate** | 1e-4 to 5e-4 | Lower than full fine-tuning |
| **Epochs** | 2-5 | Watch for overfitting after epoch 3 |
| **Batch Size** | 4-16 (effective with gradient accumulation) | Balance VRAM and convergence |
| **Warmup Ratio** | 0.03-0.1 | Stabilize early training |
| **Max Seq Length** | Model-dependent | Longer = more VRAM; truncate training data |

### QLoRA Specifics

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Quantization** | 4-bit NormalFloat (nf4) | Best quality/compression tradeoff |
| **Double Quantization** | Enabled | Further reduces memory |
| **Compute Dtype** | bfloat16 | Best for modern GPUs |

---

## Training Data Preparation

### Data Formats

**Instruction Format (Chat/Instruct models):**
```json
{
  "messages": [
    {"role": "system", "content": "You are a medical coding assistant."},
    {"role": "user", "content": "Classify this diagnosis: chest pain on exertion"},
    {"role": "assistant", "content": "ICD-10: R07.9 - Chest pain, unspecified"}
  ]
}
```

**Completion Format (Base models):**
```json
{
  "prompt": "Translate to SQL: show all users who signed up last week",
  "completion": "SELECT * FROM users WHERE created_at >= DATEADD(week, -1, GETDATE())"
}
```

**Preference Format (DPO):**
```json
{
  "prompt": "Explain recursion",
  "chosen": "Recursion is when a function calls itself with a smaller input...",
  "rejected": "Recursion is basically a loop that calls itself..."
}
```

### Data Quality Rules

- **MUST** validate all training examples for format consistency
- **MUST** remove duplicates and near-duplicates
- **MUST** ensure balanced class/task distribution (no >10:1 ratio without weighting)
- **MUST** include diverse examples covering edge cases
- **SHOULD** limit examples to model's context window
- **SHOULD** use 80/10/10 train/validation/test split
- **SHOULD** include "refusal" examples for safety
- **MAY** augment data with synthetic examples from a stronger model

### Data Size Guidelines

| Task Complexity | Minimum Examples | Recommended |
|----------------|-----------------|-------------|
| Style/format adaptation | 100-500 | 1,000+ |
| Classification (few classes) | 200-1,000 | 5,000+ |
| Domain knowledge injection | 1,000-5,000 | 10,000+ |
| Complex generation | 5,000-20,000 | 50,000+ |
| General instruction following | 10,000+ | 100,000+ |

---

## Training Pipeline

```
1. Data Collection
   |
2. Data Cleaning & Validation
   |
3. Format Conversion (JSONL / chat template)
   |
4. Train/Val/Test Split
   |
5. Base Model Selection
   |
6. Hyperparameter Configuration
   |
7. Training (with eval every N steps)
   |
8. Evaluation (held-out test set + human eval)
   |
   +- Metrics good? -> Merge adapters (LoRA) or export
   +- Metrics bad? -> Adjust data/hyperparams/approach
   |
9. Model Export (merged weights, GGUF, ONNX)
   |
10. Deployment (API serving, edge, or registry)
```

---

## Evaluation During Training

| Metric | Monitor For | Alert |
|--------|-----------|-------|
| **Training Loss** | Decreasing trend | Spikes or plateaus |
| **Validation Loss** | Decreasing, then flat | Increasing = overfitting |
| **Perplexity** | Lower is better | Compare to baseline |
| **Task-Specific Metric** | Accuracy, F1, BLEU, ROUGE | Compare to base model |
| **Generation Quality** | Human review of samples | Degradation, repetition |

---

## Provider-Specific Fine-Tuning

### OpenAI Fine-Tuning API

```
Format: JSONL with {"messages": [...]}
Models: gpt-4o-mini, gpt-4o
Limits: Check current API limits
Steps: Upload file -> Create job -> Monitor -> Deploy
```

### Azure OpenAI Fine-Tuning

```
Format: JSONL with {"messages": [...]}
Models: gpt-4o-mini, gpt-4o (check region availability)
Steps: Upload -> Create customization job -> Deploy custom model
Note: Requires Azure OpenAI resource with fine-tuning enabled
```

### Hugging Face / Local

```
Frameworks: transformers + peft + trl
Quantization: bitsandbytes (QLoRA)
Serving: vLLM, TGI, llama.cpp (GGUF)
```

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scaffold-fine-tuning.py` | Generate fine-tuning pipeline scaffold | `python scaffold-fine-tuning.py --approach lora --base-model llama-3.1-8b` |

---
