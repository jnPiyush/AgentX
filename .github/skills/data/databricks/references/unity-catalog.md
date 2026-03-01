# Unity Catalog Governance

> Fine-grained access control, row-level security, column masking, lineage, and tagging in Unity Catalog.

## 3-Level Namespace

```
metastore
+-- catalog (e.g., prod, dev, raw)
    +-- schema / database (e.g., sales, hr, logs)
        +-- table / view / volume / model / function
```

```sql
-- Reference always uses 3-level name in Unity Catalog workspaces
SELECT * FROM prod.sales.fact_orders;

-- Create table in UC
CREATE TABLE prod.sales.dim_customer (
  customer_id BIGINT NOT NULL,
  email       STRING,
  region      STRING,
  created_at  TIMESTAMP
)
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');
```

## Access Control

```sql
-- Grant fine-grained access
GRANT SELECT ON TABLE prod.sales.fact_orders TO ROLE data_analysts;
GRANT MODIFY ON SCHEMA prod.sales TO ROLE data_engineers;
```

## Row-Level Security

```sql
-- Row filter function -- users only see their region
CREATE FUNCTION prod.security.region_filter(region STRING)
RETURNS BOOLEAN
RETURN is_account_group_member(region);

ALTER TABLE prod.sales.fact_orders
SET ROW FILTER prod.security.region_filter ON (region);
```

## Column Masking (PII)

```sql
-- Mask email for non-PII-admin users
CREATE FUNCTION prod.security.mask_email(email STRING)
RETURNS STRING
RETURN CASE WHEN is_account_group_member('pii_admins') THEN email
            ELSE regexp_replace(email, '(.).+(@.+)', '$1***$2') END;

ALTER TABLE prod.sales.dim_customer
ALTER COLUMN email SET MASK prod.security.mask_email;
```

## Lineage and Tags

```sql
-- Data lineage is automatic in Unity Catalog -- query via REST or UI
-- Tags for discoverability
ALTER TABLE prod.sales.fact_orders SET TAGS ('domain' = 'sales', 'pii' = 'false');
```

## Security (Secrets and OAuth)

```python
# ALWAYS use Databricks Secrets -- never hardcode credentials
storage_key = dbutils.secrets.get(scope="prod-secrets", key="adls-storage-key")
api_token   = dbutils.secrets.get(scope="prod-secrets", key="api-token")

# Service principal OAuth for storage (preferred over SAS/key)
spark.conf.set(
    "fs.azure.account.auth.type.<storage>.dfs.core.windows.net", "OAuth"
)
spark.conf.set(
    "fs.azure.account.oauth.provider.type.<storage>.dfs.core.windows.net",
    "org.apache.hadoop.fs.azurebfs.oauth2.ClientCredsTokenProvider"
)
```
