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

Assert-True (Test-AgenticLoopResultSucceeded ([PSCustomObject]@{ exitReason = 'text_response' })) 'agentic result helper accepts completed text responses'
foreach ($failedExitReason in @('self_review_failed', 'error', 'empty_response', 'human_required', 'circuit_breaker', 'max_iterations')) {
    Assert-True (-not (Test-AgenticLoopResultSucceeded ([PSCustomObject]@{ exitReason = $failedExitReason }))) "agentic result helper rejects $failedExitReason"
}
Assert-True (-not (Test-AgenticLoopResultSucceeded $null)) 'agentic result helper rejects missing results'

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
    Assert-Equal (Get-RunnerDefaultModel 'claude-code') 'claude-opus-4.8' 'Get-RunnerDefaultModel returns Claude default for claude-code provider'
    Assert-Equal (Get-RunnerDefaultModel 'anthropic-api') 'claude-opus-4.8' 'Get-RunnerDefaultModel returns Claude default for anthropic-api provider'
    Assert-Equal (Get-RunnerDefaultModel 'openai-api') 'gpt-5.5' 'Get-RunnerDefaultModel returns GPT default for openai-api provider'
    $claudeCapability = Get-RunnerModelCapability 'claude-opus-4.8'
    Assert-Equal $claudeCapability.contextWindow 200000 'Get-RunnerModelCapability returns Claude context window metadata'
    Assert-Equal $claudeCapability.reasoningMode 'claude-thinking' 'Get-RunnerModelCapability returns Claude reasoning metadata'
    Assert-True (Test-RunnerModelSupportedByProvider -ProviderId 'claude-code' -ModelId 'claude-opus-4.8') 'Test-RunnerModelSupportedByProvider accepts Claude model ids for claude-code'
    Assert-True (-not (Test-RunnerModelSupportedByProvider -ProviderId 'claude-code' -ModelId 'gpt-4o')) 'Test-RunnerModelSupportedByProvider rejects GPT models for claude-code'
    Assert-True (Test-RunnerModelSupportedByProvider -ProviderId 'anthropic-api' -ModelId 'claude-opus-4.8') 'Test-RunnerModelSupportedByProvider accepts Claude model ids for anthropic-api'
    Assert-True (Test-RunnerModelSupportedByProvider -ProviderId 'openai-api' -ModelId 'gpt-5.5') 'Test-RunnerModelSupportedByProvider accepts GPT model ids for openai-api'

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
$originalReadAgentDef = ${function:Read-AgentDef}
$originalGetToolSchemaList = ${function:Get-ToolSchemaList}
$originalGetLoopDetector = ${function:Get-LoopDetector}
$originalGetReasoningRequestConfig = ${function:Get-ReasoningRequestConfig}
$originalInvokeLlmChat = ${function:Invoke-LlmChat}
${function:Read-AgentDef} = {
    param($agentName, $root)
    return @{ name = $agentName; description = ''; model = ''; body = '' }
}
${function:Get-ToolSchemaList} = {
    @(
        [PSCustomObject]@{ function = [PSCustomObject]@{ name = 'file_read' } }
        [PSCustomObject]@{ function = [PSCustomObject]@{ name = 'grep_search' } }
        [PSCustomObject]@{ function = [PSCustomObject]@{ name = 'list_dir' } }
    )
}
${function:Get-LoopDetector} = {
    @{
        history = [System.Collections.ArrayList]::new()
        windowSize = 30
        warningThreshold = 10
        circuitBreakerThreshold = 20
    }
}
${function:Get-ReasoningRequestConfig} = { param($agentDef, $modelId) return @{} }
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

    ${function:Invoke-LlmChat} = {
        param($token, $modelId, $messages, $tools, $RequestOptions, $maxTokens)
        throw 'synthetic reviewer failure'
    }
    $reviewFailure = Invoke-SelfReviewLoop -AgentName 'engineer' -WorkOutput 'done' -Token 't' -ModelId 'gpt-4o' -WorkspaceRoot $script:repoRoot
    Assert-Equal ([bool]$reviewFailure.approved) $false 'Invoke-SelfReviewLoop fails closed when reviewer LLM execution fails'
    Assert-True (([string]$reviewFailure.feedback) -match 'Quality gate not satisfied') 'Invoke-SelfReviewLoop returns actionable failure feedback on reviewer errors'

    ${function:Invoke-LlmChat} = {
        param($token, $modelId, $messages, $tools, $RequestOptions, $maxTokens)
        return [PSCustomObject]@{
            choices = @([PSCustomObject]@{
                message = [PSCustomObject]@{
                    content = ''
                    tool_calls = @([PSCustomObject]@{
                        id = 'review-tool-1'
                        function = [PSCustomObject]@{ name = 'list_dir'; arguments = '{"dirPath":"."}' }
                    })
                }
            })
        }
    }
    $reviewExhausted = Invoke-SelfReviewLoop -AgentName 'engineer' -WorkOutput 'done' -Token 't' -ModelId 'gpt-4o' -WorkspaceRoot $script:repoRoot -MaxReviewerIterations 1
    Assert-Equal ([bool]$reviewExhausted.approved) $false 'Invoke-SelfReviewLoop fails closed when reviewer tool turns exhaust without a verdict'
    Assert-True (([string]$reviewExhausted.feedback) -match 'did not approve') 'Reviewer exhaustion returns non-approval feedback'

    ${function:Invoke-LlmChat} = {
        param($token, $modelId, $messages, $tools, $RequestOptions, $maxTokens)
        return [PSCustomObject]@{
            choices = @([PSCustomObject]@{
                message = [PSCustomObject]@{
                    content = (@(
                        '```review'
                        'APPROVED: true'
                        '- Correctness: PASS'
                        '- Security: PASS'
                        '- Testing: PASS'
                        'FINDINGS:'
                        '```'
                    ) -join "`n")
                    tool_calls = @()
                }
            })
        }
    }
    $reviewApproved = Invoke-SelfReviewLoop -AgentName 'engineer' -WorkOutput 'done' -Token 't' -ModelId 'gpt-4o' -WorkspaceRoot $script:repoRoot -MaxReviewerIterations 1
    Assert-Equal ([bool]$reviewApproved.approved) $true 'Invoke-SelfReviewLoop accepts an explicit positive structured verdict'
    Assert-Equal @($reviewApproved.findings).Count 0 'Explicit clean review records zero findings'
} finally {
    ${function:Test-RunnerCommandAvailable} = $originalTestRunnerCommandAvailable
    ${function:Invoke-RunnerCommand} = $originalInvokeRunnerCommand
    if ($null -ne $originalReadAgentDef) { ${function:Read-AgentDef} = $originalReadAgentDef } else { Remove-Item Function:Read-AgentDef -ErrorAction SilentlyContinue }
    if ($null -ne $originalGetToolSchemaList) { ${function:Get-ToolSchemaList} = $originalGetToolSchemaList } else { Remove-Item Function:Get-ToolSchemaList -ErrorAction SilentlyContinue }
    if ($null -ne $originalGetLoopDetector) { ${function:Get-LoopDetector} = $originalGetLoopDetector } else { Remove-Item Function:Get-LoopDetector -ErrorAction SilentlyContinue }
    if ($null -ne $originalGetReasoningRequestConfig) { ${function:Get-ReasoningRequestConfig} = $originalGetReasoningRequestConfig } else { Remove-Item Function:Get-ReasoningRequestConfig -ErrorAction SilentlyContinue }
    if ($null -ne $originalInvokeLlmChat) { ${function:Invoke-LlmChat} = $originalInvokeLlmChat } else { Remove-Item Function:Invoke-LlmChat -ErrorAction SilentlyContinue }
}

$parsedFallbacks = @(ConvertFrom-ModelFallbackList "['gpt-4.1', 'gpt-4o-mini']")
Assert-Equal $parsedFallbacks.Count 2 'ConvertFrom-ModelFallbackList returns two entries'
Assert-Equal $parsedFallbacks[0] 'gpt-4.1' 'ConvertFrom-ModelFallbackList trims quotes from first entry'
Assert-Equal $parsedFallbacks[1] 'gpt-4o-mini' 'ConvertFrom-ModelFallbackList trims quotes from second entry'

