#!/usr/bin/env python3
"""Scaffold a production-ready Python project structure.

Generates:
 - Project layout (src or flat)
 - pyproject.toml with modern tooling
 - pytest configuration
 - Linting setup (ruff)
 - Pre-commit hooks config
 - GitHub Actions CI workflow

Usage:
 python scaffold-project.py --name my-app --layout src
 python scaffold-project.py --name my-api --type fastapi
"""

import argparse
import os
from pathlib import Path

PYPROJECT_TEMPLATE = """\
[project]
name = "{name}"
version = "0.1.0"
description = "{description}"
requires-python = ">=3.11"
license = {{text = "MIT"}}
readme = "README.md"

dependencies = [
{deps}
]

[project.optional-dependencies]
dev = [
 "pytest>=8.0",
 "pytest-cov>=5.0",
 "ruff>=0.8.0",
 "mypy>=1.13",
 "pre-commit>=4.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
testpaths = ["{test_dir}"]
addopts = "--cov={source_dir} --cov-report=term-missing --cov-fail-under=80"

[tool.ruff]
target-version = "py311"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "S", "B", "A", "C4", "SIM", "TCH"]
ignore = ["S101"] # Allow assert in tests

[tool.ruff.lint.isort]
known-first-party = ["{package_name}"]

[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true
"""

MAIN_MODULE = """\
\"""Main application entry point.\"""

import logging

logger = logging.getLogger(__name__)

def main() -> None:
 \"""Run the application.\"""
 logging.basicConfig(
 level=logging.INFO,
 format="%(asctime)s %(levelname)s %(name)s: %(message)s",
 )
 logger.info("Application started")

if __name__ == "__main__":
 main()
"""

FASTAPI_MAIN = """\
\"""FastAPI application entry point.\"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
 title="{name}",
 version="0.1.0",
 docs_url="/docs",
 redoc_url="/redoc",
)

app.add_middleware(
 CORSMiddleware,
 allow_origins=["*"], # TODO: Restrict in production
 allow_credentials=True,
 allow_methods=["*"],
 allow_headers=["*"],
)

@app.get("/health")
async def health() -> dict[str, str]:
 \"""Health check endpoint.\"""
 return {{"status": "healthy"}}

@app.get("/")
async def root() -> dict[str, str]:
 \"""Root endpoint.\"""
 return {{"message": "Welcome to {name}"}}
"""

TEST_TEMPLATE = """\
\"""Tests for {module}.\"""

def test_placeholder() -> None:
 \"""Placeholder test - replace with real tests.\"""
 assert True
"""

PRECOMMIT_CONFIG = """\
repos:
 - repo: https://github.com/astral-sh/ruff-pre-commit
 rev: v0.8.0
 hooks:
 - id: ruff
 args: [--fix]
 - id: ruff-format

 - repo: https://github.com/pre-commit/mirrors-mypy
 rev: v1.13.0
 hooks:
 - id: mypy
 additional_dependencies: []

 - repo: https://github.com/pre-commit/pre-commit-hooks
 rev: v5.0.0
 hooks:
 - id: check-yaml
 - id: end-of-file-fixer
 - id: trailing-whitespace
 - id: check-added-large-files
"""

CI_WORKFLOW = """\
name: CI

on:
 push:
 branches: [main, master]
 pull_request:
 branches: [main, master]

permissions:
 contents: read

jobs:
 test:
 runs-on: ubuntu-latest
 timeout-minutes: 15

 strategy:
 matrix:
 python-version: ["3.11", "3.12", "3.13"]

 steps:
 - uses: actions/checkout@v4

 - name: Set up Python ${{{{ matrix.python-version }}}}
 uses: actions/setup-python@v5
 with:
 python-version: ${{{{ matrix.python-version }}}}

 - name: Install dependencies
 run: |
 python -m pip install --upgrade pip
 pip install -e ".[dev]"

 - name: Lint with ruff
 run: ruff check .

 - name: Type check with mypy
 run: mypy {source_dir}/

 - name: Test with pytest
 run: pytest --cov-report=xml

 - name: Upload coverage
 uses: actions/upload-artifact@v4
 with:
 name: coverage-${{{{ matrix.python-version }}}}
 path: coverage.xml
"""

