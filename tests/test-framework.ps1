#!/usr/bin/env pwsh
# AgentX Framework Self-Tests
# Verifies CLI, templates, workflows, and project structure
# Usage: pwsh tests/test-framework.ps1

$ErrorActionPreference = "Continue"
$script:pass = 0
$script:fail = 0
$script:root = Split-Path $PSScriptRoot -Parent

function Assert-True($condition, $message) {
 if ($condition) {
 Write-Host " [PASS] $message" -ForegroundColor Green
 $script:pass++
 } else {
 Write-Host " [FAIL] $message" -ForegroundColor Red
 $script:fail++
 }
}

function Assert-FileExists($path, $label) {
 $fullPath = Join-Path $script:root $path
 Assert-True (Test-Path $fullPath) "$label exists ($path)"
}

function Assert-FileContains($path, $pattern, $label) {
 $fullPath = Join-Path $script:root $path
 if (Test-Path $fullPath) {
 $content = Get-Content $fullPath -Raw
 Assert-True ($content -match $pattern) "$label"
 } else {
 Assert-True $false "$label (file not found: $path)"
 }
}

function Assert-FileNotContains($path, $pattern, $label) {
 $fullPath = Join-Path $script:root $path
 if (Test-Path $fullPath) {
 $content = Get-Content $fullPath -Raw
 Assert-True ($content -notmatch $pattern) "$label"
 } else {
 Assert-True $false "$label (file not found: $path)"
 }
}

Write-Host ""
Write-Host " AgentX Framework Self-Tests" -ForegroundColor Cyan
Write-Host " ================================================" -ForegroundColor DarkGray
Write-Host ""

# --- 1. Core Files ----------------------------------------------------------------------
Write-Host " 1. Core Files" -ForegroundColor White

