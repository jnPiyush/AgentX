#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Scans for secrets in files that should not be committed.
.DESCRIPTION
 Detects high-entropy strings, known secret patterns, and files
 that typically contain secrets (.env, *.pem, *.key, etc.).
.PARAMETER Path
 Path to scan (default: current directory)
.PARAMETER MinEntropy
 Minimum Shannon entropy threshold for flagging strings (default: 4.5)
.EXAMPLE
 ./scan-secrets.ps1
 ./scan-secrets.ps1 -Path ./src -MinEntropy 4.0
#>
param(
 [string]$Path = ".",
 [double]$MinEntropy = 4.5,
 [string[]]$ExcludePatterns = @("node_modules", ".git", "bin", "obj", "dist", "__pycache__", ".venv")
)

$ErrorActionPreference = "Stop"
$issueCount = 0

function Get-Entropy($str) {
 if ([string]::IsNullOrEmpty($str)) { return 0 }
 $freq = @{}
 foreach ($char in $str.ToCharArray()) {
 $freq[$char] = ($freq[$char] ?? 0) + 1
 }
 $len = $str.Length
 $entropy = 0.0
 foreach ($count in $freq.Values) {
 $p = $count / $len
 $entropy -= $p * [Math]::Log($p, 2)
 }
 return $entropy
}

function Add-SecretIssue($file, $line, $message) {
 $script:issueCount++
 Write-Host " [SECRET] $file`:$line - $message" -ForegroundColor Red
}

Write-Host "`n=== Secret Scanner ===" -ForegroundColor Cyan

$excludeRegex = ($ExcludePatterns | ForEach-Object { [regex]::Escape($_) }) -join "|"

# --- Check 1: Dangerous file types ---
Write-Host "`n [1/3] Checking for secret file types..." -ForegroundColor White
$dangerousExtensions = @("*.pem", "*.key", "*.p12", "*.pfx", "*.jks", "*.keystore", "*.env")
foreach ($ext in $dangerousExtensions) {
 $found = Get-ChildItem -Path $Path -Filter $ext -Recurse -ErrorAction SilentlyContinue | Where-Object {
 $_.FullName -notmatch $excludeRegex -and $_.Name -ne ".env.example" -and $_.Name -ne ".env.template"
 }
 foreach ($f in $found) {
 Add-SecretIssue $f.Name 0 "Sensitive file type: $($f.Extension)"
 }
}

# --- Check 2: Known secret patterns ---
Write-Host "`n [2/3] Scanning for known secret patterns..." -ForegroundColor White
$knownPatterns = @(
 @{ Pattern = '-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----'; Msg = "Private key detected" },
 @{ Pattern = '-----BEGIN CERTIFICATE-----'; Msg = "Certificate detected" },
 @{ Pattern = 'sk_live_[a-zA-Z0-9]{20,}'; Msg = "Stripe live key" },
 @{ Pattern = 'sk_test_[a-zA-Z0-9]{20,}'; Msg = "Stripe test key (should still be in env vars)" },
 @{ Pattern = 'ghp_[a-zA-Z0-9]{36}'; Msg = "GitHub PAT" },
 @{ Pattern = 'gho_[a-zA-Z0-9]{36}'; Msg = "GitHub OAuth token" },
 @{ Pattern = 'github_pat_[a-zA-Z0-9_]{82}'; Msg = "GitHub fine-grained PAT" },
 @{ Pattern = 'AKIA[A-Z0-9]{16}'; Msg = "AWS Access Key" },
 @{ Pattern = 'xox[baprs]-[a-zA-Z0-9-]{10,}'; Msg = "Slack token" },
 @{ Pattern = 'sq0[a-z]{3}-[a-zA-Z0-9_-]{22,}'; Msg = "Square token" },
 @{ Pattern = 'eyJ[a-zA-Z0-9_-]{20,}\.eyJ[a-zA-Z0-9_-]{20,}'; Msg = "JWT token (possibly hardcoded)" }
)

$extensions = @("*.cs", "*.py", "*.ts", "*.tsx", "*.js", "*.jsx", "*.go", "*.rs", "*.java", "*.yaml", "*.yml", "*.json", "*.xml", "*.config", "*.md")
$files = @()
foreach ($ext in $extensions) {
 $files += Get-ChildItem -Path $Path -Filter $ext -Recurse -ErrorAction SilentlyContinue | Where-Object {
 $_.FullName -notmatch $excludeRegex
 }
}

Write-Host " Scanning $($files.Count) files..." -ForegroundColor Gray

foreach ($file in $files) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 $lines = $content -split "`n"
 $lineNum = 0
 foreach ($line in $lines) {
 $lineNum++
 foreach ($kp in $knownPatterns) {
 if ($line -match $kp.Pattern) {
 Add-SecretIssue $file.Name $lineNum $kp.Msg
 }
 }
 }
}

# --- Check 3: High-entropy strings ---
Write-Host "`n [3/3] Checking for high-entropy strings (threshold: $MinEntropy)..." -ForegroundColor White
$highEntropyPattern = '["\x27]([a-zA-Z0-9+/=_-]{20,})["\x27]'

foreach ($file in $files) {
 if ($file.Extension -match '\.(json|xml|yaml|yml|md)$') { continue }
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 $lines = $content -split "`n"
 $lineNum = 0
 foreach ($line in $lines) {
 $lineNum++
 if ($line -match '//.*|#.*|/\*') { continue }
 $matches2 = [regex]::Matches($line, $highEntropyPattern)
 foreach ($m in $matches2) {
 $candidate = $m.Groups[1].Value
 $entropy = Get-Entropy $candidate
 if ($entropy -ge $MinEntropy -and $candidate.Length -ge 20) {
 Add-SecretIssue $file.Name $lineNum "High-entropy string (entropy: $([Math]::Round($entropy, 2)))"
 }
 }
 }
}

# --- Summary ---
Write-Host "`n=== Scan Complete ===" -ForegroundColor Cyan
if ($issueCount -eq 0) {
 Write-Host " No secrets detected." -ForegroundColor Green
} else {
 Write-Host " $issueCount potential secret(s) found." -ForegroundColor Red
 Write-Host " Action: Move secrets to environment variables or a vault." -ForegroundColor Yellow
}
Write-Host ""
exit $(if ($issueCount -gt 0) { 1 } else { 0 })
