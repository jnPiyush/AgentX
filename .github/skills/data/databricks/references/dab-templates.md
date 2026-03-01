# Databricks Asset Bundles (DABs) Templates

> Full YAML templates for Databricks Asset Bundles with multi-target deployment and CI/CD patterns.

## Full Bundle Template

```yaml
# databricks.yml -- project root
bundle:
  name: my_data_platform

variables:
  env:
    default: dev

targets:
  dev:
    mode: development
    default: true
    workspace:
      host: https://adb-dev.azuredatabricks.net
  prod:
    mode: production
    workspace:
      host: https://adb-prod.azuredatabricks.net

resources:
  pipelines:
    medallion_dlt:
      name: ${bundle.name}_${var.env}_medallion
      development: ${bundle.target == 'dev'}
      configuration:
        spark.databricks.delta.schema.autoMerge.enabled: "true"
      libraries:
        - notebook:
            path: ./src/pipelines/bronze.py
        - notebook:
            path: ./src/pipelines/silver.py

  jobs:
    feature_engineering:
      name: ${bundle.name}_${var.env}_features
      tasks:
        - task_key: compute_features
          notebook_task:
            notebook_path: ./src/notebooks/feature_engineering.py
```

## DABs CLI Workflow

```bash
databricks bundle validate          # check syntax/config
databricks bundle deploy            # deploy resources to workspace
databricks bundle run feature_engineering  # trigger a job
databricks bundle destroy           # teardown resources
```

## DABs Best Practices

- Use `variables` for environment-specific values (workspace URLs, cluster sizes)
- Set `mode: development` for dev targets (adds user prefix, enables debug)
- Set `mode: production` for prod targets (strict validation, no user prefix)
- Pin `spark_version` in job cluster configs to avoid runtime drift
- Store `databricks.yml` in repo root alongside notebooks and source code
- Use CI/CD to run `bundle validate` on PR and `bundle deploy` on merge to main