$modelCandidates = @(Get-ModelCandidateList -preferredModel 'Claude Opus 4.8 (copilot)' -modelFallback 'gpt-4o-mini, gpt-4.1')
Assert-Equal $modelCandidates.Count 3 'Get-ModelCandidateList deduplicates resolved models'
Assert-Equal $modelCandidates[0] 'gpt-4.1' 'Primary model is resolved first in GitHub Models mode'
Assert-Equal $modelCandidates[1] 'gpt-4o-mini' 'Fallback candidate is preserved after primary model'
Assert-Equal $modelCandidates[2] 'gpt-4o' 'Default model is appended as final fallback'

$Script:ActiveProvider = [PSCustomObject]@{ id = 'claude-code' }
$claudeModelCandidates = @(Get-ModelCandidateList -preferredModel 'Claude Opus 4.8' -modelFallback '')
Assert-Equal $claudeModelCandidates[0] 'claude-opus-4.8' 'Get-ModelCandidateList resolves Claude aliases for claude-code provider'
Assert-Equal $claudeModelCandidates[-1] 'claude-opus-4.8' 'Get-ModelCandidateList appends Claude default model for claude-code provider'
$Script:ActiveProvider = [PSCustomObject]@{ id = 'openai-api' }
$openAiModelCandidates = @(Get-ModelCandidateList -preferredModel 'GPT-5.5' -modelFallback 'gpt-4o')
Assert-Equal $openAiModelCandidates[0] 'gpt-5.5' 'Get-ModelCandidateList resolves GPT aliases for openai-api provider'
Assert-Equal $openAiModelCandidates[-1] 'gpt-4o' 'Get-ModelCandidateList preserves configured fallback for openai-api provider'
$Script:ActiveProvider = $null

# Opus 5 is the declared frontmatter label for 9 agents. Without an explicit alias
# key it would fall through to the provider default, so pin the resolution per
# provider and assert the older Opus aliases still win their own longest match.
$opus5Capability = Get-RunnerModelCapability 'claude-opus-5'
Assert-True ($null -ne $opus5Capability) 'Get-RunnerModelCapability exposes claude-opus-5'
Assert-Equal $opus5Capability.reasoningMode 'claude-thinking' 'claude-opus-5 advertises Claude thinking reasoning metadata'

$Script:ActiveProvider = [PSCustomObject]@{ id = 'copilot' }
Assert-Equal (Resolve-ModelId 'Claude Opus 5 (copilot)') 'claude-opus-5' 'Resolve-ModelId maps the Opus 5 frontmatter label for copilot'
Assert-Equal (Resolve-ModelId 'Claude Opus 4.8 (copilot)') 'claude-opus-4.8' 'Opus 5 aliases do not shadow the Opus 4.8 label'
Assert-Equal (Resolve-ModelId 'GPT-5.5 (copilot)') 'gpt-5.5' 'Opus 5 aliases do not shadow GPT labels'
$Script:ActiveProvider = [PSCustomObject]@{ id = 'anthropic-api' }
Assert-Equal (Resolve-ModelId 'Claude Opus 5 (copilot)') 'claude-opus-5' 'Resolve-ModelId maps the Opus 5 label for anthropic-api'
$Script:ActiveProvider = [PSCustomObject]@{ id = 'github-models' }
Assert-Equal (Resolve-ModelId 'Claude Opus 5 (copilot)') 'gpt-4.1' 'GitHub Models downgrades the Opus 5 label to a supported GPT model'
$Script:ActiveProvider = $null

# Sonnet 5 is the declared frontmatter label for 7 agents. Pin its provider
# resolution and ensure the generic Sonnet alias cannot shadow it.
$sonnet5Capability = Get-RunnerModelCapability 'claude-sonnet-5'
Assert-True ($null -ne $sonnet5Capability) 'Get-RunnerModelCapability exposes claude-sonnet-5'
Assert-Equal $sonnet5Capability.contextWindow 1000000 'claude-sonnet-5 advertises its 1M token context window'
Assert-Equal $sonnet5Capability.reasoningMode 'claude-thinking' 'claude-sonnet-5 advertises Claude thinking reasoning metadata'

$Script:ActiveProvider = [PSCustomObject]@{ id = 'copilot' }
Assert-Equal (Resolve-ModelId 'Claude Sonnet 5 (copilot)') 'claude-sonnet-5' 'Resolve-ModelId maps the Sonnet 5 frontmatter label for copilot'
Assert-Equal (Resolve-ModelId 'Claude Sonnet 4.5 (copilot)') 'claude-sonnet-4.5' 'Sonnet 5 aliases do not shadow the Sonnet 4.5 label'
$sonnet45Capability = Get-RunnerModelCapability 'claude-sonnet-4.5'
Assert-True ($sonnet45Capability.providers -contains 'copilot') 'claude-sonnet-4.5 capability supports copilot'
$Script:ActiveProvider = [PSCustomObject]@{ id = 'claude-code' }
Assert-Equal (Resolve-ModelId 'Claude Sonnet 5 (copilot)') 'claude-sonnet-5' 'Resolve-ModelId maps the Sonnet 5 label for claude-code'
Assert-Equal (Resolve-ModelId 'Claude Sonnet 4.5 (copilot)') 'claude-sonnet-4.5' 'Resolve-ModelId maps the Sonnet 4.5 label for claude-code'
Assert-True ($sonnet45Capability.providers -contains 'claude-code') 'claude-sonnet-4.5 capability supports claude-code'
$Script:ActiveProvider = [PSCustomObject]@{ id = 'anthropic-api' }
Assert-Equal (Resolve-ModelId 'Claude Sonnet 5 (copilot)') 'claude-sonnet-5' 'Resolve-ModelId maps the Sonnet 5 label for anthropic-api'
Assert-Equal (Resolve-ModelId 'Claude Sonnet 4.5 (copilot)') 'claude-sonnet-4.5' 'Resolve-ModelId maps the Sonnet 4.5 label for anthropic-api'
Assert-True ($sonnet45Capability.providers -contains 'anthropic-api') 'claude-sonnet-4.5 capability supports anthropic-api'
$Script:ActiveProvider = [PSCustomObject]@{ id = 'github-models' }
Assert-Equal (Resolve-ModelId 'Claude Sonnet 5 (copilot)') 'gpt-4.1' 'GitHub Models downgrades the Sonnet 5 label to a supported GPT model'
$Script:ActiveProvider = $null

$pickerPath = Join-Path $repoRoot 'vscode-extension\src\commands\addAgentInternals.ts'
$pickerContent = Get-Content $pickerPath -Raw
Assert-True ($pickerContent -match 'Claude Sonnet 5 \(copilot\)') 'custom-agent model picker exposes Claude Sonnet 5'

$freshUtcDate = [datetime]::SpecifyKind([datetime]'2026-06-11T12:34:56', [System.DateTimeKind]::Utc)
$parsedUtcDate = Get-LoopStateLastTouchedUtc ([PSCustomObject]@{ lastIterationAt = $freshUtcDate })
Assert-Equal $parsedUtcDate.UtcDateTime $freshUtcDate 'runner loop-state parser preserves the UTC instant of materialized JSON timestamps'

$anthropicResponse = ConvertFrom-AnthropicResponse ([PSCustomObject]@{
    stop_reason = 'tool_use'
    content = @(
        [PSCustomObject]@{ type = 'text'; text = 'Need to inspect the workspace.' },
        [PSCustomObject]@{ type = 'tool_use'; id = 'toolu_123'; name = 'list_dir'; input = @{ dirPath = 'docs' } }
    )
})
Assert-Equal $anthropicResponse.choices[0].message.content 'Need to inspect the workspace.' 'ConvertFrom-AnthropicResponse preserves text content'
Assert-Equal $anthropicResponse.choices[0].message.tool_calls[0].function.name 'list_dir' 'ConvertFrom-AnthropicResponse normalizes Anthropic tool use blocks'

Assert-Equal (ConvertTo-ClaudeCodeModelId 'claude-opus-4.8') 'claude-opus-4-8' 'ConvertTo-ClaudeCodeModelId normalizes dot-version Claude model ids for CLI usage'