README_TEMPLATE = """\
# {name}

{description}

## Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate # or .venv\\Scripts\\activate on Windows

# Install with dev dependencies
pip install -e ".[dev]"

# Install pre-commit hooks
pre-commit install
```

## Development

```bash
# Run tests
pytest

# Lint
ruff check .

# Type check
mypy {source_dir}/

# Format
ruff format .
```

## Project Structure

```
{name}/
+-- {source_dir}/
| +-- __init__.py
| -- main.py
+-- tests/
| -- test_main.py
+-- pyproject.toml
+-- .pre-commit-config.yaml
-- README.md
```
"""

def create_project(name: str, layout: str, project_type: str, output: str) -> list[str]:
 """Create the project structure."""
 root = Path(output) / name
 root.mkdir(parents=True, exist_ok=True)

 files: list[str] = []
 package_name = name.replace("-", "_")

 # Source directory
 if layout == "src":
 source_dir = f"src/{package_name}"
 else:
 source_dir = package_name
 test_dir = "tests"

 src_path = root / source_dir
 src_path.mkdir(parents=True, exist_ok=True)
 (src_path / "__init__.py").write_text(f'"""{name} package."""\n\n__version__ = "0.1.0"\n')
 files.append(str(src_path / "__init__.py"))

 # Main module
 if project_type == "fastapi":
 main_content = FASTAPI_MAIN.format(name=name)
 deps = ' "fastapi>=0.115.0",\n "uvicorn[standard]>=0.32.0",'
 else:
 main_content = MAIN_MODULE
 deps = ""

 (src_path / "main.py").write_text(main_content)
 files.append(str(src_path / "main.py"))

 # Tests
 test_path = root / test_dir
 test_path.mkdir(parents=True, exist_ok=True)
 (test_path / "__init__.py").write_text("")
 (test_path / "test_main.py").write_text(TEST_TEMPLATE.format(module="main"))
 files.append(str(test_path / "test_main.py"))

 # pyproject.toml
 pyproject = PYPROJECT_TEMPLATE.format(
 name=name,
 description=f"A {project_type} project",
 deps=deps,
 test_dir=test_dir,
 source_dir=source_dir,
 package_name=package_name,
 )
 (root / "pyproject.toml").write_text(pyproject)
 files.append(str(root / "pyproject.toml"))

 # Pre-commit config
 (root / ".pre-commit-config.yaml").write_text(PRECOMMIT_CONFIG)
 files.append(str(root / ".pre-commit-config.yaml"))

 # CI workflow
 ci_dir = root / ".github" / "workflows"
 ci_dir.mkdir(parents=True, exist_ok=True)
 (ci_dir / "ci.yml").write_text(CI_WORKFLOW.format(source_dir=source_dir))
 files.append(str(ci_dir / "ci.yml"))

 # README
 (root / "README.md").write_text(README_TEMPLATE.format(
 name=name, description=f"A {project_type} project", source_dir=source_dir
 ))
 files.append(str(root / "README.md"))

 # .gitignore
 gitignore = "__pycache__/\n*.pyc\n.venv/\nvenv/\n*.egg-info/\ndist/\nbuild/\n.coverage\ncoverage.xml\n.mypy_cache/\n.ruff_cache/\n.pytest_cache/\n"
 (root / ".gitignore").write_text(gitignore)
 files.append(str(root / ".gitignore"))

 return files

def main() -> None:
 parser = argparse.ArgumentParser(description="Scaffold a Python project")
 parser.add_argument("--name", default="my-app", help="Project name")
 parser.add_argument("--layout", choices=["src", "flat"], default="src", help="Project layout")
 parser.add_argument("--type", choices=["basic", "fastapi"], default="basic", help="Project type")
 parser.add_argument("--output", default=".", help="Parent directory for the project")

 args = parser.parse_args()

 print(f"Scaffolding Python project '{args.name}'...")
 print(f" Layout: {args.layout}")
 print(f" Type: {args.type}")

 files = create_project(args.name, args.layout, args.type, args.output)

 print(f"\nCreated {len(files)} files:")
 for f in files:
 print(f" - {os.path.relpath(f)}")

 print(f"\nNext steps:")
 print(f" cd {args.name}")
 print(f" python -m venv .venv")
 print(f" pip install -e '.[dev]'")
 print(f" pre-commit install")

if __name__ == "__main__":
 main()
