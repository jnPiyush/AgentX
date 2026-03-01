# Streaming Ingestion

> Auto Loader and Structured Streaming code examples for batch and real-time ingestion into Delta Lake.

## Auto Loader (Cloud Files)

Incrementally ingest files from cloud storage using checkpoint-based tracking:

```python
# Auto Loader -- stream new files from ADLS/S3/GCS into Bronze Delta table
(spark.readStream
    .format("cloudFiles")
    .option("cloudFiles.format", "json")                      # csv, parquet, avro, xml...
    .option("cloudFiles.schemaLocation", "/checkpoints/schema/raw_events")
    .option("cloudFiles.inferColumnTypes", "true")
    .load("abfss://raw@storageaccount.dfs.core.windows.net/events/")
    .writeStream
    .format("delta")
    .option("checkpointLocation", "/checkpoints/bronze/raw_events")
    .option("mergeSchema", "true")                            # allow schema evolution
    .trigger(availableNow=True)                               # batch mode (process all pending then stop)
    .toTable("prod.bronze.raw_events")
)
```

### Trigger Modes

| Trigger Mode | Use Case |
|---|---|
| `availableNow=True` | Micro-batch -- process all backlog and stop (scheduled jobs) |
| `processingTime="5 minutes"` | Continuous low-latency streaming |
| `once=True` | Legacy -- prefer `availableNow` |

## Structured Streaming (Kafka / Event Hubs)

```python
# Read from Kafka topic
df_stream = (spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", "broker:9092")
    .option("subscribe", "orders_topic")
    .option("startingOffsets", "latest")
    .load()
    .select(
        from_json(col("value").cast("string"), order_schema).alias("data"),
        col("timestamp").alias("kafka_ts")
    )
    .select("data.*", "kafka_ts")
)

# Write to Silver with foreachBatch for merge pattern
def upsert_to_silver(micro_batch_df, batch_id):
    target = DeltaTable.forName(spark, "prod.silver.orders")
    target.alias("t").merge(
        micro_batch_df.alias("s"), "t.order_id = s.order_id"
    ).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()

(df_stream.writeStream
    .foreachBatch(upsert_to_silver)
    .option("checkpointLocation", "/checkpoints/silver/orders")
    .start()
)
```
