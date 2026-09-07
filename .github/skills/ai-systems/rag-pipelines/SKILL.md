---
name: "rag-pipelines"
description: 'Design and build production RAG (Retrieval-Augmented Generation) pipelines. Use when implementing document ingestion, chunking strategies, embedding selection, vector search, hybrid retrieval, reranking, or generation with grounding.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-06-15"
  updated: "2025-06-15"
compatibility:
  frameworks: ["langchain", "llamaindex", "microsoft-agent-framework", "anthropic", "azure-ai-search", "qdrant", "chroma", "pgvector"]
  languages: ["python", "typescript", "csharp"]
---

# RAG Pipelines

> **Purpose**: Build production-grade Retrieval-Augmented Generation systems that ground LLM responses in authoritative knowledge.

---

## When to Use This Skill

- Building document Q&A systems grounded in enterprise knowledge
- Implementing semantic search over unstructured documents
- Designing chunking strategies for different document types
- Selecting and configuring vector databases for retrieval
- Implementing hybrid search (keyword + semantic) and reranking
- Optimizing retrieval quality (precision, recall, faithfulness)

## Prerequisites

- Document corpus to index
- Embedding model access (OpenAI, Azure OpenAI, or open-source)
- Vector store or search service
- LLM for generation

## Decision Guide

Use RAG when the gap is knowledge access, not behavior control. Start with hybrid retrieval plus reranking for production defaults. If the main gap is behavior or formatting, fix prompts, tools, or fine-tuning instead of stuffing more documents into context.

## Why This Is a Skill

RAG quality depends on chunking, metadata, retrieval, reranking, and grounding discipline working together. This skill keeps those moving parts explicit so teams do not confuse "vector search exists" with a production retrieval system.

## Workflow

1. Define the corpus, metadata, and evaluation questions.
2. Choose chunking, embedding, and indexing strategies that fit document shape and scale.
3. Retrieve and rerank the smallest evidence set that can answer the query.
4. Ground generation on that evidence and validate quality and latency before promotion.

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-rag-architecture.md#decision-tree).

## RAG Architecture

MUST read before selection: [Decision Tree details](references/details-decision-tree-rag-architecture.md#rag-architecture).

<a id="standard-pipeline"></a>

<a id="advanced-patterns"></a>

## Chunking Strategies

MUST read before selection: [Decision Tree details](references/details-decision-tree-rag-architecture.md#chunking-strategies).

<a id="strategy-selection"></a>

<a id="chunking-rules"></a>

<a id="parent-child-chunking"></a>

## Embedding Models

MUST read before selection: [Decision Tree details](references/details-decision-tree-rag-architecture.md#embedding-models).

<a id="embedding-best-practices"></a>

## Retrieval Strategies

MUST read before selection: [Decision Tree details](references/details-decision-tree-rag-architecture.md#retrieval-strategies).

<a id="hybrid-search-recommended-default"></a>

<a id="retrieval-configuration"></a>

<a id="reranking"></a>

## Generation with Grounding

MUST read before selection: [Decision Tree details](references/details-decision-tree-rag-architecture.md#generation-with-grounding).

<a id="prompt-template"></a>

<a id="grounding-rules"></a>

## Production Considerations

MUST read before design or implementation: [Production Considerations details](references/details-production-considerations-tools-and-frameworks.md#production-considerations).

<a id="caching"></a>

<a id="performance-optimization"></a>

## Tools and Frameworks

MUST read before design or implementation: [Production Considerations details](references/details-production-considerations-tools-and-frameworks.md#tools-and-frameworks).

## Scripts

MUST read before design or implementation: [Production Considerations details](references/details-production-considerations-tools-and-frameworks.md#scripts).

## Anti-Patterns

MUST read before design or implementation: [Production Considerations details](references/details-production-considerations-tools-and-frameworks.md#anti-patterns).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Irrelevant retrieval results | Improve chunking, add reranking, tune similarity threshold |
| Hallucinations despite context | Strengthen grounding prompt, reduce temperature, check context quality |
| Slow retrieval | Add metadata pre-filtering, use ANN index, cache embeddings |
| Missing information in answers | Increase top-K, improve chunk overlap, check document coverage |
| Contradictory answers | Deduplicate chunks, add source freshness weighting |
| High token cost | Compress context, use smaller chunks, cache frequent queries |

---

## References

- [Decision Tree details](references/details-decision-tree-rag-architecture.md) - must read before selection.
- [Production Considerations details](references/details-production-considerations-tools-and-frameworks.md) - must read before design or implementation.
- [Ai Evaluation skill](../ai-evaluation/SKILL.md)
- [Model Fine Tuning skill](../model-fine-tuning/SKILL.md)


- [Source and related-reading index](references/details-source-reference-index.md)
