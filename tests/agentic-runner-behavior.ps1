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

function Assert-Equal($actual, $expected, $message) {
    Assert-True ($actual -eq $expected) "$message (expected: $expected, actual: $actual)"
}

. (Join-Path $script:repoRoot '.agentx\agentic-runner.ps1')

Write-Host ''
Write-Host ' Agentic Runner Behavior Tests' -ForegroundColor Cyan
Write-Host ' ================================================' -ForegroundColor DarkGray

$Script:ApiMode = 'models'

$parsedFallbacks = @(Parse-ModelFallbackList "['gpt-4.1', 'gpt-4o-mini']")
Assert-Equal $parsedFallbacks.Count 2 'Parse-ModelFallbackList returns two entries'
Assert-Equal $parsedFallbacks[0] 'gpt-4.1' 'Parse-ModelFallbackList trims quotes from first entry'
Assert-Equal $parsedFallbacks[1] 'gpt-4o-mini' 'Parse-ModelFallbackList trims quotes from second entry'

$modelCandidates = @(Get-ModelCandidates -preferredModel 'Claude Sonnet 4.6 (copilot)' -modelFallback 'gpt-4o-mini, gpt-4.1')
Assert-Equal $modelCandidates.Count 3 'Get-ModelCandidates deduplicates resolved models'
Assert-Equal $modelCandidates[0] 'gpt-4.1' 'Primary model is resolved first in GitHub Models mode'
Assert-Equal $modelCandidates[1] 'gpt-4o-mini' 'Fallback candidate is preserved after primary model'
Assert-Equal $modelCandidates[2] 'gpt-4o' 'Default model is appended as final fallback'

Assert-True (Test-IsModelAvailabilityError 'Copilot API error (HTTP 404): model not found') 'Model availability detector matches model-not-found errors'
Assert-True (-not (Test-IsModelAvailabilityError 'Copilot API error (HTTP 429): rate limit exceeded')) 'Model availability detector ignores rate-limit errors'

Assert-Equal (Get-ModelContextWindow 'gpt-4o') 128000 'Get-ModelContextWindow returns GPT-4o context size'
Assert-Equal (Get-ModelContextWindow 'claude-sonnet-4.6') 200000 'Get-ModelContextWindow returns Claude context size'

$largeMessages = @(
    @{ role = 'system'; content = 'system prompt' }
)
for ($i = 0; $i -lt 25; $i++) {
    $largeMessages += @{ role = 'user'; content = ('x' * 1000) }
}

$compacted = @(Invoke-ContextCompaction -Messages $largeMessages -ModelId 'gpt-4o' -KeepRecent 12 -MinRecent 4 -ThresholdPercent 0.01)
$compactionUsage = Get-ConversationTokenUsage -Messages $compacted -ModelId 'gpt-4o' -ThresholdPercent 0.01
Assert-True ($compacted.Count -lt $largeMessages.Count) 'Invoke-ContextCompaction prunes messages when token threshold is exceeded'
Assert-True ($compacted[1].content -match '^\[Context Compaction\]') 'Invoke-ContextCompaction inserts a compaction summary message'
Assert-True ($compactionUsage.totalTokens -le $compactionUsage.thresholdTokens) 'Invoke-ContextCompaction compacts to within the configured token threshold'

$clarificationSummary = Build-ClarificationSummary -FromAgent 'engineer' -TargetAgent 'architect' -Topic 'database indexing' -Exchanges @(
    @{ question = 'What index should we use?'; response = 'Use a composite index on tenant_id and created_at.'; iteration = 1; respondedBy = 'sub-agent' },
    @{ question = 'Any caveats?'; response = 'Keep write amplification in mind for high-ingest tables.'; iteration = 2; respondedBy = 'sub-agent' }
) -FinalAnswer 'Use the composite index and review ingest pressure before rollout.' -Resolved $true -EscalatedToHuman $false
Assert-True ($clarificationSummary -match 'Clarification Handoff') 'Build-ClarificationSummary emits a handoff heading'
Assert-True ($clarificationSummary -match 'From: engineer') 'Build-ClarificationSummary includes the source agent'
Assert-True ($clarificationSummary -match 'To: architect') 'Build-ClarificationSummary includes the target agent'
Assert-True ($clarificationSummary -match 'database indexing') 'Build-ClarificationSummary includes the clarification topic'
Assert-True ($clarificationSummary -match 'resolved') 'Build-ClarificationSummary includes the resolution status'