Assert-FileExists "AGENTS.md" "AGENTS.md"
Assert-FileExists "Skills.md" "Skills.md"
Assert-FileExists "README.md" "README.md"
Assert-FileExists "install.ps1" "install.ps1"
Assert-FileExists "install.sh" "install.sh"
Assert-FileExists "LICENSE" "LICENSE"
Assert-FileContains "install.ps1" '"LICENSE"' "PowerShell installer extracts the AgentX license"
Assert-FileContains "install.ps1" '"NOTICE"' "PowerShell installer extracts repository notices"
Assert-FileContains "install.sh" '\$PREFIX/LICENSE' "Bash installer extracts the AgentX license"
Assert-FileContains "install.sh" '\$PREFIX/NOTICE' "Bash installer extracts repository notices"
Assert-FileContains ".agentx/mcp-server/package.json" '"license": "Apache-2\.0"' "MCP package declares the AgentX Apache license"
Assert-FileContains ".github/workflows/auto-release.yml" 'cp LICENSE NOTICE release-staging/mcp/' "Auto release stages MCP legal files"
Assert-FileContains ".github/workflows/recover-release.yml" 'cp LICENSE NOTICE release-staging/mcp/' "Recovery release stages MCP legal files"
Assert-FileContains "install.ps1" "docs/WORKFLOW\.md" "install.ps1 bundles WORKFLOW reference doc"
Assert-FileContains "install.ps1" "docs/GUIDE\.md" "install.ps1 bundles GUIDE reference doc"
Assert-FileContains "install.sh" "docs/WORKFLOW\.md" "install.sh bundles WORKFLOW reference doc"
Assert-FileContains "install.sh" "docs/GUIDE\.md" "install.sh bundles GUIDE reference doc"
Assert-FileContains "install.ps1" "runtimeStatePatterns" "install.ps1 excludes repo runtime state from fresh installs"
Assert-FileContains "install.sh" "\.agentx/config\.json|\.agentx/issues/\*|\.agentx/state/\*" "install.sh excludes repo runtime state from fresh installs"
Assert-FileContains "install.ps1" "templates/memories" "install.ps1 seeds starter memory templates"
Assert-FileContains "install.sh" "templates/memories" "install.sh seeds starter memory templates"
Assert-FileContains "packs/agentx-copilot-cli/install.ps1" "Get-PackInstallPlan" "Copilot CLI installer builds an install plan from the pack manifest"
Assert-FileContains "packs/agentx-copilot-cli/install.ps1" "Loaded install plan from manifest\.json" "Copilot CLI installer reports manifest-driven planning"
Assert-FileContains "packs/agentx-copilot-cli/manifest.json" '"schemas"' "Copilot CLI manifest declares schema artifacts"
Assert-FileContains "packs/agentx-core/manifest.json" "scripts/score-code-quality.ps1" "Core pack declares code-quality evaluator"
Assert-FileContains "packs/agentx-core/manifest.json" "evaluation/rubrics/code-quality.md" "Core pack declares code-quality rubric"
Assert-FileContains ".agentx/mcp-server/package.json" "412e40abd4eb8beabfb952d80abf949a2baf27a3" "MCP runtime pins the patched fast-uri commit"
Assert-FileContains ".agentx/mcp-server/package-lock.json" '"version": "3\.1\.7"' "MCP lock resolves the patched fast-uri version"
Assert-FileNotContains ".agentx/mcp-server/package-lock.json" "pkgs\.visualstudio\.com|ms-feed-" "MCP lock contains no private registry URLs"
Assert-FileContains ".agentx/mcp-server/index.js" "risk-based 1/2/3/5 iteration minimum" "MCP completion metadata describes risk-based iteration floors"
Assert-FileContains "scripts/stamp-version.js" "docs/GUIDE\.md" "version stamper updates published installation guide"
Assert-FileContains "scripts/stamp-version.js" "preflightLiteralFile\('docs/GUIDE\.md', guideInstallerUrlEdits\)" "version stamper preflights guide installer URLs"
Assert-FileContains "scripts/stamp-version.js" "preflightLiteralFile\('install\.ps1', powershellInstallerUrlEdits\)" "version stamper preflights PowerShell installer URLs"
Assert-FileContains "scripts/stamp-version.js" "preflightLiteralFile\('install\.sh', bashInstallerUrlEdits\)" "version stamper preflights bash installer URLs"
Assert-FileContains "scripts/stamp-version.js" "updateLiteralFile\('docs/GUIDE\.md', guideInstallerUrlEdits\)" "version stamper rewrites guide installer URLs as exact literals"
Assert-FileContains "scripts/stamp-version.js" "updateLiteralFile\('install\.ps1', powershellInstallerUrlEdits\)" "version stamper rewrites PowerShell installer URLs as exact literals"
Assert-FileContains "scripts/stamp-version.js" "updateLiteralFile\('install\.sh', bashInstallerUrlEdits\)" "version stamper rewrites bash installer URLs as exact literals"
Assert-FileNotContains "scripts/stamp-version.js" "pattern:\s*/raw\\\.githubusercontent" "version stamper has no unanchored installer URL regex"
Assert-FileContains "scripts/stamp-version.js" "stampMcpPackage\(targetVersion\)" "version stamper updates MCP package and server metadata"
Assert-FileContains "scripts/stamp-version.js" "landing page release version" "version stamper updates the public landing page"
Assert-FileContains "scripts/stamp-version.js" "install-user\.ps1" "version stamper updates user-level PowerShell installer"
Assert-FileContains "scripts/stamp-version.js" "install-user\.sh" "version stamper updates user-level bash installer"
$stampVersionOutput = & node (Join-Path $script:root "tests/stamp-version-behavior.js") 2>&1
Assert-True ($LASTEXITCODE -eq 0) "version stamper supports LF and CRLF package locks"
if ($LASTEXITCODE -ne 0) {
 $stampVersionOutput | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
}
Assert-FileContains "scripts/stamp-package-version.js" "serverPattern" "MCP version stamper updates reported server identity"
Assert-FileContains "scripts/stamp-package-version.js" "' },\)" "MCP version stamper matches the server declaration comma"
Assert-FileContains ".github/workflows/auto-release.yml" "diff-tree --root --no-commit-id --name-only -r -m" "auto-release detects stamped versions in merge commits"
Assert-FileContains ".github/workflows/auto-release.yml" "release-preflight:" "auto-release defines a pre-release validation job"
Assert-FileContains ".github/workflows/auto-release.yml" "create-release:\r?\n\s+needs: \[detect-version-bump, release-preflight\]" "auto-release gates release creation on preflight"
Assert-FileContains ".github/workflows/auto-release.yml" "needs\.detect-version-bump\.result == 'success'" "auto-release fails closed when version detection fails"
Assert-FileContains ".github/workflows/auto-release.yml" "Validate extension before release creation" "auto-release validates extension before tagging"
Assert-FileContains ".github/workflows/auto-release.yml" "npm run test:coverage" "auto-release preflight enforces extension coverage"
Assert-FileContains ".github/workflows/auto-release.yml" "Validate MCP before release creation" "auto-release validates MCP before tagging"
Assert-FileContains ".github/workflows/auto-release.yml" "npm run audit:runtime" "auto-release preflight enforces the MCP audit"
Assert-FileContains ".github/workflows/publish-marketplace.yml" "VSIX identity mismatch" "Marketplace publish validates VSIX manifest identity"
Assert-FileContains ".github/workflows/publish-marketplace.yml" 'VSIX_FILE="agentx-\$\{EXPECTED_VERSION\}\.vsix"' "Marketplace publish selects the exact versioned VSIX"
Assert-FileContains ".github/workflows/quality-gates.yml" "node tests/stamp-version-behavior.js" "PR quality gates run version stamper regression coverage"
Assert-FileContains ".github/workflows/weekly-status.yml" "steps\.tokens\.outcome" "weekly status reports canonical token-check outcome"
Assert-FileContains ".github/workflows/weekly-status.yml" "continue-on-error: true" "weekly status continues after token violations to generate the report"
Assert-FileContains "packs/agentx-power-platform-builder/templates/SOLUTION-MANIFEST-TEMPLATE.md" '```xml' "Power Platform solution manifest uses a fenced XML block"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "validate-skill.ps1" "extension bundles canonical skill validator"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "validate-changed-skills.ps1" "extension bundles changed-skill no-regression validator"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "skill-quality.md" "extension bundles skill-quality rubric"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "score-code-quality.ps1" "extension bundles code-quality evaluator"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "code-quality.md" "extension bundles code-quality rubric"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "scripts/node_modules/yaml" "extension bundles skill rubric YAML runtime"
Assert-FileExists "vscode-extension/.github/agentx/.github/hooks/pre-commit" "extension bundles pre-commit hook source"
Assert-FileExists "vscode-extension/.github/agentx/.github/hooks/commit-msg" "extension bundles commit-msg hook source"
Assert-FileExists "vscode-extension/.github/agentx/.github/hooks/post-commit" "extension bundles post-commit hook source"
Assert-FileExists "vscode-extension/.github/agentx/AGENT-PROTOCOL.md" "extension bundles the canonical protocol referenced by bundled agents"
Assert-FileContains "vscode-extension/src/runtime/index.ts" "DEFAULT_HIGH_RISK_MIN_ITERATIONS" "runtime barrel exports every task-class minimum constant"
Assert-FileContains "scripts/stocktake.ps1" "-Json" "stocktake consumes canonical rubric JSON"
Assert-FileContains "scripts/stocktake.ps1" "/100" "stocktake reports 100-point skill scores"
Assert-FileExists ".agentx/templates/memories/conventions.md" "Starter memory: conventions"
Assert-FileExists ".agentx/templates/memories/pitfalls.md" "Starter memory: pitfalls"
Assert-FileExists ".agentx/templates/memories/decisions.md" "Starter memory: decisions"

