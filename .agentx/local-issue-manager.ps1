# Local Issue Manager for AgentX
# Provides GitHub-like issue management without requiring a repository

param(
 [Parameter(Mandatory=$false)]
 [ValidateSet('create', 'update', 'close', 'list', 'get', 'comment')]
 [string]$Action = 'list',
 
 [Parameter(Mandatory=$false)]
 [int]$IssueNumber,
 
 [Parameter(Mandatory=$false)]
 [string]$Title,
 
 [Parameter(Mandatory=$false)]
 [string]$Body,
 
 [Parameter(Mandatory=$false)]
 [string[]]$Labels,
 
 [Parameter(Mandatory=$false)]
 [ValidateSet('Backlog', 'In Progress', 'In Review', 'Ready', 'Done')]
 [string]$Status,
 
 [Parameter(Mandatory=$false)]
 [string]$Comment
)

$ErrorActionPreference = "Stop"
$AgentXDir = Join-Path $PSScriptRoot ".."
$IssuesDir = Join-Path $AgentXDir ".agentx\issues"
$ConfigFile = Join-Path $AgentXDir ".agentx\config.json"

# Ensure directories exist
if (-not (Test-Path $IssuesDir)) {
 New-Item -ItemType Directory -Path $IssuesDir -Force | Out-Null
}

# Initialize config if not exists
if (-not (Test-Path $ConfigFile)) {
 $config = @{
 mode = "local"
 nextIssueNumber = 1
 created = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
 }
 $config | ConvertTo-Json -Depth 10 | Set-Content $ConfigFile
}

function Get-Config {
 return Get-Content $ConfigFile | ConvertFrom-Json
}

function Save-Config {
 param($Config)
 $Config | ConvertTo-Json -Depth 10 | Set-Content $ConfigFile
}

function Get-NextIssueNumber {
 $config = Get-Config
 $number = $config.nextIssueNumber
 $config.nextIssueNumber = $number + 1
 Save-Config $config
 return $number
}

function Get-IssueFile {
 param([int]$Number)
 return Join-Path $IssuesDir "$Number.json"
}

function Create-Issue {
 param(
 [string]$Title,
 [string]$Body,
 [string[]]$Labels
 )
 
 $number = Get-NextIssueNumber
 # Normalize labels: split any comma-separated values into individual items
 $normalizedLabels = @()
 foreach ($l in $Labels) {
 $normalizedLabels += ($l -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
 }
 $issue = @{
 number = $number
 title = $Title
 body = $Body
 labels = $normalizedLabels
 status = "Backlog"
 state = "open"
 created = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
 updated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
 comments = @()
 }
 
 $issueFile = Get-IssueFile $number
 $issue | ConvertTo-Json -Depth 10 | Set-Content $issueFile
 
 Write-Host "Created issue #${number}: $Title" -ForegroundColor Green
 return $issue
}

function Get-Issue {
 param([int]$Number)
 
 $issueFile = Get-IssueFile $Number
 if (-not (Test-Path $issueFile)) {
 Write-Error "Issue #${Number} not found"
 return $null
 }
 
 return Get-Content $issueFile | ConvertFrom-Json
}

function Update-Issue {
 param(
 [int]$Number,
 [string]$Title,
 [string]$Body,
 [string[]]$Labels,
 [string]$Status
 )
 
 $issue = Get-Issue $Number
 if (-not $issue) { return }
 
 if ($Title) { $issue.title = $Title }
 if ($Body) { $issue.body = $Body }
 if ($Labels) { $issue.labels = $Labels }
 if ($Status) { $issue.status = $Status }
 
 $issue.updated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
 
 $issueFile = Get-IssueFile $Number
 $issue | ConvertTo-Json -Depth 10 | Set-Content $issueFile
 
 Write-Host "Updated issue #${Number}" -ForegroundColor Green
 return $issue
}

function Close-Issue {
 param([int]$Number)
 
 $issue = Get-Issue $Number
 if (-not $issue) { return }
 
 $issue.state = "closed"
 $issue.status = "Done"
 $issue.updated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
 
 $issueFile = Get-IssueFile $Number
 $issue | ConvertTo-Json -Depth 10 | Set-Content $issueFile
 
 Write-Host "Closed issue #${Number}" -ForegroundColor Green
 return $issue
}

function Add-Comment {
 param(
 [int]$Number,
 [string]$CommentBody
 )
 
 $issue = Get-Issue $Number
 if (-not $issue) { return }
 
 $comment = @{
 body = $CommentBody
 created = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
 }
 
 $issue.comments += $comment
 $issue.updated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
 
 $issueFile = Get-IssueFile $Number
 $issue | ConvertTo-Json -Depth 10 | Set-Content $issueFile
 
 Write-Host "Added comment to issue #${Number}" -ForegroundColor Green
 return $issue
}

function List-Issues {
 $issues = Get-ChildItem $IssuesDir -Filter "*.json" | ForEach-Object {
 Get-Content $_.FullName | ConvertFrom-Json
 } | Sort-Object number -Descending
 
 if ($issues.Count -eq 0) {
 Write-Host "No issues found" -ForegroundColor Yellow
 return
 }
 
 Write-Host "`nLocal Issues:" -ForegroundColor Cyan
 Write-Host "===========================================================" -ForegroundColor Cyan
 
 foreach ($issue in $issues) {
 $statusColor = switch ($issue.status) {
 "Backlog" { "Gray" }
 "In Progress" { "Yellow" }
 "In Review" { "Magenta" }
 "Ready" { "Cyan" }
 "Done" { "Green" }
 default { "White" }
 }
 
 $stateIcon = if ($issue.state -eq "open") { "( )" } else { "(*)" }
 $labels = if ($issue.labels) { " [$($issue.labels -join ', ')]" } else { "" }
 
 Write-Host "$stateIcon #$($issue.number) " -NoNewline
 Write-Host "$($issue.status)" -ForegroundColor $statusColor -NoNewline
 Write-Host " - $($issue.title)$labels"
 }
 
 Write-Host "===========================================================" -ForegroundColor Cyan
}

# Main execution
switch ($Action) {
 'create' {
 if (-not $Title) {
 Write-Error "Title is required for creating an issue"
 exit 1
 }
 Create-Issue -Title $Title -Body $Body -Labels $Labels
 }
 
 'update' {
 if (-not $IssueNumber) {
 Write-Error "IssueNumber is required for updating an issue"
 exit 1
 }
 Update-Issue -Number $IssueNumber -Title $Title -Body $Body -Labels $Labels -Status $Status
 }
 
 'close' {
 if (-not $IssueNumber) {
 Write-Error "IssueNumber is required for closing an issue"
 exit 1
 }
 Close-Issue -Number $IssueNumber
 }
 
 'get' {
 if (-not $IssueNumber) {
 Write-Error "IssueNumber is required for getting an issue"
 exit 1
 }
 $issue = Get-Issue -Number $IssueNumber
 if ($issue) {
 $issue | ConvertTo-Json -Depth 10
 }
 }
 
 'comment' {
 if (-not $IssueNumber -or -not $Comment) {
 Write-Error "IssueNumber and Comment are required for adding a comment"
 exit 1
 }
 Add-Comment -Number $IssueNumber -CommentBody $Comment
 }
 
 'list' {
 List-Issues
 }
}
