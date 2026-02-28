# Data Agent SDK Patterns

> Extended reference for the `fabric-data-agent` skill. Code patterns for the Fabric Data Agent SDK.

---

## SDK Initialization

### Management Client (Create/Configure Agents)

```python
from fabric_data_agent_sdk import DataAgentManagementClient

# Initialize management client (uses Fabric workspace context)
client = DataAgentManagementClient(
 workspace_name="Analytics",
 workspace_id="<workspace-guid>" # Optional if name is unique
)

# Create a new Data Agent
agent = client.create_agent(
 name="Sales Analytics Agent",
 description="Answers questions about sales data from the Gold Lakehouse"
)
print(f"Agent created: {agent.id}")
```

### Query Client (Chat with Agent)

```python
from fabric_data_agent_sdk import DataAgentQueryClient

# Initialize query client
query_client = DataAgentQueryClient(
 workspace_name="Analytics",
 agent_name="Sales Analytics Agent"
)

# Ask a question
response = query_client.query("What were total sales last month?")
print(f"Answer: {response.answer}")
print(f"SQL: {response.generated_sql}")
print(f"Data: {response.result_data}")
```

---

## Agent Configuration

### Instructions (System Prompt)

```python
# Set agent instructions (system prompt)
client.set_instructions(
 agent_name="Sales Analytics Agent",
 instructions="""
 You are a sales analytics assistant for Contoso.
 
 Key business rules:
 - Revenue = SUM(fact_sales[amount]) - excludes returns
 - Active customers = customers with purchases in last 90 days
 - Fiscal year starts April 1
 
 When answering:
 - Always include the time period in your response
 - Format currency as $X,XXX.XX
 - If data is missing, say so clearly
 """
)
```

### Add Datasources

```python
# Bind Lakehouse tables to the agent
client.add_datasource(
 agent_name="Sales Analytics Agent",
 lakehouse_name="Gold_LH",
 tables=[
 "fact_sales",
 "dim_product",
 "dim_customer",
 "dim_date",
 "dim_store"
 ]
)
```

### Add Few-Shot Examples

```python
# Teach the agent with example Q&A pairs
examples = [
 {
 "question": "What were total sales this year?",
 "sql": "SELECT SUM(amount) AS total_sales FROM fact_sales WHERE DATEPART(YEAR, sale_date) = DATEPART(YEAR, GETDATE())"
 },
 {
 "question": "Top 10 products by revenue",
 "sql": """
 SELECT TOP 10 p.product_name, SUM(f.amount) AS total_sales
 FROM fact_sales f
 JOIN dim_product p ON f.product_key = p.product_key
 GROUP BY p.product_name
 ORDER BY total_sales DESC
 """
 },
 {
 "question": "How many active customers do we have?",
 "sql": """
 SELECT COUNT(DISTINCT customer_key) AS active_customers
 FROM fact_sales
 WHERE sale_date >= DATEADD(DAY, -90, GETDATE())
 """
 }
]

for ex in examples:
 client.add_example(agent_name="Sales Analytics Agent", **ex)
```

### Publish Agent

```python
# Make the agent available for querying
client.publish(agent_name="Sales Analytics Agent")
print("[PASS] Agent published and ready for queries")
```

---

## Validation Pattern

### Automated Accuracy Testing

```python
def validate_agent(query_client, test_cases: list) -> dict:
 """
 Run test queries and compare against expected values.
 
 test_cases: [{"question": str, "expected_value": any, "tolerance": float}, ...]
 """
 results = {"passed": 0, "failed": 0, "errors": 0, "details": []}
 
 for test in test_cases:
 try:
 response = query_client.query(test["question"])
 actual = response.result_data
 expected = test["expected_value"]
 tolerance = test.get("tolerance", 0.01) # 1% default
 
 # Compare (numeric tolerance for calculations)
 if isinstance(expected, (int, float)):
 passed = abs(actual - expected) / max(abs(expected), 1) <= tolerance
 else:
 passed = str(actual).strip() == str(expected).strip()
 
 result = {
 "question": test["question"],
 "expected": expected,
 "actual": actual,
 "passed": passed,
 "sql": response.generated_sql
 }
 
 if passed:
 results["passed"] += 1
 else:
 results["failed"] += 1
 
 except Exception as e:
 result = {
 "question": test["question"],
 "expected": test["expected_value"],
 "actual": None,
 "passed": False,
 "error": str(e)
 }
 results["errors"] += 1
 
 results["details"].append(result)
 
 total = results["passed"] + results["failed"] + results["errors"]
 results["accuracy"] = round(results["passed"] / total * 100, 1) if total > 0 else 0
 
 print(f"\n{'[PASS]' if results['accuracy'] >= 80 else '[WARN]'} Accuracy: {results['accuracy']}%")
 print(f" Passed: {results['passed']}, Failed: {results['failed']}, Errors: {results['errors']}")
 
 return results
```

---

## Notebook Generation Pattern

```python
def create_agent_notebook(agent_config: dict, output_path: str):
 """Generate a reproducible Jupyter notebook for agent creation."""
 import json
 
 notebook = {
 "cells": [
 {
 "cell_type": "markdown",
 "source": [f"# Data Agent: {agent_config['name']}\n",
 f"Generated: {agent_config['timestamp']}\n",
 f"Lakehouse: {agent_config['lakehouse']}\n"]
 },
 {
 "cell_type": "code",
 "source": ["from fabric_data_agent_sdk import DataAgentManagementClient\n",
 f"client = DataAgentManagementClient(workspace_name='{agent_config['workspace']}')\n"]
 },
 # ... additional cells for configuration
 ],
 "metadata": {"kernelspec": {"name": "python3"}},
 "nbformat": 4,
 "nbformat_minor": 5
 }
 
 with open(output_path, "w") as f:
 json.dump(notebook, f, indent=2)
 
 print(f"[PASS] Notebook saved: {output_path}")
```
