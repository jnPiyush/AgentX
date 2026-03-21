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
Assert-True ($compacted[1].content -match '^\[Context Compaction(?: Summary)?\]') 'Invoke-ContextCompaction inserts a compaction summary message'
Assert-True ($compactionUsage.totalTokens -le $compactionUsage.thresholdTokens) 'Invoke-ContextCompaction compacts to within the configured token threshold'

$compactionSummaryContent = @"
[Context Compaction Summary]
Decisions
- Use PostgreSQL.
Preferences
- None
Constraints
- Stay within budget.
Open Questions
- None
Current State
- Migration pending.
Important References
- src/app.ts
"@
$summaryHeavyMessages = @(
    @{ role = 'system'; content = 'You are a test agent.' },
    @{ role = 'user'; content = $compactionSummaryContent }
)
for ($i = 0; $i -lt 15; $i++) {
    $summaryHeavyMessages += @{ role = 'assistant'; content = ('history ' + $i + ' ' + ('y' * 800)) }
}

$summaryCompacted = @(Invoke-ContextCompaction -Messages $summaryHeavyMessages -ModelId 'gpt-4o' -KeepRecent 6 -MinRecent 3 -ThresholdPercent 0.01)
$summaryMessages = @($summaryCompacted | Where-Object { $_.content -is [string] -and $_.content.StartsWith('[Context Compaction Summary]') })
Assert-Equal $summaryMessages.Count 1 'Invoke-ContextCompaction keeps a single merged compaction summary message'
Assert-True ($summaryMessages[0].content -match 'Decisions') 'Merged compaction summary preserves structured sections'

$script:compactionSummaryRequest = $null
$originalInvokeLlmChat = ${function:Invoke-LlmChat}
function Invoke-LlmChat {
    param(
        [string]$token,
        [string]$modelId,
        [array]$messages,
        [array]$tools,
        [hashtable]$RequestOptions = @{},
        [int]$maxTokens = 4096
    )

    $script:compactionSummaryRequest = @($messages)
    return @{
        choices = @(
            @{
                message = @{
                    content = @"
Decisions
- Use PostgreSQL.
- Capture the billing schema change.
Preferences
- None
Constraints
- Stay within budget.
Open Questions
- None
Current State
- Migration pending.
- Billing schema updated.
Important References
- src/app.ts
- docs/billing.md
"@
                }
            }
        )
    }
}

try {
    $llmSummaryMessages = @(
        @{ role = 'system'; content = 'You are a test agent.' },
        @{ role = 'user'; content = $compactionSummaryContent }
    )
    for ($i = 0; $i -lt 10; $i++) {
        $content = if ($i -eq 2) {
            'billing schema updated for invoice export and reconciliation'
        } else {
            'history ' + $i + ' ' + ('z' * 850)
        }
        $llmSummaryMessages += @{ role = 'assistant'; content = $content }
    }

    $llmSummaryCompacted = @(Invoke-ContextCompaction -Messages $llmSummaryMessages -Token 'fake-token' -ModelId 'gpt-4o' -KeepRecent 4 -MinRecent 3 -ThresholdPercent 0.01)
    $llmSummaryMessage = @($llmSummaryCompacted | Where-Object { $_.content -is [string] -and $_.content.StartsWith('[Context Compaction Summary]') })[0]
    Assert-True ($null -ne $script:compactionSummaryRequest) 'Invoke-ContextCompaction calls Invoke-LlmChat when a token is available for summary generation'
    Assert-True ($script:compactionSummaryRequest[1].content -match 'Previous Compaction Summary') 'Compaction summary request includes the prior summary context'
    Assert-True ($script:compactionSummaryRequest[1].content -match 'billing schema updated') 'Compaction summary request includes newly pruned turns'
    Assert-True ($llmSummaryMessage.content -match 'Capture the billing schema change') 'Compaction summary stores the merged LLM summary output'
    Assert-True ($llmSummaryMessage.content -match 'docs/billing\.md') 'Compaction summary preserves new important references from the merged summary'
} finally {
    ${function:Invoke-LlmChat} = $originalInvokeLlmChat
}

