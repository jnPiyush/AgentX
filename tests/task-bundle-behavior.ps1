#!/usr/bin/env pwsh

$ErrorActionPreference = 'Stop'
$script:pass = 0
$script:fail = 0
$script:repoRoot = Split-Path $PSScriptRoot -Parent

function Assert-True($condition, $message) {
    if ($condition) {
        Write-Host " [PASS] $message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host " [FAIL] $message" -ForegroundColor Red
        $script:fail++
    }
}

function New-TestWorkspace([string]$name) {
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-task-bundle-test-{0}-{1}" -f $name, [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root '.agentx') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root 'docs\execution\plans') -Force | Out-Null
    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx.ps1') (Join-Path $root '.agentx\agentx.ps1') -Force
    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx-cli.ps1') (Join-Path $root '.agentx\agentx-cli.ps1') -Force
    '{"provider":"local","integration":"local","mode":"local","nextIssueNumber":1}' | Set-Content (Join-Path $root '.agentx\config.json') -Encoding utf8
    '# Demo plan' | Set-Content (Join-Path $root 'docs\execution\plans\TASK-BUNDLE.md') -Encoding utf8
    return $root
}

function Remove-TestWorkspace([string]$root) {
    if ($root -and (Test-Path $root)) {
        Remove-Item $root -Recurse -Force
    }
}

function Invoke-AgentX([string]$root, [string[]]$arguments) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add((Join-Path $root '.agentx\agentx.ps1'))
    foreach ($argument in $arguments) {
        $startInfo.ArgumentList.Add($argument)
    }
    $startInfo.Environment['AGENTX_WORKSPACE_ROOT'] = $root

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{
        Output = ($stdout + $stderr)
        ExitCode = $process.ExitCode
    }
}

function Test-ExplicitBundleLifecycle {
    $root = New-TestWorkspace 'explicit'
    try {
        $null = Invoke-AgentX $root @('issue', 'create', '--title', '[Story] Parent issue', '--labels', 'type:story')
        $create = Invoke-AgentX $root @('bundle', 'create', '--title', 'Track slice', '--issue', '1', '--summary', 'Bundle summary', '--promotion-mode', 'story_candidate', '--json')
        $bundle = $create.Output | ConvertFrom-Json
        Assert-True ($create.ExitCode -eq 0) 'task bundle create succeeds with explicit issue context'
        Assert-True ($bundle.parent_context.issue_number -eq 1) 'created bundle keeps the explicit parent issue'
        Assert-True (@($bundle.evidence_links) -contains 'issue:#1') 'created bundle seeds issue evidence'

        $list = Invoke-AgentX $root @('bundle', 'list', '--issue', '1', '--json')
        $bundles = @($list.Output | ConvertFrom-Json)
        Assert-True ($list.ExitCode -eq 0 -and $bundles.Count -eq 1) 'bundle list filters by explicit issue context'

        $resolve = Invoke-AgentX $root @('bundle', 'resolve', '--id', $bundle.bundle_id, '--state', 'Archived', '--archive-reason', 'Merged into parent', '--json')
        $resolved = $resolve.Output | ConvertFrom-Json
        Assert-True ($resolve.ExitCode -eq 0) 'bundle resolve succeeds'
        Assert-True ($resolved.state -eq 'Archived') 'bundle resolve archives the record'
        Assert-True ($resolved.archive_reason -eq 'Merged into parent') 'bundle resolve stores archive reason'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-InferredAndAmbiguousContext {
    $root = New-TestWorkspace 'inferred'
    try {
        $null = Invoke-AgentX $root @('issue', 'create', '--title', '[Story] Active issue', '--labels', 'type:story')
        $null = Invoke-AgentX $root @('issue', 'update', '--number', '1', '--status', 'In Progress')

        $create = Invoke-AgentX $root @('bundle', 'create', '--title', 'Implicit bundle', '--json')
        $bundle = $create.Output | ConvertFrom-Json
        Assert-True ($create.ExitCode -eq 0) 'bundle create infers a single active issue context'
        Assert-True ($bundle.parent_context.issue_number -eq 1) 'inferred bundle records the active issue'
    } finally {
        Remove-TestWorkspace $root
    }

    $root = New-TestWorkspace 'ambiguous'
    try {
        $null = Invoke-AgentX $root @('issue', 'create', '--title', '[Story] First active issue', '--labels', 'type:story')
        $null = Invoke-AgentX $root @('issue', 'create', '--title', '[Story] Second active issue', '--labels', 'type:story')
        $null = Invoke-AgentX $root @('issue', 'update', '--number', '1', '--status', 'In Progress')
        $null = Invoke-AgentX $root @('issue', 'update', '--number', '2', '--status', 'In Progress')

        $create = Invoke-AgentX $root @('bundle', 'create', '--title', 'Ambiguous bundle')
        Assert-True ($create.ExitCode -ne 0) 'bundle create fails closed when multiple active contexts exist'
        Assert-True ($create.Output -match 'Task bundle context is ambiguous') 'ambiguous bundle create returns explicit fallback guidance'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-DuplicateAvoidance {
    $root = New-TestWorkspace 'duplicate'
    try {
        $null = Invoke-AgentX $root @('issue', 'create', '--title', '[Story] Parent issue', '--labels', 'type:story')
        $first = Invoke-AgentX $root @('bundle', 'create', '--title', 'Promote me', '--issue', '1', '--promotion-mode', 'story_candidate', '--json')
        $second = Invoke-AgentX $root @('bundle', 'create', '--title', 'Promote me', '--issue', '1', '--promotion-mode', 'story_candidate', '--json')
        $firstBundle = $first.Output | ConvertFrom-Json
        $secondBundle = $second.Output | ConvertFrom-Json

        $promoteFirst = Invoke-AgentX $root @('bundle', 'promote', '--id', $firstBundle.bundle_id, '--target', 'story', '--json')
        $promoteSecond = Invoke-AgentX $root @('bundle', 'promote', '--id', $secondBundle.bundle_id, '--target', 'story', '--json')
        $firstResult = $promoteFirst.Output | ConvertFrom-Json
        $secondResult = $promoteSecond.Output | ConvertFrom-Json

        Assert-True ($promoteFirst.ExitCode -eq 0) 'first bundle promotion succeeds'
        Assert-True ($promoteSecond.ExitCode -eq 0) 'second bundle promotion succeeds'
        Assert-True ($firstResult.targetReference -eq '#2') 'first promotion creates a story issue'
        Assert-True ($secondResult.targetReference -eq '#2') 'second promotion links to the existing durable issue'
        Assert-True ($secondResult.duplicateCheckResult -eq 'linked-existing') 'duplicate avoidance links the second bundle instead of creating a new issue'
    } finally {
        Remove-TestWorkspace $root
    }
}

Test-ExplicitBundleLifecycle
Test-InferredAndAmbiguousContext
Test-DuplicateAvoidance

if ($script:fail -gt 0) {
    Write-Host "`nTask bundle behavior tests failed: $($script:fail) failed, $($script:pass) passed." -ForegroundColor Red
    exit 1
}

Write-Host "`nTask bundle behavior tests passed: $($script:pass) checks." -ForegroundColor Green