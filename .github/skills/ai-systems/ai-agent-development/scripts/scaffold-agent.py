#!/usr/bin/env python3
"""Scaffold an AI agent project with Agent Framework boilerplate.

Generates a production-ready agent project structure with:
- Agent Framework client setup (Python or .NET)
- OpenTelemetry tracing configuration
- Evaluation harness template
- Environment variable template (.env)
- Project configuration (pyproject.toml or .csproj)

Usage:
 python scaffold-agent.py --name my-agent
 python scaffold-agent.py --name my-agent --runtime dotnet
 python scaffold-agent.py --name my-agent --pattern multi-agent
 python scaffold-agent.py --name my-agent --with-eval --with-mcp
"""

import argparse
import os
import sys
from pathlib import Path
from datetime import datetime

def create_file(path: Path, content: str) -> None:
 """Create a file with content, making parent directories as needed."""
 path.parent.mkdir(parents=True, exist_ok=True)
 path.write_text(content, encoding="utf-8")
 print(f" Created: {path}")

def scaffold_python_agent(root: Path, name: str, pattern: str, with_eval: bool, with_mcp: bool) -> None:
 """Generate Python agent project structure."""

 # pyproject.toml
 deps = [
 '"agent-framework-azure-ai>=0.1.0"',
 '"azure-identity>=1.15.0"',
 '"opentelemetry-api>=1.20.0"',
 '"opentelemetry-sdk>=1.20.0"',
 '"python-dotenv>=1.0.0"',
 ]
 if with_eval:
 deps.append('"azure-ai-evaluation>=1.0.0"')
 if with_mcp:
 deps.append('"agent-framework-mcp>=0.1.0"')

 deps_str = ",\n ".join(deps)

 create_file(root / "pyproject.toml", f"""[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "{name}"
version = "0.1.0"
description = "AI Agent built with Microsoft Agent Framework"
requires-python = ">=3.11"
dependencies = [
 {deps_str},
]

[project.optional-dependencies]
dev = [
 "pytest>=8.0",
 "pytest-asyncio>=0.23.0",
 "ruff>=0.4.0",
]

[tool.ruff]
target-version = "py311"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
""")

 # .env template
 create_file(root / ".env.template", """# AI Agent Environment Variables
# Copy to .env and fill in values

# Microsoft Foundry / Azure OpenAI
FOUNDRY_ENDPOINT=https://your-project.services.ai.azure.com
FOUNDRY_API_KEY=your-api-key-here
FOUNDRY_MODEL=gpt-5.1

# OpenTelemetry (optional - for tracing)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME={name}

# Application
LOG_LEVEL=INFO
MAX_TURNS=10
""")

 # .env (gitignored placeholder)
 create_file(root / ".gitignore", """# Environment
.env
.env.local

# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
.venv/
venv/

# IDE
.vscode/
.idea/

# Traces and outputs
traces/
outputs/
""")

 # Main agent module
 if pattern == "single":
 agent_code = _python_single_agent(name)
 elif pattern == "multi-agent":
 agent_code = _python_multi_agent(name)
 elif pattern == "sequential":
 agent_code = _python_sequential_workflow(name)
 else:
 agent_code = _python_single_agent(name)

 create_file(root / "src" / name.replace("-", "_") / "__init__.py", "")
 create_file(root / "src" / name.replace("-", "_") / "agent.py", agent_code)

 # Tracing setup
 create_file(root / "src" / name.replace("-", "_") / "tracing.py", f"""\"\"\"OpenTelemetry tracing configuration for {name}.\"\"\"

import os

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

# Agent Framework auto-instrumentation
from agent_framework.openai import AIInferenceInstrumentor

def setup_tracing() -> None:
 \"\"\"Initialize OpenTelemetry tracing with Agent Framework instrumentation.

 Call this BEFORE creating any agent or client instances.
 \"\"\"
 provider = TracerProvider()

 # Configure exporter based on environment
 endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
 if endpoint:
 from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

 exporter = OTLPSpanExporter(endpoint=endpoint)
 provider.add_span_processor(SimpleSpanProcessor(exporter))

 trace.set_tracer_provider(provider)

 # Instrument Agent Framework (auto-captures LLM calls)
 AIInferenceInstrumentor().instrument()

 print(f"Tracing initialized for {{os.getenv('OTEL_SERVICE_NAME', '{name}')}}")
""")

 # Main entry point
 create_file(root / "src" / name.replace("-", "_") / "main.py", f"""\"\"\"Entry point for {name} agent.\"\"\"

import asyncio
import os

from dotenv import load_dotenv

from .tracing import setup_tracing
from .agent import run_agent

async def main() -> None:
 \"\"\"Initialize and run the agent.\"\"\"
 load_dotenv()
 setup_tracing()

 query = os.getenv("AGENT_QUERY", "Hello! What can you help me with?")
 result = await run_agent(query)
 print(f"\\nAgent response:\\n{{result}}")

if __name__ == "__main__":
 asyncio.run(main())
""")

 # Tests
 create_file(root / "tests" / "__init__.py", "")
 create_file(root / "tests" / "test_agent.py", f"""\"\"\"Tests for {name} agent.\"\"\"

import pytest

@pytest.mark.asyncio
async def test_agent_responds():
 \"\"\"Agent should return a non-empty response.\"\"\"
 from {name.replace("-", "_")}.agent import run_agent

 # Note: Requires valid credentials in .env
 # For CI, mock the client or use a test endpoint
 # result = await run_agent("Hello")
 # assert result is not None
 # assert len(result) > 0
 pytest.skip("Requires valid AI endpoint credentials")
""")

 # Evaluation harness (optional)
 if with_eval:
 create_file(root / "evaluation" / "evaluate.py", f"""\"\"\"Evaluation harness for {name} agent.\"\"\"

import json
from pathlib import Path

from azure.ai.evaluation import evaluate
from azure.ai.evaluation import (
 CoherenceEvaluator,
 FluencyEvaluator,
 GroundednessEvaluator,
 RelevanceEvaluator,
)

def run_evaluation():
 \"\"\"Run evaluation against test dataset.\"\"\"
 # Load test dataset
 dataset_path = Path(__file__).parent / "test_dataset.jsonl"
 if not dataset_path.exists():
 print("Create evaluation/test_dataset.jsonl with test cases first.")
 print("Format: {{\\"query\\": \\"...\\"," "\\"expected\\": \\"...\\"," "\\"context\\": \\"...\\"}}")
 return

 results = evaluate(
 data=str(dataset_path),
 evaluators={{
 "coherence": CoherenceEvaluator(),
 "fluency": FluencyEvaluator(),
 "groundedness": GroundednessEvaluator(),
 "relevance": RelevanceEvaluator(),
 }},
 output_path="evaluation/results.json",
 )

 print("Evaluation Results:")
 print(json.dumps(results, indent=2))

if __name__ == "__main__":
 run_evaluation()
""")

 create_file(root / "evaluation" / "test_dataset.jsonl", """{"query": "What is the capital of France?", "expected": "Paris", "context": "France is a country in Europe."}
{"query": "What is 2 + 2?", "expected": "4", "context": "Basic arithmetic question."}
""")

 # MCP server template (optional)
 if with_mcp:
 create_file(root / "src" / name.replace("-", "_") / "mcp_tools.py", f"""\"\"\"MCP tool definitions for {name} agent.\"\"\"

from agent_framework.mcp import MCPServer, tool

class {name.replace("-", "").title()}Tools(MCPServer):
 \"\"\"MCP tools exposed by this agent.\"\"\"

 @tool(description="Example tool that echoes input")
 async def echo(self, message: str) -> str:
 \"\"\"Echo the input message back.\"\"\"
 return f"Echo: {{message}}"

 @tool(description="Get current timestamp")
 async def get_timestamp(self) -> str:
 \"\"\"Return current UTC timestamp.\"\"\"
 from datetime import datetime, timezone
 return datetime.now(timezone.utc).isoformat()
""")

 # README
 create_file(root / "README.md", f"""# {name}

AI Agent built with [Microsoft Agent Framework](https://github.com/microsoft/agent-framework).

## Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate # Linux/Mac
# .venv\\Scripts\\activate # Windows

# Install dependencies
pip install -e ".[dev]"

# Configure environment
cp .env.template .env
# Edit .env with your Foundry credentials
```

## Run

```bash
python -m {name.replace("-", "_")}.main
```

## Test

```bash
pytest
```
{"## Evaluate" if with_eval else ""}
{"```bash" if with_eval else ""}
{"python evaluation/evaluate.py" if with_eval else ""}
{"```" if with_eval else ""}

## Architecture

- **Pattern**: {pattern}
- **Runtime**: Python 3.11+
- **Framework**: Microsoft Agent Framework
- **Tracing**: OpenTelemetry (auto-instrumented)
{"- **MCP**: Tool server enabled" if with_mcp else ""}
""")

