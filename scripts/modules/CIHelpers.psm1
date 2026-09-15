# ------------------------------------------------------------------
# Frontier Shared Module: CIHelpers
# ------------------------------------------------------------------
# Common CI/CD helper functions used across Frontier scripts.
# Provides platform-agnostic output formatting for GitHub Actions
# and local terminal environments.
#
# Usage:
#   . "$PSScriptRoot/../modules/CIHelpers.psm1"
#   Write-CIOutput "key" "value"
#   Write-CIAnnotation -Level warning -Message "Something happened" -File "src/foo.ts" -Line 42
#   Test-IsCI
# ------------------------------------------------------------------

function Test-IsCI {
    <#
    .SYNOPSIS
        Returns $true if running in a CI environment (GitHub Actions, Azure Pipelines).
    #>
    return ($null -ne $env:GITHUB_ACTIONS) -or ($null -ne $env:TF_BUILD) -or ($null -ne $env:CI)
}

function Write-CIOutput {
    <#
    .SYNOPSIS
        Set a CI output variable (GitHub Actions GITHUB_OUTPUT or local echo).
    .PARAMETER Name
        Output variable name.
    .PARAMETER Value
        Output variable value.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $Name,
        [Parameter(Mandatory)] [string] $Value
    )

    if ($env:GITHUB_OUTPUT) {
        "$Name=$Value" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
    }
    else {
        Write-Host "[OUTPUT] $Name=$Value"
    }
}

function Write-CIAnnotation {
    <#
    .SYNOPSIS
        Write a CI annotation (warning, error, notice) compatible with GitHub Actions.
    .PARAMETER Level
        Annotation level: notice, warning, or error.
    .PARAMETER Message
        Annotation message text.
    .PARAMETER File
        Optional file path for the annotation.
    .PARAMETER Line
        Optional line number for the annotation.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet('notice', 'warning', 'error')]
        [string] $Level,

        [Parameter(Mandatory)] [string] $Message,
        [string] $File,
        [int] $Line = 0
    )

    if (Test-IsCI) {
        $location = ''
        if ($File) {
            $location = " file=$File"
            if ($Line -gt 0) { $location += ",line=$Line" }
        }
        Write-Host "::${Level}${location}::${Message}"
    }
    else {
        $prefix = switch ($Level) {
            'error'   { '[FAIL]' }
            'warning' { '[WARN]' }
            default   { '[INFO]' }
        }
        $suffix = if ($File) { " ($File" + $(if ($Line -gt 0) { ":$Line" } else { '' }) + ")" } else { '' }
        Write-Host "$prefix $Message$suffix"
    }
}

function Write-CISummary {
    <#
    .SYNOPSIS
        Append markdown content to the GitHub Actions step summary.
    .PARAMETER Content
        Markdown content to append.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $Content
    )

    if ($env:GITHUB_STEP_SUMMARY) {
        $Content | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
    }
    else {
        Write-Host "--- Step Summary ---"
        Write-Host $Content
        Write-Host "--------------------"
    }
}

function Set-CIGroup {
    <#
    .SYNOPSIS
        Start or end a collapsible group in CI output.
    .PARAMETER Name
        Group name (start) or $null (end).
    .PARAMETER End
        If set, ends the current group.
    #>
    [CmdletBinding()]
    param(
        [string] $Name,
        [switch] $End
    )

    if (Test-IsCI) {
        if ($End) {
            Write-Host "::endgroup::"
        }
        else {
            Write-Host "::group::$Name"
        }
    }
    else {
        if (-not $End) {
            Write-Host "`n=== $Name ==="
        }
    }
}

Export-ModuleMember -Function Test-IsCI, Write-CIOutput, Write-CIAnnotation, Write-CISummary, Set-CIGroup
