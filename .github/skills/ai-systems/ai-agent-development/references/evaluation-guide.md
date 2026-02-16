# Evaluation Guide

Comprehensive guide for evaluating AI agent performance using Microsoft Foundry.

## Evaluation Workflow

1. **Prepare Dataset** - Create JSONL test data
2. **Upload Dataset** - Push to Microsoft Foundry
3. **Define Evaluators** - Select built-in or create custom
4. **Run Evaluation** - Execute against your agent
5. **Analyze Results** - Review scores and iterate

## Test Dataset Format

Create a JSONL file with input/output pairs:

```jsonl
{"query": "What is the capital of France?", "expected_response": "Paris"}
{"query": "Calculate 15 * 23", "expected_response": "345"}
{"query": "Summarize the benefits of AI", "response": "AI improves efficiency..."}
```

## Built-in Evaluators

### Agent Evaluators

| Evaluator | Purpose | Data Mapping |
|-----------|---------|--------------|
| `builtin.intent_resolution` | Was intent correctly identified? | query, response |
| `builtin.task_adherence` | Were instructions followed? | query, response, instructions |
| `builtin.task_completion` | Was task completed end-to-end? | query, response |
| `builtin.tool_call_accuracy` | Were tools used correctly? | query, response, tool_calls |
| `builtin.tool_selection` | Were right tools chosen? | query, response, available_tools |

### Quality Evaluators

| Evaluator | Purpose | Data Mapping |
|-----------|---------|--------------|
| `builtin.coherence` | Natural text flow? | query, response |
| `builtin.fluency` | Grammar correct? | response |
| `builtin.groundedness` | Claims substantiated? (RAG) | query, response, context |
| `builtin.relevance` | Answers key points? (RAG) | query, response |

## Complete Evaluation Example

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from openai.types.eval_create_params import DataSourceConfigCustom
from openai.types.evals.create_eval_jsonl_run_data_source_param import (
 CreateEvalJSONLRunDataSourceParam, SourceFileID
)
import os
import time

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
 },
 {
 "type": "azure_ai_evaluator",
 "name": "relevance",
 "evaluator_name": "builtin.relevance",
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

 print(f"Status: {run.status}")
 print(f"Report: {run.report_url}")
```

## Custom Evaluators

### Code-Based Evaluator (Objective Metrics)

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
 if 100 <= length <= 500:
 return 1.0
 elif length < 100:
 return 0.5
 else:
 return 0.7
""",
 "input_schema": {
 "type": "object",
 "properties": {
 "response": {"type": "string"}
 },
 "required": ["response"]
 },
 "output_schema": {
 "type": "number"
 }
 }
 }
)
```

### Prompt-Based Evaluator (Subjective Metrics)

```python
prompt_evaluator = project_client.evaluators.create_version(
 name="friendliness_check",
 evaluator_version={
 "name": "friendliness_check",
 "definition": {
 "type": "PROMPT",
 "prompt_text": """
Rate the friendliness of this response on a scale of 1-5:

Query: {{query}}
Response: {{response}}

Consider:
- Tone (warm, welcoming, helpful)
- Language (polite, respectful)
- Helpfulness (goes above and beyond)

Output JSON only: {"result": <int 1-5>, "reason": "<brief explanation>"}
""",
 "input_schema": {
 "type": "object",
 "properties": {
 "query": {"type": "string"},
 "response": {"type": "string"}
 },
 "required": ["query", "response"]
 },
 "output_schema": {
 "type": "object",
 "properties": {
 "result": {"type": "integer"},
 "reason": {"type": "string"}
 }
 }
 }
 }
)
```

## Quality Thresholds

| Metric | Minimum | Target | Notes |
|--------|---------|--------|-------|
| Coherence | 3.5 | 4.0+ | Scale 1-5 |
| Fluency | 4.0 | 4.5+ | Scale 1-5 |
| Relevance | 3.5 | 4.0+ | Scale 1-5 |
| Task Completion | 0.7 | 0.9+ | Scale 0-1 |
| Tool Accuracy | 0.8 | 0.95+ | Scale 0-1 |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Dataset upload fails | Invalid JSONL | Validate JSON format line-by-line |
| Evaluator not found | Wrong name | Use exact `builtin.*` names |
| Low scores | Misaligned expectations | Review and refine agent instructions |
| Timeout | Large dataset | Split into smaller batches |

