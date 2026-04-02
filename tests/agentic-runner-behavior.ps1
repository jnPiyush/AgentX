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

$originalLlmProviderEnv = $env:AGENTX_LLM_PROVIDER
$originalReadinessModeEnv = $env:AGENTX_LLM_READINESS_MODE

try {
    Assert-Equal (ConvertTo-RunnerProviderId 'models') 'github-models' 'ConvertTo-RunnerProviderId normalizes models alias'
    Assert-Equal (ConvertTo-RunnerProviderId 'github_models') 'github-models' 'ConvertTo-RunnerProviderId normalizes underscore alias'
    Assert-Equal (ConvertTo-RunnerProviderId 'copilot') 'copilot' 'ConvertTo-RunnerProviderId preserves copilot provider id'
    Assert-Equal (ConvertTo-RunnerProviderId 'claude') 'claude-code' 'ConvertTo-RunnerProviderId normalizes claude alias'
    Assert-Equal (ConvertTo-RunnerProviderId 'claude_code') 'claude-code' 'ConvertTo-RunnerProviderId normalizes claude_code alias'
    Assert-Equal (ConvertTo-RunnerProviderId 'anthropic') 'anthropic-api' 'ConvertTo-RunnerProviderId normalizes anthropic alias'
    Assert-Equal (ConvertTo-RunnerProviderId 'openai') 'openai-api' 'ConvertTo-RunnerProviderId normalizes openai alias'

    $env:AGENTX_LLM_PROVIDER = ''
    $env:AGENTX_LLM_READINESS_MODE = ''
    $defaultPreference = Get-RunnerProviderPreference @{ }
    Assert-Equal $defaultPreference.providerId 'auto' 'Get-RunnerProviderPreference defaults to auto when unset'
    Assert-Equal $defaultPreference.source 'default' 'Get-RunnerProviderPreference reports default source when unset'

    $configPreference = Get-RunnerProviderPreference ([PSCustomObject]@{ llmProvider = 'copilot' })
    Assert-Equal $configPreference.providerId 'copilot' 'Get-RunnerProviderPreference reads llmProvider from config'
    Assert-Equal $configPreference.source 'config' 'Get-RunnerProviderPreference reports config source'

    $env:AGENTX_LLM_PROVIDER = 'github-models'
    $envPreference = Get-RunnerProviderPreference ([PSCustomObject]@{ llmProvider = 'copilot' })
    Assert-Equal $envPreference.providerId 'github-models' 'Get-RunnerProviderPreference lets env override config'
    Assert-Equal $envPreference.source 'env' 'Get-RunnerProviderPreference reports env source'
    $env:AGENTX_LLM_PROVIDER = ''

    Assert-Equal (Get-RunnerReadinessMode -Config ([PSCustomObject]@{ }) -PreferredProviderId 'copilot') 'strict' 'Get-RunnerReadinessMode defaults explicit providers to strict mode'
    Assert-Equal (Get-RunnerReadinessMode -Config ([PSCustomObject]@{ }) -PreferredProviderId 'auto') 'advisory' 'Get-RunnerReadinessMode keeps auto selection advisory by default'
    Assert-Equal (Get-RunnerDefaultModel 'claude-code') 'claude-sonnet-4.6' 'Get-RunnerDefaultModel returns Claude default for claude-code provider'
    Assert-Equal (Get-RunnerDefaultModel 'anthropic-api') 'claude-sonnet-4.6' 'Get-RunnerDefaultModel returns Claude default for anthropic-api provider'
    Assert-Equal (Get-RunnerDefaultModel 'openai-api') 'gpt-5.4' 'Get-RunnerDefaultModel returns GPT default for openai-api provider'
    $claudeCapability = Get-RunnerModelCapability 'claude-sonnet-4.6'
    Assert-Equal $claudeCapability.contextWindow 200000 'Get-RunnerModelCapability returns Claude context window metadata'
    Assert-Equal $claudeCapability.reasoningMode 'claude-thinking' 'Get-RunnerModelCapability returns Claude reasoning metadata'
    Assert-True (Test-RunnerModelSupportedByProvider -ProviderId 'claude-code' -ModelId 'claude-sonnet-4.6') 'Test-RunnerModelSupportedByProvider accepts Claude model ids for claude-code'
    Assert-True (-not (Test-RunnerModelSupportedByProvider -ProviderId 'claude-code' -ModelId 'gpt-4o')) 'Test-RunnerModelSupportedByProvider rejects GPT models for claude-code'
    Assert-True (Test-RunnerModelSupportedByProvider -ProviderId 'anthropic-api' -ModelId 'claude-sonnet-4.6') 'Test-RunnerModelSupportedByProvider accepts Claude model ids for anthropic-api'
    Assert-True (Test-RunnerModelSupportedByProvider -ProviderId 'openai-api' -ModelId 'gpt-5.4') 'Test-RunnerModelSupportedByProvider accepts GPT model ids for openai-api'

    $providerRegistry = @{
        'copilot' = [PSCustomObject]@{ id = 'copilot'; displayName = 'Copilot API'; enabled = $true; ready = $true; reason = 'ready'; transport = 'copilot'; selectionSource = 'default'; authSource = 'gh' }
        'github-models' = [PSCustomObject]@{ id = 'github-models'; displayName = 'GitHub Models'; enabled = $true; ready = $true; reason = 'ready'; transport = 'models'; selectionSource = 'default'; authSource = 'gh' }
        'claude-code' = [PSCustomObject]@{ id = 'claude-code'; displayName = 'Claude Code'; enabled = $true; ready = $true; reason = 'ready'; transport = 'claude-code'; selectionSource = 'default'; authSource = 'claude' }
    }
    $selectedAuto = Select-RunnerProviderFromRegistry -Registry $providerRegistry -RequestedProviderId 'auto' -ReadinessMode 'advisory'
    Assert-Equal $selectedAuto.id 'copilot' 'Select-RunnerProviderFromRegistry prefers copilot in auto mode when ready'

    $providerRegistry['copilot'].ready = $false
    $selectedFallback = Select-RunnerProviderFromRegistry -Registry $providerRegistry -RequestedProviderId 'copilot' -ReadinessMode 'advisory'
    Assert-Equal $selectedFallback.id 'github-models' 'Select-RunnerProviderFromRegistry falls back in advisory mode when copilot is unavailable'

    $strictFailed = $false
    try {
        $null = Select-RunnerProviderFromRegistry -Registry $providerRegistry -RequestedProviderId 'copilot' -ReadinessMode 'strict'
    } catch {
        $strictFailed = $_.Exception.Message -match 'Copilot API is not ready'
    }
    Assert-True $strictFailed 'Select-RunnerProviderFromRegistry fails closed for explicit providers in strict mode'

    $selectedClaude = Select-RunnerProviderFromRegistry -Registry $providerRegistry -RequestedProviderId 'claude-code' -ReadinessMode 'strict'
    Assert-Equal $selectedClaude.id 'claude-code' 'Select-RunnerProviderFromRegistry selects claude-code when explicitly requested and ready'

    $providerRegistry['copilot'].ready = $true
} finally {
    $env:AGENTX_LLM_PROVIDER = $originalLlmProviderEnv
    $env:AGENTX_LLM_READINESS_MODE = $originalReadinessModeEnv
}

