#!/usr/bin/env bash
# AgentX Framework Self-Tests (Bash)
# Parity with tests/test-framework.ps1 for Linux/macOS validation.
#
# Usage:
#   bash tests/test-framework.sh
#   ./tests/test-framework.sh
#
# Requirements: bash 4+, standard coreutils
# Optional: jq (for JSON validation)

set -uo pipefail

PASS=0
FAIL=0
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Helpers ---------------------------------------------------------------

assert_true() {
  local condition="$1"
  local message="$2"
  if eval "$condition"; then
    echo -e "  \033[0;32m[PASS]\033[0m $message"
    ((PASS++))
  else
    echo -e "  \033[0;31m[FAIL]\033[0m $message"
    ((FAIL++))
  fi
}

assert_file_exists() {
  local relpath="$1"
  local label="$2"
  local fullpath="$ROOT/$relpath"
  assert_true "[[ -f '$fullpath' ]]" "$label exists ($relpath)"
}

assert_dir_exists() {
  local relpath="$1"
  local label="$2"
  local fullpath="$ROOT/$relpath"
  assert_true "[[ -d '$fullpath' ]]" "$label exists ($relpath)"
}

assert_file_contains() {
  local relpath="$1"
  local pattern="$2"
  local label="$3"
  local fullpath="$ROOT/$relpath"
  if [[ -f "$fullpath" ]]; then
    assert_true "grep -qE '$pattern' '$fullpath'" "$label"
  else
    echo -e "  \033[0;31m[FAIL]\033[0m $label (file not found: $relpath)"
    ((FAIL++))
  fi
}

echo ""
echo -e "  \033[0;36mAgentX Framework Self-Tests (Bash)\033[0m"
echo -e "  \033[0;90m================================================\033[0m"
echo ""

# --- 1. Core Files ---------------------------------------------------------
echo -e "  \033[1;37m1. Core Files\033[0m"

assert_file_exists "AGENTS.md"   "AGENTS.md"
assert_file_exists "Skills.md"   "Skills.md"
assert_file_exists "README.md"   "README.md"
assert_file_exists "install.ps1" "install.ps1"
assert_file_exists "install.sh"  "install.sh"
assert_file_exists "LICENSE"     "LICENSE"

# --- 2. Agent Definitions --------------------------------------------------
echo ""
echo -e "  \033[1;37m2. Agent Definitions\033[0m"

for agent in agent-x product-manager architect engineer reviewer ux-designer devops reviewer-auto; do
  assert_file_exists ".github/agents/$agent.agent.md" "Agent: $agent"
done

# --- 3. Templates -----------------------------------------------------------
echo ""
echo -e "  \033[1;37m3. Templates\033[0m"

for tpl in PRD-TEMPLATE.md ADR-TEMPLATE.md SPEC-TEMPLATE.md UX-TEMPLATE.md REVIEW-TEMPLATE.md PROGRESS-TEMPLATE.md; do
  assert_file_exists ".github/templates/$tpl" "Template: $tpl"
done

assert_file_contains ".github/templates/PRD-TEMPLATE.md"  "AI/ML Requirements"  "PRD has AI/ML Requirements section"
assert_file_contains ".github/templates/ADR-TEMPLATE.md"  "AI/ML Architecture"  "ADR has AI/ML Architecture section"
assert_file_contains ".github/templates/SPEC-TEMPLATE.md" "AI/ML Specification" "SPEC has AI/ML Specification section"

# --- 4. TOML Workflows ------------------------------------------------------
echo ""
echo -e "  \033[1;37m4. TOML Workflows\033[0m"

for wf in feature epic story bug spike devops docs; do
  assert_file_exists ".agentx/workflows/$wf.toml" "Workflow: $wf"
done

assert_file_contains ".agentx/workflows/feature.toml" '\[\[steps\]\]' "feature.toml has steps"
assert_file_contains ".agentx/workflows/feature.toml" 'agent\s*='     "feature.toml has agent assignments"

# --- 5. CLI (agentx.sh) ----------------------------------------------------
echo ""
echo -e "  \033[1;37m5. CLI (agentx.sh)\033[0m"