$claudeToolList = Get-ClaudeCodeAllowedTool @(
    @{ function = @{ name = 'file_read' } },
    @{ function = @{ name = 'file_edit' } },
    @{ function = @{ name = 'terminal_exec' } },
    @{ function = @{ name = 'list_dir' } }
)
Assert-Equal $claudeToolList '""' 'Claude Code native tools stay disabled until they route through AgentX guards'

$providerTools = Get-AgentProviderToolSchema -AgentName 'engineer' -Tools @(
    @{ function = @{ name = 'file_read' } },
    @{ function = @{ name = 'terminal_exec' } }
)
Assert-Equal @($providerTools).Count 1 'autonomous provider schema removes terminal_exec for normal agents'
Assert-Equal ([string]$providerTools.function.name) 'file_read' 'autonomous provider schema preserves guarded file tools'

$claudeNormalized = ConvertFrom-ClaudeCodeResponse '{"result":"Updated the auth flow and added tests.","session_id":"abc"}'
Assert-Equal $claudeNormalized.choices[0].message.content 'Updated the auth flow and added tests.' 'ConvertFrom-ClaudeCodeResponse normalizes json result payloads'

$claudeRawText = ConvertFrom-ClaudeCodeResponse 'Plain text response from Claude Code'
Assert-Equal $claudeRawText.choices[0].message.content 'Plain text response from Claude Code' 'ConvertFrom-ClaudeCodeResponse falls back to raw text when output is not json'

$originalInvokeRunnerCommandWithInput = ${function:Invoke-RunnerCommandWithInput}
try {
    $script:capturedClaudeArguments = @()
    function Invoke-RunnerCommandWithInput {
        param([string]$FileName, [string[]]$Arguments = @(), [string]$InputText = '')
        $script:capturedClaudeArguments = @($Arguments)
        return [PSCustomObject]@{
            output = '{"result":"Claude bridge executed successfully."}'
            exitCode = 0
        }
    }

    $claudeResponse = Invoke-ClaudeCodePrintMode -ModelId 'claude-opus-4.8' -Messages @(
        @{ role = 'system'; content = 'Follow repo rules.' },
        @{ role = 'user'; content = 'Inspect the workspace and summarize the next step.' }
    ) -Tools @(
        @{ function = @{ name = 'file_read' } },
        @{ function = @{ name = 'grep_search' } }
    ) -RequestOptions @{ effort = 'medium' }
    Assert-Equal $claudeResponse.choices[0].message.content 'Claude bridge executed successfully.' 'Invoke-ClaudeCodePrintMode returns normalized Claude Code output'
    $permissionIndex = [Array]::IndexOf($script:capturedClaudeArguments, '--permission-mode')
    $toolsIndex = [Array]::IndexOf($script:capturedClaudeArguments, '--tools')
    Assert-Equal $script:capturedClaudeArguments[$permissionIndex + 1] 'dontAsk' 'Claude bridge does not bypass native permissions'
    Assert-Equal $script:capturedClaudeArguments[$toolsIndex + 1] '""' 'Claude bridge passes an empty native-tool list'
} finally {
    ${function:Invoke-RunnerCommandWithInput} = $originalInvokeRunnerCommandWithInput
}

Assert-True (Test-IsModelAvailabilityError 'Copilot API error (HTTP 404): model not found') 'Model availability detector matches model-not-found errors'
Assert-True (-not (Test-IsModelAvailabilityError 'Copilot API error (HTTP 429): rate limit exceeded')) 'Model availability detector ignores rate-limit errors'

Assert-Equal (Get-ModelContextWindow 'gpt-4o') 128000 'Get-ModelContextWindow returns GPT-4o context size'
Assert-Equal (Get-ModelContextWindow 'claude-opus-4.8') 200000 'Get-ModelContextWindow returns Claude context size'

$Script:ActiveProvider = [PSCustomObject]@{ id = 'copilot' }
$gptReasoning = Get-ReasoningRequestConfig -agentDef @{ reasoningLevel = 'high' } -modelId 'gpt-5.5'
Assert-Equal $gptReasoning.reasoning.effort 'high' 'Get-ReasoningRequestConfig uses metadata-driven GPT reasoning support'

$Script:ActiveProvider = [PSCustomObject]@{ id = 'claude-code' }
$claudeCliReasoning = Get-ReasoningRequestConfig -agentDef @{ reasoningLevel = 'medium' } -modelId 'claude-opus-4.8'
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

    $claudeBridgeResponse = Invoke-LlmChat -token '' -modelId 'claude-opus-4.8' -messages @(@{ role = 'user'; content = 'hello' }) -tools @() -RequestOptions @{ effort = 'medium' }
    Assert-Equal $claudeBridgeResponse.choices[0].message.content 'Claude Code handled the request.' 'Invoke-LlmChat routes claude-code provider requests through the Claude bridge'
} finally {
    ${function:Invoke-ClaudeCodePrintMode} = $originalClaudeBridge
}

    $Script:ActiveProvider = [PSCustomObject]@{ id = 'copilot' }
$claudeReasoning = Get-ReasoningRequestConfig -agentDef @{ reasoningLevel = 'medium' } -modelId 'claude-opus-4.8'
Assert-Equal $claudeReasoning.thinking.type 'adaptive' 'Get-ReasoningRequestConfig uses metadata-driven Claude reasoning support'
$Script:ActiveProvider = $null

$learningRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-learning-$([System.IO.Path]::GetRandomFileName())")
try {
    New-Item -ItemType Directory -Path (Join-Path $learningRoot 'memories') -Force | Out-Null
    Set-Content -Path (Join-Path $learningRoot 'memories\conventions.md') -Encoding ascii -Value @(
        '- 2026-06-20: Use model version sweeps to update live defaults and bundled extension assets.'
        '- 2026-05-17: Sync bundled extension assets after root docs change.'
        'This prose is not a bullet and should not be loaded.'
    )
    Set-Content -Path (Join-Path $learningRoot 'memories\pitfalls.md') -Encoding ascii -Value @(
        '- 2026-04-30: Loop gate mistakes happen when agents edit before starting the quality loop.'
        '- Ranking unrelated note should not match deployment terms.'
    )
    Set-Content -Path (Join-Path $learningRoot 'memories\decisions.md') -Encoding ascii -Value @(
        '- 2026-01-01: Prefer billing schema evidence before rollout.'
    )

    $curatedLearnings = @(Get-RunnerCuratedLearnings -WorkspaceRoot $learningRoot)
    Assert-Equal $curatedLearnings.Count 5 'Get-RunnerCuratedLearnings loads only bullet memories from curated files'
    Assert-Equal $curatedLearnings[0].category 'conventions' 'Get-RunnerCuratedLearnings preserves memory category'
    Assert-Equal $curatedLearnings[0].date '2026-06-20' 'Get-RunnerCuratedLearnings extracts leading dates'
    Assert-True (-not ($curatedLearnings.text -contains 'This prose is not a bullet and should not be loaded.')) 'Get-RunnerCuratedLearnings skips non-bullet prose'

    $modelMatches = @(Get-RunnerRelevantLearnings -WorkspaceRoot $learningRoot -Query 'model version bundled assets' -Limit 2)
    Assert-Equal $modelMatches.Count 2 'Get-RunnerRelevantLearnings respects the requested result limit'
    Assert-True ($modelMatches[0].text -match 'model version sweeps') 'Get-RunnerRelevantLearnings ranks strongest keyword overlap first'
    Assert-True ($modelMatches[1].text -match 'bundled extension assets') 'Get-RunnerRelevantLearnings includes lower-scoring relevant memories'

    $billingMatches = @(Get-RunnerRelevantLearnings -WorkspaceRoot $learningRoot -Query 'billing schema evidence' -Limit 5)
    Assert-Equal $billingMatches.Count 1 'Get-RunnerRelevantLearnings filters out non-matching memories'
    Assert-Equal $billingMatches[0].category 'decisions' 'Get-RunnerRelevantLearnings returns category metadata with matches'

    $noMatches = @(Get-RunnerRelevantLearnings -WorkspaceRoot $learningRoot -Query 'nonexistent orchid topic' -Limit 5)
    Assert-Equal $noMatches.Count 0 'Get-RunnerRelevantLearnings returns no results for unrelated queries'
} finally {
    Remove-Item -Path $learningRoot -Recurse -Force -ErrorAction SilentlyContinue
}

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
Assert-True ($summaryMessages[0].content -match 'Deterministic facts') 'Merged compaction summary now carries deterministic fact extraction'

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

