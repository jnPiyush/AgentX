---
name: "rag-pipelines"
description: 'Design and build production RAG (Retrieval-Augmented Generation) pipelines. Use when implementing document ingestion, chunking strategies, embedding selection, vector search, hybrid retrieval, reranking, or generation with grounding.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-06-15"
  updated: "2025-06-15"
compatibility:
  frameworks: ["langchain", "llamaindex", "semantic-kernel", "azure-ai-search", "qdrant", "chroma", "pgvector"]
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

## Decision Tree

```
Building a RAG system?
+- What type of documents?
|  +- Short, structured (FAQ, KB articles)?
|     -> Small chunks (256-512 tokens), simple splitting
|  +- Long, unstructured (reports, papers)?
|     -> Semantic chunking, hierarchical retrieval
|  +- Code repositories?
|     -> AST-aware chunking, function-level
|  +- Multi-modal (PDFs with tables/images)?
|     -> Document intelligence + specialized parsers
+- What query patterns?
|  +- Exact lookups? -> Keyword search (BM25)
|  +- Semantic similarity? -> Vector search
|  +- Both? -> Hybrid search (recommended default)
+- Need high precision?
|  +- Add reranking (cross-encoder or Cohere Rerank)
|  +- Add metadata filtering (date, source, category)
+- Scale considerations?
   +- <100K docs -> Single vector store, simple pipeline
   +- 100K-10M docs -> Hybrid search + reranking + caching
   +- >10M docs -> Distributed index, tiered retrieval, pre-filtering
```

---

## RAG Architecture

### Standard Pipeline

```
[Documents] -> [Parser/Loader] -> [Chunker] -> [Embedder] -> [Vector Store]
                                                                    |
[User Query] -> [Embedder] -> [Retriever] -> [Reranker] -> [Top-K Contexts]
                                                                    |
                                    [Prompt Builder] <- [System Prompt + Template]
                                           |
                                    [LLM Generation]
                                           |
                                    [Response + Citations]
```

### Advanced Patterns

| Pattern | When to Use | Complexity |
|---------|-------------|------------|
| **Naive RAG** | Simple Q&A, small corpus | Low |
| **Hybrid RAG** | Production systems, diverse queries | Medium |
| **Multi-Index RAG** | Multiple document types/sources | Medium |
| **Hierarchical RAG** | Long documents, nested structure | High |
| **Agentic RAG** | Multi-step reasoning, tool use | High |
| **Graph RAG** | Entity-relationship knowledge | High |
| **Corrective RAG (CRAG)** | Self-correcting retrieval | High |
| **Self-RAG** | Adaptive retrieval decisions | High |

---

## Chunking Strategies

### Strategy Selection

| Strategy | Best For | Chunk Size | Overlap |
|----------|----------|------------|---------|
| **Fixed-size** | Uniform text, simple setup | 512-1024 tokens | 50-100 tokens |
| **Sentence-based** | Articles, documentation | 3-5 sentences | 1 sentence |
| **Paragraph-based** | Well-structured documents | Natural paragraphs | 0 |
| **Semantic** | Mixed content, varying density | Dynamic (by topic boundary) | Context-aware |
| **Recursive** | Nested structure (Markdown, HTML) | Varies by level | Level-dependent |
| **Document-specific** | Code, tables, slides | Function/table/slide | 0 |

### Chunking Rules

- **MUST** preserve semantic coherence within chunks
- **MUST** include metadata (source, page, section, timestamp)
- **MUST** test multiple chunk sizes and measure retrieval quality
- **SHOULD** add overlap to prevent information loss at boundaries
- **SHOULD** use parent-child relationships for hierarchical docs
- **SHOULD** keep chunks within the embedding model's token limit
- **MAY** store both small chunks (retrieval) and large chunks (context)

### Parent-Child Chunking

```
Document
  |
  +-- Parent Chunk (2000 tokens) -- stored for LLM context
       |
       +-- Child Chunk 1 (256 tokens) -- indexed for retrieval
       +-- Child Chunk 2 (256 tokens) -- indexed for retrieval
       +-- Child Chunk 3 (256 tokens) -- indexed for retrieval
```

Retrieve child chunks -> return parent chunk to LLM for more context.

---

## Embedding Models

| Model | Dimensions | Max Tokens | Use Case |
|-------|-----------|------------|----------|
| **text-embedding-3-large** (OpenAI) | 3072 | 8191 | Highest quality, API-based |
| **text-embedding-3-small** (OpenAI) | 1536 | 8191 | Good quality, lower cost |
| **Cohere embed-v4** | 1024 | 512 | Multilingual, on-premise option |
| **BGE-large-en-v1.5** | 1024 | 512 | Open-source, high quality |
| **all-MiniLM-L6-v2** | 384 | 256 | Lightweight, fast, local |
| **nomic-embed-text** | 768 | 8192 | Open-source, long context |