def _python_single_agent(name: str) -> str:
 """Generate single agent pattern code."""
 return f"""\"\"\"Single agent implementation for {name}.\"\"\"

import os

from agent_framework.openai import OpenAIChatClient

async def run_agent(query: str) -> str:
 \"\"\"Run the agent with a single query.\"\"\"
 client = OpenAIChatClient(
 model=os.getenv("FOUNDRY_MODEL", "gpt-5.1"),
 api_key=os.getenv("FOUNDRY_API_KEY"),
 endpoint=os.getenv("FOUNDRY_ENDPOINT"),
 )

 agent = {{
 "name": "{name}",
 "instructions": \"\"\"You are a helpful AI assistant.

TASK: Answer the user's question accurately and concisely.

CONSTRAINTS:
- Be factual and cite sources when possible
- Say "I don't know" if uncertain
- Keep responses under 500 words
\"\"\",
 "tools": [],
 }}

 response = await client.chat(
 messages=[{{"role": "user", "content": query}}],
 agent=agent,
 )

 return response.content
"""

def _python_multi_agent(name: str) -> str:
 """Generate multi-agent pattern code."""
 return f"""\"\"\"Multi-agent orchestration for {name}.\"\"\"

import os

from agent_framework.openai import OpenAIChatClient
from agent_framework.workflows import GroupChatWorkflow

async def run_agent(query: str) -> str:
 \"\"\"Run multi-agent workflow with group chat orchestration.\"\"\"
 client = OpenAIChatClient(
 model=os.getenv("FOUNDRY_MODEL", "gpt-5.1"),
 api_key=os.getenv("FOUNDRY_API_KEY"),
 endpoint=os.getenv("FOUNDRY_ENDPOINT"),
 )

 researcher = {{
 "name": "Researcher",
 "instructions": "You research topics thoroughly. Provide factual information with sources.",
 "tools": [],
 }}

 writer = {{
 "name": "Writer",
 "instructions": "You write clear, engaging content based on research provided.",
 "tools": [],
 }}

 reviewer = {{
 "name": "Reviewer",
 "instructions": "You review content for accuracy, clarity, and completeness. Suggest improvements.",
 "tools": [],
 }}

 workflow = GroupChatWorkflow(
 agents=[researcher, writer, reviewer],
 client=client,
 max_turns=10,
 termination_condition="approval",
 )

 result = await workflow.run(query=query)
 return result.final_output
"""

