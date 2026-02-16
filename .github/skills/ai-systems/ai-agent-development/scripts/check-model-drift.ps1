<#
.SYNOPSIS
 Validate AI agent project for model change, data drift, and judge LLM readiness.

.DESCRIPTION
 Checks an AI agent project for the three most common production blind spots:
 1. Model Change Management - pinned versions, baselines, migration plans
 2. Data Drift Detection - input logging, distribution tracking, eval freshness
 3. Judge LLM Quality - rubric presence, validation data, consistency checks

 Scans source code, config files, and evaluation artifacts.

.PARAMETER Path
 Root of the agent project to validate. Defaults to current directory.

.PARAMETER Strict
 Treat warnings as failures (exit code > 0).

.EXAMPLE
 ./check-model-drift.ps1
 ./check-model-drift.ps1 -Path ./my-agent -Strict
#>

param(
 [string]$Path = ".",
 [switch]$Strict
)

$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Warned = 0
$script:Failed = 0

function Write-Check {
 param([string]$Name, [string]$Status, [string]$Detail = "")
 switch ($Status) {
 "PASS" {
 Write-Host " [PASS] $Name" -ForegroundColor Green
 $script:Passed++
 }
 "WARN" {
 Write-Host " [WARN] $Name" -ForegroundColor Yellow
 if ($Detail) { Write-Host " $Detail" -ForegroundColor DarkYellow }
 $script:Warned++
 }
 "FAIL" {
 Write-Host " [FAIL] $Name" -ForegroundColor Red
 if ($Detail) { Write-Host " $Detail" -ForegroundColor DarkRed }
 $script:Failed++
 }
 }
}

$Root = Resolve-Path $Path -ErrorAction SilentlyContinue
if (-not $Root) {
 Write-Host "Error: Path '$Path' not found." -ForegroundColor Red
 exit 1
}

# Collect source files
$pyFiles = Get-ChildItem -Path $Root -Filter "*.py" -Recurse -ErrorAction SilentlyContinue |
 Where-Object { $_.FullName -notmatch '(\.venv|venv|__pycache__|node_modules|\.git)' }
$csFiles = Get-ChildItem -Path $Root -Filter "*.cs" -Recurse -ErrorAction SilentlyContinue |
 Where-Object { $_.FullName -notmatch '(bin|obj|\.git)' }
$configFiles = @()
$configFiles += Get-ChildItem -Path $Root -Include "*.json","*.yaml","*.yml","*.toml","*.env*" -Recurse -ErrorAction SilentlyContinue |
 Where-Object { $_.FullName -notmatch '(\.venv|venv|node_modules|\.git|bin|obj)' }
$allSource = @($pyFiles) + @($csFiles) | Where-Object { $_ -ne $null }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Model Change, Data Drift & Judge LLM Validator" -ForegroundColor Cyan
Write-Host " Path: $Root" -ForegroundColor DarkGray
Write-Host "============================================================" -ForegroundColor Cyan

# ================================================================
# SECTION 1: MODEL CHANGE MANAGEMENT
# ================================================================
Write-Host ""
Write-Host "--- 1. Model Change Management ---" -ForegroundColor White

# Check: Model version pinned (not just generic name)
$hasPinnedVersion = $false
$hasGenericModel = $false
$genericModelFiles = @()

foreach ($file in $allSource + $configFiles) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }

 # Pinned: model name with date suffix like gpt-5.1-2026-01-15
 if ($content -match '(gpt-\d[\w.-]+-\d{4}-\d{2}-\d{2}|claude-[\w.]+-\d{8}|model_version.*pinned)') {
 $hasPinnedVersion = $true
 }
 # Generic: just "gpt-5.1" or "gpt-4o" without date pin
 if ($content -match 'model["\s:=]+["'']?(gpt-\d[\w.]*|claude-[\w.-]+|o\d+(-\w+)?)["'']?' -and
 $content -notmatch '(gpt-\d[\w.-]+-\d{4}-\d{2}-\d{2})') {
 $hasGenericModel = $true
 $genericModelFiles += $file.Name
 }
}

if ($hasPinnedVersion) {
 Write-Check "Model version pinned (date-stamped)" "PASS"
} elseif ($hasGenericModel) {
 $fileList = ($genericModelFiles | Select-Object -Unique) -join ", "
 Write-Check "Model version pinned" "WARN" "Generic model names found in: $fileList. Pin with date suffix (e.g., gpt-5.1-2026-01-15)"
} else {
 Write-Check "Model version pinned" "WARN" "No model references found to validate"
}

