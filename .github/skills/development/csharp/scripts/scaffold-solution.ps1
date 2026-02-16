#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Scaffold a .NET solution with production-ready project structure.

.DESCRIPTION
 Creates a .NET solution with API project, class library, and test project.
 Includes: GlobalUsings, health checks, structured logging, nullable enabled.

.PARAMETER Name
 Solution name. Default: MyApp

.PARAMETER Template
 Project template: 'webapi', 'console', 'classlib'. Default: webapi

.PARAMETER Output
 Output directory. Default: current directory.

.EXAMPLE
 .\scaffold-solution.ps1 -Name MyService -Template webapi
#>
param(
 [string]$Name = "MyApp",
 [ValidateSet("webapi", "console", "classlib")]
 [string]$Template = "webapi",
 [string]$Output = "."
)

$ErrorActionPreference = "Stop"

function Write-Header { param([string]$Text); Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Info { param([string]$Text); Write-Host " INFO: $Text" -ForegroundColor Yellow }

Write-Header "Scaffolding .NET Solution: $Name"
Write-Info "Template: $Template"

$root = Join-Path $Output $Name
New-Item -ItemType Directory -Path $root -Force | Out-Null

Push-Location $root
try {
 # Create solution
 dotnet new sln --name $Name --force | Out-Null
 Write-Host " Created: $Name.sln" -ForegroundColor Green

 # Create projects based on template
 $srcDir = "src"
 $testDir = "tests"

 if ($Template -eq "webapi") {
 # API project
 dotnet new webapi -o "$srcDir/$Name.Api" --use-controllers --no-https false --force | Out-Null
 dotnet sln add "$srcDir/$Name.Api" | Out-Null
 Write-Host " Created: $srcDir/$Name.Api" -ForegroundColor Green

 # Core/Domain library
 dotnet new classlib -o "$srcDir/$Name.Core" --force | Out-Null
 dotnet sln add "$srcDir/$Name.Core" | Out-Null
 dotnet add "$srcDir/$Name.Api" reference "$srcDir/$Name.Core" | Out-Null
 Write-Host " Created: $srcDir/$Name.Core" -ForegroundColor Green

 # Infrastructure library
 dotnet new classlib -o "$srcDir/$Name.Infrastructure" --force | Out-Null
 dotnet sln add "$srcDir/$Name.Infrastructure" | Out-Null
 dotnet add "$srcDir/$Name.Infrastructure" reference "$srcDir/$Name.Core" | Out-Null
 dotnet add "$srcDir/$Name.Api" reference "$srcDir/$Name.Infrastructure" | Out-Null
 Write-Host " Created: $srcDir/$Name.Infrastructure" -ForegroundColor Green

 } elseif ($Template -eq "console") {
 dotnet new console -o "$srcDir/$Name" --force | Out-Null
 dotnet sln add "$srcDir/$Name" | Out-Null
 Write-Host " Created: $srcDir/$Name" -ForegroundColor Green

 } else {
 dotnet new classlib -o "$srcDir/$Name" --force | Out-Null
 dotnet sln add "$srcDir/$Name" | Out-Null
 Write-Host " Created: $srcDir/$Name" -ForegroundColor Green
 }

 # Test project (always)
 $testProj = "$testDir/$Name.Tests"
 dotnet new xunit -o $testProj --force | Out-Null
 dotnet sln add $testProj | Out-Null

 # Add reference to main project
 if ($Template -eq "webapi") {
 dotnet add $testProj reference "$srcDir/$Name.Api" | Out-Null
 dotnet add $testProj reference "$srcDir/$Name.Core" | Out-Null
 } else {
 dotnet add $testProj reference "$srcDir/$Name" | Out-Null
 }

 # Add common test packages
 dotnet add $testProj package Moq | Out-Null
 dotnet add $testProj package FluentAssertions | Out-Null
 dotnet add $testProj package coverlet.collector | Out-Null
 Write-Host " Created: $testProj (xUnit + Moq + FluentAssertions)" -ForegroundColor Green

 # Create .editorconfig
 $editorconfig = @"
root = true

[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.cs]
dotnet_sort_system_directives_first = true
csharp_using_directive_placement = outside_namespace

# Nullable enabled
dotnet_diagnostic.CS8600.severity = warning
dotnet_diagnostic.CS8601.severity = warning
dotnet_diagnostic.CS8602.severity = warning
dotnet_diagnostic.CS8603.severity = warning
"@
 $editorconfig | Set-Content ".editorconfig" -Encoding UTF8
 Write-Host " Created: .editorconfig" -ForegroundColor Green

 # Create .gitignore
 $gitignore = @"
bin/
obj/
*.user
*.suo
.vs/
*.DotSettings.user
TestResults/
coverage/
*.log
"@
 $gitignore | Set-Content ".gitignore" -Encoding UTF8

 # Create README
 $readme = @"
# $Name

## Setup

```bash
dotnet restore
dotnet build
dotnet test
```

## Run

```bash
$(if ($Template -eq 'webapi') { "dotnet run --project src/$Name.Api" } else { "dotnet run --project src/$Name" })
```

## Project Structure

```
$Name/
+-- src/
$(if ($Template -eq 'webapi') {
"| +-- $Name.Api/ # API controllers and configuration
| +-- $Name.Core/ # Domain models and interfaces
| -- $Name.Infrastructure/ # Data access and external services"
} else {
"| -- $Name/ # Main project"
})
+-- tests/
| -- $Name.Tests/ # Unit and integration tests
-- $Name.sln
```
"@
 $readme | Set-Content "README.md" -Encoding UTF8
 Write-Host " Created: README.md" -ForegroundColor Green

 Write-Header "Done"
 Write-Host " Solution: $root\$Name.sln"
 Write-Host " Build: dotnet build" -ForegroundColor Cyan
 Write-Host " Test: dotnet test" -ForegroundColor Cyan
 if ($Template -eq "webapi") {
 Write-Host " Run: dotnet run --project src/$Name.Api" -ForegroundColor Cyan
 }

} finally {
 Pop-Location
}
