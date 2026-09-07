# RAG Pipelines Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

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

## Core Rules
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
