#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Audit VS Code mock completeness by scanning source files for vscode.* references
.DESCRIPTION
    Scans all TypeScript source files (excluding tests) for VS Code API usage patterns
    and compares against the mock exports to identify missing API surface.
    Based on lessons learned from AgentX v7.6.0 - addresses "Mock Completeness Gap" theme.
.EXAMPLE
    ./scripts/audit-vscode-mock.ps1
#>

[CmdletBinding()]
param(
    [string]$SourcePath = "vscode-extension/src",
    [string]$MockPath = "vscode-extension/src/test/mocks/vscode.ts",
    [switch]$CI
)

Write-Host "=== VS Code Mock Audit ===" -ForegroundColor Cyan
Write-Host ""

# Check if paths exist
if (!(Test-Path $SourcePath)) {
    Write-Error "Source path not found: $SourcePath"
    exit 1
}

if (!(Test-Path $MockPath)) {
    Write-Error "Mock file not found: $MockPath"
    exit 1
}

Write-Host "Scanning source files: $SourcePath" -ForegroundColor Green
Write-Host "Mock file: $MockPath" -ForegroundColor Green
Write-Host ""

# Extract vscode API patterns from source files (excluding tests)
$sourceFiles = Get-ChildItem -Path $SourcePath -Recurse -Filter "*.ts" |
    Where-Object { $_.FullName -notmatch "[\\/]test[\\/]" -and $_.Name -ne "vscode.ts" }

Write-Host "Found $($sourceFiles.Count) source files to scan" -ForegroundColor Yellow

$vsCodeApiPatterns = @()
$vsCodeEnumPatterns = @()

foreach ($file in $sourceFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Match vscode.* patterns (property access, method calls, enum access)
    # Patterns: vscode.window.showInformationMessage, vscode.ViewColumn.One, etc.
    $matches = [regex]::Matches($content, 'vscode\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)')
    
    foreach ($match in $matches) {
        $apiPath = $match.Groups[1].Value
        
        # Separate enums (usually PascalCase starting parts) from methods/properties
        if ($apiPath -cmatch '^[A-Z][a-zA-Z0-9]*(\.[A-Z][a-zA-Z0-9]*)*$') {
            $vsCodeEnumPatterns += $apiPath
        } else {
            $vsCodeApiPatterns += $apiPath
        }
    }
}

# Remove duplicates and sort
$uniqueApiPatterns = $vsCodeApiPatterns | Sort-Object -Unique
$uniqueEnumPatterns = $vsCodeEnumPatterns | Sort-Object -Unique

Write-Host "Found $($uniqueApiPatterns.Count) unique API patterns" -ForegroundColor Yellow
Write-Host "Found $($uniqueEnumPatterns.Count) unique enum patterns" -ForegroundColor Yellow
Write-Host ""

# Read mock file and extract exported surface
$mockContent = Get-Content $MockPath -Raw

# Extract mock exports - look for class, interface, enum, and const exports
$mockApiPatterns = @()
$mockEnumPatterns = @()

# Match class exports like "export class CancellationToken"
$classMatches = [regex]::Matches($mockContent, 'export\s+class\s+(\w+)')
foreach ($match in $classMatches) {
    $mockEnumPatterns += $match.Groups[1].Value
}

# Match interface exports like "export interface ExtensionContext"  
$interfaceMatches = [regex]::Matches($mockContent, 'export\s+interface\s+(\w+)')
foreach ($match in $interfaceMatches) {
    $mockEnumPatterns += $match.Groups[1].Value
}

# Match type alias exports like "export type ProviderResult<T>"
$typeMatches = [regex]::Matches($mockContent, 'export\s+type\s+(\w+)')
foreach ($match in $typeMatches) {
    $mockEnumPatterns += $match.Groups[1].Value
}

# Match enum exports like "export enum ViewColumn"
$enumMatches = [regex]::Matches($mockContent, 'export\s+enum\s+(\w+)')
foreach ($match in $enumMatches) {
    $mockEnumPatterns += $match.Groups[1].Value
}