def _python_sequential_workflow(name: str) -> str:
 """Generate sequential workflow pattern code."""
 return f"""\"\"\"Sequential workflow for {name}.\"\"\"

import os

from agent_framework.openai import OpenAIChatClient
from agent_framework.workflows import SequentialWorkflow

async def run_agent(query: str) -> str:
 \"\"\"Run agents in sequence: research -> analyze -> summarize.\"\"\"
 client = OpenAIChatClient(
 model=os.getenv("FOUNDRY_MODEL", "gpt-5.1"),
 api_key=os.getenv("FOUNDRY_API_KEY"),
 endpoint=os.getenv("FOUNDRY_ENDPOINT"),
 )

 researcher = {{
 "name": "Researcher",
 "instructions": "Gather comprehensive information about the topic.",
 }}

 analyzer = {{
 "name": "Analyzer",
 "instructions": "Analyze the research and identify key insights and patterns.",
 }}

 summarizer = {{
 "name": "Summarizer",
 "instructions": "Create a concise executive summary from the analysis.",
 }}

 workflow = SequentialWorkflow(
 agents=[researcher, analyzer, summarizer],
 client=client,
 handoff_strategy="on_completion",
 )

 result = await workflow.run(query=query)
 return result.final_output
"""

def scaffold_dotnet_agent(root: Path, name: str, pattern: str, with_eval: bool) -> None:
 """Generate .NET agent project structure."""
 safe_name = name.replace("-", ".")
 namespace = safe_name.replace(".", "").title()

 # .csproj
 create_file(root / f"{safe_name}.csproj", f"""<Project Sdk="Microsoft.NET.Sdk">

 <PropertyGroup>
 <OutputType>Exe</OutputType>
 <TargetFramework>net9.0</TargetFramework>
 <ImplicitUsings>enable</ImplicitUsings>
 <Nullable>enable</Nullable>
 </PropertyGroup>

 <ItemGroup>
 <PackageReference Include="Microsoft.Agents.AI.AzureAI" Version="*-*" />
 <PackageReference Include="Microsoft.Agents.AI.Workflows" Version="*-*" />
 <PackageReference Include="Microsoft.Extensions.Configuration.Json" Version="9.*" />
 <PackageReference Include="Microsoft.Extensions.Configuration.EnvironmentVariables" Version="9.*" />
 <PackageReference Include="Azure.Identity" Version="1.*" />
 <PackageReference Include="OpenTelemetry" Version="1.*" />
 <PackageReference Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.*" />
 </ItemGroup>

</Project>
""")

 # Program.cs
 create_file(root / "Program.cs", f"""using Microsoft.Agents.AI.AzureAI;
using OpenTelemetry;
using OpenTelemetry.Trace;

// Setup tracing
using var tracerProvider = Sdk.CreateTracerProviderBuilder()
 .AddSource("{name}")
 .AddOtlpExporter()
 .Build();

// Configure client
var client = new OpenAIChatClient(
 model: Environment.GetEnvironmentVariable("FOUNDRY_MODEL") ?? "gpt-5.1",
 apiKey: Environment.GetEnvironmentVariable("FOUNDRY_API_KEY")!,
 endpoint: new Uri(Environment.GetEnvironmentVariable("FOUNDRY_ENDPOINT")!)
);

// Run agent
var response = await client.ChatAsync(
 messages: [new {{ Role = "user", Content = "Hello! What can you help me with?" }}],
 agent: new
 {{
 Name = "{name}",
 Instructions = "You are a helpful AI assistant.",
 Tools = Array.Empty<object>()
 }}
);

Console.WriteLine($"Response: {{response.Content}}");
""")

 # appsettings.json
 create_file(root / "appsettings.json", """{
 "Foundry": {
 "Endpoint": "",
 "Model": "gpt-5.1"
 },
 "Logging": {
 "LogLevel": {
 "Default": "Information"
 }
 }
}
""")

 # .gitignore
 create_file(root / ".gitignore", """bin/
obj/
.vs/
*.user
appsettings.Development.json
.env
""")

 # README
 create_file(root / "README.md", f"""# {name}

AI Agent built with [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) (.NET).

## Setup

```bash
dotnet restore
# Set environment variables or edit appsettings.json
```

## Run

```bash
dotnet run
```
""")