$consultingResearchDef = Read-AgentDef -agentName 'consulting-research' -root $script:repoRoot
Assert-True ($null -ne $consultingResearchDef) 'Read-AgentDef loads the Consulting Research definition'
Assert-True ($consultingResearchDef.constraints.Count -gt 0) 'Read-AgentDef parses multiline frontmatter constraints'
Assert-True ($consultingResearchDef.canModify -contains 'docs/coaching/**') 'Read-AgentDef parses nested can_modify boundaries'
Assert-True ($consultingResearchDef.cannotModify -contains 'src/**') 'Read-AgentDef parses nested cannot_modify boundaries'

$consultingResearchPrompt = Build-SystemPrompt -agentDef $consultingResearchDef -agentName 'consulting-research'
Assert-True ($consultingResearchPrompt -match '## Output Types') 'Build-SystemPrompt includes output type guidance for deliverable agents'
Assert-True ($consultingResearchPrompt -match 'docs/coaching/BRIEF-\{topic\}\.md') 'Build-SystemPrompt includes Consulting Research deliverable file targets'
Assert-True ($consultingResearchPrompt -match 'create or update the appropriate file in the workspace') 'Build-SystemPrompt explicitly instructs the agent to create required deliverable files'

$consultingResearchBoundaries = Read-BoundaryRules -AgentDef $consultingResearchDef
Assert-True ($consultingResearchBoundaries.canModify -contains 'docs/coaching/**') 'Read-BoundaryRules honors frontmatter can_modify entries'
Assert-True (-not (Test-BoundaryAllowed -FilePath 'src/app.ts' -Rules $consultingResearchBoundaries -WorkspaceRoot $script:repoRoot)) 'Test-BoundaryAllowed blocks Consulting Research writes outside allowed paths'
Assert-True (Test-BoundaryAllowed -FilePath 'docs/coaching/BRIEF-demo.md' -Rules $consultingResearchBoundaries -WorkspaceRoot $script:repoRoot) 'Test-BoundaryAllowed permits Consulting Research writes in coaching docs'

$tmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-runner-" + [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
try {
    $sessionMessages = @(
        @{ role = 'system'; content = 'system prompt' }
        @{ role = 'user'; content = 'initial request' }
    )
    $sessionMeta = @{
        sessionId = 'session-1'
        agentName = 'engineer'
        pendingHumanClarification = @{
            fromAgent = 'engineer'
            targetAgent = 'architect'
            topic = 'auth flow'
            question = 'Which auth path should we keep?'
            exchanges = @(
                @{ question = 'Which auth path should we keep?'; response = 'Need human input.'; iteration = 1; respondedBy = 'sub-agent' }
            )
        }
    }
    Save-Session -sessionId 'session-1' -messages $sessionMessages -meta $sessionMeta -root $tmpRoot
    $loadedSession = Read-Session -sessionId 'session-1' -root $tmpRoot
    Assert-True ($null -ne $loadedSession) 'Read-Session loads a saved session payload'
    Assert-Equal $loadedSession.meta.agentName 'engineer' 'Read-Session preserves session metadata'
    Assert-Equal $loadedSession.messages.Count 2 'Read-Session preserves saved messages'
} finally {
    Remove-Item $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host ' ================================================' -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Yellow' })
if ($script:fail -gt 0) {
    Write-Host " Failures: $($script:fail)" -ForegroundColor Red
}
Write-Host ''

exit $script:fail