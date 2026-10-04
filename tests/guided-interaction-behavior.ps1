#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..' '.frontier' 'runtime' 'agentic-runner.ps1')

$passed = 0
function Assert-That([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "[FAIL] $Message" }
    $script:passed++
    Write-Host "[PASS] $Message"
}
function Assert-Rejected([scriptblock]$Action, [string]$Message, [string]$ExpectedPattern = '') {
    $rejected = $false
    $errorMessage = ''
    try { & $Action | Out-Null } catch { $rejected = $true; $errorMessage = $_.Exception.Message }
    Assert-That $rejected $Message
    if ($ExpectedPattern) { Assert-That ($errorMessage -match $ExpectedPattern) "$Message rejects for the expected reason: $errorMessage" }
}
function New-FixturePlan {
    return @{
        goal = 'Write the requested fixture'
        scope = @('src/result.txt'); nonGoals = @('No external changes'); assumptions = @()
        steps = @(@{ title = 'Write fixture'; verification = 'Inspect the resulting bytes; suites remain deferred' })
    }
}

$root = Join-Path ([IO.Path]::GetTempPath()) "frontier-guided-$([guid]::NewGuid().ToString('N'))"
[void][IO.Directory]::CreateDirectory($root)
try {
    $state = New-RunnerInteraction 'guided-fixture' $root 'engineer' 'Write fixture' 'guided'
    $state.model = 'gpt-4o'; $state.provider = 'github-models'; $state.rolePolicy = '0' * 64
    Assert-That (-not (Test-InteractionAuthorized $state)) 'guided mode starts without authorization'
    Assert-That ([bool](Get-InteractionToolBlock $state 'file_write')) 'writes are blocked before a plan'
    Assert-That ([bool](Get-InteractionToolBlock $state 'future_external_tool')) 'unknown future tools fail closed before approval'
    Assert-That (-not (Get-InteractionToolBlock $state 'file_read')) 'bounded discovery remains available'
    Set-InteractionPlan $state (New-FixturePlan)
    $view = Get-InteractionPendingView $state
    Assert-That ($view.kind -eq 'plan' -and $view.planVersion -eq 1 -and $view.plan.steps[0].id -eq 's1') 'the runtime assigns plan and milestone identities'
    Assert-That ($view.digest -cmatch '^[a-f0-9]{64}$') 'the plan has a SHA256 digest'
    Assert-Rejected { Resume-RunnerInteraction $state $view.inputId 'answer' 1 $view.digest 'yes' } 'clarification text cannot approve a plan'
    Assert-Rejected { Resume-RunnerInteraction $state $view.inputId 'approve' 2 $view.digest '' } 'stale plan versions are rejected'
    Assert-Rejected { Resume-RunnerInteraction $state $view.inputId 'approve' 1 ('0' * 64) '' } 'wrong plan hashes are rejected'
    Assert-Rejected { Resume-RunnerInteraction $state ('0' * 32) 'approve' 1 $view.digest '' } 'wrong pending input IDs are rejected'
    Assert-Rejected { Resume-RunnerInteraction $state $view.inputId 'approve' 1 $view.digest 'and change the goal' } 'approval with edits is rejected'
    Assert-Rejected { ConvertFrom-RunnerInteraction $state 'different-session' $root 'engineer' } 'cross-session replay is rejected'
    Assert-Rejected { ConvertFrom-RunnerInteraction $state 'guided-fixture' (Join-Path $root 'different') 'engineer' } 'cross-workspace replay is rejected'
    Assert-Rejected { ConvertFrom-RunnerInteraction $state 'guided-fixture' $root 'devops' } 'cross-role replay is rejected'
    $changed = $state | ConvertTo-Json -Depth 25 | ConvertFrom-Json -AsHashtable -Depth 25
    $changed.plan.goal = 'Different goal'
    Assert-Rejected { ConvertFrom-RunnerInteraction $changed 'guided-fixture' $root 'engineer' } 'changed stored plan content cannot retain approval identity'
    $restored = ConvertFrom-RunnerInteraction $state 'guided-fixture' $root 'engineer'
    Resume-RunnerInteraction $restored $view.inputId 'approve' 1 $view.digest ''
    Assert-That (Test-InteractionAuthorized $restored) 'an exact explicit decision authorizes the plan'
    $midTask = ConvertFrom-RunnerInteraction $restored 'guided-fixture' $root 'engineer'
    Set-InteractionQuestion $midTask @{ question = 'Expand the affected area?'; impact = 'scope'; choices = @('Keep scope', 'Expand scope') }
    Resume-RunnerInteraction $midTask $midTask.pending.id 'answer' 0 '' 'Expand scope'
    Assert-That (-not (Test-InteractionAuthorized $midTask)) 'a consequential mid-task answer requires renewed plan approval'
    $interrupted = ConvertFrom-RunnerInteraction $restored 'guided-fixture' $root 'engineer'
    Resume-RunnerInteraction $interrupted '' 'continue' 1 $view.digest ''
    Assert-That (Test-InteractionAuthorized $interrupted) 'explicit continuation preserves the same approved scope'
    Resume-RunnerInteraction $interrupted '' 'cancel' 1 $view.digest ''
    Assert-That ($interrupted.phase -eq 'cancelled') 'an interrupted session can be cancelled without a pending question'
    Assert-That ([bool](Get-InteractionToolBlock $restored 'file_write')) 'a milestone must start before mutation'
    Set-InteractionProgress $restored @{
        planVersion = 1; stepId = 's1'; status = 'in_progress'; summary = 'Starting fixture'; evidence = 'Plan reviewed'
    } | Out-Null
    Assert-That (-not (Get-InteractionToolBlock $restored 'file_write')) 'an active approved milestone permits role-guarded mutation'
    Assert-Rejected { Set-InteractionProgress $restored @{
        planVersion = 1; stepId = 's2'; status = 'completed'; summary = 'Done'; evidence = 'Reported'
    } } 'unknown milestone IDs cannot be completed'
    Set-InteractionProgress $restored @{
        planVersion = 1; stepId = 's1'; status = 'completed'; summary = 'Fixture written'; evidence = 'Agent-reported fixture inspection, not a suite pass'
    } | Out-Null
    Assert-That (Test-InteractionComplete $restored) 'all reported milestones allow final verification'
    Set-InteractionPlan $restored (New-FixturePlan)
    Assert-That (-not (Test-InteractionAuthorized $restored)) 'revising a plan immediately removes authorization'
    Assert-That ($restored.planVersion -eq 2 -and $restored.history.Count -ge 4) 'revision history is retained'
    Assert-Rejected { Resume-RunnerInteraction $restored $view.inputId 'approve' 1 $view.digest '' } 'a superseded decision is never replayed'
    Resume-RunnerInteraction $restored $restored.pending.id 'cancel' 0 '' ''
    Assert-That ($restored.phase -eq 'cancelled' -and -not $restored.approval) 'cancel preserves history but removes authorization'

    $questionState = New-RunnerInteraction 'question-fixture' $root 'engineer' 'Clarify scope' 'guided'
    $questionState.model = 'gpt-4o'; $questionState.provider = 'github-models'; $questionState.rolePolicy = '0' * 64
    Set-InteractionQuestion $questionState @{ question = 'Which file is in scope?'; impact = 'scope'; choices = @('First', 'Second') }
    $questionId = $questionState.pending.id
    Assert-Rejected { Set-InteractionQuestion $questionState @{ question = 'Another?'; impact = 'scope'; choices = @() } } 'only one input may be pending'
    Resume-RunnerInteraction $questionState $questionId 'answer' 0 '' 'First'
    Assert-That (-not (Test-InteractionAuthorized $questionState)) 'an answered question still needs a plan'
    $unsafePlan = New-FixturePlan
    $unsafePlan.goal = "Hidden`e[2Jtext"
    Assert-Rejected { Set-InteractionPlan $questionState $unsafePlan } 'terminal control characters are rejected'
    $extraField = New-FixturePlan
    $extraField.approved = $true
    Assert-Rejected { Set-InteractionPlan $questionState $extraField } 'a model cannot add its own approval field'
    $joinerText = 'word' + [char]0x200C + 'word' + [char]0x200D + 'word'
    Assert-That ((ConvertTo-InteractionText $joinerText) -ceq $joinerText) 'legitimate joining characters remain valid'
    Assert-Rejected { ConvertTo-InteractionText ('word' + [char]0x202E + 'word') } 'bidi overrides remain blocked'
    $preview = Get-InteractionQuestionPreview (('a' * 1499) + [char]::ConvertFromUtf32(0x1F600))
    Assert-That ($preview.Length -eq 1499) 'question previews never split a surrogate pair'
    $fragmented = 'before' + [char]0xD83D + 'middle' + [char]0xDE00 + 'after'
    $safePreview = Get-InteractionQuestionPreview $fragmented
    Assert-That ($safePreview -ceq ('before' + [char]0xFFFD + 'middle' + [char]0xFFFD + 'after')) 'upstream surrogate fragments are replaced in previews rather than aborting escalation'
    $reviseState = ConvertFrom-RunnerInteraction $state 'guided-fixture' $root 'engineer'
    Assert-Rejected {
        Resume-RunnerInteraction $reviseState $reviseState.pending.id 'revise' 1 $reviseState.digest ('x' * 12001)
    } 'revision feedback is bounded before it changes pending state'
    $auto = New-RunnerInteraction 'auto-fixture' $root 'engineer' 'Preauthorized fixture' 'autonomous'
    Assert-That (Test-InteractionAuthorized $auto) 'explicit autonomous mode is caller-authorized'
    Set-InteractionQuestion $auto @{ question = 'Required consent?'; impact = 'consent'; choices = @('Yes', 'No') }
    Assert-That (-not (Test-InteractionAuthorized $auto)) 'required input suspends automation too'
    $delegate = New-RunnerInteraction 'delegate-fixture' $root 'engineer' 'Inspect only' 'delegated'
    foreach ($tool in @('file_write', 'file_edit', 'propose_plan', 'request_user_input', 'report_progress', 'terminal_exec')) {
        Assert-That ([bool](Get-InteractionToolBlock $delegate $tool)) "a clarification delegate cannot use $tool"
    }

    $meta = @{ sessionId = 'stored-fixture'; agentName = 'engineer'; interaction = $null }
    Save-Session 'stored-fixture' @(@{ role = 'user'; content = 'Fixture' }) $meta $root
    Assert-That ((Read-Session 'stored-fixture' $root).meta.sessionId -eq 'stored-fixture') 'session JSON is readable after an atomic save'
    $oversized = 'x' * (32MB + 1)
    Assert-Rejected { Save-Session 'stored-fixture' @(@{ role = 'user'; content = $oversized }) $meta $root } 'oversized checkpoints are rejected on save'
    Assert-That ((Read-Session 'stored-fixture' $root).messages[0].content -eq 'Fixture') 'an oversized save preserves the previous checkpoint'
    $oversized = $null
    Assert-Rejected { Read-Session '..\outside' $root } 'session path traversal is rejected'
    $lock = Enter-RunnerSession 'stored-fixture' $root
    try { Assert-Rejected { Enter-RunnerSession 'stored-fixture' $root } 'only one writer may own a session' }
    finally { $lock.Dispose() }
    $guard = Test-SandboxPath '.frontier/sessions/stored-fixture.json' $root
    Assert-That (-not $guard.allowed) 'model file tools cannot access authorization state'
    $file = Get-RunnerSessionPath 'stored-fixture' $root
    [IO.File]::WriteAllText($file, '{invalid')
    Assert-Rejected { Read-Session 'stored-fixture' $root } 'corrupt state is an explicit error rather than a missing session'

    function Get-GitHubToken { return '' }
    function Initialize-ApiMode { param($ghToken) $Script:ApiMode = 'models' }
    $script:providerId = 'github-models'
    $script:rolePaths = @('src/**')
    $script:selfReviewCalls = 0
    $script:responseFactory = $null
    function Get-ActiveProviderId { return $script:providerId }
    function Get-ProviderExecutionToken { param($ProviderId, $GitHubToken) return '' }
    function Write-RunnerProviderDiagnostic { param($Provider, $ModelCandidates) }
    function Get-ResearchFirstMode { param($Config) return 'off' }
    function Read-AgentDef {
        param($agentName, $root)
        return @{
            name = $agentName; description = ''; model = 'gpt-4o'; modelFallback = 'gpt-4.1'; body = ''
            tools = @('codebase', 'editFiles'); canModify = $script:rolePaths; cannotModify = @(); agents = @('architect')
        }
    }
    function Invoke-SelfReviewLoop {
        param($AgentName, $WorkOutput, $Token, $ModelId, $WorkspaceRoot, $EnableCategoryVerdicts, $EnableCalibrationExamples)
        $script:selfReviewCalls++
        return @{ approved = $true; findings = @(); feedback = 'Fixture reviewer response' }
    }
    function New-Call([string]$Id, [string]$Name, $Arguments) {
        return [pscustomobject]@{
            id = $Id; type = 'function'
            function = [pscustomobject]@{ name = $Name; arguments = ($Arguments | ConvertTo-Json -Depth 15 -Compress) }
        }
    }
    function New-ModelReply([string]$Content = '', [array]$Calls = @()) {
        return [pscustomobject]@{
            choices = @([pscustomobject]@{ message = [pscustomobject]@{ content = $Content; tool_calls = $Calls } })
            usage = [pscustomobject]@{ prompt_tokens = 1; completion_tokens = 1; total_tokens = 2 }
        }
    }
    $script:runPhase = 'plan'
    $script:modelCalls = 0
    $script:executionCalls = 0
    $script:observedTools = @()
    function Invoke-LlmChat {
        param($token, $modelId, $messages, $tools, $RequestOptions)
        $script:modelCalls++
        $script:observedTools = @($tools | ForEach-Object { $_.function.name })
        if ($script:responseFactory) { return & $script:responseFactory $messages $tools }
        $calls = @()
        $content = ''
        if ($script:runPhase -eq 'plan') {
            $calls = @(
                (New-Call 'proposal' 'propose_plan' (New-FixturePlan)),
                (New-Call 'late-write' 'file_write' @{ filePath = 'src/result.txt'; content = 'must not execute' })
            )
        } elseif ($script:executionCalls++ -eq 0) {
            $calls = @(
                (New-Call 'start-step' 'report_progress' @{ planVersion = 1; stepId = 's1'; status = 'in_progress'; summary = 'Starting'; evidence = 'Approved plan' }),
                (New-Call 'write' 'file_write' @{ filePath = 'src/result.txt'; content = 'approved bytes' }),
                (New-Call 'finish-step' 'report_progress' @{ planVersion = 1; stepId = 's1'; status = 'completed'; summary = 'Written'; evidence = 'file_write returned success; no tests run' })
            )
        } else { $content = 'Execution finished; external review and tests remain separate.' }
        return New-ModelReply $content $calls
    }
    $result = Invoke-AgenticLoop -Agent 'engineer' -Prompt 'Write the requested fixture' -WorkspaceRoot $root -MaxIterations 4 -SkipLoopStateSync
    Assert-That ($result.exitReason -eq 'human_required' -and $script:modelCalls -eq 1) 'proposal suspends before another model call'
    Assert-That (-not (Test-Path -LiteralPath (Join-Path $root 'src/result.txt'))) 'same-batch writes after a proposal have no effect'
    Assert-That ($script:observedTools -notcontains 'file_write') 'pre-approval mutation tools are not advertised'
    $saved = Read-Session $result.sessionId $root
    Assert-That (@($saved.messages | Where-Object { $_.role -eq 'tool' }).Count -eq 2) 'every proposed tool call has a result, including declined batch tails'
    Assert-That ($saved.meta.interaction.phase -eq 'awaiting_plan') 'pending approval survives a durable read'
    Assert-That ($saved.meta.interaction.maxIterations -eq 4) 'the caller iteration limit is persisted'
    $script:runPhase = 'execute'
    $pendingInput = $result.pendingInteraction
    $resume = @{
        Agent = 'engineer'; WorkspaceRoot = $root; ResumeSessionId = $result.sessionId
        InputId = $pendingInput.inputId; InputDecision = 'approve'; PlanVersion = 1
        PlanDigest = $pendingInput.digest; SkipLoopStateSync = $true
    }
    $beforeInvalidResume = $script:modelCalls
    Assert-Rejected { Invoke-AgenticLoop @resume -MaxIterations 5 } 'resume cannot raise the original per-run iteration limit' 'cannot increase the authorized per-run iteration limit'
    Assert-Rejected { Invoke-AgenticLoop @resume -Model 'gpt-4.1' } 'resume cannot change the model' 'Resume cannot change the model'
    $script:providerId = 'copilot'
    try { Assert-Rejected { Invoke-AgenticLoop @resume } 'resume cannot change the provider' 'Provider, model or role permissions changed' }
    finally { $script:providerId = 'github-models' }
    $script:rolePaths = @('docs/**')
    try { Assert-Rejected { Invoke-AgenticLoop @resume } 'resume cannot widen or replace role permissions' 'Provider, model or role permissions changed' }
    finally { $script:rolePaths = @('src/**') }
    Assert-That ($script:modelCalls -eq $beforeInvalidResume) 'invalid resumes never call the model'
    Assert-That ((Read-Session $result.sessionId $root).meta.interaction.pending.id -ceq $pendingInput.inputId) 'rejected resumes preserve the pending decision'
    $completed = Invoke-AgenticLoop -Agent 'engineer' -WorkspaceRoot $root -ResumeSessionId $result.sessionId `
        -InputId $pendingInput.inputId -InputDecision approve -PlanVersion $pendingInput.planVersion -PlanDigest $pendingInput.digest `
        -SkipLoopStateSync
    Assert-That ($completed.exitReason -eq 'text_response') 'exact approval resumes native execution'
    Assert-That ([IO.File]::ReadAllText((Join-Path $root 'src/result.txt')) -ceq 'approved bytes') 'approved native execution writes the expected bytes'
    Assert-That ((Read-Session $result.sessionId $root).meta.interaction.phase -eq 'completed') 'execution completion is persisted after milestones and internal review'
    Assert-Rejected {
        Invoke-AgenticLoop -Agent 'engineer' -WorkspaceRoot $root -ResumeSessionId $result.sessionId `
            -InputId $pendingInput.inputId -InputDecision approve -PlanVersion $pendingInput.planVersion -PlanDigest $pendingInput.digest -SkipLoopStateSync
    } 'a consumed decision cannot execute the task a second time'
    $beforeHydra = $script:modelCalls
    $hydra = Invoke-AgenticLoop -Agent 'engineer' -Prompt 'Candidate' -WorkspaceRoot $root -Engine hydrafusion -SkipLoopStateSync
    Assert-That ($hydra.exitReason -eq 'error' -and $script:modelCalls -eq $beforeHydra) 'unqualified guided HydraFusion never silently changes provider or launches'

    $script:providerId = 'claude-code'
    try {
        Assert-Rejected { Invoke-AgenticLoop -Agent engineer -Prompt 'Guided fixture' -WorkspaceRoot $root -SkipLoopStateSync } 'the text-only Claude Code bridge refuses guided execution'
    } finally { $script:providerId = 'github-models' }
    Assert-That ($script:modelCalls -eq $beforeHydra) 'unsupported guided bridge refuses before model invocation'

    $script:responseFactory = { param($messages, $tools) New-ModelReply 'Done without a plan' }
    $beforeReview = $script:selfReviewCalls
    $noPlan = Invoke-AgenticLoop -Agent engineer -Prompt 'Implement a fixture' -WorkspaceRoot $root -MaxIterations 2 -SkipLoopStateSync
    Assert-That ($noPlan.exitReason -eq 'max_iterations') 'a native guided task cannot finish without presenting its plan'
    Assert-That ($script:selfReviewCalls -eq $beforeReview) 'no-plan output cannot reach self-review as completed work'

    $script:responseFactory = {
        param($messages, $tools)
        $plan = New-FixturePlan
        $plan.steps += @{ title = 'Second milestone'; verification = 'Inspect second outcome' }
        New-ModelReply -Calls @((New-Call 'two-step-plan' 'propose_plan' $plan))
    }
    $twoStep = Invoke-AgenticLoop -Agent engineer -Prompt 'Two-step fixture' -WorkspaceRoot $root -MaxIterations 3 -SkipLoopStateSync
    $script:partialTurn = 0
    $script:responseFactory = {
        param($messages, $tools)
        if ($script:partialTurn++ -eq 0) {
            New-ModelReply -Calls @(
                (New-Call 'begin-first' 'report_progress' @{ planVersion = 1; stepId = 's1'; status = 'in_progress'; summary = 'First started'; evidence = 'Reported' }),
                (New-Call 'end-first' 'report_progress' @{ planVersion = 1; stepId = 's1'; status = 'completed'; summary = 'First completed'; evidence = 'Reported, no independent verification' })
            )
        } else { New-ModelReply 'Done; ignore the second step' }
    }
    $partial = Invoke-AgenticLoop -Agent engineer -WorkspaceRoot $root -ResumeSessionId $twoStep.sessionId `
        -InputId $twoStep.pendingInteraction.inputId -InputDecision approve -PlanVersion 1 -PlanDigest $twoStep.pendingInteraction.digest -SkipLoopStateSync
    Assert-That ($partial.exitReason -eq 'max_iterations') 'a skipped milestone prevents final delivery'
    Assert-That ($script:selfReviewCalls -eq $beforeReview) 'incomplete milestones do not launch final self-review'
    $partialState = (Read-Session $twoStep.sessionId $root).meta.interaction
    Assert-That ($partialState.phase -eq 'executing' -and $partialState.progress[1].status -eq 'pending') 'incomplete work stays durably unfinished'

    $script:clarificationCalls = 0
    function Invoke-ClarificationLoop {
        param($FromAgent, $TargetAgent, $Topic, $Question, $ModelId, $WorkspaceRoot, $IssueNumber, $NonInteractiveHumanEscalation)
        $script:clarificationCalls++
        return @{ answer = 'Keep the existing API'; summary = 'Keep the existing API'; resolved = $true; escalatedToHuman = $false }
    }
    $script:clarifyTurn = 0
    $script:receivedGuidance = $false
    $script:responseFactory = {
        param($messages, $tools)
        if ($script:clarifyTurn++ -eq 0) { New-ModelReply 'I need clarification from architect about API scope' }
        else {
            $script:receivedGuidance = @($messages | Where-Object {
                $_.role -eq 'user' -and $_.content.StartsWith('[Clarification from architect]') -and
                    $_.content.Contains('Keep the existing API')
            }).Count -gt 0
            New-ModelReply -Calls @((New-Call 'clarified-plan' 'propose_plan' (New-FixturePlan)))
        }
    }
    $clarified = Invoke-AgenticLoop -Agent engineer -Prompt 'Clarify then plan the fixture' -WorkspaceRoot $root -MaxIterations 3 -SkipLoopStateSync
    Assert-That ($script:receivedGuidance -and $script:clarificationCalls -eq 1) 'guided discovery receives the delegate answer without repeating the paid clarification'
    Assert-That ($clarified.exitReason -eq 'human_required') 'resolved agent clarification proceeds to user plan approval'

    $script:responseFactory = { param($messages, $tools) throw 'model_not_found: requested model is unavailable' }
    $beforeFallback = $script:modelCalls
    $noFallback = Invoke-AgenticLoop -Agent engineer -WorkspaceRoot $root -ResumeSessionId $clarified.sessionId `
        -InputId $clarified.pendingInteraction.inputId -InputDecision approve -PlanVersion 1 -PlanDigest $clarified.pendingInteraction.digest -SkipLoopStateSync
    Assert-That ($noFallback.exitReason -eq 'error' -and $script:modelCalls -eq $beforeFallback + 1) 'a recorded plan cannot silently switch to the configured fallback model'
    Assert-That ($noFallback.finalText -like '*cannot be transferred*') 'model continuity failure is actionable'

    $repairId = 'interrupted-fixture'
    $repairState = New-RunnerInteraction $repairId $root engineer 'Inspect an interrupted effect' guided 2
    $repairState.model = 'gpt-4o'; $repairState.provider = 'github-models'
    $repairState.rolePolicy = Get-InteractionPlanDigest ([ordered]@{
        tools = @('codebase', 'editFiles'); canModify = @('src/**'); canModifySpecified = $null; cannotModify = @()
    })
    Set-InteractionPlan $repairState (New-FixturePlan)
    Resume-RunnerInteraction $repairState $repairState.pending.id approve 1 $repairState.digest ''
    Set-InteractionProgress $repairState @{
        planVersion = 1; stepId = 's1'; status = 'in_progress'; summary = 'Before interruption'; evidence = 'Checkpoint'
    } | Out-Null
    $repairMeta = @{
        sessionId = $repairId; agentName = 'engineer'; modelId = 'gpt-4o'; issueNumber = 0
        interaction = $repairState; researchExplorationCount = 0; sessionSummary = 'Interrupted'
        pendingHumanClarification = $null; skipLoopStateSync = $true
    }
    Save-Session $repairId @(
        @{ role = 'user'; content = 'Inspect an interrupted effect' },
        @{ role = 'assistant'; content = ''; tool_calls = @((New-Call 'lost-write' file_write @{ filePath = 'src/never-replay.txt'; content = 'must not execute' })) }
    ) $repairMeta $root
    $script:repairTurn = 0
    $script:repairNotice = $false
    $script:responseFactory = {
        param($messages, $tools)
        if ($script:repairTurn++ -eq 0) {
            $script:repairNotice = @($messages | Where-Object { $_.role -eq 'tool' -and $_.tool_call_id -eq 'lost-write' -and $_.content -like '*interrupted*' }).Count -eq 1
            New-ModelReply -Calls @((New-Call 'repair-question' request_user_input @{ question = 'Which interrupted effect should be inspected?'; impact = 'scope'; choices = @() }))
        } else { throw 'Unexpected replay or extra turn' }
    }
    $repaired = Invoke-AgenticLoop -Agent engineer -WorkspaceRoot $root -ResumeSessionId $repairId `
        -InputDecision continue -PlanVersion 1 -PlanDigest $repairState.digest -SkipLoopStateSync
    Assert-That ($repaired.exitReason -eq 'human_required' -and $script:repairNotice) 'resuming an interruption supplies an explicit unknown tool result'
    Assert-That (-not (Test-Path -LiteralPath (Join-Path $root 'src/never-replay.txt'))) 'interrupted tool calls are never automatically replayed'

    $script:originalSaveSession = ${function:Save-Session}
    $script:planCheckpointModels = [System.Collections.Generic.List[string]]::new()
    $script:fallbackTurn = 0
    $script:responseFactory = {
        param($messages, $tools)
        if ($script:fallbackTurn++ -eq 0) { throw 'model_not_found: requested model is unavailable' }
        New-ModelReply -Calls @((New-Call 'fallback-plan' propose_plan (New-FixturePlan)))
    }
    try {
        function Save-Session {
            param($sessionId, $messages, $meta, $root)
            if ($meta.exitReason -eq 'active' -and $meta.interaction.plan) {
                $script:planCheckpointModels.Add([string]$meta.modelId)
            }
            & $script:originalSaveSession $sessionId $messages $meta $root
        }
        $fallbackPlan = Invoke-AgenticLoop -Agent engineer -Prompt 'Plan after configured fallback' -WorkspaceRoot $root -MaxIterations 3 -SkipLoopStateSync
        Assert-That ($fallbackPlan.exitReason -eq 'human_required') 'configured pre-plan fallback can still propose a plan'
        Assert-That ($script:planCheckpointModels.Count -gt 0 -and
            @($script:planCheckpointModels | Where-Object { $_ -cne 'gpt-4.1' }).Count -eq 0) 'every pre-final plan checkpoint records the actual fallback model'
    } finally { ${function:Save-Session} = $script:originalSaveSession }
    Write-Host "Results: $passed passed"
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force
}