# Check: Model config is externalized (env var or config file)
$modelExternalized = $false
foreach ($file in $allSource) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(os\.getenv\([''"].*MODEL|Environment\.GetEnvironmentVariable\([''"].*MODEL|config\[.*model|\.env.*MODEL)') {
 $modelExternalized = $true
 break
 }
}
if ($modelExternalized) {
 Write-Check "Model config externalized (env/config)" "PASS"
} elseif ($hasGenericModel) {
 Write-Check "Model config externalized" "FAIL" "Model name appears hardcoded. Use env vars (AGENT_MODEL, FOUNDRY_MODEL)"
} else {
 Write-Check "Model config externalized" "WARN" "Could not determine model configuration approach"
}

# Check: Evaluation baseline exists
$baselineFiles = Get-ChildItem -Path $Root -Include "baseline*.json","baseline*.jsonl","eval-baseline*" -Recurse -ErrorAction SilentlyContinue |
 Where-Object { $_.FullName -notmatch '(\.venv|node_modules|\.git)' }

if ($baselineFiles.Count -gt 0) {
 Write-Check "Evaluation baseline file exists ($($baselineFiles.Count) found)" "PASS"
} else {
 Write-Check "Evaluation baseline file" "FAIL" "No baseline*.json found. Run eval and save scores before deploying"
}

# Check: Model migration documented
$hasMigrationDocs = $false
foreach ($file in ($allSource + $configFiles)) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(last_evaluated|model_migration|migration_notes|model.*changelog|model.*history)') {
 $hasMigrationDocs = $true
 break
 }
}
if ($hasMigrationDocs) {
 Write-Check "Model migration tracking documented" "PASS"
} else {
 Write-Check "Model migration tracking" "WARN" "Add last_evaluated date and migration notes to model config"
}

# ================================================================
# SECTION 2: DATA DRIFT DETECTION
# ================================================================
Write-Host ""
Write-Host "--- 2. Data Drift Detection ---" -ForegroundColor White

# Check: Input logging present
$hasInputLogging = $false
foreach ($file in $allSource) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(log.*query|log.*input|log.*request|logger.*user.*message|log_input|track_input|record_query)') {
 $hasInputLogging = $true
 break
 }
}
if ($hasInputLogging) {
 Write-Check "Input logging implemented" "PASS"
} elseif ($allSource.Count -gt 0) {
 Write-Check "Input logging" "FAIL" "Log all production inputs (query, timestamp, response latency)"
} else {
 Write-Check "Input logging" "WARN" "No source files to check"
}

# Check: Evaluation dataset exists and is fresh
$evalDatasets = Get-ChildItem -Path $Root -Include "*.jsonl" -Recurse -ErrorAction SilentlyContinue |
 Where-Object { $_.FullName -notmatch '(\.venv|node_modules|\.git)' -and $_.Name -match '(eval|test|dataset)' }

if ($evalDatasets.Count -gt 0) {
 $oldest = $evalDatasets | Sort-Object LastWriteTime | Select-Object -First 1
 $ageInDays = ((Get-Date) - $oldest.LastWriteTime).Days
 if ($ageInDays -gt 90) {
 Write-Check "Evaluation dataset freshness" "WARN" "$($oldest.Name) is $ageInDays days old. Update with recent production samples (target: < 90 days)"
 } else {
 Write-Check "Evaluation dataset exists and fresh ($ageInDays days old)" "PASS"
 }
} else {
 Write-Check "Evaluation dataset" "FAIL" "No eval/test dataset found. Create evaluation/*.jsonl with representative queries"
}

# Check: Drift monitoring code
$hasDriftMonitoring = $false
foreach ($file in $allSource) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(drift|distribution.*compare|novelty.*detect|topic.*cluster|input.*stats|query.*stats|DriftDetector)') {
 $hasDriftMonitoring = $true
 break
 }
}
if ($hasDriftMonitoring) {
 Write-Check "Drift monitoring implemented" "PASS"
} else {
 Write-Check "Drift monitoring" "WARN" "Implement input distribution tracking to detect data drift over time"
}

# Check: Out-of-domain handling
$hasOODHandling = $false
foreach ($file in $allSource) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(out.*of.*domain|unsupported.*topic|I.*can.*not.*help|outside.*scope|guardrail|boundary.*check|off.topic)') {
 $hasOODHandling = $true
 break
 }
}
if ($hasOODHandling) {
 Write-Check "Out-of-domain handling" "PASS"
} else {
 Write-Check "Out-of-domain handling" "WARN" "Add guardrails for inputs outside agent's intended scope"
}