# --- 2. Agent Definitions ---------------------------------------------------------------
Write-Host ""
Write-Host " 2. Agent Definitions" -ForegroundColor White

$agents = @("agent-x", "product-manager", "architect", "engineer", "reviewer", "ux-designer", "devops", "reviewer-auto", "data-scientist", "tester", "fabric-engineer", "power-platform-builder", "consulting-research", "powerbi-analyst")
foreach ($agent in $agents) {
 Assert-FileExists ".github/agents/$agent.agent.md" "Agent: $agent"
}

# --- 3. Templates -----------------------------------------------------------------------
Write-Host ""
Write-Host " 3. Templates" -ForegroundColor White

$templates = @("PRD-TEMPLATE.md", "ADR-TEMPLATE.md", "SPEC-TEMPLATE.md", "UX-TEMPLATE.md", "REVIEW-TEMPLATE.md", "PROGRESS-TEMPLATE.md", "SECURITY-PLAN-TEMPLATE.md")
foreach ($tpl in $templates) {
 Assert-FileExists ".github/templates/$tpl" "Template: $tpl"
}

# AI-First template sections
Assert-FileContains ".github/templates/PRD-TEMPLATE.md" "AI/ML Requirements" "PRD has AI/ML Requirements section"
Assert-FileContains ".github/templates/ADR-TEMPLATE.md" "AI/ML Architecture" "ADR has AI/ML Architecture section"
Assert-FileContains ".github/templates/SPEC-TEMPLATE.md" "AI/ML Specification" "SPEC has AI/ML Specification section"

