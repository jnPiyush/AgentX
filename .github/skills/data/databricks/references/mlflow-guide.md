# MLflow Guide

> Experiment tracking, model registry, model lifecycle, and Model Serving patterns.

## Experiment Tracking

```python
import mlflow
import mlflow.sklearn
from mlflow.models.signature import infer_signature

mlflow.set_experiment("/Users/me/churn_prediction")

with mlflow.start_run(run_name="xgboost_v3") as run:
    # Log parameters
    mlflow.log_params({"learning_rate": 0.1, "max_depth": 6, "n_estimators": 300})

    # Train model
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    # Log metrics
    mlflow.log_metrics({
        "accuracy": accuracy_score(y_test, predictions),
        "f1":       f1_score(y_test, predictions, average="weighted"),
        "auc_roc":  roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
    })

    # Log model with signature and input example (required for Model Serving)
    signature = infer_signature(X_train, predictions)
    mlflow.sklearn.log_model(
        model,
        artifact_path="model",
        signature=signature,
        input_example=X_train.head(5),
        registered_model_name="prod.ml.churn_predictor"  # UC-backed registry
    )
```

## Model Lifecycle (Unity Catalog-backed Registry)

```
Registered -> (alias: champion/challenger) -> Served via Model Serving endpoint
```

```python
from mlflow import MlflowClient

client = MlflowClient()
# Promote run to registered model and assign alias
client.set_registered_model_alias(
    name="prod.ml.churn_predictor",
    alias="champion",
    version=7
)

# Query by alias in serving or notebooks
model = mlflow.pyfunc.load_model("models:/prod.ml.churn_predictor@champion")
```

## MLflow Best Practices

- Always log `signature` and `input_example` -- required for Model Serving deployment
- Use Unity Catalog-backed registry (`prod.ml.<model_name>`) for governance
- Assign `champion`/`challenger` aliases instead of numeric stage transitions
- Log all hyperparameters, metrics, and artifacts for reproducibility
- Use `mlflow.autolog()` for supported frameworks (sklearn, PyTorch, TensorFlow)