# ================================================================
# SECTION 3: JUDGE LLM IMPLEMENTATION
# ================================================================
Write-Host ""
Write-Host "--- 3. Judge LLM Implementation ---" -ForegroundColor White

# Check: Evaluator/judge exists
$hasEvaluator = $false
$hasCustomJudge = $false
foreach ($file in $allSource) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(Evaluator|evaluator|evaluate\(|evals\.create|judge|builtin\.\w+)') {
 $hasEvaluator = $true
 }
 if ($content -match '(PROMPT.*type|prompt_text.*Rate|rubric|scoring.*criteria|score.*1.*5|judge.*prompt)') {
 $hasCustomJudge = $true
 }
}
if ($hasEvaluator) {
 Write-Check "Evaluator/judge configured" "PASS"
} else {
 Write-Check "Evaluator/judge" "FAIL" "No evaluation setup found. Implement LLM-as-judge or use builtin evaluators"
}

# Check: Judge has structured rubric (not just "rate 1-5")
if ($hasCustomJudge) {
 Write-Check "Judge rubric defined (structured scoring criteria)" "PASS"
} elseif ($hasEvaluator) {
 Write-Check "Judge rubric" "WARN" "Using evaluator without visible custom rubric. Ensure scoring criteria are explicit"
} else {
 Write-Check "Judge rubric" "WARN" "No judge rubric found. Define what each score level means"
}

# Check: Judge validation data (known-answer set)
$judgeValidation = Get-ChildItem -Path $Root -Include "*.jsonl","*.json" -Recurse -ErrorAction SilentlyContinue |
 Where-Object { $_.FullName -notmatch '(\.venv|node_modules|\.git)' -and $_.Name -match '(judge.*valid|gold.*standard|known.*answer|judge.*test|annotated)' }

if ($judgeValidation.Count -gt 0) {
 Write-Check "Judge validation dataset (known-answer set)" "PASS"
} else {
 Write-Check "Judge validation dataset" "WARN" "Create judge-validation.jsonl with 20-30 human-scored examples to validate judge accuracy"
}

# Check: Different model for judge vs agent
$useDifferentJudgeModel = $false
foreach ($file in $allSource) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(judge.*model|JUDGE_MODEL|evaluator.*model|secondary.*model|judge_deployment)') {
 $useDifferentJudgeModel = $true
 break
 }
}
if ($useDifferentJudgeModel) {
 Write-Check "Separate model for judge vs agent" "PASS"
} elseif ($hasEvaluator) {
 Write-Check "Separate judge model" "WARN" "Consider using a different model for evaluation to avoid self-evaluation bias"
} else {
 Write-Check "Separate judge model" "WARN" "No evaluator found to check"
}

# Check: Multi-dimensional evaluation (not just one score)
$hasMultiDimEval = $false
foreach ($file in $allSource) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 # Look for multiple evaluator dimensions
 $dimensions = 0
 if ($content -match 'coherence') { $dimensions++ }
 if ($content -match 'relevance') { $dimensions++ }
 if ($content -match 'fluency') { $dimensions++ }
 if ($content -match 'groundedness') { $dimensions++ }
 if ($content -match 'accuracy') { $dimensions++ }
 if ($content -match 'completeness') { $dimensions++ }
 if ($content -match 'helpfulness') { $dimensions++ }
 if ($content -match 'task_completion') { $dimensions++ }
 if ($dimensions -ge 2) {
 $hasMultiDimEval = $true
 break
 }
}
if ($hasMultiDimEval) {
 Write-Check "Multi-dimensional evaluation (2+ metrics)" "PASS"
} elseif ($hasEvaluator) {
 Write-Check "Multi-dimensional evaluation" "WARN" "Add multiple evaluation dimensions (accuracy, completeness, helpfulness, etc.)"
} else {
 Write-Check "Multi-dimensional evaluation" "WARN" "No evaluator to analyze"
}

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Results: $($script:Passed) passed, $($script:Warned) warnings, $($script:Failed) failed" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan

$exitCode = $script:Failed
if ($Strict) { $exitCode += $script:Warned }

if ($exitCode -eq 0) {
 Write-Host " Agent is resilient to model change, drift, and judge issues!" -ForegroundColor Green
} elseif ($script:Failed -eq 0) {
 Write-Host " No critical failures, but address warnings for production hardening." -ForegroundColor Yellow
} else {
 Write-Host " Critical gaps found. Address FAIL items before production deployment." -ForegroundColor Red
}

Write-Host ""
Write-Host " Reference: model-drift-judge-patterns.md" -ForegroundColor DarkGray
Write-Host ""
exit $exitCode