### Embedding Best Practices

- **MUST** use the same embedding model for indexing and querying
- **SHOULD** normalize embeddings for cosine similarity
- **SHOULD** benchmark embedding models on your domain data
- **MAY** use dimensionality reduction (Matryoshka) for storage savings

---

## Retrieval Strategies

### Hybrid Search (Recommended Default)

```
User Query
    |
    +-- [Keyword Search (BM25)] --> Keyword Results
    |
    +-- [Vector Search (Embeddings)] --> Semantic Results
    |
    +-- [Reciprocal Rank Fusion (RRF)] --> Merged Results
    |
    +-- [Reranker (Cross-Encoder)] --> Final Top-K
```

### Retrieval Configuration

| Parameter | Recommended | Notes |
|-----------|-------------|-------|
| **Top-K (initial)** | 20-50 | Cast wide net before reranking |
| **Top-K (final)** | 3-5 | After reranking, for LLM context |
| **Similarity Threshold** | 0.7+ (cosine) | Filter low-quality results |
| **Keyword Weight** | 0.3-0.5 | In hybrid search |
| **Semantic Weight** | 0.5-0.7 | In hybrid search |
| **Metadata Filters** | Domain-specific | Date, source, category, access level |

### Reranking

| Reranker | Type | Quality | Speed |
|----------|------|---------|-------|
| **Cohere Rerank** | API | Excellent | Fast |
| **BGE-Reranker** | Local cross-encoder | Very Good | Medium |
| **FlashRank** | Local, lightweight | Good | Fast |
| **LLM-based** | Use LLM to score relevance | Excellent | Slow |

---

## Generation with Grounding

### Prompt Template

```
You are a helpful assistant. Answer the user's question using ONLY the provided context.
If the context does not contain enough information, say "I don't have enough information."

## Context
{retrieved_chunks}

## Question
{user_question}

## Rules
- Cite sources using [Source: filename, page N]
- Do not fabricate information not in the context
- If unsure, indicate uncertainty
```

### Grounding Rules

- **MUST** instruct the model to use only provided context
- **MUST** include citation format in the prompt
- **MUST** handle "no relevant context" gracefully
- **SHOULD** include source metadata in context chunks
- **SHOULD** order chunks by relevance score
- **MAY** include chunk relevance scores for transparency

---

## Production Considerations

### Caching

| Cache Layer | What to Cache | TTL |
|-------------|---------------|-----|
| **Query Embedding** | Embedding vector for repeated queries | 24h |
| **Retrieval Results** | Top-K results for exact query match | 1h |
| **Generated Answer** | Full answer for identical query + context | 30min |
| **Semantic Cache** | Answer for semantically similar queries | 1h (with similarity threshold) |

### Performance Optimization

| Optimization | Impact | Effort |
|-------------|--------|--------|
| Pre-filter by metadata | Reduces search space | Low |
| Approximate nearest neighbor (ANN) | Faster vector search | Built-in |
| Embedding caching | Reduce API calls | Medium |
| Streaming generation | Better UX | Low |
| Async retrieval + generation | Lower latency | Medium |
| Batch ingestion | Faster indexing | Low |

---

## Tools and Frameworks

| Tool | Capabilities | When to Use |
|------|-------------|-------------|
| **LangChain** | Full RAG pipeline orchestration | Rapid prototyping, Python |
| **LlamaIndex** | Advanced indexing and retrieval | Complex document structures |
| **Semantic Kernel** | .NET/Python RAG with plugins | Microsoft ecosystem |
| **Azure AI Search** | Managed hybrid search + vector | Production Azure deployments |
| **Qdrant** | High-performance vector DB | Self-hosted, filtering |
| **ChromaDB** | Lightweight vector DB | Prototyping, local dev |
| **pgvector** | PostgreSQL vector extension | Existing Postgres infra |

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scaffold-rag-pipeline.py` | Generate RAG pipeline scaffold | `python scaffold-rag-pipeline.py --store azure-ai-search --framework langchain` |

---

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

- [LangChain RAG Tutorial](https://python.langchain.com/docs/tutorials/rag/)
- [LlamaIndex Documentation](https://docs.llamaindex.ai/)
- [Azure AI Search - RAG](https://learn.microsoft.com/azure/search/retrieval-augmented-generation-overview)
- [RAGAS Evaluation for RAG](https://docs.ragas.io/)

---

**Related**: [Cognitive Architecture](../cognitive-architecture/SKILL.md) for memory systems | [AI Evaluation](../ai-evaluation/SKILL.md) for measuring RAG quality | [Context Management](../context-management/SKILL.md) for token optimization
