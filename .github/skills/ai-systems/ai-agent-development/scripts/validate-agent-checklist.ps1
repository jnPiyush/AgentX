<#
.SYNOPSIS
 Validates an AI agent project against the production checklist.

.DESCRIPTION
 Programmatically checks the production readiness checklist from the
 ai-agent-development SKILL.md. Scans for:
 - Hardcoded secrets/API keys
 - Tracing/observability setup
 - Error handling patterns
 - Evaluation dataset presence
 - Security best practices
 - Environment variable usage

.PARAMETER Path
 Root of the agent project to validate. Defaults to current directory.

.PARAMETER Strict
 Treat warnings as failures.

.EXAMPLE
 ./validate-agent-checklist.ps1
 ./validate-agent-checklist.ps1 -Path ./my-agent -Strict
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

Write-Host ""
Write-Host "-----------------------------------------------------" -ForegroundColor Cyan
Write-Host " AI Agent Production Checklist Validator" -ForegroundColor Cyan
Write-Host " Path: $Root" -ForegroundColor DarkGray
Write-Host "-----------------------------------------------------" -ForegroundColor Cyan

# Collect all source files
$pyFiles = Get-ChildItem -Path $Root -Filter "*.py" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '(\.venv|venv|__pycache__|node_modules|\.git)' }
$csFiles = Get-ChildItem -Path $Root -Filter "*.cs" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '(bin|obj|\.git)' }
$allFiles = @($pyFiles) + @($csFiles) | Where-Object { $_ -ne $null }

# --- 1. Development Checks ---------------------------------------
Write-Host ""
Write-Host "[TASK] Development" -ForegroundColor White

# Check: No hardcoded secrets
$secretPatterns = @(
 'api[_-]?key\s*=\s*["\x27][A-Za-z0-9]',
 'password\s*=\s*["\x27][^$\{]',
 'secret\s*=\s*["\x27][A-Za-z0-9]',
 'sk-[A-Za-z0-9]{20,}',
 'Bearer\s+[A-Za-z0-9\-._~+/]+=*'
)
$secretsFound = $false
foreach ($file in $allFiles) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 foreach ($pattern in $secretPatterns) {
 if ($content -match $pattern) {
 # Skip template/example files
 if ($file.Name -match '\.(template|example|sample)') { continue }
 if ($content -match '(your-api-key|placeholder|example|CHANGE_ME)') { continue }
 $secretsFound = $true
 break
 }
 }
}
if ($secretsFound) {
 Write-Check "No hardcoded secrets" "FAIL" "Found potential hardcoded credentials in source files"
} else {
 Write-Check "No hardcoded secrets" "PASS"
}

# Check: Error handling present
$hasErrorHandling = $false
foreach ($file in $allFiles) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(try\s*:|try\s*\{|except\s|catch\s*\(|retry|max_retries|RetryPolicy)') {
 $hasErrorHandling = $true
 break
 }
}
if ($hasErrorHandling) {
 Write-Check "Error handling with retries" "PASS"
} elseif ($allFiles.Count -gt 0) {
 Write-Check "Error handling with retries" "WARN" "No try/catch or retry patterns found"
} else {
 Write-Check "Error handling with retries" "WARN" "No source files found"
}

# Check: Environment variables for config
$usesEnvVars = $false
foreach ($file in $allFiles) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(os\.getenv|os\.environ|Environment\.GetEnvironmentVariable|\.env|dotenv|IConfiguration)') {
 $usesEnvVars = $true
 break
 }
}
if ($usesEnvVars) {
 Write-Check "Credentials via environment/config" "PASS"
} elseif ($allFiles.Count -gt 0) {
 Write-Check "Credentials via environment/config" "FAIL" "No env var usage found - secrets may be hardcoded"
} else {
 Write-Check "Credentials via environment/config" "WARN" "No source files to check"
}

# Check: .env.template or appsettings.json exists
$hasEnvTemplate = (Test-Path "$Root/.env.template") -or (Test-Path "$Root/.env.example") -or (Test-Path "$Root/appsettings.json")
if ($hasEnvTemplate) {
 Write-Check "Environment template exists" "PASS"
} else {
 Write-Check "Environment template exists" "WARN" "Add .env.template or appsettings.json for onboarding"
}

# --- 2. Observability Checks -------------------------------------
Write-Host ""
Write-Host "[OBS] Observability" -ForegroundColor White

# Check: Tracing setup
$hasTracing = $false
foreach ($file in $allFiles) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(opentelemetry|AIInferenceInstrumentor|TracerProvider|AddOtlpExporter|instrument\(\))') {
 $hasTracing = $true
 break
 }
}
if ($hasTracing) {
 Write-Check "OpenTelemetry tracing configured" "PASS"
} elseif ($allFiles.Count -gt 0) {
 Write-Check "OpenTelemetry tracing configured" "FAIL" "No OpenTelemetry/tracing setup found - critical for debugging"
} else {
 Write-Check "OpenTelemetry tracing configured" "WARN" "No source files to check"
}

