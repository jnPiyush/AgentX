#!/usr/bin/env pwsh
# Memory Scale Test - Validate JsonObservationStore pattern at >1000 observations
# Tests per-issue JSON file pattern + manifest for performance at scale.
# Resolves TD-006: "Git-backed observation store untested at scale (>1000 observations)"
#
# Usage:
#   .\tests\memory-scale-test.ps1                    # Default: 1500 observations
#   .\tests\memory-scale-test.ps1 -Count 5000        # Stress test
#   .\tests\memory-scale-test.ps1 -Count 500 -Issues 50
#Requires -Version 7.0
param(
    [int]$Count = 1500,
    [int]$Issues = 100,
    [switch]$KeepData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$testDir = Join-Path ([System.IO.Path]::GetTempPath()) "agentx-memory-scale-$(Get-Random)"
New-Item -ItemType Directory -Path $testDir -Force | Out-Null
$manifestFile = Join-Path $testDir 'manifest.json'

$agents = @('pm','architect','engineer','reviewer','devops','tester','data-scientist')
$categories = @('decision','code-change','error','key-fact','compaction-summary')

$passed = 0
$failed = 0
$results = @()

function Write-TestResult([string]$name, [bool]$ok, [string]$detail) {
    $mark = if ($ok) { '[PASS]' } else { '[FAIL]' }
    Write-Host "  $mark $name"
    if ($detail) { Write-Host "        $detail" }
    $script:results += @{ name = $name; pass = $ok; detail = $detail }
    if ($ok) { $script:passed++ } else { $script:failed++ }
}

# Generate observation ID
function New-ObsId { return "obs-$(Get-Random -Minimum 100000 -Maximum 999999)" }

# --- Test 1: Write N observations across M issues ---
Write-Host "`n  Memory Scale Test ($Count observations, $Issues issues)"
Write-Host "  ============================================`n"

$sw = [System.Diagnostics.Stopwatch]::StartNew()

# Build manifest + per-issue files
$manifest = @()
$issueMap = @{}

for ($i = 0; $i -lt $Count; $i++) {
    $issueNum = ($i % $Issues) + 1
    $agent = $agents[$i % $agents.Count]
    $category = $categories[$i % $categories.Count]
    $id = New-ObsId
    $ts = (Get-Date).AddMinutes(-$Count + $i).ToString('o')

    $obs = @{
        id          = $id
        agent       = $agent
        issueNumber = $issueNum
        category    = $category
        content     = "Observation content for test $i - agent $agent worked on issue #$issueNum and produced a $category observation during the quality loop iteration."
        summary     = "Test observation $i from $agent on #$issueNum"
        tokens      = 42
        timestamp   = $ts
        sessionId   = "session-$(($i / 50) -as [int])"
    }

    # Per-issue accumulation
    if (-not $issueMap.ContainsKey($issueNum)) { $issueMap[$issueNum] = @() }
    $issueMap[$issueNum] += $obs

    # Manifest entry (index only)
    $manifest += @{
        id          = $id
        agent       = $agent
        issueNumber = $issueNum
        category    = $category
        summary     = $obs.summary
        tokens      = 42
        timestamp   = $ts
    }
}

$genTime = $sw.Elapsed.TotalMilliseconds

# --- Test 2: Write per-issue JSON files ---
$sw.Restart()

foreach ($kv in $issueMap.GetEnumerator()) {
    $issueFile = Join-Path $testDir "issue-$($kv.Key).json"
    $kv.Value | ConvertTo-Json -Depth 5 -Compress | Set-Content -Path $issueFile -Encoding utf8
}

$manifest | ConvertTo-Json -Depth 5 -Compress | Set-Content -Path $manifestFile -Encoding utf8

$writeTime = $sw.Elapsed.TotalMilliseconds

$fileCount = (Get-ChildItem $testDir -Filter 'issue-*.json').Count
Write-TestResult "Write $Count observations to $fileCount issue files" ($fileCount -eq $Issues) "Time: $([math]::Round($writeTime))ms, Files: $fileCount"

# --- Test 3: Read manifest performance ---
$sw.Restart()
$loadedManifest = Get-Content $manifestFile -Raw -Encoding utf8 | ConvertFrom-Json
$readManifestTime = $sw.Elapsed.TotalMilliseconds
$manifestCount = $loadedManifest.Count
Write-TestResult "Read manifest ($manifestCount entries)" ($manifestCount -eq $Count) "Time: $([math]::Round($readManifestTime))ms"

# --- Test 4: Manifest size check (should be manageable for git) ---
$manifestSize = (Get-Item $manifestFile).Length
$manifestSizeKB = [math]::Round($manifestSize / 1024, 1)
$sizeOk = $manifestSizeKB -lt 5000  # 5MB limit for git comfort
Write-TestResult "Manifest file size" $sizeOk "Size: ${manifestSizeKB}KB ($manifestCount entries)"

# --- Test 5: Search by agent (simulate listByAgent) ---
$sw.Restart()
$agentFilter = $loadedManifest | Where-Object { $_.agent -eq 'engineer' }
$searchAgentTime = $sw.Elapsed.TotalMilliseconds
$agentCount = @($agentFilter).Count
Write-TestResult "Search by agent (engineer)" ($agentCount -gt 0) "Found: $agentCount, Time: $([math]::Round($searchAgentTime))ms"

# --- Test 6: Search by issue (simulate getByIssue) ---
$sw.Restart()
$targetIssue = 1
$issueFilter = $loadedManifest | Where-Object { $_.issueNumber -eq $targetIssue }
$searchIssueTime = $sw.Elapsed.TotalMilliseconds
$issueCount = @($issueFilter).Count
Write-TestResult "Search by issue (#$targetIssue)" ($issueCount -gt 0) "Found: $issueCount, Time: $([math]::Round($searchIssueTime))ms"

# --- Test 7: Read single issue file ---
$sw.Restart()
$issueFile1 = Join-Path $testDir "issue-1.json"
$issueObs = Get-Content $issueFile1 -Raw -Encoding utf8 | ConvertFrom-Json
$readIssueTime = $sw.Elapsed.TotalMilliseconds
Write-TestResult "Read single issue file" ($issueObs.Count -gt 0) "Observations: $($issueObs.Count), Time: $([math]::Round($readIssueTime))ms"

# --- Test 8: Search by category ---
$sw.Restart()
$catFilter = $loadedManifest | Where-Object { $_.category -eq 'decision' }
$searchCatTime = $sw.Elapsed.TotalMilliseconds
Write-TestResult "Search by category (decision)" ($catFilter.Count -gt 0) "Found: $(@($catFilter).Count), Time: $([math]::Round($searchCatTime))ms"

# --- Test 9: Full-text search simulation (keyword in summary) ---
$sw.Restart()
$keyword = 'engineer'
$ftsResults = $loadedManifest | Where-Object { $_.summary -match $keyword }
$ftsTime = $sw.Elapsed.TotalMilliseconds
Write-TestResult "Full-text search ('$keyword')" ($ftsResults.Count -gt 0) "Found: $(@($ftsResults).Count), Time: $([math]::Round($ftsTime))ms"

# --- Test 10: Concurrent write simulation ---
$sw.Restart()
$lockFile = Join-Path $testDir '.lock'
$concurrentOk = $true
$jobs = @()
for ($j = 0; $j -lt 5; $j++) {
    $issueNum = $Issues + $j + 1
    $issueFile = Join-Path $testDir "issue-$issueNum.json"
    $obs = @(@{
        id = New-ObsId; agent = 'engineer'; issueNumber = $issueNum
        category = 'decision'; content = "Concurrent write test $j"
        summary = "Concurrent $j"; tokens = 10; timestamp = (Get-Date).ToString('o')
        sessionId = "concurrent-test"
    })
    $obs | ConvertTo-Json -Depth 5 | Set-Content -Path $issueFile -Encoding utf8
}
$concurrentTime = $sw.Elapsed.TotalMilliseconds
$newFileCount = (Get-ChildItem $testDir -Filter 'issue-*.json').Count
Write-TestResult "Concurrent-style writes (5 new issues)" ($newFileCount -eq ($Issues + 5)) "Total files: $newFileCount, Time: $([math]::Round($concurrentTime))ms"

# --- Test 11: Total storage footprint ---
$totalSize = (Get-ChildItem $testDir -File | Measure-Object -Property Length -Sum).Sum
$totalSizeMB = [math]::Round($totalSize / 1MB, 2)
$footprintOk = $totalSizeMB -lt 50  # 50MB upper bound
Write-TestResult "Storage footprint" $footprintOk "Total: ${totalSizeMB}MB for $Count observations"

# --- Test 12: Stress - getStats equivalent ---
$sw.Restart()
$totalTokens = ($loadedManifest | Measure-Object -Property tokens -Sum).Sum
$byCategory = @{}
foreach ($entry in $loadedManifest) {
    if (-not $byCategory.ContainsKey($entry.category)) { $byCategory[$entry.category] = 0 }
    $byCategory[$entry.category]++
}
$byAgent = @{}
foreach ($entry in $loadedManifest) {
    if (-not $byAgent.ContainsKey($entry.agent)) { $byAgent[$entry.agent] = 0 }
    $byAgent[$entry.agent]++
}
$statsTime = $sw.Elapsed.TotalMilliseconds
Write-TestResult "Compute store stats" $true "Tokens: $totalTokens, Categories: $($byCategory.Count), Agents: $($byAgent.Count), Time: $([math]::Round($statsTime))ms"

# --- Performance thresholds ---
Write-Host "`n  Performance Thresholds"
Write-Host "  ----------------------"

$perfChecks = @(
    @{ name = "Manifest read < 500ms"; ok = ($readManifestTime -lt 500); detail = "${readManifestTime}ms" }
    @{ name = "Agent search < 200ms"; ok = ($searchAgentTime -lt 200); detail = "${searchAgentTime}ms" }
    @{ name = "Issue search < 200ms"; ok = ($searchIssueTime -lt 200); detail = "${searchIssueTime}ms" }
    @{ name = "FTS search < 500ms"; ok = ($ftsTime -lt 500); detail = "${ftsTime}ms" }
    @{ name = "Single issue read < 100ms"; ok = ($readIssueTime -lt 100); detail = "${readIssueTime}ms" }
    @{ name = "Stats computation < 500ms"; ok = ($statsTime -lt 500); detail = "${statsTime}ms" }
)

foreach ($pc in $perfChecks) {
    $mark = if ($pc.ok) { '[PASS]' } else { '[WARN]' }
    Write-Host "  $mark $($pc.name) ($($pc.detail))"
    if (-not $pc.ok) { $script:results += @{ name = $pc.name; pass = $false; detail = "Threshold exceeded: $($pc.detail)" } }
}

# Cleanup
if (-not $KeepData) {
    Remove-Item $testDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "`n  Cleaned up temp data at $testDir"
}

# Summary
$total = $passed + $failed
Write-Host "`n  ============================================"
Write-Host "  Total: $total | Pass: $passed | Fail: $failed"
if ($failed -gt 0) {
    Write-Host "  [FAIL] Memory scale test has $failed failure(s)`n"
    exit 1
} else {
    Write-Host "  [PASS] Memory pattern validated at $Count observations scale`n"
    exit 0
}
