# ------------------------------------------------------------------
# AgentX Shared Module: SecurityHelpers
# ------------------------------------------------------------------
# Common security validation functions used across AgentX scripts.
# Provides reusable checks for secrets detection, command blocking,
# and dependency auditing.
#
# CANONICAL SOURCE for secret detection patterns:
#   vscode-extension/src/utils/secretRedactor.ts
# Keep patterns in sync when adding new detectors.
#
# Usage:
#   . "$PSScriptRoot/../modules/SecurityHelpers.psm1"
#   $violations = Find-HardcodedSecrets -Path "src/"
#   Test-BlockedCommand -Command "dangerous-command-here"
#   Get-ViolationSummary -Violations $violations
# ------------------------------------------------------------------

function Find-HardcodedSecrets {
    <#
    .SYNOPSIS
        Scan files for potential hardcoded secrets (API keys, tokens, passwords).
    .PARAMETER Path
        Root directory to scan.
    .PARAMETER Extensions
        File extensions to check (default: common code extensions).
    .RETURNS
        Array of violation objects with File, Line, Pattern, Match properties.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $Path,
        [string[]] $Extensions = @('*.ts', '*.js', '*.py', '*.cs', '*.json', '*.yml', '*.yaml', '*.env', '*.ps1', '*.sh')
    )

    $patterns = @(
        @{ Name = 'AWS Key';          Regex = 'AKIA[0-9A-Z]{16}' },
        @{ Name = 'Azure Storage';    Regex = 'DefaultEndpointsProtocol=https;AccountName=' },
        @{ Name = 'Connection String'; Regex = '(password|pwd)\s*=\s*[^;\s]{8,}' },
        @{ Name = 'Private Key';      Regex = '-----BEGIN (RSA |EC )?PRIVATE KEY-----' },
        @{ Name = 'Generic Token';    Regex = '(api[_-]?key|api[_-]?secret|access[_-]?token)\s*[:=]\s*[''"][A-Za-z0-9/+=]{20,}[''"]' },
        @{ Name = 'GitHub Token';     Regex = 'gh[pousr]_[A-Za-z0-9_]{36,}' }
    )

    $violations = @()

    foreach ($ext in $Extensions) {
        $files = Get-ChildItem -Path $Path -Filter $ext -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '(node_modules|\.git|\.venv|bin|obj|out)' }

        foreach ($file in $files) {
            $lineNum = 0
            foreach ($line in (Get-Content $file.FullName -ErrorAction SilentlyContinue)) {
                $lineNum++
                foreach ($pattern in $patterns) {
                    if ($line -match $pattern.Regex) {
                        $violations += [PSCustomObject]@{
                            File    = $file.FullName
                            Line    = $lineNum
                            Pattern = $pattern.Name
                            Match   = ($Matches[0] | Select-Object -First 1)
                        }
                    }
                }
            }
        }
    }

    return $violations
}

function Test-BlockedCommand {
    <#
    .SYNOPSIS
        Check if a command string contains any blocked/dangerous commands.
    .PARAMETER Command
        Command string to validate.
    .RETURNS
        $true if the command is blocked, $false if safe.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $Command
    )

    $blockedPatterns = @(
        'rm\s+-rf\s+/',
        'git\s+reset\s+--hard',
        'drop\s+database',
        'truncate\s+table',
        'format\s+[a-z]:',
        'del\s+/[sf]\s+[a-z]:\\',
        'Remove-Item\s+-Recurse\s+-Force\s+[A-Z]:\\'
    )

    foreach ($pattern in $blockedPatterns) {
        if ($Command -match $pattern) {
            return $true
        }
    }

    return $false
}

function Get-ViolationSummary {
    <#
    .SYNOPSIS
        Format an array of violations into a summary report.
    .PARAMETER Violations
        Array of violation objects.
    .PARAMETER Title
        Report title.
    .RETURNS
        Formatted string summary.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [array] $Violations,
        [string] $Title = 'Security Scan Results'
    )

    if ($Violations.Count -eq 0) {
        return "[PASS] $Title -- No violations found."
    }

    $summary = "[FAIL] $Title -- $($Violations.Count) violation(s) found:`n"
    $grouped = $Violations | Group-Object -Property Pattern

    foreach ($group in $grouped) {
        $summary += "`n  $($group.Name): $($group.Count) occurrence(s)`n"
        foreach ($v in $group.Group | Select-Object -First 3) {
            $relPath = $v.File -replace [regex]::Escape((Get-Location).Path + '\'), ''
            $summary += "    - $relPath`:$($v.Line)`n"
        }
        if ($group.Count -gt 3) {
            $summary += "    ... and $($group.Count - 3) more`n"
        }
    }

    return $summary
}

Export-ModuleMember -Function Find-HardcodedSecrets, Test-BlockedCommand, Get-ViolationSummary