# --- 4. Agent Definitions ----------------------------------------------------------------
Write-Host ""
Write-Host " 4. Agent Definitions" -ForegroundColor White

$agents = @("agent-x", "product-manager", "architect", "engineer", "reviewer", "reviewer-auto", "ux-designer", "devops", "data-scientist", "tester", "fabric-engineer", "power-platform-builder", "powerbi-analyst", "consulting-research")
foreach ($ag in $agents) {
 Assert-FileExists ".github/agents/$ag.agent.md" "Agent: $ag"
}

# Verify agent frontmatter structure
Assert-FileContains ".github/agents/engineer.agent.md" "description:" "engineer.agent.md has description"
Assert-FileContains ".github/agents/engineer.agent.md" "model:" "engineer.agent.md has model"
Assert-FileContains ".github/agents/fabric-engineer.agent.md" "type:fabric" "Fabric Engineer declares type:fabric trigger"
Assert-FileContains ".github/agents/fabric-engineer.agent.md" "AgentX Power BI Analyst" "Fabric Engineer preserves Power BI handoff"
Assert-FileContains ".github/agents/power-platform-builder.agent.md" "type:lowcode" "Power Platform Builder declares type:lowcode trigger"
Assert-FileContains ".github/agents/power-platform-builder.agent.md" "MUST NOT call pac auth" "Power Platform Builder forbids tenant authentication"

# --- 5. CLI -----------------------------------------------------------------------------
Write-Host ""
Write-Host " 5. CLI" -ForegroundColor White

Assert-FileExists ".agentx/agentx.ps1" "CLI launcher exists"
Assert-FileExists ".agentx/agentx-cli.ps1" "CLI implementation exists"
Assert-FileExists ".agentx/agentx.sh" "Bash CLI launcher exists"
Assert-FileExists ".agentx/agentic-runner.ps1" "CLI agentic loop runner exists"

# Test CLI commands exist in the implementation file
$cliCommands = @("ready", "state", "deps", "digest", "workflow", "hook", "policy-hook", "version", "run", "loop", "validate", "config", "issue", "bundle", "parallel", "backlog-sync", "hire", "watch")
foreach ($cmd in $cliCommands) {
 Assert-FileContains ".agentx/agentx-cli.ps1" "'$cmd'" "CLI supports: $cmd"
}