assert_file_exists ".agentx/agentx.sh" "CLI script exists"
assert_file_contains ".agentx/agentx.sh" "cmd_ready"    "CLI implements: ready"
assert_file_contains ".agentx/agentx.sh" "cmd_state"    "CLI implements: state"
assert_file_contains ".agentx/agentx.sh" "cmd_deps"     "CLI implements: deps"
assert_file_contains ".agentx/agentx.sh" "cmd_digest"   "CLI implements: digest"
assert_file_contains ".agentx/agentx.sh" "cmd_workflow"  "CLI implements: workflow"
assert_file_contains ".agentx/agentx.sh" "cmd_hook"     "CLI implements: hook"
assert_file_contains ".agentx/agentx.sh" "cmd_version"  "CLI implements: version"
assert_file_contains ".agentx/agentx.sh" "cmd_upgrade"  "CLI implements: upgrade"
assert_file_contains ".agentx/agentx.sh" "cmd_run"      "CLI implements: run"

# --- 6. Skills ---------------------------------------------------------------
echo ""
echo -e "  \033[1;37m6. Skills\033[0m"

SKILL_COUNT=$(find "$ROOT/.github/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
assert_true "[[ $SKILL_COUNT -ge 35 ]]" "At least 35 skills exist (found: $SKILL_COUNT)"

assert_file_exists ".github/skills/ai-systems/ai-agent-development/SKILL.md"         "AI Agent Development skill"
assert_file_exists ".github/skills/ai-systems/cognitive-architecture/SKILL.md"        "Cognitive Architecture skill"
assert_file_exists ".github/skills/ai-systems/cognitive-architecture/scripts/scaffold-cognitive.py" "Cognitive scaffold script"

# Instructions
assert_file_exists ".github/instructions/typescript.instructions.md" "TypeScript instruction file"
assert_file_exists ".github/skills/infrastructure/terraform/SKILL.md"       "Terraform skill"
assert_file_exists ".github/skills/infrastructure/bicep/SKILL.md"           "Bicep skill"

# Schemas
assert_file_exists "scripts/validate-frontmatter.ps1"                    "Frontmatter validation script"
assert_file_exists ".github/schemas/instruction-frontmatter.schema.json" "Instruction schema"
assert_file_exists ".github/schemas/agent-frontmatter.schema.json"       "Agent schema"
assert_file_exists ".github/schemas/skill-frontmatter.schema.json"       "Skill schema"

# --- 7. AI-First Intent Preservation ----------------------------------------
echo ""
echo -e "  \033[1;37m7. AI-First Intent Preservation\033[0m"

assert_file_contains ".github/agents/agent-x.agent.md"         "classifyDomain"         "Agent X has domain classification"
assert_file_contains ".github/agents/agent-x.agent.md"         "needs:ai"               "Agent X detects AI domain"
assert_file_contains ".github/agents/agent-x.agent.md"         "validatePRDIntent"      "Agent X validates PRD intent"
assert_file_contains ".github/agents/product-manager.agent.md" "Domain Classification"  "PM has domain classification step"
assert_file_contains ".github/agents/product-manager.agent.md" "ai-agent-development/SKILL.md" "PM references AI skill"
assert_file_contains ".github/agents/architect.agent.md"        "AI-Aware Research"     "Architect has AI-aware research step"
assert_file_contains ".github/agents/engineer.agent.md"         "AI Implementation Setup" "Engineer has AI implementation step"
assert_file_contains ".github/agents/reviewer.agent.md"         "Intent Preservation"   "Reviewer has intent preservation check"

# --- 8. GitHub Actions -------------------------------------------------------
echo ""
echo -e "  \033[1;37m8. GitHub Actions\033[0m"

assert_file_exists ".github/workflows/agent-x.yml"       "agent-x.yml workflow"
assert_file_exists ".github/workflows/quality-gates.yml"  "quality-gates.yml workflow"

# --- 9. Hooks & Scripts ------------------------------------------------------
echo ""
echo -e "  \033[1;37m9. Hooks & Scripts\033[0m"

assert_file_exists ".github/hooks/pre-commit"            "pre-commit hook"
assert_file_exists ".github/hooks/commit-msg"            "commit-msg hook"
assert_file_exists ".github/scripts/validate-handoff.sh" "validate-handoff.sh"

# --- 10. Documentation Consistency -------------------------------------------
echo ""
echo -e "  \033[1;37m10. Documentation Consistency\033[0m"

assert_file_contains "AGENTS.md"                     "Single source of truth"  "AGENTS.md declares single source"
assert_file_exists   "docs/QUICKSTART.md"                                      "5-minute Quickstart guide"
assert_file_contains "AGENTS.md"                     "QUICKSTART"              "AGENTS.md links to Quickstart"
assert_file_contains ".github/copilot-instructions.md" "RFC 2119"             "Router has RFC 2119 directive language"
assert_file_contains "README.md"                     "OpenSSF"                 "README has OpenSSF Scorecard badge"

# --- 11. Bash CLI Functional Tests -------------------------------------------
echo ""
echo -e "  \033[1;37m11. Bash CLI Functional Tests\033[0m"

# Test help command
HELP_OUTPUT=$(bash "$ROOT/.agentx/agentx.sh" help 2>&1)
assert_true "[[ \$? -eq 0 ]]" "agentx.sh help exits cleanly"
assert_true "[[ '$HELP_OUTPUT' == *'Commands'* ]]" "agentx.sh help shows Commands section"

# Test version command
VERSION_OUTPUT=$(bash "$ROOT/.agentx/agentx.sh" version 2>&1)
assert_true "[[ \$? -eq 0 ]]" "agentx.sh version exits cleanly"

# Test workflow list (no arguments)
WORKFLOW_OUTPUT=$(bash "$ROOT/.agentx/agentx.sh" workflow 2>&1)
assert_true "[[ \$? -eq 0 ]]" "agentx.sh workflow (list) exits cleanly"

# Test workflow with type
WORKFLOW_FEATURE=$(bash "$ROOT/.agentx/agentx.sh" workflow feature 2>&1)
assert_true "[[ \$? -eq 0 ]]" "agentx.sh workflow feature exits cleanly"

# Test state (no args = show all)
STATE_OUTPUT=$(bash "$ROOT/.agentx/agentx.sh" state 2>&1)
assert_true "[[ \$? -eq 0 ]]" "agentx.sh state exits cleanly"

# Test ready queue
READY_OUTPUT=$(bash "$ROOT/.agentx/agentx.sh" ready 2>&1)
assert_true "[[ \$? -eq 0 ]]" "agentx.sh ready exits cleanly"

# --- 12. VS Code Extension --------------------------------------------------
echo ""
echo -e "  \033[1;37m12. VS Code Extension\033[0m"

assert_file_exists "vscode-extension/package.json"    "Extension package.json"
assert_file_exists "vscode-extension/tsconfig.json"   "Extension tsconfig.json"
assert_file_exists "vscode-extension/src/extension.ts" "Extension entry point"
assert_file_exists "vscode-extension/src/agentxContext.ts" "AgentXContext module"
assert_file_exists "vscode-extension/src/chat/chatParticipant.ts" "Chat participant"
assert_file_exists "vscode-extension/src/chat/agentRouter.ts"     "Agent router"
assert_file_exists "vscode-extension/src/chat/commandHandlers.ts" "Command handlers"
assert_file_exists "vscode-extension/src/chat/followupProvider.ts" "Followup provider"
assert_file_exists "vscode-extension/src/chat/agentContextLoader.ts" "Agent context loader"

assert_file_contains "vscode-extension/package.json" '"test"' "Extension has test script"
assert_dir_exists    "vscode-extension/src/test"              "Extension test directory exists"

# --- Results -----------------------------------------------------------------
echo ""
echo -e "  \033[0;90m================================================\033[0m"
TOTAL=$((PASS + FAIL))
if [[ $FAIL -eq 0 ]]; then
  echo -e "  \033[0;32mResults: $PASS/$TOTAL passed\033[0m"
else
  echo -e "  \033[0;33mResults: $PASS/$TOTAL passed\033[0m"
  echo -e "  \033[0;31mFailures: $FAIL\033[0m"
fi
echo ""

exit "$FAIL"
