---
name: "vector-databases"
description: 'Choose, configure, and operate vector databases for embeddings and hybrid search. Covers Azure AI Search, Pinecone, Qdrant, Weaviate, Milvus, pgvector, LanceDB, MongoDB Atlas Vector, Elasticsearch / OpenSearch kNN. Selection criteria, index types (HNSW, IVF, DiskANN), filters, hybrid (BM25 + vector), embedding model selection, sharding, cost.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["azure-ai-search", "pinecone", "qdrant", "weaviate", "milvus", "pgvector", "lancedb", "mongo-atlas-vector", "elasticsearch", "opensearch"]
  languages: ["python", "typescript", "csharp"]
---

# Vector Databases

> **Purpose**: Pick the right vector store, configure it for production, and avoid the failure modes that wreck retrieval quality.

---

## When to Use This Skill

- Choosing a vector store (existing infra reuse vs purpose-built)
- Sizing index, picking distance metric, configuring HNSW/IVF/DiskANN parameters
- Implementing hybrid search (keyword + vector) with reranking
- Adding metadata filters, namespaces, multi-tenancy
- Operating at scale (sharding, replication, cost)

---

## Selection Decision Tree

```
Already running PostgreSQL?  -> Start with pgvector + HNSW. Migrate later if you outgrow it.
Already running Elastic / OpenSearch / Mongo? -> Use their native vector index.
Pure managed vector DB needed? -> Pinecone (serverless), Qdrant Cloud, Weaviate Cloud
Need Microsoft / Azure ecosystem fit? -> Azure AI Search (hybrid + reranker built-in)
Local / embedded / OSS-only? -> LanceDB or Qdrant local
Massive scale (>500M vectors), dense recall? -> Milvus + DiskANN, or Pinecone enterprise
```

---

## Comparison (April 2026)

| Store | Strength | Trade-off |
|-------|----------|-----------|
| **Azure AI Search** | Built-in hybrid + semantic reranker, integrated with Foundry | Azure-only |
| **Pinecone (Serverless)** | Zero-ops, auto-scaling | Cost at low volume; vendor lock-in |
| **Qdrant** | Fast, rich filters, OSS or cloud, payload search | Self-host ops |
| **Weaviate** | Modules (rerankers, generative), GraphQL | Heavier footprint |
| **Milvus** | Largest scale, many index types | Operational complexity |
| **pgvector** (with `pgvectorscale`) | Reuses Postgres ops, transactions | Lags on >50M vectors unless tuned |
| **LanceDB** | Embedded, file-based, fast for laptops + edge | Smaller ecosystem |
| **MongoDB Atlas Vector Search** | Combines with document data | Atlas-only |
| **Elasticsearch / OpenSearch** | Mature search + kNN in one | Vector perf lags purpose-built |

---

## Index Types

| Index | Use When | Pros | Cons |
|-------|----------|------|------|
| **HNSW** | Default, <100M vectors | Fast, tunable | RAM-heavy |
| **IVF** / **IVF_PQ** | Memory-constrained | Compact | Recall tuning needed |
| **DiskANN** / **Vamana** | >100M vectors, SSD-served | Disk-friendly | Slower writes |
| **ScaNN** | Google ecosystem | Strong recall/latency | Less common standalone |

Tune HNSW: `M = 16-32`, `efConstruction = 200`, `efSearch = 100-200` (raise for recall).

---

## Distance Metric

| Metric | Use With |
|--------|----------|
| Cosine | Most embedding models (OpenAI, Cohere, voyage, BGE) |
| Inner product (dot) | When embeddings are already normalized; fastest |
| L2 (Euclidean) | Some image / multimodal embeddings |

Match the metric the embedding model was trained with -- check the model card.

---

## Embedding Model Selection (2026)

| Model | Strength |
|-------|----------|
| OpenAI `text-embedding-3-large` / `text-embedding-4` | Strong general baseline |
| Cohere Embed v4 | Multilingual, multimodal |
| Voyage 3 / 3-large | Top retrieval quality (MTEB) |
| BGE-M3, E5-mistral, NV-Embed | Open-weights leaders |
| Azure / Bedrock-hosted variants | Same model, different ops surface |

Rules:

- Pick by your **target retrieval task**, not by general MTEB rank
- Test your top 3 candidates on a small labeled eval set
- Beware embedding-model upgrades -- they change the vector space; you must re-embed

---

## Hybrid Search

Production default. Combines:

- **Keyword (BM25)** for exact terms, rare entities, codes
- **Vector** for semantic similarity
- **Reranker** (cross-encoder, Cohere Rerank, Voyage Rerank, Azure semantic ranker) on top-K

Fusion: Reciprocal Rank Fusion (RRF) or weighted blend. RRF is robust default.

---

## Filters and Multi-Tenancy

- Use **pre-filtering** (filter then ANN) for high-selectivity filters and small result sets
- Use **post-filtering** (ANN then filter) for low-selectivity filters and large recall
- Partition by tenant (namespace / collection) when tenant counts are bounded
- Encode tenant in filter when tenant counts are very high (millions)

---

## Operational Checklist

- [ ] Re-embedding plan documented (model upgrade strategy)
- [ ] Backup and restore tested
- [ ] Index rebuild SLA known
- [ ] Cost per million vectors / per query measured
- [ ] Recall@K and latency p95 measured against labeled eval set
- [ ] PII / data-classification metadata stored on each vector
- [ ] Deletion / right-to-erasure path implemented
- [ ] Drift monitor on retrieval quality (see `data-drift-strategy`)

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| RAG architecture and chunking | `rag-pipelines` |
| Eval harness for retrieval quality | `ai-evaluation` |
| Drift monitoring | `data-drift-strategy` |
| Cost / latency observability | `agent-observability` |

## References

- Azure AI Search hybrid + semantic ranker docs
- Pinecone, Qdrant, Weaviate, Milvus operator docs
- pgvector + pgvectorscale (Timescale) tuning guide
- MTEB leaderboard