# Agentic runner has tool definitions
Assert-FileContains ".agentx/agentic-runner.ps1" "Invoke-AgenticLoop" "Agentic runner has main loop function"
Assert-FileContains ".agentx/agentic-runner.ps1" "file_read" "Agentic runner has file_read tool"
Assert-FileContains ".agentx/agentic-runner.ps1" "Autonomous terminal execution is disabled" "Agentic runner blocks autonomous terminal execution"
Assert-FileContains ".agentx/agentx-cli.ps1" "SetUnixFileMode" "Hook installer sets POSIX executable permissions"
Assert-FileContains ".agentx/agentx-cli.ps1" "GroupExecute" "Hook installer verifies group executable permission"
Assert-FileContains ".agentx/agentx-cli.ps1" "OtherExecute" "Hook installer verifies other executable permission"
Assert-FileContains ".agentx/agentic-runner.ps1" "Copilot" "Agentic runner supports Copilot API"
Assert-FileExists "tests/provider-behavior.ps1" "Provider behavior test script"
Assert-FileExists "tests/task-bundle-behavior.ps1" "Task bundle behavior test script"
Assert-FileExists "tests/bounded-parallel-behavior.ps1" "Bounded parallel behavior test script"
Assert-FileExists "tests/harness-audit-behavior.ps1" "Harness audit behavior test script"
Assert-FileExists "tests/agentic-runner-behavior.ps1" "Agentic runner behavior test script"
Assert-FileExists "tests/sprint-discover-behavior.ps1" "Sprint/discover behavior test script"
Assert-FileExists "tests/loop-parity-behavior.ps1" "Loop parity behavior test script"
Assert-FileExists "tests/pre-commit-gate-behavior.ps1" "Pre-commit gate behavior test script"
Assert-FileExists "tests/skill-rubric-behavior.ps1" "Skill rubric behavior test script"
Assert-FileExists "tests/code-quality-rubric-behavior.ps1" "Code-quality rubric behavior test script"
Assert-FileExists "tests/ai-agent-scaffold-behavior.ps1" "AI agent scaffold behavior test script"
Assert-FileExists "tests/customization-modernization-behavior.ps1" "Customization modernization behavior test script"
Assert-FileExists "tests/policy-hook-behavior.ps1" "Policy hook behavior test script"
Assert-FileExists "tests/token-budget-behavior.ps1" "Token budget behavior test script"
Assert-FileExists "tests/token-budget-ci-behavior.ps1" "Token budget CI execution test script"
Assert-FileExists "tests/model-route-behavior.ps1" "Model route behavior test script"
Assert-FileExists "tests/budget-behavior.ps1" "Budget behavior test script"
Assert-FileExists "tests/copilot-host-compatibility-behavior.ps1" "Copilot host compatibility behavior test script"
Assert-FileExists "tests/harness-distribution-behavior.ps1" "Harness distribution behavior test script"
Assert-FileExists "tests/installer-license-behavior.ps1" "Installer license behavior test script"

$providerBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/provider-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $providerBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Provider CLI behavior tests pass"

$taskBundleBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/task-bundle-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $taskBundleBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Task bundle CLI behavior tests pass"

$boundedParallelBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/bounded-parallel-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $boundedParallelBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Bounded parallel CLI behavior tests pass"

$harnessAuditBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/harness-audit-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $harnessAuditBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Harness audit CLI behavior tests pass"

$agenticRunnerBehaviorTempFile = [System.IO.Path]::GetTempFileName()
& pwsh -NoProfile -File (Join-Path $script:root "tests/agentic-runner-behavior.ps1") *> $agenticRunnerBehaviorTempFile
$agenticRunnerBehaviorExitCode = $LASTEXITCODE
if ($agenticRunnerBehaviorExitCode -ne 0) {
    Get-Content $agenticRunnerBehaviorTempFile | Write-Host
}
Remove-Item $agenticRunnerBehaviorTempFile -ErrorAction SilentlyContinue
Assert-True ($agenticRunnerBehaviorExitCode -eq 0) "Agentic runner behavior tests pass"

$sprintDiscoverBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/sprint-discover-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $sprintDiscoverBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Sprint/discover CLI behavior tests pass"

$loopParityBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/loop-parity-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $loopParityBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Loop parity behavior tests pass"

$preCommitGateBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/pre-commit-gate-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $preCommitGateBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Pre-commit gate behavior tests pass"

$tokenBudgetBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/token-budget-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $tokenBudgetBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Token budget behavior tests pass"

$tokenCiResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/token-budget-ci-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host $tokenCiResult }
Assert-True ($LASTEXITCODE -eq 0) "Token budget CI execution tests pass"

$modelRouteBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/model-route-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $modelRouteBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Model route behavior tests pass"

$budgetBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/budget-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $budgetBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Budget behavior tests pass"

$skillRubricBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/skill-rubric-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $skillRubricBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Skill rubric behavior tests pass"

$codeQualityRubricResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/code-quality-rubric-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $codeQualityRubricResult
}
Assert-True ($LASTEXITCODE -eq 0) "Code-quality rubric behavior tests pass"

$noAiSlopResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/no-ai-slop-skill-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $noAiSlopResult
}
Assert-True ($LASTEXITCODE -eq 0) "No AI Slop skill behavior tests pass"

$aiAgentScaffoldResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/ai-agent-scaffold-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $aiAgentScaffoldResult
}
Assert-True ($LASTEXITCODE -eq 0) "AI agent scaffold behavior tests pass"

$customizationModernizationResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/customization-modernization-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $customizationModernizationResult
}
Assert-True ($LASTEXITCODE -eq 0) "Customization modernization behavior tests pass"

$policyHookBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/policy-hook-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $policyHookBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Policy hook behavior tests pass"

$copilotHostCompatibilityResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/copilot-host-compatibility-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $copilotHostCompatibilityResult
}
Assert-True ($LASTEXITCODE -eq 0) "Copilot host compatibility behavior tests pass"

$harnessDistributionResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/harness-distribution-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $harnessDistributionResult
}
Assert-True ($LASTEXITCODE -eq 0) "Harness distribution behavior tests pass"

$installerLicenseResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/installer-license-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $installerLicenseResult
}
Assert-True ($LASTEXITCODE -eq 0) "Installer license behavior tests pass"

# --- 6. Skills --------------------------------------------------------------------------
Write-Host ""
Write-Host " 6. Skills" -ForegroundColor White

$skillCount = (Get-ChildItem -Path (Join-Path $script:root ".github/skills") -Recurse -Filter "SKILL.md").Count
Assert-True ($skillCount -ge 35) "At least 35 skills exist (found: $skillCount)"

# Verify AI skill exists
Assert-FileExists ".github/skills/ai-systems/ai-agent-development/SKILL.md" "AI Agent Development skill"

# Verify Skills.md count matches
Assert-FileContains "Skills.md" "$skillCount skills across" "Skills.md skill count matches actual ($skillCount)"

