# Request GitHub Copilot code review on a PR and auto-resolve review threads.
# Usage: pwsh scripts/ghcp-review-resolve.ps1 -Pr <n> [-AutoResolve] [-TimeoutSeconds 180] [-DryRun]
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][int]$Pr,
    [switch]$AutoResolve,
    [int]$TimeoutSeconds = 180,
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

function Test-Gh {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "gh CLI not found. Install from https://cli.github.com/" }
    gh auth status >$null 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gh not authenticated. Run 'gh auth login'." }
}

function Get-RepoCoords {
    $json = gh repo view --json owner,name | ConvertFrom-Json
    return @{ owner = $json.owner.login; repo = $json.name }
}

function Request-CopilotReview {
    param([int]$PrNum)
    Write-Host "[1/4] Requesting Copilot review on PR #$PrNum..."
    if ($DryRun) { Write-Host "  [dry-run] gh pr edit $PrNum --add-reviewer copilot-pull-request-reviewer"; return }
    $out = gh pr edit $PrNum --add-reviewer copilot-pull-request-reviewer 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Adding Copilot reviewer failed: $out"
        Write-Warning "Manual fallback: request Copilot review via PR page."
    } else {
        Write-Host "  Review requested."
    }
}

function Wait-ForCopilotReview {
    param([int]$PrNum, [int]$Timeout)
    Write-Host "[2/4] Waiting up to ${Timeout}s for Copilot review..."
    $deadline = (Get-Date).AddSeconds($Timeout)
    while ((Get-Date) -lt $deadline) {
        $reviews = gh pr view $PrNum --json reviews | ConvertFrom-Json
        $cop = $reviews.reviews | Where-Object { $_.author.login -match 'copilot' } | Select-Object -Last 1
        if ($cop) { Write-Host "  Found review state=$($cop.state) by $($cop.author.login)"; return $cop }
        Start-Sleep -Seconds 5
    }
    Write-Warning "  Timed out waiting. Continuing to scan existing threads."
    return $null
}

function Get-ReviewThreads {
    param([string]$Owner, [string]$Repo, [int]$PrNum)
    Write-Host "[3/4] Fetching review threads via GraphQL..."
    $q = 'query($owner:String!,$repo:String!,$n:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:5){nodes{body author{login}}}}}}}}'
    $resp = gh api graphql -f "query=$q" -F "owner=$Owner" -F "repo=$Repo" -F "n=$PrNum" | ConvertFrom-Json
    return $resp.data.repository.pullRequest.reviewThreads.nodes
}

function Resolve-Thread {
    param([string]$ThreadId)
    $m = 'mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}'
    if ($DryRun) { Write-Host "  [dry-run] resolve $ThreadId"; return $true }
    gh api graphql -f "query=$m" -F "id=$ThreadId" 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

Test-Gh
$coords = Get-RepoCoords
Write-Host "Repo: $($coords.owner)/$($coords.repo)  PR: #$Pr  AutoResolve=$AutoResolve  DryRun=$DryRun`
"
Request-CopilotReview -PrNum $Pr | Out-Null
Wait-ForCopilotReview -PrNum $Pr -Timeout $TimeoutSeconds | Out-Null
$threads = Get-ReviewThreads -Owner $coords.owner -Repo $coords.repo -PrNum $Pr
if (-not $threads) { Write-Host "No review threads found."; exit 0 }

$open = @($threads | Where-Object { -not $_.isResolved })
$copilotOnly = @($open | Where-Object {
    $authors = @($_.comments.nodes.author.login) | Sort-Object -Unique
    ($authors.Count -eq 1) -and ($authors[0] -match 'copilot|github-actions')
})

Write-Host "[4/4] Threads: total=$($threads.Count) open=$($open.Count) copilot-only=$($copilotOnly.Count)"

$resolved = 0; $deferred = 0
if ($AutoResolve) {
    foreach ($t in $copilotOnly) {
        if (Resolve-Thread -ThreadId $t.id) { $resolved++ } else { $deferred++ }
    }
    $deferred += ($open.Count - $copilotOnly.Count)
} else {
    Write-Host "  -AutoResolve not set; reporting only."
    $deferred = $open.Count
}

Write-Host "`
Result: resolved=$resolved deferred=$deferred"
exit 0