def main():
 parser = argparse.ArgumentParser(
 description="Scaffold an AI agent project with Agent Framework"
 )
 parser.add_argument("--name", required=True, help="Project name (kebab-case)")
 parser.add_argument(
 "--runtime",
 choices=["python", "dotnet"],
 default="python",
 help="Runtime platform (default: python)",
 )
 parser.add_argument(
 "--pattern",
 choices=["single", "multi-agent", "sequential"],
 default="single",
 help="Agent pattern (default: single)",
 )
 parser.add_argument(
 "--with-eval",
 action="store_true",
 help="Include evaluation harness template",
 )
 parser.add_argument(
 "--with-mcp",
 action="store_true",
 help="Include MCP server template (Python only)",
 )
 parser.add_argument(
 "--output",
 type=str,
 default=None,
 help="Output directory (default: ./<name>)",
 )

 args = parser.parse_args()
 root = Path(args.output or args.name).resolve()

 if root.exists() and any(root.iterdir()):
 print(f"Error: Directory '{root}' already exists and is not empty.")
 sys.exit(1)

 print(f"\nScaffolding AI agent project: {args.name}")
 print(f" Runtime: {args.runtime}")
 print(f" Pattern: {args.pattern}")
 print(f" Output: {root}\n")

 if args.runtime == "python":
 scaffold_python_agent(root, args.name, args.pattern, args.with_eval, args.with_mcp)
 else:
 scaffold_dotnet_agent(root, args.name, args.pattern, args.with_eval)

 print(f"\n[OK] Agent project scaffolded at: {root}")
 print(f"\nNext steps:")
 if args.runtime == "python":
 print(f" cd {args.name}")
 print(f" python -m venv .venv && .venv/Scripts/activate")
 print(f" pip install -e '.[dev]'")
 print(f" cp .env.template .env # Fill in credentials")
 print(f" python -m {args.name.replace('-', '_')}.main")
 else:
 print(f" cd {args.name}")
 print(f" dotnet restore")
 print(f" # Set FOUNDRY_ENDPOINT and FOUNDRY_API_KEY env vars")
 print(f" dotnet run")

if __name__ == "__main__":
 main()