# Verify Impeccable integration contract
Assert-FileExists ".github/skills/design/impeccable-integration/SKILL.md" "Impeccable integration skill"
Assert-FileContains ".github/skills/design/impeccable-integration/SKILL.md" 'name: "impeccable-integration"' "Impeccable bridge does not collide with upstream skill name"
Assert-FileContains ".github/skills/design/impeccable-integration/SKILL.md" "npm exec --offline -- impeccable detect --json" "Impeccable detector uses the pinned project-local binary"
Assert-FileNotContains ".github/skills/design/impeccable-integration/SKILL.md" '(?m)^\s*(?:\$\s*)?npx\s+impeccable' "Impeccable integration has no executable bare npx command"
Assert-FileContains ".github/agents/ux-designer.agent.md" "Read PRD -> Design Language -> Design Research" "UX Designer runs design language before design research"
Assert-FileContains ".github/skills/design/prototype-audit/SKILL.md" "Pass 0: Design-language conformance" "Prototype audit runs deterministic design-language pass first"
Assert-FileContains ".github/skills/design/prototype-audit/SKILL.md" '(?s)## Output.*?- Status: PASS \| FIXED \| BLOCKED \| DEGRADED.*?## Loop contract' "Prototype audit output supports the DEGRADED state"
Assert-FileNotContains ".github/skills/design/prototype-audit/SKILL.md" "See the impeccable skill" "Prototype audit references the renamed integration explicitly"
Assert-FileContains ".github/skills/design/anti-slop/SKILL.md" "T2, T3, T8, T10" "Anti-slop retains AgentX-only fabrication and emoji tells"
Assert-FileContains "NOTICE" "\.github/skills/design/impeccable-integration/SKILL\.md" "NOTICE points to the Impeccable integration skill"
Assert-FileNotContains "NOTICE" "\.github/skills/design/impeccable/SKILL\.md" "NOTICE has no stale Impeccable skill path"
Assert-FileContains "Skills.md" "Prototype Build\|impeccable-integration->" "Prototype workflow uses the non-colliding Impeccable integration id"
Assert-FileContains "vscode-extension/.github/Skills.md" "Prototype Build\|impeccable-integration->" "Bundled prototype workflow uses the non-colliding integration id"
Assert-FileContains ".github/templates/UX-TEMPLATE.md" "## 0\. Design Language" "UX template records design language before design work"
Assert-FileContains ".github/templates/UX-TEMPLATE.md" "Detector Status.*PASS \| BLOCKED \| DEGRADED" "UX template records detector or fallback status"
Assert-FileContains ".github/templates/UX-TEMPLATE.md" "Ran: T1-T10 \+ Honest Placeholders \+ axe \+ Pass 9 critique" "UX template records the complete DEGRADED fallback"
Assert-FileContains ".github/skills/design/impeccable-integration/SKILL.md" "Ran: T1-T10 \+ Honest Placeholders \+ axe \+ Pass 9 critique" "Impeccable integration records the complete DEGRADED fallback"
Assert-FileContains ".github/agents/ux-designer.agent.md" "PRODUCT.md and DESIGN.md are cited" "UX exit gate requires design-language evidence"
Assert-FileExists "vscode-extension/.github/agentx/skills/design/impeccable-integration/SKILL.md" "Bundled Impeccable integration skill"
Assert-FileContains "vscode-extension/package.json" "\.github/agentx/skills/design/impeccable-integration/SKILL\.md" "VS Code contributes the Impeccable integration skill"
$prototypeAuditScoreJson = & pwsh -NoProfile -File (Join-Path $script:root "scripts/score-skill.ps1") -SkillPath (Join-Path $script:root ".github/skills/design/prototype-audit/SKILL.md") -Json 2>$null | Out-String
$prototypeAuditScore = $prototypeAuditScoreJson | ConvertFrom-Json -Depth 20
Assert-True ($LASTEXITCODE -eq 0 -and @($prototypeAuditScore.skills)[0].blockers.Count -eq 0) "Prototype audit frontmatter passes the real YAML-backed skill scorer"

# Verify new skills and instructions
Assert-FileExists ".github/skills/ai-systems/cognitive-architecture/SKILL.md" "Cognitive Architecture skill"
Assert-FileExists ".github/skills/ai-systems/cognitive-architecture/scripts/scaffold-cognitive.py" "Cognitive scaffold script"
Assert-FileExists ".github/instructions/typescript.instructions.md" "TypeScript instruction file"
Assert-FileExists ".github/skills/infrastructure/terraform/SKILL.md" "Terraform skill"
Assert-FileExists ".github/skills/infrastructure/bicep/SKILL.md" "Bicep skill"

# Verify enterprise validation
Assert-FileExists "scripts/validate-frontmatter.ps1" "Frontmatter validation script"
Assert-FileExists ".github/schemas/instruction-frontmatter.schema.json" "Instruction schema"
Assert-FileExists ".github/schemas/agent-frontmatter.schema.json" "Agent schema"
Assert-FileExists ".github/schemas/skill-frontmatter.schema.json" "Skill schema"
Assert-FileExists ".github/workflows/scorecard.yml" "OpenSSF Scorecard workflow"
Assert-FileContains "scripts/score-output.ps1" "\*\.ps1" "score-output includes PowerShell files in engineer scoring checks"
Assert-FileContains "scripts/score-output.ps1" "\*\.test\.ts','\*\.spec\.ts','\*\.ps1" "score-output includes PowerShell tests in engineer coverage proxy"

