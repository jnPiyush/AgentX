#!/usr/bin/env bash
# check-coverage.sh - Check test coverage against a threshold
#
# Usage:
# ./check-coverage.sh [--threshold 80] [--path ./src] [--format summary|detailed|json]
#
# Supports: .NET (Coverlet), Python (pytest-cov), Node.js (Istanbul/Jest)

set -euo pipefail

THRESHOLD=80
PROJECT_PATH="."
FORMAT="summary"

while [[ $# -gt 0 ]]; do
 case $1 in
 --threshold) THRESHOLD="$2"; shift 2 ;;
 --path) PROJECT_PATH="$2"; shift 2 ;;
 --format) FORMAT="$2"; shift 2 ;;
 *) echo "Unknown option: $1"; exit 1 ;;
 esac
done

header() { echo -e "\n\033[36m=== $1 ===\033[0m"; }
pass_msg(){ echo -e " \033[32mPASS: $1\033[0m"; }
fail_msg(){ echo -e " \033[31mFAIL: $1\033[0m"; }
info_msg(){ echo -e " \033[33mINFO: $1\033[0m"; }

detect_project_type() {
 if find "$PROJECT_PATH" -name "*.csproj" -o -name "*.sln" 2>/dev/null | head -1 | grep -q .; then
 echo "dotnet"
 elif [[ -f "$PROJECT_PATH/pyproject.toml" || -f "$PROJECT_PATH/setup.py" || -f "$PROJECT_PATH/requirements.txt" ]]; then
 echo "python"
 elif [[ -f "$PROJECT_PATH/package.json" ]]; then
 echo "node"
 else
 echo ""
 fi
}

run_dotnet_coverage() {
 info_msg "Running dotnet test with Coverlet..."
 local output
 output=$(dotnet test "$PROJECT_PATH" --collect:"XPlat Code Coverage" \
 --results-directory "$PROJECT_PATH/TestResults" 2>&1) || true
 local coverage
 coverage=$(echo "$output" | grep -oP 'Total\s*\|\s*\K[\d.]+(?=%)' | tail -1)
 [[ -z "$coverage" ]] && coverage=0
 echo "$coverage"
}

run_python_coverage() {
 info_msg "Running pytest with coverage..."
 pushd "$PROJECT_PATH" > /dev/null
 local output
 output=$(python -m pytest --cov --cov-report=term-missing 2>&1) || true
 local coverage
 coverage=$(echo "$output" | grep -oP 'TOTAL\s+\d+\s+\d+\s+\K\d+(?=%)' | tail -1)
 [[ -z "$coverage" ]] && coverage=0
 popd > /dev/null
 echo "$coverage"
}

run_node_coverage() {
 info_msg "Running npm test with coverage..."
 pushd "$PROJECT_PATH" > /dev/null
 local output
 if grep -q '"vitest"' package.json 2>/dev/null; then
 output=$(npx vitest run --coverage 2>&1) || true
 elif grep -q '"jest"' package.json 2>/dev/null; then
 output=$(npx jest --coverage 2>&1) || true
 else
 output=$(npm test -- --coverage 2>&1) || true
 fi
 local coverage
 coverage=$(echo "$output" | grep -oP 'All files\s*\|\s*\K[\d.]+' | tail -1)
 [[ -z "$coverage" ]] && coverage=0
 popd > /dev/null
 echo "$coverage"
}

# Main
header "Coverage Check"
echo " Target: ${THRESHOLD}%"
echo " Path: $PROJECT_PATH"

PROJECT_TYPE=$(detect_project_type)

if [[ -z "$PROJECT_TYPE" ]]; then
 fail_msg "Could not detect project type at: $PROJECT_PATH"
 info_msg "Supported: .NET (.csproj/.sln), Python (pyproject.toml/setup.py), Node.js (package.json)"
 exit 1
fi

info_msg "Detected project type: $PROJECT_TYPE"

case "$PROJECT_TYPE" in
 dotnet) COVERAGE=$(run_dotnet_coverage) ;;
 python) COVERAGE=$(run_python_coverage) ;;
 node) COVERAGE=$(run_node_coverage) ;;
esac

header "Results"

if [[ "$FORMAT" == "json" ]]; then
 echo "{\"projectType\":\"$PROJECT_TYPE\",\"threshold\":$THRESHOLD,\"coverage\":$COVERAGE,\"passed\":$([ "$COVERAGE" -ge "$THRESHOLD" ] && echo true || echo false)}"
else
 echo " Coverage: ${COVERAGE}%"
fi

if (( $(echo "$COVERAGE >= $THRESHOLD" | bc -l) )); then
 pass_msg "Coverage ${COVERAGE}% meets threshold of ${THRESHOLD}%"
 exit 0
else
 fail_msg "Coverage ${COVERAGE}% is below threshold of ${THRESHOLD}%"
 exit 1
fi
