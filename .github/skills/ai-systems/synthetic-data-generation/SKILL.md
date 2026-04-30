---
name: "synthetic-data-generation"
description: 'Generate synthetic data for fine-tuning, eval-set bootstrapping, RAG corpus augmentation, and rare-case coverage. Covers Self-Instruct, Evol-Instruct, persona-based generation, distillation from larger models, dataset curation (filtering, dedup, decontamination), and provenance / dataset cards.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["distilabel", "argilla", "self-instruct", "evol-instruct", "openai", "anthropic"]
  languages: ["python"]
---

# Synthetic Data Generation

> **Purpose**: Build training and eval datasets quickly without violating user privacy, while controlling for quality, diversity, and contamination.

---

## When to Use This Skill

- Bootstrapping eval sets when you have no real labeled data
- Augmenting fine-tuning data for under-represented intents / slices
- Generating adversarial test cases (combine with `ai-safety-and-red-teaming`)
- Creating QA pairs over a private RAG corpus
- Privacy-safe substitutes for production data in dev/test

## When NOT to Use

- If real, well-labeled data exists at sufficient scale -- use it
- For final benchmark numbers in regulated decisions -- use human-labeled holdouts

---

## Common Techniques

| Technique | Use For |
|-----------|---------|
| **Self-Instruct** | Generate instruction/response pairs from a small seed |
| **Evol-Instruct** | Iteratively rewrite prompts to be deeper, broader, harder |
| **Persona-based** | Generate from N personas to enforce demographic / role diversity |
| **Distillation** | Strong-model answers used to train smaller model (check provider terms) |
| **Back-translation** | Multilingual coverage |
| **Counterfactual augmentation** | Flip protected attributes to test fairness |
| **Programmatic / templated** | Slot-fill structured data with controlled noise |
| **RAG-grounded QA** | Generate Q & A from each chunk; ideal for eval sets |

---

## Pipeline

```
1. Define target distribution and slices (intents, difficulty, demographics)
2. Choose generator model (often a strong reasoning model)
3. Seed with examples or schema
4. Generate at over-sample rate (2-5x target)
5. Quality filter: schema validation, toxicity, dedupe
6. Diversity filter: embedding clustering, slice balancing
7. Decontamination: remove overlap with eval/test sets
8. Human review on a sample (5-10%)
9. Dataset card + version + provenance
```

---

## Quality Filters

| Filter | Tool |
|--------|------|
| Schema valid | JSON Schema, Pydantic |
| Length sane | Token count bounds |
| Language correct | fastText / lid.176 |
| Toxicity / unsafe | LlamaGuard, Azure Content Safety |
| PII present | Presidio |
| Dedupe (near) | MinHash / SimHash, embedding cosine |
| Factuality (RAG) | Citation present and supports claim |
| Difficulty balanced | LLM judge classifies easy/medium/hard |

Apply filters in order from cheap to expensive.

---

## Decontamination

Critical before using synthetic data near eval sets.

- N-gram overlap (13-gram is a common threshold) against held-out eval
- Embedding-based near-duplicate detection across train and test
- Source-traceable seeds: never seed from the eval set itself

Document decontamination in the dataset card. A model that has seen its eval is not measuring what you think it is.

---

## Diversity and Bias

- Stratify by intent, language, register (formal/informal), persona, slice
- Measure diversity: distinct n-grams, embedding-cluster spread, persona coverage
- Watch for **mode collapse**: generator produces narrow patterns; mitigate with temperature, persona conditioning, or rejection sampling
- Audit for amplified bias (compare slice distributions to target)

---

## Legal and Ethical

- Check provider Terms of Service before training models on outputs (some providers restrict use to train competing models)
- Honor source licenses (do not generate near-copies of copyrighted text)
- Do not generate synthetic personally-identifying data of real individuals
- Document the generator model and prompt; downstream consumers must know provenance

---

## Dataset Card (Required Output)

- Purpose and intended use
- Generation method (model, prompt template, seeds)
- Filters applied with retention rates
- Slice distribution (counts per category)
- Decontamination evidence
- Known limitations and biases
- Version, license, contact

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| Eval set construction | `ai-evaluation` |
| Fine-tuning that consumes the data | `model-fine-tuning` |
| RAG-grounded QA generation | `rag-pipelines` |
| Bias / safety filtering | `ai-safety-and-red-teaming` |
| Drift over generations | `data-drift-strategy` |

## References

- Self-Instruct (Wang et al.), Evol-Instruct (WizardLM)
- Distilabel and Argilla pipelines
- HuggingFace datasets cards format