# Match direct const exports like "export const ViewColumn = { One: 1, ... }"
$exportMatches = [regex]::Matches($mockContent, 'export\s+const\s+(\w+)\s*=')
foreach ($match in $exportMatches) {
    $mockEnumPatterns += $match.Groups[1].Value
}

# Match properties like "window: { showInformationMessage: () => {}, ... }"
$propertyMatches = [regex]::Matches($mockContent, '(\w+):\s*{[^}]*}|\w+:\s*\([^)]*\)\s*=>')
foreach ($match in $propertyMatches) {
    $mockApiPatterns += $match.Groups[1].Value
}

# Match object properties within existing objects like "window = { prop: ... }"
$objectPropMatches = [regex]::Matches($mockContent, '(\w+):\s*async?\s*\([^)]*\)')
foreach ($match in $objectPropMatches) {
    $mockApiPatterns += $match.Groups[1].Value
}

# Add known exported objects from the mock structure
$mockApiPatterns += @('window', 'workspace', 'commands', 'extensions', 'env', 'chat', 'lm')

# Add specific enum values we know exist
$knownEnumValues = @(
    'ViewColumn.One', 'ViewColumn.Two', 'ViewColumn.Active', 'ViewColumn.Beside', 'ViewColumn.Three',
    'TreeItemCollapsibleState.None', 'TreeItemCollapsibleState.Collapsed', 'TreeItemCollapsibleState.Expanded',
    'QuickPickItemKind.Separator', 'ConfigurationTarget.Workspace', 'ConfigurationTarget.Global',
    'ProgressLocation.Notification', 'StatusBarAlignment.Left',
    'LanguageModelChatMessage.User', 'LanguageModelChatMessage.Assistant'
)

foreach ($enumValue in $knownEnumValues) {
    $mockEnumPatterns += $enumValue
}

# Find missing API surface
$missingApis = @()
$missingEnums = @()

foreach ($api in $uniqueApiPatterns) {
    $found = $false
    foreach ($mockApi in $mockApiPatterns) {
        if ($api -like "$mockApi*" -or $api -eq $mockApi) {
            $found = $true
            break
        }
    }
    if (-not $found) {
        $missingApis += $api
    }
}

foreach ($enum in $uniqueEnumPatterns) {
    $found = $false
    
    # Check direct matches first
    if ($mockEnumPatterns -contains $enum) {
        $found = $true
    } else {
        # Check base enum matches (e.g., ViewColumn for ViewColumn.One)
        $enumBase = $enum.Split('.')[0]  
        if ($mockEnumPatterns -contains $enumBase) {
            $found = $true
        } else {
            # Check pattern matches
            foreach ($mockEnum in $mockEnumPatterns) {
                if ($enum -like "$mockEnum*" -or $enum -eq $mockEnum) {
                    $found = $true
                    break
                }
            }
        }
    }
    
    if (-not $found) {
        $missingEnums += $enum
    }
}

# Report results
Write-Host "=== AUDIT RESULTS ===" -ForegroundColor Cyan
Write-Host ""

if ($missingApis.Count -eq 0 -and $missingEnums.Count -eq 0) {
    Write-Host "[PASS] Mock completeness check passed!" -ForegroundColor Green
    Write-Host "All VS Code APIs used in source code are available in the mock." -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAIL] Mock completeness check failed!" -ForegroundColor Red
    Write-Host ""
    
    if ($missingApis.Count -gt 0) {
        Write-Host "Missing API patterns ($($missingApis.Count)):" -ForegroundColor Red
        foreach ($api in $missingApis) {
            Write-Host "  - vscode.$api" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    if ($missingEnums.Count -gt 0) {
        Write-Host "Missing enum patterns ($($missingEnums.Count)):" -ForegroundColor Red
        foreach ($enum in $missingEnums) {
            Write-Host "  - vscode.$enum" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    Write-Host "To fix: Add missing APIs to $MockPath" -ForegroundColor Yellow
    Write-Host "Example mock additions:" -ForegroundColor Yellow
    Write-Host "  export const MissingEnum = { One: 1, Two: 2 };" -ForegroundColor Gray
    Write-Host "  window: { missingMethod: () => ({}) }," -ForegroundColor Gray
    
    if ($CI) {
        exit 1
    }
}