$originalTestRunnerCommandAvailable = ${function:Test-RunnerCommandAvailable}
$originalInvokeRunnerCommand = ${function:Invoke-RunnerCommand}
try {
    function Test-RunnerCommandAvailable {
        param([string]$CommandName)
        return ($CommandName -eq 'claude')
    }

    function Invoke-RunnerCommand {
        param([string]$FileName, [string[]]$Arguments = @())
        return [PSCustomObject]@{
            output = '{"authenticated":true}'
            exitCode = 0
        }
    }

    $claudeReady = Test-ClaudeCodeProviderReady
    Assert-True $claudeReady.ready 'Test-ClaudeCodeProviderReady reports ready when claude auth status succeeds'
    Assert-True ($claudeReady.reason -match 'authenticated') 'Test-ClaudeCodeProviderReady returns an authentication success reason'
} finally {
    ${function:Test-RunnerCommandAvailable} = $originalTestRunnerCommandAvailable
    ${function:Invoke-RunnerCommand} = $originalInvokeRunnerCommand
}

$parsedFallbacks = @(ConvertFrom-ModelFallbackList "['gpt-4.1', 'gpt-4o-mini']")
Assert-Equal $parsedFallbacks.Count 2 'ConvertFrom-ModelFallbackList returns two entries'
Assert-Equal $parsedFallbacks[0] 'gpt-4.1' 'ConvertFrom-ModelFallbackList trims quotes from first entry'
Assert-Equal $parsedFallbacks[1] 'gpt-4o-mini' 'ConvertFrom-ModelFallbackList trims quotes from second entry'

