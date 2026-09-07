# RAG Pipelines Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

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
| **Microsoft Agent Framework** | .NET/Python/TS RAG with plugins and agents | Microsoft ecosystem |
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

## Anti-Patterns

- **No reranking**: Returning raw vector search results directly to the LLM -> Add a cross-encoder or LLM-based reranker to improve precision
- **Giant chunks**: Using chunk sizes over 2000 tokens -> Keep chunks small (256-1024 tokens) for retrieval, use parent-child for LLM context
- **Mismatched embeddings**: Using different embedding models for indexing and querying -> Always use the same model and version for both
- **No metadata filtering**: Searching the entire index for every query -> Add metadata filters (date, source, category) to narrow the search space
- **Stuffing all chunks**: Feeding all retrieved chunks into the prompt regardless of relevance -> Limit to top 3-5 after reranking
- **No grounding instructions**: Omitting "answer only from context" instructions in the prompt -> Always instruct the model to use provided context and cite sources
- **Static index**: Never refreshing the document index after initial ingestion -> Schedule re-ingestion as source documents change

---