# --- 7. AI-First Intent Preservation ----------------------------------------------------
Write-Host ""
Write-Host " 7. AI-First Intent Preservation" -ForegroundColor White

# Agent X has domain classification
Assert-FileContains ".github/agents/agent-x.agent.md" "## Domain Detection" "Agent X has domain classification"
Assert-FileContains ".github/agents/agent-x.agent.md" "needs:ai" "Agent X detects AI domain"
Assert-FileContains ".github/agents/agent-x.agent.md" "## PRD Intent Validation" "Agent X validates PRD intent"

# PM has AI domain classification step
Assert-FileContains ".github/agents/product-manager.agent.md" "Classify Domain Intent" "PM has domain classification step"
Assert-FileContains ".github/agents/product-manager.agent.md" "ai-agent-development/SKILL.md" "PM references AI skill"

# Architect has AI-aware research
Assert-FileContains ".github/agents/architect.agent.md" "AI-first assessment" "Architect has AI-aware research step"
Assert-FileContains ".github/agents/architect.agent.md" "aitk_get_ai_model_guidance" "Architect uses AITK tools"

# Engineer has AI implementation setup
Assert-FileContains ".github/agents/engineer.agent.md" "For GenAI features" "Engineer has AI implementation step"
Assert-FileContains ".github/agents/engineer.agent.md" "Store all system prompts as separate files" "Engineer uses current GenAI implementation guidance"

# Reviewer has intent preservation check
Assert-FileContains ".github/agents/reviewer.agent.md" "Intent Preservation" "Reviewer has intent preservation check"
Assert-FileContains ".github/agents/reviewer.agent.md" "Reject path" "Reviewer rejects intent violations"

# --- 8. GitHub Actions ------------------------------------------------------------------
Write-Host ""
Write-Host " 8. GitHub Actions" -ForegroundColor White

Assert-FileExists ".github/workflows/agent-x.yml" "agent-x.yml workflow"
Assert-FileExists ".github/workflows/quality-gates.yml" "quality-gates.yml workflow"
Assert-FileExists "azure-pipelines.yml" "azure-pipelines.yml pipeline"

# --- 9. Hooks & Scripts -----------------------------------------------------------------
Write-Host ""
Write-Host " 9. Hooks & Scripts" -ForegroundColor White

Assert-FileExists ".github/hooks/pre-commit" "pre-commit hook"
Assert-FileExists ".github/hooks/commit-msg" "commit-msg hook"
Assert-FileExists ".github/hooks/post-commit" "post-commit hook"

# --- 10. Documentation Consistency ------------------------------------------------------
Write-Host ""
Write-Host " 10. Documentation Consistency" -ForegroundColor White

Assert-FileContains "AGENTS.md" "single source of truth|system of record|Map to all AgentX resources" "AGENTS.md declares single source"
Assert-FileContains "README.md" "$skillCount production skills" "README skill count heading matches ($skillCount)"
Assert-FileContains "README.md" "$skillCount skills" "README framework totals matches ($skillCount)"
Assert-FileExists "docs/GUIDE.md" "Consolidated Guide (quickstart + setup)"
Assert-FileContains "AGENTS.md" "GUIDE" "AGENTS.md links to Guide"
Assert-FileContains ".github/copilot-instructions.md" "RFC 2119" "Router has RFC 2119 directive language"
Assert-FileContains "README.md" "OpenSSF" "README has OpenSSF Scorecard badge"
Assert-FileContains "vscode-extension/package.json" '"vscode:prepublish": "npm run sync:version && npm run prepare:chat && npm run clean && tsc -p ./"' "VS Code extension prepublish stamps bundled assets once before packaging"

# --- Results ----------------------------------------------------------------------------
Write-Host ""
Write-Host " ================================================" -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { "Green" } else { "Yellow" })
if ($script:fail -gt 0) {
 Write-Host " Failures: $($script:fail)" -ForegroundColor Red
}
Write-Host ""

exit $script:fail