$modelCandidates = @(Get-ModelCandidateList -preferredModel 'Claude Sonnet 4.6 (copilot)' -modelFallback 'gpt-4o-mini, gpt-4.1')
Assert-Equal $modelCandidates.Count 3 'Get-ModelCandidateList deduplicates resolved models'
Assert-Equal $modelCandidates[0] 'gpt-4.1' 'Primary model is resolved first in GitHub Models mode'
Assert-Equal $modelCandidates[1] 'gpt-4o-mini' 'Fallback candidate is preserved after primary model'
Assert-Equal $modelCandidates[2] 'gpt-4o' 'Default model is appended as final fallback'

$Script:ActiveProvider = [PSCustomObject]@{ id = 'claude-code' }
$claudeModelCandidates = @(Get-ModelCandidateList -preferredModel 'Claude Sonnet 4.6' -modelFallback '')
Assert-Equal $claudeModelCandidates[0] 'claude-sonnet-4.6' 'Get-ModelCandidateList resolves Claude aliases for claude-code provider'
Assert-Equal $claudeModelCandidates[-1] 'claude-sonnet-4.6' 'Get-ModelCandidateList appends Claude default model for claude-code provider'
$Script:ActiveProvider = [PSCustomObject]@{ id = 'openai-api' }
$openAiModelCandidates = @(Get-ModelCandidateList -preferredModel 'GPT-5.4' -modelFallback 'gpt-4o')
Assert-Equal $openAiModelCandidates[0] 'gpt-5.4' 'Get-ModelCandidateList resolves GPT aliases for openai-api provider'
Assert-Equal $openAiModelCandidates[-1] 'gpt-4o' 'Get-ModelCandidateList preserves configured fallback for openai-api provider'
$Script:ActiveProvider = $null

$anthropicResponse = ConvertFrom-AnthropicResponse ([PSCustomObject]@{
    stop_reason = 'tool_use'
    content = @(
        [PSCustomObject]@{ type = 'text'; text = 'Need to inspect the workspace.' },
        [PSCustomObject]@{ type = 'tool_use'; id = 'toolu_123'; name = 'list_dir'; input = @{ dirPath = 'docs' } }
    )
})
Assert-Equal $anthropicResponse.choices[0].message.content 'Need to inspect the workspace.' 'ConvertFrom-AnthropicResponse preserves text content'
Assert-Equal $anthropicResponse.choices[0].message.tool_calls[0].function.name 'list_dir' 'ConvertFrom-AnthropicResponse normalizes Anthropic tool use blocks'

Assert-Equal (ConvertTo-ClaudeCodeModelId 'claude-sonnet-4.6') 'claude-sonnet-4-6' 'ConvertTo-ClaudeCodeModelId normalizes dot-version Claude model ids for CLI usage'

$claudeToolList = Get-ClaudeCodeAllowedTools @(
    @{ function = @{ name = 'file_read' } },
    @{ function = @{ name = 'file_edit' } },
    @{ function = @{ name = 'terminal_exec' } },
    @{ function = @{ name = 'list_dir' } }
)
Assert-Equal $claudeToolList 'Read,Edit,Bash,Glob' 'Get-ClaudeCodeAllowedTools maps AgentX tools to Claude Code built-ins'

$claudeNormalized = ConvertFrom-ClaudeCodeResponse '{"result":"Updated the auth flow and added tests.","session_id":"abc"}'
Assert-Equal $claudeNormalized.choices[0].message.content 'Updated the auth flow and added tests.' 'ConvertFrom-ClaudeCodeResponse normalizes json result payloads'

$claudeRawText = ConvertFrom-ClaudeCodeResponse 'Plain text response from Claude Code'
Assert-Equal $claudeRawText.choices[0].message.content 'Plain text response from Claude Code' 'ConvertFrom-ClaudeCodeResponse falls back to raw text when output is not json'

$originalInvokeRunnerCommandWithInput = ${function:Invoke-RunnerCommandWithInput}
try {
    function Invoke-RunnerCommandWithInput {
        param([string]$FileName, [string[]]$Arguments = @(), [string]$InputText = '')
        return [PSCustomObject]@{
            output = '{"result":"Claude bridge executed successfully."}'
            exitCode = 0
        }
    }

    $claudeResponse = Invoke-ClaudeCodePrintMode -ModelId 'claude-sonnet-4.6' -Messages @(
        @{ role = 'system'; content = 'Follow repo rules.' },
        @{ role = 'user'; content = 'Inspect the workspace and summarize the next step.' }
    ) -Tools @(
        @{ function = @{ name = 'file_read' } },
        @{ function = @{ name = 'grep_search' } }
    ) -RequestOptions @{ effort = 'medium' }
    Assert-Equal $claudeResponse.choices[0].message.content 'Claude bridge executed successfully.' 'Invoke-ClaudeCodePrintMode returns normalized Claude Code output'
} finally {
    ${function:Invoke-RunnerCommandWithInput} = $originalInvokeRunnerCommandWithInput
}

