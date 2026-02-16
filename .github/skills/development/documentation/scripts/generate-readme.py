#!/usr/bin/env python3
"""Generate a production-ready README.md from project analysis.

Scans the project to auto-detect: language, dependencies, scripts,
and generates a structured README with setup, usage, and contributing sections.

Usage:
 python generate-readme.py [--path .] [--output README.md]
"""

import argparse
import json
import os
from pathlib import Path

def detect_language(path: Path) -> str:
 """Detect primary programming language."""
 extensions: dict[str, int] = {}
 for f in path.rglob("*"):
 if f.is_file() and not any(
 part in str(f) for part in ["node_modules", ".git", "bin", "obj", "__pycache__", ".venv"]
 ):
 ext = f.suffix.lower()
 if ext in (".cs", ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java"):
 extensions[ext] = extensions.get(ext, 0) + 1

 lang_map = {
 ".cs": "C# / .NET", ".py": "Python", ".ts": "TypeScript",
 ".tsx": "TypeScript (React)", ".js": "JavaScript", ".jsx": "JavaScript (React)",
 ".go": "Go", ".rs": "Rust", ".java": "Java",
 }
 if extensions:
 top_ext = max(extensions, key=extensions.get) # type: ignore
 return lang_map.get(top_ext, "Unknown")
 return "Unknown"

def detect_package_manager(path: Path) -> dict:
 """Detect package manager and scripts."""
 info: dict = {"manager": "", "scripts": {}, "deps": []}

 # Node.js
 pkg_json = path / "package.json"
 if pkg_json.exists():
 data = json.loads(pkg_json.read_text())
 info["manager"] = "npm"
 info["scripts"] = data.get("scripts", {})
 info["deps"] = list(data.get("dependencies", {}).keys())[:10]
 return info

 # Python
 pyproject = path / "pyproject.toml"
 if pyproject.exists():
 info["manager"] = "pip"
 return info

 req = path / "requirements.txt"
 if req.exists():
 info["manager"] = "pip"
 deps = [
 line.split("==")[0].split(">=")[0].strip()
 for line in req.read_text().splitlines()
 if line.strip() and not line.startswith("#")
 ]
 info["deps"] = deps[:10]
 return info

 # .NET
 for csproj in path.rglob("*.csproj"):
 info["manager"] = "dotnet"
 break

 # Go
 if (path / "go.mod").exists():
 info["manager"] = "go"

 return info

def generate_readme(path: Path, project_name: str) -> str:
 """Generate README content."""
 lang = detect_language(path)
 pkg = detect_package_manager(path)

 # Setup commands by manager
 setup_commands = {
 "npm": "npm install",
 "pip": "pip install -e '.[dev]'",
 "dotnet": "dotnet restore\ndotnet build",
 "go": "go mod download",
 }

 run_commands = {
 "npm": "npm start",
 "pip": "python -m {name}",
 "dotnet": "dotnet run",
 "go": "go run .",
 }

 test_commands = {
 "npm": "npm test",
 "pip": "pytest",
 "dotnet": "dotnet test",
 "go": "go test ./...",
 }

 setup = setup_commands.get(pkg["manager"], "# Add setup instructions")
 run = run_commands.get(pkg["manager"], "# Add run instructions").format(name=project_name)
 test = test_commands.get(pkg["manager"], "# Add test instructions")

 # Build scripts section
 scripts_section = ""
 if pkg["scripts"]:
 scripts_section = "\n## Available Scripts\n\n| Script | Command |\n|--------|--------|\n"
 for name, cmd in list(pkg["scripts"].items())[:10]:
 scripts_section += f"| `{name}` | `{cmd}` |\n"

 # Build deps section
 deps_section = ""
 if pkg["deps"]:
 deps_section = "\n## Key Dependencies\n\n"
 for dep in pkg["deps"]:
 deps_section += f"- `{dep}`\n"

 readme = f"""\
# {project_name}

> Brief description of the project.

**Language**: {lang} 
**License**: MIT

---

## Prerequisites

- {lang} development environment installed
{'- Node.js 20+ and npm' if pkg['manager'] == 'npm' else ''}
{'- Python 3.11+' if pkg['manager'] == 'pip' else ''}
{'- .NET 8+ SDK' if pkg['manager'] == 'dotnet' else ''}
{'- Go 1.22+' if pkg['manager'] == 'go' else ''}

## Setup

```bash
# Clone the repository
git clone <repository-url>
cd {project_name}

# Install dependencies
{setup}
```

## Usage

```bash
{run}
```

## Testing

```bash
{test}
```
{scripts_section}{deps_section}
## Project Structure

```
{project_name}/
+-- src/ # Source code
+-- tests/ # Test files
+-- docs/ # Documentation
-- README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
"""
 return readme

def main() -> None:
 parser = argparse.ArgumentParser(description="Generate README.md")
 parser.add_argument("--path", default=".", help="Project root")
 parser.add_argument("--output", default="README.md", help="Output file")
 parser.add_argument("--name", default="", help="Project name")

 args = parser.parse_args()
 project_path = Path(args.path).resolve()
 project_name = args.name or project_path.name

 print(f"Generating README for '{project_name}'...")
 readme = generate_readme(project_path, project_name)

 output = Path(args.output)
 output.write_text(readme, encoding="utf-8")
 print(f" Created: {output}")

if __name__ == "__main__":
 main()
