#Requires -Version 7.4
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path $PSScriptRoot -Parent
. (Join-Path $repo '.frontier/runtime/agentic-runner.ps1')
$passed = 0
function Assert-Receipt([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "[FAIL] $Message" }
    $script:passed++
    Write-Host "[PASS] $Message"
}
function New-Receipt([string]$Freshness = 'live', [bool]$Deduped = $false, [string]$Kind = 'source') {
    return [pscustomobject]@{
        id = 'a' * 64; contentHash = 'b' * 64; fileHash = 'c' * 64
        kind = $Kind; freshness = $Freshness; deduped = $Deduped
        path = 'src/fixture.ts'; startLine = 1; endLine = 2
    }
}
function New-ReceiptMessage([string]$Epoch, [int]$Iteration, [array]$Items, [string]$Role = 'tool') {
    return @{
        role = $Role; content = 'Fixture source evidence'; tool_call_id = 'context-fixture'
        repositoryEpoch = $Epoch; repositoryIteration = $Iteration; repositoryItems = $Items
    }
}
$history = @(
    (New-ReceiptMessage 'current' 1 @((New-Receipt))),
    (New-ReceiptMessage 'current' 1 @((New-Receipt))),
    (New-ReceiptMessage 'current' 2 @((New-Receipt))),
    (New-ReceiptMessage 'old-run' 1 @((New-Receipt))),
    (New-ReceiptMessage 'current' 1 @((New-Receipt -Freshness stale))),
    (New-ReceiptMessage 'current' 1 @((New-Receipt -Deduped $true))),
    (New-ReceiptMessage 'current' 1 @((New-Receipt -Kind symbol))),
    (New-ReceiptMessage 'current' 1 @((New-Receipt)) -Role user)
)
$retained = @(Get-RetainedRepositoryItems $history current 2)
Assert-Receipt ($retained.Count -eq 1) 'only unique earlier-turn live source receipts from tool results are retained'
Assert-Receipt (@(Get-RetainedRepositoryItems $history new-run 2).Count -eq 0) 'a fresh resume epoch cannot inherit old receipts'
Assert-Receipt (@(Get-RetainedRepositoryItems @(@{ role = 'user'; content = 'Compacted summary' }) current 3).Count -eq 0) 'compaction summaries do not imply retained source evidence'

$script:actualLlm = ${function:Invoke-LlmChat}
$script:provider = 'github-models'
$script:turn = 0
$script:compactions = 0
$script:receivedReceipts = [Collections.Generic.List[object]]::new()
function Get-GitHubToken { return '' }
function Initialize-ApiMode { param($ghToken) $Script:ApiMode = 'models' }
function Get-ActiveProviderId { return $script:provider }
function Get-ProviderExecutionToken { param($ProviderId, $GitHubToken) return '' }
function Write-RunnerProviderDiagnostic { param($Provider, $ModelCandidates) }
function Get-ResearchFirstMode { param($Config) return 'off' }
function New-RunnerRepositoryContextMessage { param($WorkspaceRoot, $Query, $AgentName) return $null }
function Read-AgentDef {
    param($agentName, $root)
    return @{
        name = $agentName; description = ''; model = 'gpt-4o'; modelFallback = ''; body = ''
        tools = @('codebase'); canModify = @(); cannotModify = @()
    }
}
function Invoke-SelfReviewLoop {
    param($AgentName, $WorkOutput, $Token, $ModelId, $WorkspaceRoot, $EnableCategoryVerdicts, $EnableCalibrationExamples)
    return @{ approved = $true; findings = @(); feedback = 'Fixture review' }
}
function Invoke-ContextCompaction {
    param($Messages, $Token, $ModelId, $KeepRecent, $MinRecent, $ThresholdPercent)
    $script:compactions++
    if ($script:compactions -eq 3) {
        return @($Messages | Where-Object { $_.role -eq 'system' }) +
            @(@{ role = 'user'; content = '[Context Compaction Summary] Source evidence must be retrieved again.' })
    }
    return $Messages
}
function New-ContextCall([string]$Id, [string]$Name = 'repository_context') {
    $arguments = if ($Name -eq 'repository_context') { @{ query = 'fixture'; detail = 'evidence' } }
        else { @{ question = 'Continue the fixture?'; impact = 'consent'; choices = @('Continue', 'Cancel') } }
    return [pscustomobject]@{
        id = $Id; type = 'function'
        function = [pscustomobject]@{ name = $Name; arguments = ($arguments | ConvertTo-Json -Compress) }
    }
}
function Invoke-LlmChat {
    param($token, $modelId, $messages, $tools, $RequestOptions)
    $calls = @()
    $content = ''
    switch ($script:turn++) {
        0 { $calls = @((New-ContextCall first), (New-ContextCall same-batch)) }
        1 { $calls = @((New-ContextCall next-turn)) }
        2 { $calls = @((New-ContextCall after-compaction)) }
        3 { $calls = @((New-ContextCall question request_user_input)) }
        4 { $calls = @((New-ContextCall resumed)) }
        default { $content = 'Fixture execution complete.' }
    }
    return [pscustomobject]@{
        choices = @([pscustomobject]@{ message = [pscustomobject]@{ content = $content; tool_calls = $calls } })
        usage = [pscustomobject]@{ prompt_tokens = 1; completion_tokens = 1; total_tokens = 2 }
    }
}
function Invoke-Tool {
    param($name, $params, $workspaceRoot, $agentName, $agentDef, [array]$RepositoryReceipts, $ContextModel)
    if ($name -ne 'repository_context') { throw 'Unexpected fixture tool.' }
    $script:receivedReceipts.Add(@($RepositoryReceipts))
    return @{
        error = $false; text = "Fixture context result $($script:receivedReceipts.Count)"
        repositoryItems = @((New-Receipt), (New-Receipt -Freshness stale), (New-Receipt -Deduped $true))
        repositoryBudget = @{ scope = 'context-text'; method = 'chars4-estimate'; tokenCount = 10 }
    }
}