Assert-True (Test-IsModelAvailabilityError 'Copilot API error (HTTP 404): model not found') 'Model availability detector matches model-not-found errors'
Assert-True (-not (Test-IsModelAvailabilityError 'Copilot API error (HTTP 429): rate limit exceeded')) 'Model availability detector ignores rate-limit errors'

Assert-Equal (Get-ModelContextWindow 'gpt-4o') 128000 'Get-ModelContextWindow returns GPT-4o context size'
Assert-Equal (Get-ModelContextWindow 'claude-sonnet-4.6') 200000 'Get-ModelContextWindow returns Claude context size'

$Script:ActiveProvider = [PSCustomObject]@{ id = 'copilot' }
$gptReasoning = Get-ReasoningRequestConfig -agentDef @{ reasoningLevel = 'high' } -modelId 'gpt-5.4'
Assert-Equal $gptReasoning.reasoning.effort 'high' 'Get-ReasoningRequestConfig uses metadata-driven GPT reasoning support'

$Script:ActiveProvider = [PSCustomObject]@{ id = 'claude-code' }
$claudeCliReasoning = Get-ReasoningRequestConfig -agentDef @{ reasoningLevel = 'medium' } -modelId 'claude-sonnet-4.6'
Assert-Equal $claudeCliReasoning.effort 'medium' 'Get-ReasoningRequestConfig emits Claude Code effort settings for Claude models'

$originalClaudeBridge = ${function:Invoke-ClaudeCodePrintMode}
try {
    function Invoke-ClaudeCodePrintMode {
        param(
            [string]$ModelId,
            [array]$Messages,
            [array]$Tools,
            [hashtable]$RequestOptions = @{}
        )

        return @{
            choices = @(
                @{
                    message = @{
                        content = 'Claude Code handled the request.'
                        tool_calls = @()
                    }
                    finish_reason = 'stop'
                }
            )
        }
    }

    $claudeBridgeResponse = Invoke-LlmChat -token '' -modelId 'claude-sonnet-4.6' -messages @(@{ role = 'user'; content = 'hello' }) -tools @() -RequestOptions @{ effort = 'medium' }
    Assert-Equal $claudeBridgeResponse.choices[0].message.content 'Claude Code handled the request.' 'Invoke-LlmChat routes claude-code provider requests through the Claude bridge'
} finally {
    ${function:Invoke-ClaudeCodePrintMode} = $originalClaudeBridge
}

    $Script:ActiveProvider = [PSCustomObject]@{ id = 'copilot' }
$claudeReasoning = Get-ReasoningRequestConfig -agentDef @{ reasoningLevel = 'medium' } -modelId 'claude-sonnet-4.6'
Assert-Equal $claudeReasoning.thinking.type 'adaptive' 'Get-ReasoningRequestConfig uses metadata-driven Claude reasoning support'
$Script:ActiveProvider = $null

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

$boundedSessionSummary = Build-BoundedSessionSummary -Messages @(
    @{ role = 'system'; content = 'system prompt' },
    @{ role = 'user'; content = 'Implement the login flow with bounded session state.' },
    @{ role = 'assistant'; content = "[Context Compaction Summary]`nDecisions`n- Keep login simple.`nCurrent State`n- Need regression coverage." }
) -FinalText ('Resolved the flow and added regression coverage. ' + ('x' * 240)) -ExecutionSummaryEvents @(
    @{ type = 'WARN'; message = 'A fallback path was used.' }
) -MaxChars 180
Assert-True ($boundedSessionSummary.Length -le 180) 'Build-BoundedSessionSummary enforces the configured character budget'
Assert-True ($boundedSessionSummary -match 'Prompt:') 'Build-BoundedSessionSummary includes the initial user prompt preview'
Assert-True ($boundedSessionSummary -match 'Execution:') 'Build-BoundedSessionSummary includes execution summary context when present'

