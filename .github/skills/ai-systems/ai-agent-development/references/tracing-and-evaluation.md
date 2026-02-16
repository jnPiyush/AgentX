# AI Agent Tracing & Evaluation Patterns

## Observability (Tracing)

### Setup OpenTelemetry

```python
from agent_framework.observability import configure_otel_providers

# Before running agent - must open trace viewer first!
configure_otel_providers(
 vs_code_extension_port=4317, # AI Toolkit gRPC port
 enable_sensitive_data=True
)
```

**Open Trace Viewer**: `Ctrl+Shift+P` -> `AI Toolkit: Open Trace Viewer`

[WARN] **CRITICAL**: Open trace viewer BEFORE running your agent.

---

## Evaluation

### Workflow

1. Upload dataset (JSONL)
2. Define evaluators (built-in or custom)
3. Create evaluation
4. Run evaluation
5. Analyze results

### Prerequisites

```bash
pip install "azure-ai-projects>=2.0.0b2"
```

### Built-in Evaluators

**Agent Evaluators**:
- `builtin.intent_resolution` - Intent correctly identified?
- `builtin.task_adherence` - Instructions followed?
- `builtin.task_completion` - Task completed end-to-end?
- `builtin.tool_call_accuracy` - Tools used correctly?
- `builtin.tool_selection` - Right tools chosen?

**Quality Evaluators**:
- `builtin.coherence` - Natural text flow?
- `builtin.fluency` - Grammar correct?
- `builtin.groundedness` - Claims substantiated? (RAG)
- `builtin.relevance` - Answers key points? (RAG)

### Evaluation Example

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from openai.types.eval_create_params import DataSourceConfigCustom
from openai.types.evals.create_eval_jsonl_run_data_source_param import (
 CreateEvalJSONLRunDataSourceParam, SourceFileID
)

endpoint = os.getenv("FOUNDRY_PROJECT_ENDPOINT")
model_deployment = os.getenv("MODEL_DEPLOYMENT_NAME")

with (
 DefaultAzureCredential() as credential,
 AIProjectClient(endpoint=endpoint, credential=credential) as project_client,
 project_client.get_openai_client() as openai_client,
):
 # 1. Upload Dataset
 dataset = project_client.datasets.upload_file(
 name="eval-data",
 version="1",
 file_path="data.jsonl"
 )

 # 2. Define Data Schema
 data_source_config = DataSourceConfigCustom({
 "type": "custom",
 "item_schema": {
 "type": "object",
 "properties": {
 "query": {"type": "string"},
 "response": {"type": "string"}
 },
 "required": ["query", "response"]
 },
 "include_sample_schema": True
 })

 # 3. Define Evaluators
 testing_criteria = [
 {
 "type": "azure_ai_evaluator",
 "name": "coherence",
 "evaluator_name": "builtin.coherence",
 "data_mapping": {
 "query": "{{item.query}}", 
 "response": "{{item.response}}"
 },
 "initialization_parameters": {"deployment_name": model_deployment}
 }
 ]

 # 4. Create Evaluation
 evaluation = openai_client.evals.create(
 name="agent-eval",
 data_source_config=data_source_config,
 testing_criteria=testing_criteria
 )

 # 5. Run Evaluation
 run = openai_client.evals.runs.create(
 eval_id=evaluation.id,
 name="eval-run",
 data_source=CreateEvalJSONLRunDataSourceParam(
 type="jsonl", 
 source=SourceFileID(type="file_id", id=dataset.id)
 )
 )

 # 6. Wait for Completion
 while run.status not in ["completed", "failed"]:
 run = openai_client.evals.runs.retrieve(run_id=run.id, eval_id=evaluation.id)
 time.sleep(3)

 print(f"Report: {run.report_url}")
```

### Custom Evaluators

**Code-based** (objective metrics):
```python
code_evaluator = project_client.evaluators.create_version(
 name="response_length_check",
 evaluator_version={
 "name": "response_length_check",
 "definition": {
 "type": "CODE",
 "code_text": """
def grade(sample, item):
 length = len(item.get("response", ""))
 return 1.0 if 100 <= length <= 500 else 0.5
""",
 # ... schema omitted for brevity
 }
 }
)
```

**Prompt-based** (subjective metrics):
```python
prompt_evaluator = project_client.evaluators.create_version(
 name="friendliness_check",
 evaluator_version={
 "name": "friendliness_check",
 "definition": {
 "type": "PROMPT",
 "prompt_text": """
Rate friendliness (1-5):
Query: {{query}}
Response: {{response}}

Output JSON: {"result": <int>, "reason": "<text>"}
""",
 # ... schema omitted for brevity
 }
 }
)
```

---