$root = Join-Path ([IO.Path]::GetTempPath()) "frontier-graph-receipts-$([guid]::NewGuid().ToString('N'))"
[void][IO.Directory]::CreateDirectory($root)
try {
    $pending = Invoke-AgenticLoop -Agent engineer -Prompt 'Inspect fixture evidence' -WorkspaceRoot $root `
        -InteractionMode autonomous -MaxIterations 6 -SkipLoopStateSync
    Assert-Receipt ($pending.exitReason -eq 'human_required') 'fixture pauses with durable earlier-turn evidence'
    Assert-Receipt ($script:receivedReceipts.Count -eq 4) 'the actual runner dispatched all four context calls'
    Assert-Receipt ($script:receivedReceipts[0].Count -eq 0 -and $script:receivedReceipts[1].Count -eq 0) 'same-batch context results cannot suppress each other'
    Assert-Receipt ($script:receivedReceipts[2].Count -eq 1) 'the next model turn receives only unique live non-deduped evidence'
    Assert-Receipt ($script:receivedReceipts[3].Count -eq 0) 'actual runner selection forgets receipts removed by compaction'
    $saved = Read-Session $pending.sessionId $root
    Assert-Receipt (@($saved.messages | Where-Object { (Get-MessageFieldValue $_ 'repositoryItems') }).Count -gt 0) 'pending sessions preserve receipts with their delivered tool results'
    $resumed = Invoke-AgenticLoop -Agent engineer -WorkspaceRoot $root -ResumeSessionId $pending.sessionId `
        -InputId $pending.pendingInteraction.inputId -InputDecision answer -HumanClarificationResponse 'Continue' -SkipLoopStateSync
    Assert-Receipt ($resumed.exitReason -eq 'text_response' -and $script:receivedReceipts[4].Count -eq 0) 'resume creates a fresh evidence epoch before the next context tool call'

    $wireMessages = @(
        @{ role = 'user'; content = 'Inspect fixture.' },
        @{ role = 'assistant'; content = ''; tool_calls = @((New-ContextCall context-fixture)) },
        (New-ReceiptMessage 'must-not-be-sent' 1 @((New-Receipt)))
    )
    $script:wireBody = ''
    function Invoke-RestMethod {
        param($Uri, $Method, $Headers, $Body, $ErrorAction)
        $script:wireBody = [string]$Body
        if ($script:provider -eq 'anthropic-api') {
            return [pscustomobject]@{
                content = @([pscustomobject]@{ type = 'text'; text = 'Fixture' }); stop_reason = 'end_turn'
                usage = [pscustomobject]@{ input_tokens = 1; output_tokens = 1 }
            }
        }
        if ($script:provider -eq 'openai-api') {
            return [pscustomobject]@{
                status = 'completed'
                output = @([pscustomobject]@{ type = 'message'; content = @([pscustomobject]@{ type = 'output_text'; text = 'Fixture' }) })
                usage = [pscustomobject]@{ input_tokens = 1; output_tokens = 1; total_tokens = 2 }
            }
        }
        return [pscustomobject]@{ choices = @([pscustomobject]@{ message = [pscustomobject]@{ content = 'Fixture'; tool_calls = @() } }) }
    }
    foreach ($route in @(
        @{ provider = 'github-models'; model = 'gpt-4o' },
        @{ provider = 'anthropic-api'; model = 'claude-opus-5-5' },
        @{ provider = 'openai-api'; model = 'gpt-5.6-sol' }
    )) {
        $script:provider = $route.provider
        $null = & $script:actualLlm -token 'fixture-credential-not-real' -modelId $route.model -messages $wireMessages -tools @()
        Assert-Receipt ($script:wireBody -match 'Fixture source evidence' -and
            $script:wireBody -notmatch 'repositoryEpoch|repositoryIteration|repositoryItems|must-not-be-sent') "$($route.provider) sends source text but never local receipt metadata"
    }
    Write-Host "Repository runner receipts: $passed passed."
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force
}