$researchWriteBlock = Test-ResearchFirstToolUse -Mode 'enforced' -ExplorationCount 0 -ToolName 'file_edit'
Assert-True $researchWriteBlock.blocked 'Test-ResearchFirstToolUse blocks writes before enough exploration in enforced mode'
Assert-True ($researchWriteBlock.reason -match 'requires at least 2 read-only exploration steps') 'Test-ResearchFirstToolUse explains the research-first block reason'

$researchReadOnly = Test-ResearchFirstToolUse -Mode 'enforced' -ExplorationCount 0 -ToolName 'grep_search'
Assert-Equal $researchReadOnly.explorationDelta 1 'Test-ResearchFirstToolUse counts read-only exploration steps'
Assert-True (-not $researchReadOnly.blocked) 'Test-ResearchFirstToolUse allows read-only exploration in enforced mode'

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
$architectClarifyTargets = @(Resolve-ClarificationTargetList -agentDef $architectDef)
Assert-True ($architectClarifyTargets -contains 'product-manager') 'Resolve-ClarificationTargetList maps Architect collaborators to runtime agent IDs'

$engineerDef = Read-AgentDef -agentName 'engineer' -root $script:repoRoot
$engineerClarifyTargets = @(Resolve-ClarificationTargetList -agentDef $engineerDef)
Assert-True ($engineerClarifyTargets -contains 'architect') 'Resolve-ClarificationTargetList keeps direct runtime agent IDs available for Engineer'
Assert-True ($engineerClarifyTargets -contains 'data-scientist') 'Resolve-ClarificationTargetList includes Data Scientist for Engineer alignment checkpoints'

$consultingResearchPrompt = Build-SystemPrompt -agentDef $consultingResearchDef -agentName 'consulting-research'
Assert-True ($consultingResearchPrompt -match '## Output Types') 'Build-SystemPrompt includes output type guidance for deliverable agents'
Assert-True ($consultingResearchPrompt -match 'docs/coaching/BRIEF-\{topic\}\.md') 'Build-SystemPrompt includes Consulting Research deliverable file targets'
Assert-True ($consultingResearchPrompt -match 'create or update the appropriate file in the workspace') 'Build-SystemPrompt explicitly instructs the agent to create required deliverable files'

$architectPrompt = Build-SystemPrompt -agentDef $architectDef -agentName 'architect'
Assert-True ($architectPrompt -match 'Use runtime agent IDs such as product-manager, architect, ux-designer, engineer, data-scientist') 'Build-SystemPrompt documents runtime agent IDs for clarification requests'