$fallbackSummary = Invoke-CompactionSummary -Token '' -ModelId 'gpt-4o' -ExistingSummary 'Decisions: keep billing changes documented.' -Messages @(
    @{ role = 'assistant'; content = 'Updated docs/billing.md for issue #42.'; tool_calls = @(@{ function = @{ name = 'file_edit' } }) }
    @{ role = 'user'; content = 'Need follow-up in src/app.ts before rollout.' }
)
Assert-True ($fallbackSummary -match 'Deterministic facts') 'Invoke-CompactionSummary falls back to deterministic facts when no token is available'
Assert-True ($fallbackSummary -match 'docs/billing\.md') 'Deterministic compaction fallback preserves file references'
Assert-True ($fallbackSummary -match '#42') 'Deterministic compaction fallback preserves issue references'

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

$clarificationContract = Read-ClarificationResponseContract @"
Status: resolved
## Direct Answer
Use the composite index on tenant_id and created_at.
## Evidence And Constraints
The current query path filters by tenant first and sorts by created_at.
## Remaining Uncertainty
Review ingest amplification before enabling it on the highest-volume table.
"@
Assert-Equal $clarificationContract.status 'resolved' 'Read-ClarificationResponseContract reads the declared status'
Assert-True $clarificationContract.resolved 'Read-ClarificationResponseContract recognizes a complete resolved clarification contract'
Assert-Equal $clarificationContract.missingSections.Count 0 'Read-ClarificationResponseContract tracks no missing sections for a complete contract'

$clarificationMissingSections = Read-ClarificationResponseContract @"
Status: partial
## Direct Answer
Use the composite index.
"@
Assert-True (-not $clarificationMissingSections.resolved) 'Read-ClarificationResponseContract does not treat partial answers as resolved'
Assert-True ($clarificationMissingSections.missingSections -contains 'Evidence And Constraints') 'Read-ClarificationResponseContract reports missing evidence sections'

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
Assert-Equal $engineerDef.constraints.Count 23 'Read-AgentDef stops constraints at the next top-level key'
Assert-Equal $engineerDef.tools.Count 10 'Read-AgentDef stops tools at the next top-level key'
Assert-Equal $engineerDef.agents.Count 9 'Read-AgentDef parses only collaborator entries as agents'
Assert-Equal $engineerDef.canModify.Count 5 'Read-AgentDef parses only can_modify boundary entries'
Assert-Equal $engineerDef.cannotModify.Count 4 'Read-AgentDef parses only cannot_modify boundary entries'
Assert-True (-not ($engineerDef.constraints -contains 'AgentX Architect')) 'Read-AgentDef does not inject collaborators as constraints'
$engineerClarifyTargets = @(Resolve-ClarificationTargetList -agentDef $engineerDef)
Assert-True ($engineerClarifyTargets -contains 'architect') 'Resolve-ClarificationTargetList keeps direct runtime agent IDs available for Engineer'
Assert-True ($engineerClarifyTargets -contains 'data-scientist') 'Resolve-ClarificationTargetList includes Data Scientist for Engineer alignment checkpoints'

$consultingResearchPrompt = Build-SystemPrompt -agentDef $consultingResearchDef -agentName 'consulting-research'
Assert-True ($consultingResearchPrompt -match '## Output Types') 'Build-SystemPrompt includes output type guidance for deliverable agents'
Assert-True ($consultingResearchPrompt -match 'docs/coaching/BRIEF-\{topic\}\.md') 'Build-SystemPrompt includes Consulting Research deliverable file targets'
Assert-True ($consultingResearchPrompt -match 'create or update the appropriate file in the workspace') 'Build-SystemPrompt explicitly instructs the agent to create required deliverable files'

$architectPrompt = Build-SystemPrompt -agentDef $architectDef -agentName 'architect'
Assert-True ($architectPrompt -match 'Use runtime agent IDs such as product-manager, architect, ux-designer, engineer, data-scientist') 'Build-SystemPrompt documents runtime agent IDs for clarification requests'
Assert-True ($architectPrompt -match 'Workflow And Skill Adherence') 'Build-SystemPrompt includes workflow and skill adherence guidance'

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

