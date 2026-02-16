# Pipeline Activity Patterns

> Extended reference for the `fabric-analytics` skill. Common pipeline configurations and dependency chains.

---

## Copy Activity Patterns

### Database -> Lakehouse

```
Source: Azure SQL / PostgreSQL / MySQL
Activity: Copy Activity
Destination: Lakehouse Delta table
Mode: Overwrite (full) or Append (incremental)
```

**Key Settings**:
| Setting | Full Load | Incremental |
|---------|-----------|-------------|
| `table_action_option` | `Overwrite` | `Append` |
| Source query | `SELECT *` | `SELECT * WHERE modified_date > @lastRun` |
| Schedule | Daily/weekly | Hourly |

### Incremental Load with Watermark

```
Pipeline: Incremental_Orders
+-- Lookup Activity: Get last watermark from control table
+-- Copy Activity: Copy rows WHERE modified_date > watermark
-- Stored Procedure: Update watermark in control table
```

### File -> Lakehouse

```
Source: ADLS Gen2 / S3 (via shortcut) / Azure Blob
Activity: Copy Activity
Destination: Lakehouse Files/ (raw) or Tables/ (if auto-schema)
Formats: CSV, Parquet, JSON, Avro, ORC
```

---

## Pipeline Dependency Patterns

### Sequential Chain

```
Copy Activity (Source -> Bronze)
 -- depends_on -> Notebook (Bronze -> Silver)
 -- depends_on -> Notebook (Silver -> Gold)
 -- depends_on -> Dataflow (Refresh Semantic Model)
```

### Parallel + Merge

```
-- Copy Activity (Orders) --
| |
+-- Copy Activity (Products) --+-- depends_on -> Notebook (Join & Transform)
| |
-- Copy Activity (Customers) --
```

### Conditional Branching

```
Notebook (Validate Data)
+-- On Success -> Notebook (Transform to Gold)
+-- On Failure -> Web Activity (Send alert email)
-- On Completion -> Stored Procedure (Log run status)
```

---

## Pipeline Best Practices

| Practice | Details |
|----------|---------|
| **Idempotent activities** | Use Overwrite or MERGE - safe to retry on failure |
| **Parameterize** | Use pipeline parameters for environment (dev/test/prod) |
| **Error handling** | Add On Failure paths with alerting (email, Teams, logging) |
| **Monitoring** | Check pipeline run history in Fabric Monitor hub |
| **Naming convention** | `PL_{domain}_{action}_{schedule}` (e.g., `PL_Sales_Ingest_Daily`) |
| **Activity naming** | `{ActivityType}_{source}_{target}` (e.g., `Copy_SQL_Bronze`) |

---

## Pipeline Scheduling

| Pattern | Trigger | Use Case |
|---------|---------|----------|
| **Scheduled** | Cron (e.g., daily 2 AM UTC) | Regular batch loads |
| **Tumbling window** | Fixed intervals, no overlap | Incremental processing |
| **Event-based** | File arrival in ADLS | Real-time file ingestion |
| **Manual** | On-demand API/UI trigger | Ad-hoc or testing runs |

---

## Control Flow Activities

| Activity | Purpose | Example |
|----------|---------|---------|
| **If Condition** | Branch based on expression | Skip weekend loads |
| **ForEach** | Iterate over array | Process multiple tables |
| **Until** | Loop until condition met | Poll for data readiness |
| **Wait** | Pause execution | Delay between retries |
| **Set Variable** | Store values | Capture run metadata |
| **Web** | Call HTTP endpoints | Send Slack/Teams notifications |