$consultingResearchBoundaries = Read-BoundaryRuleSet -AgentDef $consultingResearchDef
Assert-True ($consultingResearchBoundaries.canModify -contains 'docs/coaching/**') 'Read-BoundaryRuleSet honors frontmatter can_modify entries'
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
    $loopStateDir = Join-Path $runnerTestRoot '.agentx\state'
    New-Item -ItemType Directory -Path $loopStateDir -Force | Out-Null
    $loopStatePath = Join-Path $loopStateDir 'loop-state.json'
    $currentLoopTimestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')

    $script:runnerMessages = [System.Collections.Generic.List[object]]::new()
    $script:runnerLlmCalls = 0
    $script:selfReviewCalls = 0
    $script:lastSavedSessionMeta = $null

    function Get-GitHubToken { return 'fake-token' }
    function Initialize-ApiMode { param([string]$ghToken) $Script:ApiMode = 'models' }
    function Read-AgentDef { param([string]$agentName, [string]$root) return @{ name = $agentName; description = ''; model = ''; modelFallback = ''; body = ''; canModify = @(); cannotModify = @() } }
    function Get-ModelCandidateList { param([string]$preferredModel, [string]$modelFallback) return @('gpt-4o') }
    function Build-SystemPrompt { param($agentDef, [string]$agentName) return 'system prompt' }
    function Get-ToolSchemaList { return @() }
    function Save-Session {
        param($sessionId, $messages, $meta, $root)
        $script:lastSavedSessionMeta = $meta
    }
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

    @{
        active = $true
        status = 'active'
        issueNumber = 0
        iteration = 1
        minIterations = 5
        maxIterations = 20
        completionCriteria = 'TASK_COMPLETE'
        startedAt = $currentLoopTimestamp
        lastIterationAt = $currentLoopTimestamp
        history = @(
            @{
                iteration = 1
            timestamp = $currentLoopTimestamp
                summary = 'Loop started'
                status = 'active'
                outcome = 'pending'
            }
        )
    } | ConvertTo-Json -Depth 6 | Set-Content -Path $loopStatePath -Encoding UTF8

    $result = Invoke-AgenticLoop -Agent 'engineer' -Prompt 'Implement the login fix' -MaxIterations 10 -WorkspaceRoot $runnerTestRoot
    $syncedLoopState = Get-Content -Path $loopStatePath -Raw | ConvertFrom-Json

    Assert-Equal $result.exitReason 'text_response' 'Invoke-AgenticLoop still exits normally after minimum self-review passes are met'
    Assert-Equal $script:selfReviewCalls 5 'Invoke-AgenticLoop requires five approved self-review passes before finishing'
    Assert-Equal $result.iterations 5 'Invoke-AgenticLoop continues the main loop until the minimum self-review passes are complete'
    Assert-True ($result.finalText -match '\[SELF-REVIEW SUMMARY\] Completed 5/5 required review iterations') 'Invoke-AgenticLoop appends a final self-review summary once the minimum passes are met'
    Assert-True ($result.finalText -match '\[SELF-REVIEW SUMMARY\] Iteration 5: APPROVED') 'Invoke-AgenticLoop records the final approved review iteration in the summary'
    Assert-Equal $syncedLoopState.status 'complete' 'Invoke-AgenticLoop marks the active loop complete after a successful run'
    Assert-True (-not $syncedLoopState.active) 'Invoke-AgenticLoop clears the active loop flag after a successful run'
    Assert-Equal ([int]$syncedLoopState.iteration) 5 'Invoke-AgenticLoop syncs the loop iteration count to the enforced minimum review passes'
    $minimumReminderSeen = @($script:runnerMessages | Where-Object {
        $_ -match '^\[Self-Review MINIMUM NOT YET MET - Iteration 1/5\]' -and $_ -match 'every role must complete at least 5 self-review passes before finishing'
    }).Count -gt 0
    Assert-True $minimumReminderSeen 'Invoke-AgenticLoop injects a minimum-self-review reminder after the first approved pass'
    Assert-True ($null -ne $script:lastSavedSessionMeta.sessionSummary) 'Invoke-AgenticLoop saves a bounded session summary in session metadata'
    Assert-True ([string]$script:lastSavedSessionMeta.sessionSummary).Length -le 1600 'Invoke-AgenticLoop bounds the saved session summary length'

    @{
        active = $true
        status = 'active'
        issueNumber = 0
        iteration = 1
        minIterations = 5
        maxIterations = 20
        completionCriteria = 'TASK_COMPLETE'
        startedAt = $currentLoopTimestamp
        lastIterationAt = $currentLoopTimestamp
        history = @(
            @{
                iteration = 1
            timestamp = $currentLoopTimestamp
                summary = 'Loop started'
                status = 'active'
                outcome = 'pending'
            }
        )
    } | ConvertTo-Json -Depth 6 | Set-Content -Path $loopStatePath -Encoding UTF8

    $script:runnerMessages.Clear()
    $script:selfReviewCalls = 0
    $skipResult = Invoke-AgenticLoop -Agent 'engineer' -Prompt 'Answer the clarification request' -MaxIterations 10 -WorkspaceRoot $runnerTestRoot -SkipLoopStateSync
    $unsyncedLoopState = Get-Content -Path $loopStatePath -Raw | ConvertFrom-Json

    Assert-Equal $skipResult.exitReason 'text_response' 'Invoke-AgenticLoop still completes successfully when loop-state sync is skipped'
    Assert-Equal $unsyncedLoopState.status 'active' 'Invoke-AgenticLoop leaves the parent loop active when SkipLoopStateSync is used'
    Assert-True $unsyncedLoopState.active 'Invoke-AgenticLoop preserves the active loop flag when SkipLoopStateSync is used'
    Assert-Equal ([int]$unsyncedLoopState.iteration) 1 'Invoke-AgenticLoop does not mutate loop iterations when SkipLoopStateSync is used'
} finally {
    Remove-Item Function:Get-GitHubToken -ErrorAction SilentlyContinue
    Remove-Item Function:Initialize-ApiMode -ErrorAction SilentlyContinue
    Remove-Item Function:Read-AgentDef -ErrorAction SilentlyContinue
    Remove-Item Function:Get-ModelCandidateList -ErrorAction SilentlyContinue
    Remove-Item Function:Build-SystemPrompt -ErrorAction SilentlyContinue
    Remove-Item Function:Get-ToolSchemaList -ErrorAction SilentlyContinue
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