# Check: Structured logging
$hasLogging = $false
foreach ($file in $allFiles) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(logging\.|Logger|ILogger|logger\.|log\.|structlog|serilog)') {
 $hasLogging = $true
 break
 }
}
if ($hasLogging) {
 Write-Check "Structured logging configured" "PASS"
} else {
 Write-Check "Structured logging configured" "WARN" "Consider adding structured logging for production"
}

# --- 3. Evaluation Checks ----------------------------------------
Write-Host ""
Write-Host "[CHART] Evaluation" -ForegroundColor White

# Check: Evaluation dataset exists
$hasEvalData = (Test-Path "$Root/evaluation") -or
 (Get-ChildItem -Path $Root -Filter "*.jsonl" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(eval|test|dataset)' }).Count -gt 0
if ($hasEvalData) {
 Write-Check "Evaluation dataset exists" "PASS"
} else {
 Write-Check "Evaluation dataset exists" "WARN" "Create evaluation/ directory with test_dataset.jsonl"
}

# Check: Evaluators configured
$hasEvaluators = $false
foreach ($file in $allFiles) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(Evaluator|evaluate\(|azure.ai.evaluation|EvaluatorConfig)') {
 $hasEvaluators = $true
 break
 }
}
if ($hasEvaluators) {
 Write-Check "Evaluators defined" "PASS"
} else {
 Write-Check "Evaluators defined" "WARN" "Add evaluation with CoherenceEvaluator, RelevanceEvaluator, etc."
}

# --- 4. Security Checks ------------------------------------------
Write-Host ""
Write-Host "[SEC] Security" -ForegroundColor White

# Check: .gitignore excludes .env
$gitignore = "$Root/.gitignore"
if (Test-Path $gitignore) {
 $gitignoreContent = Get-Content $gitignore -Raw
 if ($gitignoreContent -match '\.env') {
 Write-Check ".env excluded from git" "PASS"
 } else {
 Write-Check ".env excluded from git" "FAIL" "Add .env to .gitignore"
 }
} else {
 Write-Check ".gitignore exists" "WARN" "Create .gitignore with .env exclusion"
}

# Check: Max turns / termination condition
$hasTermination = $false
foreach ($file in $allFiles) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(max_turns|MaxTurns|termination|max_iterations|MaxIterations)') {
 $hasTermination = $true
 break
 }
}
if ($hasTermination) {
 Write-Check "Agent termination conditions" "PASS"
} else {
 Write-Check "Agent termination conditions" "WARN" "Set max_turns to prevent infinite agent loops"
}

# Check: Input validation
$hasInputValidation = $false
foreach ($file in $allFiles) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 if ($content -match '(validate|sanitize|strip\(|\.strip|input.*check|len\(.*\)|MaxLength|StringLength)') {
 $hasInputValidation = $true
 break
 }
}
if ($hasInputValidation) {
 Write-Check "Input validation present" "PASS"
} else {
 Write-Check "Input validation present" "WARN" "Validate and sanitize user inputs before sending to LLM"
}

# --- 5. Operations Checks ----------------------------------------
Write-Host ""
Write-Host "[OPS] Operations" -ForegroundColor White

# Check: README exists
if (Test-Path "$Root/README.md") {
 Write-Check "README.md exists" "PASS"
} else {
 Write-Check "README.md exists" "WARN" "Add README with setup, run, and architecture docs"
}

# Check: Tests exist
$testFiles = @()
$testFiles += Get-ChildItem -Path $Root -Filter "test_*.py" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\.venv' }
$testFiles += Get-ChildItem -Path $Root -Filter "*_test.py" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\.venv' }
$testFiles += Get-ChildItem -Path $Root -Filter "*Tests.cs" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '(bin|obj)' }

if ($testFiles.Count -gt 0) {
 Write-Check "Tests exist ($($testFiles.Count) test files)" "PASS"
} else {
 Write-Check "Tests exist" "WARN" "Add tests for agent behavior and tool functions"
}

# --- Summary -----------------------------------------------------
Write-Host ""
Write-Host "-----------------------------------------------------" -ForegroundColor Cyan
Write-Host " Results: $($script:Passed) passed, $($script:Warned) warnings, $($script:Failed) failed" -ForegroundColor White
Write-Host "-----------------------------------------------------" -ForegroundColor Cyan

$exitCode = $script:Failed
if ($Strict) { $exitCode += $script:Warned }

if ($exitCode -eq 0) {
 Write-Host " [PASS] Agent project is production-ready!" -ForegroundColor Green
} else {
 Write-Host " [WARN] Address the issues above before deploying." -ForegroundColor Yellow
}

Write-Host ""
exit $exitCode