# ---------------------------------------------------------------------------
# Clarification Ledger Persistence Tests
# ---------------------------------------------------------------------------
$ledgerRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-ledger-" + [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $ledgerRoot -Force | Out-Null
try {
    # Test 1: Save a resolved clarification record
    $ledgerId = Save-ClarificationRecord `
        -WorkspaceRoot $ledgerRoot `
        -IssueNumber 42 `
        -FromAgent 'engineer' `
        -TargetAgent 'architect' `
        -Topic 'database indexing strategy' `
        -Exchanges @(
            @{ question = 'What index should we use?'; response = 'Use a composite index.'; iteration = 1; respondedBy = 'sub-agent' }
        ) `
        -Resolved $true `
        -EscalatedToHuman $false `
        -RecordType 'clarification'
    Assert-Equal $ledgerId 'CLR-42-001' 'Save-ClarificationRecord generates sequential CLR ID'

    $ledgerFile = Join-Path $ledgerRoot '.agentx' 'state' 'clarifications' 'issue-42.json'
    Assert-True (Test-Path $ledgerFile) 'Save-ClarificationRecord creates the ledger file on disk'

    $ledgerContent = Get-Content $ledgerFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20
    Assert-Equal $ledgerContent.issueNumber 42 'Ledger file records the correct issue number'
    Assert-Equal $ledgerContent.clarifications.Count 1 'Ledger file contains one clarification record'
    Assert-Equal $ledgerContent.clarifications[0].id 'CLR-42-001' 'Ledger record has the correct ID'
    Assert-Equal $ledgerContent.clarifications[0].from 'engineer' 'Ledger record captures the from agent'
    Assert-Equal $ledgerContent.clarifications[0].to 'architect' 'Ledger record captures the to agent'
    Assert-Equal $ledgerContent.clarifications[0].topic 'database indexing strategy' 'Ledger record captures the topic'
    Assert-Equal $ledgerContent.clarifications[0].status 'resolved' 'Ledger record status is resolved'
    Assert-True ($ledgerContent.clarifications[0].thread.Count -ge 2) 'Ledger record contains thread entries for question and answer'

    # Test 2: Append a second record to the same issue
    $ledgerId2 = Save-ClarificationRecord `
        -WorkspaceRoot $ledgerRoot `
        -IssueNumber 42 `
        -FromAgent 'engineer' `
        -TargetAgent 'data-scientist' `
        -Topic 'model evaluation threshold' `
        -Exchanges @(
            @{ question = 'What eval threshold?'; response = 'Use 0.85 F1.'; iteration = 1; respondedBy = 'sub-agent' },
            @{ question = 'Any caveats?'; response = 'Watch for class imbalance.'; iteration = 2; respondedBy = 'sub-agent' }
        ) `
        -Resolved $true `
        -EscalatedToHuman $false `
        -RecordType 'clarification'
    Assert-Equal $ledgerId2 'CLR-42-002' 'Save-ClarificationRecord increments the sequence number'

    $ledgerContent2 = Get-Content $ledgerFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20
    Assert-Equal $ledgerContent2.clarifications.Count 2 'Ledger file appends the second record'

    # Test 3: Escalated clarification gets status=escalated
    $ledgerId3 = Save-ClarificationRecord `
        -WorkspaceRoot $ledgerRoot `
        -IssueNumber 42 `
        -FromAgent 'engineer' `
        -TargetAgent 'architect' `
        -Topic 'auth flow decision' `
        -Exchanges @(
            @{ question = 'Which auth?'; response = 'Need human input.'; iteration = 1; respondedBy = 'human' }
        ) `
        -Resolved $false `
        -EscalatedToHuman $true `
        -RecordType 'clarification'
    Assert-Equal $ledgerId3 'CLR-42-003' 'Escalated record gets the next sequential ID'
    $ledgerContent3 = Get-Content $ledgerFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20
    Assert-Equal $ledgerContent3.clarifications[2].status 'escalated' 'Escalated clarification has status=escalated'
    $escalationEntries = @($ledgerContent3.clarifications[2].thread | Where-Object { $_.type -eq 'escalation' })
    Assert-True ($escalationEntries.Count -gt 0) 'Escalated record contains an escalation thread entry'

    # Test 4: Brainstorm record type
    $brainstormId = Save-ClarificationRecord `
        -WorkspaceRoot $ledgerRoot `
        -IssueNumber 42 `
        -FromAgent 'agent-x' `
        -TargetAgent 'architect' `
        -Topic 'scaling approach brainstorm' `
        -Exchanges @(
            @{ question = 'How should we scale the ingest pipeline?'; response = 'Consider horizontal partitioning with event-driven consumers.'; iteration = 1; respondedBy = 'sub-agent' }
        ) `
        -Resolved $true `
        -EscalatedToHuman $false `
        -RecordType 'brainstorm'
    Assert-Equal $brainstormId 'CLR-42-004' 'Brainstorm record gets next sequential ID'
    $ledgerContent4 = Get-Content $ledgerFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20
    Assert-Equal $ledgerContent4.clarifications[3].recordType 'brainstorm' 'Brainstorm record preserves the recordType field'

    # Test 5: Issue 0 (no issue context) creates a general ledger
    $generalId = Save-ClarificationRecord `
        -WorkspaceRoot $ledgerRoot `
        -IssueNumber 0 `
        -FromAgent 'engineer' `
        -TargetAgent 'architect' `
        -Topic 'general question' `
        -Exchanges @(
            @{ question = 'General question?'; response = 'General answer.'; iteration = 1; respondedBy = 'sub-agent' }
        ) `
        -Resolved $true `
        -EscalatedToHuman $false
    $generalFile = Join-Path $ledgerRoot '.agentx' 'state' 'clarifications' 'issue-0.json'
    Assert-True (Test-Path $generalFile) 'Save-ClarificationRecord creates a general ledger for issue 0'
    Assert-Equal $generalId 'CLR-0-001' 'General ledger record gets CLR-0 prefix'
} finally {
    Remove-Item $ledgerRoot -Recurse -Force -ErrorAction SilentlyContinue
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
    $script:selfReviewApproved = $true
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
        $latencyWatch = [System.Diagnostics.Stopwatch]::StartNew()
        while ($latencyWatch.ElapsedMilliseconds -lt 2) { }
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
        $latencyWatch = [System.Diagnostics.Stopwatch]::StartNew()
        while ($latencyWatch.ElapsedMilliseconds -lt 2) { }
        $script:selfReviewCalls++
        if ($script:selfReviewApproved) {
            return @{ approved = $true; findings = @(); feedback = 'Looks good' }
        }
        return @{
            approved = $false
            findings = @(@{ impact = 'high'; category = 'correctness'; description = 'Still broken' })
            feedback = 'Address the remaining HIGH finding.'
        }
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

    Assert-Equal $result.exitReason 'text_response' 'Invoke-AgenticLoop exits normally after one approved internal self-review'
    Assert-Equal $script:selfReviewCalls 1 'Invoke-AgenticLoop performs one approved internal self-review by default'
    Assert-Equal $result.iterations 1 'Invoke-AgenticLoop does not add duplicate main-model passes after approval'
    Assert-True ($result.finalText -match '\[SELF-REVIEW SUMMARY\] Completed 1/1 required review iterations') 'Invoke-AgenticLoop appends the single internal-review summary'
    Assert-True ($result.finalText -match '\[SELF-REVIEW SUMMARY\] Iteration 1: APPROVED') 'Invoke-AgenticLoop records the approved internal review'
    Assert-True ([int]$result.stageTimings.modelMs -gt 0) 'Invoke-AgenticLoop returns measured model latency'
    Assert-True ([int]$result.stageTimings.selfReviewMs -gt 0) 'Invoke-AgenticLoop returns measured self-review latency'
    Assert-True ([int]$result.stageTimings.compactionMs -ge 0) 'Invoke-AgenticLoop returns cumulative compaction latency'
    Assert-Equal $syncedLoopState.status 'active' 'Invoke-AgenticLoop leaves the loop active for independent review after a successful run'
    Assert-True ([bool]$syncedLoopState.active) 'Invoke-AgenticLoop preserves the active loop flag until independent review'
    Assert-Equal ([int]$syncedLoopState.iteration) 1 'Invoke-AgenticLoop preserves the external loop minimum for independent review'
    $minimumReminderSeen = @($script:runnerMessages | Where-Object {
        $_ -match '^\[Self-Review MINIMUM NOT YET MET'
    }).Count -gt 0
    Assert-True (-not $minimumReminderSeen) 'Invoke-AgenticLoop does not inject duplicate-review reminders after approval'
    Assert-True ($null -ne $script:lastSavedSessionMeta.sessionSummary) 'Invoke-AgenticLoop saves a bounded session summary in session metadata'
    Assert-True ([string]$script:lastSavedSessionMeta.sessionSummary).Length -le 1600 'Invoke-AgenticLoop bounds the saved session summary length'

    @{
        active = $true
        status = 'active'
        issueNumber = 0
        prompt = 'Fix bug in login redirect handling'
        taskClass = 'standard'
        iteration = 1
        minIterations = 3
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
    $bugResult = Invoke-AgenticLoop -Agent 'engineer' -Prompt 'Fix bug in login redirect handling' -MaxIterations 10 -WorkspaceRoot $runnerTestRoot
    $bugLoopState = Get-Content -Path $loopStatePath -Raw | ConvertFrom-Json

    Assert-Equal $bugResult.exitReason 'text_response' 'Invoke-AgenticLoop still completes successfully for standard bug work'
    Assert-Equal $script:selfReviewCalls 1 'Invoke-AgenticLoop does not copy the external loop minimum into internal self-review'
    Assert-Equal $bugResult.iterations 1 'Invoke-AgenticLoop finishes standard work after one approved internal review'
    Assert-True ($bugResult.finalText -match '\[SELF-REVIEW SUMMARY\] Completed 1/1 required review iterations') 'Invoke-AgenticLoop records the single internal review for bug work'
    Assert-Equal ([int]$bugLoopState.iteration) 1 'Invoke-AgenticLoop leaves remaining external iterations to the quality loop'

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

    '{"harness":{"selfReview":{"minIterations":2,"maxIterations":4,"stallThreshold":2,"enableCategoryVerdicts":false,"enableCalibrationExamples":false,"enableStallDetection":false}}}' | Set-Content -Path (Join-Path $runnerTestRoot '.agentx\config.json') -Encoding UTF8
    Remove-Item $loopStatePath -ErrorAction SilentlyContinue
    $script:runnerMessages.Clear()
    $script:selfReviewCalls = 0
    $configuredResult = Invoke-AgenticLoop -Agent 'engineer' -Prompt 'Implement the login fix' -MaxIterations 10 -WorkspaceRoot $runnerTestRoot

    Assert-Equal $configuredResult.exitReason 'text_response' 'Invoke-AgenticLoop still completes successfully with self-review config overrides'
    Assert-Equal $script:selfReviewCalls 2 'Invoke-AgenticLoop honors an explicit higher internal-review minimum'
    Assert-Equal $configuredResult.iterations 2 'Invoke-AgenticLoop stops after the configured internal-review minimum'
    Remove-Item -LiteralPath (Join-Path $runnerTestRoot '.agentx\config.json') -Force

    @{
        active = $true
        status = 'active'
        issueNumber = 0
        iteration = 0
        minIterations = 5
        maxIterations = 20
        completionCriteria = 'TASK_COMPLETE'
        startedAt = $currentLoopTimestamp
        lastIterationAt = $currentLoopTimestamp
        history = @()
    } | ConvertTo-Json -Depth 6 | Set-Content -Path $loopStatePath -Encoding UTF8
    $script:runnerMessages.Clear()
    $script:selfReviewCalls = 0
    $script:selfReviewApproved = $false
    $failedReviewResult = Invoke-AgenticLoop -Agent 'engineer' -Prompt 'Implement a still-broken change' -MaxIterations 10 -WorkspaceRoot $runnerTestRoot
    $failedReviewState = Get-Content -Path $loopStatePath -Raw | ConvertFrom-Json

    Assert-Equal $failedReviewResult.exitReason 'self_review_failed' 'self-review exhaustion exits as failure rather than text_response'
    Assert-Equal $script:selfReviewCalls 3 'self-review exhaustion uses the bounded default retry budget'
    Assert-True ([bool]$failedReviewState.active) 'failed self-review leaves the quality loop active'
    Assert-Equal ([string]$failedReviewState.status) 'active' 'failed self-review does not mark durable state complete'
    Assert-Equal ([int]$failedReviewState.iteration) 1 'internal self-review retries count as one durable work cycle'
    Assert-True ($failedReviewResult.finalText -match 'without approval') 'self-review exhaustion reports the unresolved approval blocker'
    Assert-True ([double]$failedReviewResult.stageTimings.modelMs -ge 8) 'model telemetry accumulates across four retry-path turns'
    Assert-True ([double]$failedReviewResult.stageTimings.selfReviewMs -ge 6) 'self-review telemetry accumulates across three failed reviews'
    $script:selfReviewApproved = $true
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
Write-Host ' Workspace path sandbox' -ForegroundColor White

$sandboxRoot = Join-Path ([IO.Path]::GetTempPath()) ("agentx-sandbox-{0}" -f [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $sandboxRoot 'src') -Force | Out-Null
# The 8.3 alias checks need the real directories to exist, because an alias only
# resolves when its target does.
New-Item -ItemType Directory -Path (Join-Path $sandboxRoot '.git\hooks') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $sandboxRoot '.agentx\state') -Force | Out-Null
try {
    Assert-True (Test-SandboxPath -Path 'src/app.ts' -WorkspaceRoot $sandboxRoot).allowed 'workspace-relative path is allowed'
    Assert-True (Test-SandboxPath -Path 'src/secretRedactor.ts' -WorkspaceRoot $sandboxRoot).allowed 'source file naming a secret is not blocked'

    $traversal = Test-SandboxPath -Path '../outside.txt' -WorkspaceRoot $sandboxRoot
    Assert-True (-not $traversal.allowed) 'parent traversal is blocked'
    Assert-Equal $traversal.reason 'Path traversal attempt detected' 'traversal reports the traversal reason'

    $nested = Test-SandboxPath -Path 'src/../../outside.txt' -WorkspaceRoot $sandboxRoot
    Assert-True (-not $nested.allowed) 'embedded traversal is blocked'

    $absolute = Test-SandboxPath -Path ([IO.Path]::GetTempPath()) -WorkspaceRoot $sandboxRoot
    Assert-True (-not $absolute.allowed) 'absolute path outside the workspace is blocked'
    Assert-Equal $absolute.reason 'Path is outside workspace root' 'outside path reports the containment reason'

    Assert-True (-not (Test-SandboxPath -Path '.env' -WorkspaceRoot $sandboxRoot).allowed) 'dotenv file is blocked'
    Assert-True (-not (Test-SandboxPath -Path '.env.production' -WorkspaceRoot $sandboxRoot).allowed) 'dotenv variant is blocked'
    Assert-True (-not (Test-SandboxPath -Path 'certs/server.pem' -WorkspaceRoot $sandboxRoot).allowed) 'pem certificate is blocked'
    Assert-True (-not (Test-SandboxPath -Path 'certs/server.KEY' -WorkspaceRoot $sandboxRoot).allowed) 'private key is blocked case-insensitively'
    Assert-True (-not (Test-SandboxPath -Path '.ssh/id_rsa' -WorkspaceRoot $sandboxRoot).allowed) 'ssh directory is blocked'
    Assert-True (-not (Test-SandboxPath -Path '.aws/credentials' -WorkspaceRoot $sandboxRoot).allowed) 'aws directory is blocked'
    Assert-True (-not (Test-SandboxPath -Path '.config/gh/hosts.yml' -WorkspaceRoot $sandboxRoot).allowed) 'gh config directory is blocked'
    Assert-True (-not (Test-SandboxPath -Path '' -WorkspaceRoot $sandboxRoot).allowed) 'empty path is rejected'

    $readBlocked = Invoke-Tool 'file_read' @{ filePath = '../escape.txt' } $sandboxRoot
    Assert-True $readBlocked.error 'file_read rejects a traversal path'
    Assert-True ($readBlocked.text -like '*PATH BLOCKED*') 'file_read reports the sandbox block'

    $writeBlocked = Invoke-Tool 'file_write' @{ filePath = '../escape.txt'; content = 'nope' } $sandboxRoot
    Assert-True $writeBlocked.error 'file_write rejects a traversal path'
    Assert-True (-not (Test-Path (Join-Path (Split-Path $sandboxRoot -Parent) 'escape.txt'))) 'blocked file_write creates nothing outside the workspace'

    $editBlocked = Invoke-Tool 'file_edit' @{ filePath = '.env'; oldString = 'a'; newString = 'b' } $sandboxRoot
    Assert-True $editBlocked.error 'file_edit rejects a sensitive file'

    $listBlocked = Invoke-Tool 'list_dir' @{ dirPath = '../' } $sandboxRoot
    Assert-True $listBlocked.error 'list_dir rejects a traversal path'

    # Wildcards would glob past the validated string onto other files.
    Assert-True (-not (Test-SandboxPath -Path '.en?' -WorkspaceRoot $sandboxRoot).allowed) 'single-character wildcard is blocked'
    Assert-True (-not (Test-SandboxPath -Path '.[e]nv' -WorkspaceRoot $sandboxRoot).allowed) 'character-class wildcard is blocked'
    Assert-True (-not (Test-SandboxPath -Path '*' -WorkspaceRoot $sandboxRoot).allowed) 'star wildcard is blocked'
    Assert-True (-not (Test-SandboxPath -Path '.env::$DATA' -WorkspaceRoot $sandboxRoot).allowed) 'alternate data stream syntax is blocked'
    Assert-True (-not (Test-SandboxPath -Path 'src/app.ts' -WorkspaceRoot '').allowed) 'missing workspace root is rejected rather than throwing'
    Assert-True (-not (Test-SandboxPath -Path '.netrc' -WorkspaceRoot $sandboxRoot).allowed) 'netrc credential file is blocked'
    Assert-True (-not (Test-SandboxPath -Path 'keys/service.p8' -WorkspaceRoot $sandboxRoot).allowed) 'p8 private key is blocked'

    # Single-stream ADS syntax hides content behind an otherwise allowed leaf.
    Assert-True (-not (Test-SandboxPath -Path 'notes.txt:hidden' -WorkspaceRoot $sandboxRoot).allowed) 'single-colon alternate data stream is blocked'
    Assert-True (Test-SandboxPath -Path (Join-Path $sandboxRoot 'src/app.ts') -WorkspaceRoot $sandboxRoot).allowed 'a drive-letter colon is not mistaken for a stream'

    # The enforcement surfaces themselves must be out of reach.
    Assert-True (-not (Test-SandboxPath -Path '.git/hooks/pre-commit' -WorkspaceRoot $sandboxRoot).allowed) 'git hooks directory is blocked'
    Assert-True (-not (Test-SandboxPath -Path '.git/config' -WorkspaceRoot $sandboxRoot).allowed) 'git config is blocked'
    Assert-True (-not (Test-SandboxPath -Path '.agentx/state/loop-state.json' -WorkspaceRoot $sandboxRoot).allowed) 'gate-bearing loop state is blocked'
    # The gate implementations are protected by the same rationale as the state.
    Assert-True (-not (Test-SandboxPath -Path '.agentx/agentx-cli.ps1' -WorkspaceRoot $sandboxRoot).allowed) 'the CLI that implements the gate is blocked'
    Assert-True (-not (Test-SandboxPath -Path '.github/hooks/pre-commit' -WorkspaceRoot $sandboxRoot).allowed) 'the installed hook source is blocked'
    Assert-True (Test-SandboxPath -Path '.github/workflows/ci.yml' -WorkspaceRoot $sandboxRoot).allowed 'the .github directory is not confused with .git'
    Assert-True (Test-SandboxPath -Path '.agentx/plugins/readme.md' -WorkspaceRoot $sandboxRoot).allowed 'only gate-bearing paths under .agentx are blocked'

    # 8.3 aliases reach a blocked location under a different spelling. They only
    # exist on volumes with short-name generation enabled, so the check is skipped
    # where the alias does not resolve.
    if (Test-Path -LiteralPath (Join-Path $sandboxRoot 'GIT~1')) {
        Assert-True (-not (Test-SandboxPath -Path 'GIT~1/hooks/pre-commit' -WorkspaceRoot $sandboxRoot).allowed) 'short-name alias for .git is blocked'
        $shortNameWrite = Invoke-Tool 'file_write' @{ filePath = 'GIT~1/hooks/pre-commit'; content = 'exit 0' } $sandboxRoot
        Assert-True $shortNameWrite.error 'file_write rejects a short-name alias path'
    } else {
        Assert-True $true 'short-name alias tests skipped (8.3 generation disabled on this volume)'
        Assert-True $true 'short-name alias write test skipped (8.3 generation disabled on this volume)'
    }
    if (Test-Path -LiteralPath (Join-Path $sandboxRoot 'AGENTX~1')) {
        Assert-True (-not (Test-SandboxPath -Path 'AGENTX~1/state/loop-state.json' -WorkspaceRoot $sandboxRoot).allowed) 'short-name alias for .agentx is blocked'
    } else {
        Assert-True $true 'agentx short-name alias test skipped (8.3 generation disabled on this volume)'
    }

    # The alias rule keys on whether the component really exists under that name,
    # so ordinary files containing a tilde stay reachable.
    Set-Content -LiteralPath (Join-Path $sandboxRoot 'notes~1.md') -Value 'tilde file' -Encoding utf8
    Assert-True (Test-SandboxPath -Path 'notes~1.md' -WorkspaceRoot $sandboxRoot).allowed 'a real file containing a tilde is not mistaken for an 8.3 alias'
    $tildeRead = Invoke-Tool 'file_read' @{ filePath = 'notes~1.md' } $sandboxRoot
    Assert-True (-not $tildeRead.error) "file_read can still read a real tilde-named file (text: $($tildeRead.text))"

    $hardlinkAlias = Join-Path $sandboxRoot 'loop-state-alias.json'
    $hardlinkCreated = $false
    try {
        Set-Content -LiteralPath (Join-Path $sandboxRoot '.agentx\state\loop-state.json') -Value '{"protected":true}' -Encoding utf8
        New-Item -ItemType HardLink -Path $hardlinkAlias -Target (Join-Path $sandboxRoot '.agentx\state\loop-state.json') -ErrorAction Stop | Out-Null
        $hardlinkCreated = $true
    } catch { $hardlinkCreated = $false }
    if ($hardlinkCreated) {
        $hardlinkRead = Invoke-Tool 'file_read' @{ filePath = 'loop-state-alias.json' } $sandboxRoot
        $hardlinkWrite = Invoke-Tool 'file_write' @{ filePath = 'loop-state-alias.json'; content = '{"protected":false}' } $sandboxRoot
        $hardlinkGrep = Invoke-Tool 'grep_search' @{ pattern = 'protected'; includePattern = '*.json'; maxResults = 20 } $sandboxRoot
        Assert-True $hardlinkRead.error 'file_read rejects a hardlink alias to protected state'
        Assert-True $hardlinkWrite.error 'file_write rejects a hardlink alias to protected state'
        Assert-True ($hardlinkGrep.text -notmatch 'loop-state-alias\.json') 'grep_search excludes hardlink aliases'
        Assert-True ((Get-Content -LiteralPath (Join-Path $sandboxRoot '.agentx\state\loop-state.json') -Raw) -match 'true') 'blocked hardlink write preserves protected content'
    } else {
        Assert-True $true 'hardlink alias tests skipped (hardlink creation not permitted)'
        Assert-True $true 'hardlink write test skipped (hardlink creation not permitted)'
        Assert-True $true 'hardlink grep test skipped (hardlink creation not permitted)'
        Assert-True $true 'hardlink preservation test skipped (hardlink creation not permitted)'
    }

    # Widened credential deny-list.
    Assert-True (-not (Test-SandboxPath -Path '.envrc' -WorkspaceRoot $sandboxRoot).allowed) 'envrc is blocked'
    Assert-True (-not (Test-SandboxPath -Path '.pgpass' -WorkspaceRoot $sandboxRoot).allowed) 'pgpass is blocked'
    Assert-True (-not (Test-SandboxPath -Path 'deploy/kubeconfig' -WorkspaceRoot $sandboxRoot).allowed) 'kubeconfig is blocked outside the .kube directory'
    Assert-True (-not (Test-SandboxPath -Path 'keys/putty.ppk' -WorkspaceRoot $sandboxRoot).allowed) 'ppk private key is blocked'
    Assert-True (-not (Test-SandboxPath -Path '.gitconfig' -WorkspaceRoot $sandboxRoot).allowed) 'gitconfig is blocked'

    $stateWrite = Invoke-Tool 'file_write' @{ filePath = '.agentx/state/loop-state.json'; content = '{"reviewGate":null}' } $sandboxRoot
    Assert-True $stateWrite.error 'file_write cannot rewrite the gate-bearing loop state'
    $hookWrite = Invoke-Tool 'file_write' @{ filePath = '.git/hooks/pre-commit'; content = 'exit 0' } $sandboxRoot
    Assert-True $hookWrite.error 'file_write cannot replace the pre-commit hook'
    $terminalWrite = Invoke-Tool 'terminal_exec' @{ command = "Set-Content -LiteralPath '.agentx/state/loop-state.json' -Value '{}'" } $sandboxRoot 'engineer'
    Assert-True $terminalWrite.error 'terminal_exec is fail-closed for autonomous agents'
    Assert-True ($terminalWrite.text -match 'Autonomous terminal execution is disabled') 'terminal_exec explains the external-sandbox requirement'

    Set-Content -LiteralPath (Join-Path $sandboxRoot 'realfile.txt') -Value 'real' -Encoding utf8
    $globWrite = Invoke-Tool 'file_write' @{ filePath = '*'; content = 'clobbered' } $sandboxRoot
    Assert-True $globWrite.error 'file_write rejects a bare wildcard path'
    Assert-Equal (Get-Content -LiteralPath (Join-Path $sandboxRoot 'realfile.txt') -Raw).Trim() 'real' 'wildcard write did not clobber existing files'

    # Symlink escape: skipped where the platform denies link creation.
    $linkOutside = Join-Path ([IO.Path]::GetTempPath()) ("agentx-sandbox-outside-{0}" -f [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $linkOutside -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $linkOutside 'loot.txt') -Value 'loot' -Encoding utf8
    $linkPath = Join-Path $sandboxRoot 'escape-link'
    $linkCreated = $false
    try {
        New-Item -ItemType SymbolicLink -Path $linkPath -Target $linkOutside -ErrorAction Stop | Out-Null
        $linkCreated = $true
    } catch { $linkCreated = $false }
    if ($linkCreated) {
        $linkGuard = Test-SandboxPath -Path 'escape-link' -WorkspaceRoot $sandboxRoot
        Assert-True (-not $linkGuard.allowed) 'symlink pointing outside the workspace is blocked'
        # An intermediate link carries an allowed-looking relative path outside
        # the root, so every component must be followed, not just the leaf.
        $viaLink = Test-SandboxPath -Path 'escape-link/loot.txt' -WorkspaceRoot $sandboxRoot
        Assert-True (-not $viaLink.allowed) 'a path traversing an escaping link is blocked'
        $viaLinkNew = Test-SandboxPath -Path 'escape-link/newfile.txt' -WorkspaceRoot $sandboxRoot
        Assert-True (-not $viaLinkNew.allowed) 'writing a new file through an escaping link is blocked'
        $readThroughLink = Invoke-Tool 'file_read' @{ filePath = 'escape-link/loot.txt' } $sandboxRoot
        Assert-True $readThroughLink.error 'file_read cannot read through an escaping link'

        $fileLinkPath = Join-Path $sandboxRoot 'escape-file.txt'
        $fileLinkCreated = $false
        try {
            New-Item -ItemType SymbolicLink -Path $fileLinkPath -Target (Join-Path $linkOutside 'loot.txt') -ErrorAction Stop | Out-Null
            $fileLinkCreated = $true
        } catch { $fileLinkCreated = $false }
        if ($fileLinkCreated) {
            $grepThroughLink = Invoke-Tool 'grep_search' @{ pattern = 'loot'; includePattern = '*.txt'; maxResults = 20 } $sandboxRoot
            Assert-True ($grepThroughLink.text -notmatch 'escape-file\.txt') 'grep_search excludes file symlinks that escape the workspace'
        } else {
            Assert-True $true 'grep file-symlink test skipped (file symlink creation not permitted)'
        }
    } else {
        Assert-True $true 'symlink escape test skipped (link creation not permitted on this host)'
    }
    Remove-Item $linkOutside -Recurse -Force -ErrorAction SilentlyContinue
} finally {
    Remove-Item $sandboxRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host ' Runner self-review record' -ForegroundColor White
$selfReviewRoot = Join-Path ([IO.Path]::GetTempPath()) ("agentx-runner-selfreview-{0}" -f [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path (Join-Path $selfReviewRoot '.agentx\state') -Force | Out-Null
    $nowStamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    ([ordered]@{
        active          = $true
        status          = 'active'
        iteration       = 5
        maxIterations   = 5
        minIterations   = 5
        reviewGate      = 'structured'
        startedAt       = $nowStamp
        lastIterationAt = $nowStamp
        history         = @()
    } | ConvertTo-Json -Depth 10) |
        Set-Content -LiteralPath (Join-Path $selfReviewRoot '.agentx\state\loop-state.json') -Encoding utf8

    Sync-AgenticLoopState -WorkspaceRoot $selfReviewRoot -IssueNumber 0 -Iterations 5 -ExitReason 'text_response' `
        -FinalText 'Autonomous run finished' -SelfReview ([PSCustomObject]@{ approved = $true; high = 0; medium = 0; low = 0 })

    $syncedState = Get-Content -LiteralPath (Join-Path $selfReviewRoot '.agentx\state\loop-state.json') -Raw | ConvertFrom-Json
    $lastEntry = @($syncedState.history)[-1]
    Assert-True ($null -ne $lastEntry) 'runner appends a history entry when its work completes'
    Assert-True ([bool]$syncedState.active) 'runner keeps the loop active for independent review'
    Assert-Equal ([string]$syncedState.status) 'active' 'runner does not claim loop completion before independent review'
    Assert-Equal ([int]$syncedState.maxIterations) 6 'runner reserves a final independent-review slot at the configured maximum'
    # A self-review is evidence, not an approval. Writing it as a 'review' record
    # would either mint the verdict the gate demands from an independent reviewer,
    # or trap the loop behind a verdict no command can clear.
    Assert-True ($lastEntry.PSObject.Properties.Name -contains 'selfReview') 'runner records its self-review under selfReview'
    Assert-True ($lastEntry.PSObject.Properties.Name -notcontains 'review') 'runner does not write a structured review record'
    Assert-True ($lastEntry.selfReview.PSObject.Properties.Name -notcontains 'verdict') 'runner self-review carries no verdict'
    Assert-Equal ([string]$lastEntry.selfReview.reviewer) 'agentic-runner-self-review' 'runner self-review is attributed to the runner'

    $evidencePath = Join-Path $selfReviewRoot 'independent-review.txt'
    Set-Content -LiteralPath $evidencePath -Value 'Independent review approved with zero blocking findings.' -Encoding utf8
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = (Get-Command pwsh -ErrorAction Stop).Source
    $startInfo.WorkingDirectory = $selfReviewRoot
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.Environment['AGENTX_WORKSPACE_ROOT'] = $selfReviewRoot
    foreach ($argument in @('-NoProfile', '-File', (Join-Path $script:repoRoot '.agentx\agentx-cli.ps1'), 'loop', 'iterate', '-s', 'Independent review approved', '-e', $evidencePath, '--verdict', 'approved', '--reviewer', 'runner-test-reviewer', '--high', '0', '--medium', '0', '--low', '0')) {
        $startInfo.ArgumentList.Add($argument)
    }
    $process = [System.Diagnostics.Process]::Start($startInfo)
    [void]$process.StandardOutput.ReadToEnd()
    [void]$process.StandardError.ReadToEnd()
    $process.WaitForExit()
    Assert-Equal $process.ExitCode 0 'independent verdict can be appended after autonomous work completes'
    $reviewedState = Get-Content -LiteralPath (Join-Path $selfReviewRoot '.agentx\state\loop-state.json') -Raw | ConvertFrom-Json
    $reviewEntry = @($reviewedState.history)[-1]
    Assert-Equal ([string]$reviewEntry.review.verdict) 'approved' 'appended verdict is stored as the final structured review'
} finally {
    Remove-Item $selfReviewRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host ' Runner quality-iteration floor' -ForegroundColor White
$minimumReviewState = [PSCustomObject]@{
    active = $true
    status = 'active'
    prompt = 'Implement secure iteration floor'
    completionCriteria = 'TASK_COMPLETE'
    taskClass = 'complex-delivery'
    iteration = 0
    minIterations = 5
    maxIterations = 20
}
Assert-Equal (Get-RunnerSelfReviewMinIteration -AgentName 'engineer' -Prompt 'test' -LoopState $minimumReviewState -MaxReviewerIterations 1) 1 'internal self-review stays independent from the external loop minimum'
Assert-Equal (Get-LoopTaskClassFromState ([PSCustomObject]@{ role = 'engineer'; prompt = 'Fix bug in rendering'; completionCriteria = 'TASK_COMPLETE' })) 'complex-delivery' 'runner role-only legacy classification matches CLI and TypeScript'
Assert-Equal (Get-LoopTaskClassFromState ([PSCustomObject]@{ prompt = 'Refine the agent prompt handling'; completionCriteria = 'TASK_COMPLETE' })) 'complex-delivery' 'runner agent vocabulary matches CLI and TypeScript'
foreach ($highRiskPrompt in @('Implement password reset', 'Validate JWT claims', 'Add OAuth login', 'Rotate API keys', 'Encrypt customer records', 'Update session handling')) {
    Assert-Equal (Get-LoopTaskClassFromState ([PSCustomObject]@{ taskClass = 'standard'; prompt = $highRiskPrompt; completionCriteria = 'TASK_COMPLETE' })) 'high-risk' "runner recognizes high-risk prompt variant: $highRiskPrompt"
}

$minimumSyncRoot = Join-Path ([IO.Path]::GetTempPath()) ("agentx-runner-minimum-{0}" -f [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path (Join-Path $minimumSyncRoot '.agentx\state') -Force | Out-Null
    $minimumReviewState | Add-Member -NotePropertyName startedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force
    $minimumReviewState | Add-Member -NotePropertyName lastIterationAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force
    $minimumReviewState | Add-Member -NotePropertyName history -NotePropertyValue @() -Force
    $minimumReviewState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $minimumSyncRoot '.agentx\state\loop-state.json') -Encoding utf8

    Sync-AgenticLoopState -WorkspaceRoot $minimumSyncRoot -IssueNumber 0 -Iterations 1 -ExitReason 'text_response' `
        -FinalText 'Premature final response' -SelfReview ([PSCustomObject]@{ approved = $true; high = 0; medium = 0; low = 0 })

    $minimumSynced = Get-Content -LiteralPath (Join-Path $minimumSyncRoot '.agentx\state\loop-state.json') -Raw | ConvertFrom-Json
    Assert-Equal ([int]$minimumSynced.iteration) 1 'state synchronization preserves the actual quality-iteration count'
    Assert-True ([bool]$minimumSynced.active) 'state remains active when actual passes are below the minimum'
    Assert-Equal ([string]$minimumSynced.status) 'active' 'premature runner response does not mark the loop complete'
} finally {
    Remove-Item $minimumSyncRoot -Recurse -Force -ErrorAction SilentlyContinue
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