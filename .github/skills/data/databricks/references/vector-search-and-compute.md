# Vector Search and Compute Configuration

> Databricks Vector Search for RAG, cluster types, Spark tuning, and Photon engine details.

## Vector Search (AI / RAG)

```python
from databricks.vector_search.client import VectorSearchClient

vsc = VectorSearchClient()

# Create a sync index backed by a Delta table (auto-updates on table changes)
vsc.create_delta_sync_index(
    endpoint_name="my_vs_endpoint",
    source_table_name="prod.docs.articles",
    index_name="prod.docs.articles_idx",
    pipeline_type="TRIGGERED",                     # or CONTINUOUS
    primary_key="article_id",
    embedding_source_column="content",             # column to embed
    embedding_model_endpoint_name="bge-large-en"  # Model Serving endpoint
)

# Similarity search
results = vsc.get_index(
    endpoint_name="my_vs_endpoint",
    index_name="prod.docs.articles_idx"
).similarity_search(
    query_text="What is the return policy?",
    columns=["article_id", "title", "content"],
    num_results=5
)
```

## Cluster Types

| Type | Use Case | Lifecycle |
|---|---|---|
| **All-Purpose** | Interactive notebooks, exploration | Manual start/stop |
| **Job Cluster** | Production jobs (ephemeral) | Auto-created per run |
| **SQL Warehouse** | SQL analytics, BI tools | Auto-suspend |
| **Instance Pool** | Reduce cold starts across clusters | Pre-warmed nodes |

## Recommended Spark Config

```python
# Spark session tuning (set in cluster config or notebook)
spark.conf.set("spark.databricks.delta.optimizeWrite.enabled", "true")   # auto-compact small files
spark.conf.set("spark.databricks.delta.autoCompact.enabled", "true")     # merge small files on write
spark.conf.set("spark.sql.adaptive.enabled", "true")                     # AQE -- auto partition tuning
spark.conf.set("spark.sql.shuffle.partitions", "auto")                   # AQE shuffle partition sizing
```

## Photon Engine

Enable Photon (C++ vectorized execution) on compute for 2-12x query speedup:

- Available on Databricks Runtime 9.1+
- Automatically selected when `Photon Accelerated` cluster policy is applied
- Best for SQL analytics, wide transformations, and Delta write operations