Push-ExecutionSummaryScope
Add-ExecutionSummaryEvent -Type 'COMPACTION' -Message 'Initial compaction event.'
Add-ExecutionSummaryEvent -Type 'COMPACTION' -Message 'Latest compaction event.' -ReplaceExisting
Add-ExecutionSummaryEvent -Type 'HUMAN RESPONSE' -Message 'Use the existing auth flow.' -ReplaceExisting
$executionSummaryEvents = @(Pop-ExecutionSummaryScope)
$executionSummary = Format-ExecutionSummary -Events $executionSummaryEvents
Assert-True ($executionSummary -match '\[EXECUTION SUMMARY\] COMPACTION: Latest compaction event\.') 'Format-ExecutionSummary keeps the latest replaceable event per type'
Assert-True (-not ($executionSummary -match 'Initial compaction event')) 'Format-ExecutionSummary replaces superseded singleton events'
Assert-True ($executionSummary -match '\[EXECUTION SUMMARY\] HUMAN RESPONSE: Use the existing auth flow\.') 'Format-ExecutionSummary includes other captured runtime events'

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

$architectDef = Read-AgentDef -agentName 'architect' -root $script:repoRoot
Assert-True ($architectDef.agents -contains 'AgentX Product Manager') 'Read-AgentDef parses multiline collaborator agents from frontmatter'
$architectClarifyTargets = @(Resolve-CanClarifyTargets -agentDef $architectDef)
Assert-True ($architectClarifyTargets -contains 'product-manager') 'Resolve-CanClarifyTargets maps Architect collaborators to runtime agent IDs'

$engineerDef = Read-AgentDef -agentName 'engineer' -root $script:repoRoot
$engineerClarifyTargets = @(Resolve-CanClarifyTargets -agentDef $engineerDef)
Assert-True ($engineerClarifyTargets -contains 'architect') 'Resolve-CanClarifyTargets keeps direct runtime agent IDs available for Engineer'
Assert-True ($engineerClarifyTargets -contains 'data-scientist') 'Resolve-CanClarifyTargets includes Data Scientist for Engineer alignment checkpoints'

$consultingResearchPrompt = Build-SystemPrompt -agentDef $consultingResearchDef -agentName 'consulting-research'
Assert-True ($consultingResearchPrompt -match '## Output Types') 'Build-SystemPrompt includes output type guidance for deliverable agents'
Assert-True ($consultingResearchPrompt -match 'docs/coaching/BRIEF-\{topic\}\.md') 'Build-SystemPrompt includes Consulting Research deliverable file targets'
Assert-True ($consultingResearchPrompt -match 'create or update the appropriate file in the workspace') 'Build-SystemPrompt explicitly instructs the agent to create required deliverable files'

$architectPrompt = Build-SystemPrompt -agentDef $architectDef -agentName 'architect'
Assert-True ($architectPrompt -match 'Use runtime agent IDs such as product-manager, architect, ux-designer, engineer, data-scientist') 'Build-SystemPrompt documents runtime agent IDs for clarification requests'

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

$runnerTestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-runner-loop-" + [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $runnerTestRoot -Force | Out-Null
try {
    $script:runnerMessages = [System.Collections.Generic.List[object]]::new()
    $script:runnerLlmCalls = 0
    $script:selfReviewCalls = 0

    function Get-GitHubToken { return 'fake-token' }
    function Initialize-ApiMode { param([string]$ghToken) $Script:ApiMode = 'models' }
    function Read-AgentDef { param([string]$agentName, [string]$root) return @{ name = $agentName; description = ''; model = ''; modelFallback = ''; body = ''; canModify = @(); cannotModify = @() } }
    function Get-ModelCandidates { param([string]$preferredModel, [string]$modelFallback) return @('gpt-4o') }
    function Build-SystemPrompt { param($agentDef, [string]$agentName) return 'system prompt' }
    function Get-ToolSchemas { return @() }
    function Save-Session { param($sessionId, $messages, $meta, $root) }
    function New-LoopDetector { return [PSCustomObject]@{} }
    function Add-LoopRecord { param($detector, $toolName, $paramsJson, $resultSnippet) }
    function Test-LoopDetection { param($detector) return @{ severity = 'none'; message = '' } }
    function Invoke-LlmChat {
        param($token, $modelId, $messages, $tools, $maxTokens)
        $script:runnerLlmCalls++
        $script:runnerMessages.Add(($messages[-1]).content) | Out-Null
        return [PSCustomObject]@{
            choices = @(
                [PSCustomObject]@{
                    message = [PSCustomObject]@{
                        content = 'Candidate final answer'
                        tool_calls = @()
                    }
                }
            )
        }
    }
    function Invoke-SelfReviewLoop {
        param($AgentName, $WorkOutput, $Token, $ModelId, $WorkspaceRoot, $MaxReviewerIterations)
        $script:selfReviewCalls++
        return @{ approved = $true; findings = @(); feedback = 'Looks good' }
    }

    $result = Invoke-AgenticLoop -Agent 'engineer' -Prompt 'Implement the login fix' -MaxIterations 6 -WorkspaceRoot $runnerTestRoot

    Assert-Equal $result.exitReason 'text_response' 'Invoke-AgenticLoop still exits normally after minimum self-review passes are met'
    Assert-Equal $script:selfReviewCalls 3 'Invoke-AgenticLoop requires three approved self-review passes before finishing'
    Assert-Equal $result.iterations 3 'Invoke-AgenticLoop continues the main loop until the minimum self-review passes are complete'
    Assert-True ($result.finalText -match '\[SELF-REVIEW SUMMARY\] Completed 3/3 required review iterations') 'Invoke-AgenticLoop appends a final self-review summary once the minimum passes are met'
    Assert-True ($result.finalText -match '\[SELF-REVIEW SUMMARY\] Iteration 3: APPROVED') 'Invoke-AgenticLoop records the final approved review iteration in the summary'
    $minimumReminderSeen = @($script:runnerMessages | Where-Object {
        $_ -match '^\[Self-Review MINIMUM NOT YET MET - Iteration 1/3\]' -and $_ -match 'every role must complete at least 3 self-review passes before finishing'
    }).Count -gt 0
    Assert-True $minimumReminderSeen 'Invoke-AgenticLoop injects a minimum-self-review reminder after the first approved pass'
} finally {
    Remove-Item Function:Get-GitHubToken -ErrorAction SilentlyContinue
    Remove-Item Function:Initialize-ApiMode -ErrorAction SilentlyContinue
    Remove-Item Function:Read-AgentDef -ErrorAction SilentlyContinue
    Remove-Item Function:Get-ModelCandidates -ErrorAction SilentlyContinue
    Remove-Item Function:Build-SystemPrompt -ErrorAction SilentlyContinue
    Remove-Item Function:Get-ToolSchemas -ErrorAction SilentlyContinue
    Remove-Item Function:Save-Session -ErrorAction SilentlyContinue
    Remove-Item Function:New-LoopDetector -ErrorAction SilentlyContinue
    Remove-Item Function:Add-LoopRecord -ErrorAction SilentlyContinue
    Remove-Item Function:Test-LoopDetection -ErrorAction SilentlyContinue
    Remove-Item Function:Invoke-LlmChat -ErrorAction SilentlyContinue
    Remove-Item Function:Invoke-SelfReviewLoop -ErrorAction SilentlyContinue
    Remove-Item $runnerTestRoot -Recurse -Force -ErrorAction SilentlyContinue
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