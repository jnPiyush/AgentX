#Requires -Version 7.0
Set-StrictMode -Version Latest

$Script:INTERACTION_UNSAFE_TEXT_PATTERN = '[\p{Cc}\p{Cf}-[\u200C\u200D]]'

function Assert-InteractionKeys($Value, [string[]]$Required, [string[]]$Optional = @()) {
    if ($Value -isnot [System.Collections.IDictionary]) { throw 'Interaction input must be an object.' }
    foreach ($key in $Required) {
        if (-not $Value.Contains($key)) { throw "Interaction input requires '$key'." }
    }
    foreach ($key in $Value.Keys) {
        if ($key -notin $Required -and $key -notin $Optional) { throw "Unsupported interaction field '$key'." }
    }
}

function ConvertTo-InteractionText($Value, [int]$Maximum = 1500) {
    if ($Value -isnot [string] -or [string]::IsNullOrWhiteSpace($Value) -or $Value.Length -gt $Maximum) {
        throw "Interaction text must contain 1-$Maximum characters."
    }
    if ($Value -match $Script:INTERACTION_UNSAFE_TEXT_PATTERN) {
        throw 'Interaction text cannot contain control or directional-formatting characters.'
    }
    return $Value.Trim().Normalize([Text.NormalizationForm]::FormC)
}

function Get-InteractionQuestionPreview([string]$Text) {
    $text = [regex]::Replace($Text, $Script:INTERACTION_UNSAFE_TEXT_PATTERN, ' ')
    $text = [regex]::Replace($text, '(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])', [string][char]0xFFFD)
    $length = [Math]::Min(1500, $text.Length)
    if ($length -gt 0 -and [char]::IsHighSurrogate($text[$length - 1])) { $length-- }
    return ConvertTo-InteractionText $text.Substring(0, $length)
}

function ConvertTo-InteractionList($Value) {
    if ($Value -isnot [array] -or $Value.Count -gt 10) { throw 'Interaction lists require at most 10 strings.' }
    foreach ($item in $Value) { ConvertTo-InteractionText $item 300 }
}

function New-RunnerInteraction([string]$SessionId, [string]$Root, [string]$Agent, [string]$Task, [string]$Mode,
    [int]$MaxIterations = 30, $TokenBudget = $null) {
    if ($Mode -notin @('guided', 'autonomous', 'delegated')) { throw "Unsupported interaction mode '$Mode'." }
    return @{
        schemaVersion = 1; sessionId = $SessionId
        workspaceRoot = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($Root))
        agent = $Agent; engine = 'native'; mode = $Mode; task = $Task
        model = ''; provider = ''; rolePolicy = ''
        maxIterations = $MaxIterations; tokenBudget = $TokenBudget
        phase = $(if ($Mode -eq 'guided') { 'discovery' } else { 'executing' })
        planVersion = 0; plan = $null; digest = ''; approval = $null; pending = $null
        progress = @(); history = @()
    }
}

function Get-InteractionPlanDigest($Plan) {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($Plan | ConvertTo-Json -Depth 12 -Compress))
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
}

function New-InteractionPlan($State, $InputPlan, [int]$Version) {
    if ([string]::IsNullOrWhiteSpace($State.model) -or [string]::IsNullOrWhiteSpace($State.provider) -or
        $State.rolePolicy -cnotmatch '^[a-f0-9]{64}$') { throw 'A plan requires resolved provider, model and role permissions.' }
    Assert-InteractionKeys $InputPlan @('goal', 'scope', 'nonGoals', 'assumptions', 'steps')
    if ($InputPlan.steps -isnot [array] -or $InputPlan.steps.Count -lt 1 -or $InputPlan.steps.Count -gt 10) {
        throw 'A plan requires 1-10 high-level steps.'
    }
    $steps = @(
        for ($index = 0; $index -lt $InputPlan.steps.Count; $index++) {
            $step = $InputPlan.steps[$index]
            Assert-InteractionKeys $step @('title', 'verification')
            [ordered]@{
                id = "s$($index + 1)"
                title = ConvertTo-InteractionText $step.title 300
                verification = ConvertTo-InteractionText $step.verification 600
            }
        }
    )
    $scope = @(ConvertTo-InteractionList $InputPlan.scope)
    if ($scope.Count -eq 0) { throw 'A plan requires an explicit scope.' }
    return [ordered]@{
        sessionId = $State.sessionId; workspaceRoot = $State.workspaceRoot
        agent = $State.agent; engine = $State.engine; mode = $State.mode
        model = $State.model; provider = $State.provider; rolePolicy = $State.rolePolicy
        maxIterationsPerRun = $State.maxIterations; tokenBudgetPerRun = $State.tokenBudget
        version = $Version
        goal = ConvertTo-InteractionText $InputPlan.goal
        scope = $scope
        nonGoals = @(ConvertTo-InteractionList $InputPlan.nonGoals)
        assumptions = @(ConvertTo-InteractionList $InputPlan.assumptions)
        steps = $steps
    }
}

function Add-InteractionHistory($State, [string]$Kind, $Details) {
    $State.history = @($State.history) + @(@{
        at = [DateTime]::UtcNow.ToString('o'); kind = $Kind
        planVersion = $State.planVersion; details = $Details
    })
}

function Set-InteractionQuestion($State, $InputQuestion) {
    Assert-InteractionKeys $InputQuestion @('question', 'impact', 'choices')
    if ($State.mode -eq 'delegated' -or $State.pending -or $State.phase -in @('completed', 'cancelled')) {
        throw 'This session cannot request another input.'
    }
    if ($InputQuestion.impact -notin @('scope', 'behavior', 'contract', 'acceptance', 'security', 'cost', 'consent')) {
        throw 'A question must identify a consequential uncertainty or a required consent.'
    }
    $question = ConvertTo-InteractionText $InputQuestion.question
    $choices = @(ConvertTo-InteractionList $InputQuestion.choices)
    if ($choices.Count -eq 1 -or $choices.Count -gt 5) { throw 'Use no choices for free text, or 2-5 choices.' }
    $resumePhase = $State.phase
    if ($State.mode -eq 'guided' -and $State.approval -and $InputQuestion.impact -ne 'consent') {
        $State.approval = $null
        $resumePhase = 'discovery'
    }
    $State.pending = @{
        id = [guid]::NewGuid().ToString('N'); kind = 'question'
        question = $question; choices = $choices; impact = $InputQuestion.impact
        resumePhase = $resumePhase
    }
    $State.phase = 'awaiting_input'
    Add-InteractionHistory $State 'question' $State.pending
}

function Set-InteractionPlan($State, $InputPlan) {
    if ($State.mode -eq 'delegated' -or $State.pending -or $State.phase -in @('completed', 'cancelled')) {
        throw 'This session cannot propose a plan.'
    }
    $version = $State.planVersion + 1
    $plan = New-InteractionPlan $State $InputPlan $version
    $digest = Get-InteractionPlanDigest $plan
    $State.planVersion = $version
    $State.plan = $plan
    $State.digest = $digest
    $State.approval = $null
    $State.progress = @($plan.steps | ForEach-Object {
        @{ stepId = $_.id; status = 'pending'; summary = ''; evidence = ''; source = 'agent_reported' }
    })
    if ($State.mode -eq 'guided') {
        $State.pending = @{
            id = [guid]::NewGuid().ToString('N'); kind = 'plan'
            planVersion = $version; digest = $digest
        }
        $State.phase = 'awaiting_plan'
    } else {
        $State.phase = 'executing'
    }
    Add-InteractionHistory $State 'plan_proposed' @{ plan = $plan; digest = $digest }
}

function Resume-RunnerInteraction($State, [string]$InputId, [string]$Decision,
    [int]$PlanVersion, [string]$Digest, [string]$Response) {
    if ($Response.Length -gt 12000) { throw 'User responses and revision feedback must not exceed 12000 characters.' }
    $pending = $State.pending
    if ($Decision -eq 'cancel' -and -not $pending) {
        if ($State.phase -in @('completed', 'cancelled') -or $InputId -or
            $PlanVersion -ne $State.planVersion -or $Digest -cne $State.digest) {
            throw 'Cancellation requires the current unfinished session identity.'
        }
        $State.phase = 'cancelled'
        $State.approval = $null
        Add-InteractionHistory $State 'cancel' @{ response = 'Caller cancelled the unfinished session.' }
        return
    }
    if ($Decision -eq 'continue' -and -not $pending) {
        if (-not (Test-InteractionAuthorized $State) -or $InputId -or
            $PlanVersion -ne $State.planVersion -or $Digest -cne $State.digest) {
            throw 'Continuation requires the same authorized, unfinished plan identity.'
        }
        Add-InteractionHistory $State 'continued' @{ response = 'Caller resumed an unfinished session; verify interrupted effects before retrying.' }
        return
    }
    if (-not $pending -or $InputId -cne $pending.id) { throw 'Pending input is missing or stale; inspect the session before responding.' }
    if ($Decision -eq 'cancel') {
        $State.phase = 'cancelled'
        $State.approval = $null
    } elseif ($pending.kind -eq 'plan') {
        if ($PlanVersion -ne $State.planVersion -or $Digest -cne $State.digest) { throw 'Plan approval does not match the pending version and digest.' }
        if ($Decision -eq 'approve') {
            if ($Response) { throw 'Approval cannot include edits; revise the plan and approve its new version.' }
            $State.approval = @{ version = $PlanVersion; digest = $Digest; source = 'caller_input'; at = [DateTime]::UtcNow.ToString('o') }
            $State.phase = 'executing'
        } elseif ($Decision -eq 'revise') {
            if ([string]::IsNullOrWhiteSpace($Response)) { throw 'Plan revision requires feedback.' }
            $State.approval = $null
            $State.phase = 'discovery'
        } else { throw 'A plan requires an explicit approve, revise or cancel decision.' }
    } elseif ($Decision -eq 'answer') {
        if ($PlanVersion -ne 0 -or $Digest) { throw 'A question answer must not include plan-approval fields.' }
        if ([string]::IsNullOrWhiteSpace($Response) -or $Response.Length -gt 12000) { throw 'A nonempty answer of at most 12000 characters is required.' }
        $State.phase = $pending.resumePhase
    } else { throw 'A clarification answer cannot approve a plan.' }
    Add-InteractionHistory $State $Decision @{ inputId = $InputId; response = $Response }
    $State.pending = $null
}

function Test-InteractionAuthorized($State) {
    if ($State.pending -or $State.phase -ne 'executing' -or $State.mode -eq 'delegated') { return $false }
    if ($State.mode -eq 'autonomous') { return $true }
    return $null -ne $State.approval -and $State.approval.version -eq $State.planVersion -and
        $State.approval.digest -ceq $State.digest
}

function Get-InteractionToolBlock($State, [string]$ToolName) {
    if ($State.pending) { return 'Awaiting user input; later batch calls are declined without execution.' }
    $reads = @('repository_context', 'file_read', 'grep_search', 'list_dir')
    if ($ToolName -in $reads) { return '' }
    if ($State.mode -eq 'delegated') { return 'Clarification delegates are read-only and cannot start user intake.' }
    if ($ToolName -in @('request_user_input', 'propose_plan', 'report_progress')) { return '' }
    if (-not (Test-InteractionAuthorized $State)) { return 'Submit a plan and wait for explicit approval before execution.' }
    if ($State.mode -eq 'guided' -and -not @($State.progress | Where-Object { $_.status -eq 'in_progress' }).Count) {
        return 'Report the affected milestone as in_progress before making changes.'
    }
    return ''
}

function Set-InteractionProgress($State, $Report) {
    Assert-InteractionKeys $Report @('planVersion', 'stepId', 'status', 'summary', 'evidence')
    if (-not (Test-InteractionAuthorized $State) -or -not $State.plan) { throw 'Progress requires an authorized current plan.' }
    if ($Report.planVersion -isnot [long] -and $Report.planVersion -isnot [int]) { throw 'planVersion must be an integer.' }
    if ($Report.planVersion -ne $State.planVersion) { throw 'Progress refers to a stale plan version.' }
    if ($Report.status -notin @('in_progress', 'completed', 'blocked')) { throw 'Unsupported milestone status.' }
    $step = @($State.progress | Where-Object { $_.stepId -ceq $Report.stepId })
    if ($step.Count -ne 1) { throw 'Unknown milestone ID.' }
    if ($Report.status -eq 'completed' -and $step[0].status -notin @('in_progress', 'blocked')) {
        throw 'Start the milestone before reporting completion.'
    }
    $summary = ConvertTo-InteractionText $Report.summary 1000
    $evidence = ConvertTo-InteractionText $Report.evidence 1500
    $step[0].status = $Report.status
    $step[0].summary = $summary
    $step[0].evidence = $evidence
    Add-InteractionHistory $State 'milestone' @{
        stepId = $Report.stepId; status = $Report.status
        summary = $summary; evidence = $evidence; source = 'agent_reported'
    }
    $next = @($State.progress | Where-Object { $_.status -ne 'completed' } | Select-Object -First 1)
    $nextText = if ($next.Count) { $next[0].stepId } else { 'final verification and review' }
    return "[MILESTONE] Plan v$($State.planVersion) $($Report.stepId)/$($State.progress.Count) $($Report.status): $summary | Reported evidence: $evidence | Next: $nextText"
}

function Test-InteractionComplete($State) {
    if ($State.mode -eq 'delegated') { return $true }
    if (-not (Test-InteractionAuthorized $State)) { return $false }
    if ($State.mode -eq 'autonomous' -and -not $State.plan) { return $true }
    return @($State.progress | Where-Object { $_.status -ne 'completed' }).Count -eq 0
}

function ConvertFrom-RunnerInteraction($Value, [string]$SessionId, [string]$Root, [string]$Agent) {
    $state = $Value | ConvertTo-Json -Depth 25 -Compress | ConvertFrom-Json -AsHashtable -Depth 25
    Assert-InteractionKeys $state @('schemaVersion', 'sessionId', 'workspaceRoot', 'agent', 'engine', 'mode',
        'task', 'model', 'provider', 'rolePolicy', 'maxIterations', 'tokenBudget', 'phase', 'planVersion', 'plan', 'digest',
        'approval', 'pending', 'progress', 'history')
    $comparison = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
    $rootPath = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($Root))
    if ($state.schemaVersion -ne 1 -or $state.sessionId -cne $SessionId -or $state.agent -cne $Agent -or
        -not $rootPath.Equals([string]$state.workspaceRoot, $comparison) -or $state.engine -ne 'native') {
        throw 'Interaction state does not match this workspace, session, role and engine.'
    }
    if (($state.schemaVersion -isnot [int] -and $state.schemaVersion -isnot [long]) -or
        ($state.planVersion -isnot [int] -and $state.planVersion -isnot [long]) -or $state.planVersion -lt 0 -or
        ($state.maxIterations -isnot [int] -and $state.maxIterations -isnot [long]) -or
        $state.maxIterations -lt 1 -or $state.maxIterations -gt 1000 -or
        $state.mode -notin @('guided', 'autonomous', 'delegated') -or
        $state.phase -notin @('discovery', 'awaiting_input', 'awaiting_plan', 'executing', 'completed', 'cancelled') -or
        $state.progress -isnot [array] -or $state.history -isnot [array]) { throw 'Invalid interaction state.' }
    if ($null -ne $state.tokenBudget -and (($state.tokenBudget -isnot [long] -and $state.tokenBudget -isnot [int]) -or
        $state.tokenBudget -le 0)) { throw 'Invalid saved token budget.' }
    if ($state.plan) {
        $inputPlan = @{
            goal = $state.plan.goal; scope = $state.plan.scope; nonGoals = $state.plan.nonGoals
            assumptions = $state.plan.assumptions
            steps = @($state.plan.steps | ForEach-Object { @{ title = $_.title; verification = $_.verification } })
        }
        $plan = New-InteractionPlan $state $inputPlan ([int]$state.planVersion)
        if ((Get-InteractionPlanDigest $plan) -cne $state.digest -or
            (Get-InteractionPlanDigest $state.plan) -cne $state.digest) { throw 'Stored plan digest does not match its content.' }
        if ($state.progress.Count -ne $plan.steps.Count) { throw 'Stored milestone count differs from the plan.' }
        for ($index = 0; $index -lt $state.progress.Count; $index++) {
            $progress = $state.progress[$index]
            Assert-InteractionKeys $progress @('stepId', 'status', 'summary', 'evidence', 'source')
            if ($progress.stepId -cne $plan.steps[$index].id -or
                $progress.status -notin @('pending', 'in_progress', 'completed', 'blocked') -or
                $progress.source -ne 'agent_reported') { throw 'Invalid stored milestone.' }
        }
    } elseif ($state.planVersion -ne 0 -or $state.digest -or $state.approval) { throw 'Invalid plan identity.' }
    if ($state.approval) {
        Assert-InteractionKeys $state.approval @('version', 'digest', 'source', 'at')
        if ($state.mode -ne 'guided' -or $state.approval.version -ne $state.planVersion -or
            $state.approval.digest -cne $state.digest -or $state.approval.source -ne 'caller_input') {
            throw 'Stored approval refers to a different plan or authority.'
        }
    }
    if ($state.pending) {
        if ($state.pending.kind -eq 'plan') {
            Assert-InteractionKeys $state.pending @('id', 'kind', 'planVersion', 'digest')
            if ($state.phase -ne 'awaiting_plan' -or $state.approval -or
                $state.pending.planVersion -ne $state.planVersion -or $state.pending.digest -cne $state.digest) {
                throw 'Invalid pending plan approval.'
            }
        } elseif ($state.pending.kind -eq 'question') {
            Assert-InteractionKeys $state.pending @('id', 'kind', 'question', 'choices', 'impact', 'resumePhase')
            if ($state.phase -ne 'awaiting_input' -or $state.pending.resumePhase -notin @('discovery', 'executing')) {
                throw 'Invalid pending question.'
            }
        } else { throw 'Unknown pending input kind.' }
        if ($state.pending.id -cnotmatch '^[a-f0-9]{32}$') { throw 'Invalid pending input identity.' }
    } elseif ($state.phase -in @('awaiting_input', 'awaiting_plan')) { throw 'Awaiting state has no pending input.' }
    if ($state.phase -eq 'executing' -and $state.mode -eq 'guided' -and -not $state.approval) {
        throw 'Executing guided state is missing plan approval.'
    }
    return $state
}

function Get-InteractionSnapshot($State) {
    return @{
        role = 'system'; contextKind = 'interaction'
        content = (@{
            source = 'Frontier runtime interaction state'
            mode = $State.mode; phase = $State.phase; planVersion = $State.planVersion
            authorized = Test-InteractionAuthorized $State
            authorization = $(if ($State.mode -eq 'autonomous') { 'caller_authorized' } elseif ($State.approval) { 'user_approved_plan' } else { 'not_approved' })
            plan = $State.plan; progress = $State.progress; pending = $State.pending
        } | ConvertTo-Json -Depth 15 -Compress)
    }
}

function Get-InteractionPendingView($State) {
    if (-not $State.pending) { return $null }
    $pending = $State.pending
    $view = [ordered]@{
        sessionId = $State.sessionId; agent = $State.agent; inputId = $pending.id
        kind = $pending.kind; phase = $State.phase
    }
    if ($pending.kind -eq 'plan') {
        $view.planVersion = $State.planVersion
        $view.digest = $State.digest
        $view.plan = $State.plan
        $view.message = "Review plan v$($State.planVersion). Approve this exact plan, request changes, or cancel."
    } else {
        $view.question = $pending.question
        $view.choices = @($pending.choices)
        $view.message = $pending.question
    }
    return $view
}

function Repair-InterruptedToolResults([array]$Messages) {
    $outstanding = @{}
    foreach ($message in $Messages) {
        $role = Get-MessageFieldValue $message 'role'
        if ($role -eq 'assistant') {
            foreach ($call in @(Get-MessageFieldValue $message 'tool_calls')) {
                if ($call) { $outstanding[[string]$call.id] = $true }
            }
        } elseif ($role -eq 'tool') {
            [void]$outstanding.Remove([string](Get-MessageFieldValue $message 'tool_call_id'))
        }
    }
    return @($Messages) + @($outstanding.Keys | ForEach-Object {
        @{ role = 'tool'; tool_call_id = $_; content = 'Execution was interrupted. This call may not have completed; inspect current workspace evidence before retrying it. No replay was performed.' }
    })
}

function Get-InteractionToolSchemas {
    $textList = @{ type = 'array'; maxItems = 10; items = @{ type = 'string'; minLength = 1; maxLength = 300 } }
    return @(
        @{ type = 'function'; function = @{
            name = 'request_user_input'; description = 'Ask one consequential question and suspend the run for the user; never assume consent.'
            parameters = @{
                type = 'object'; additionalProperties = $false; required = @('question', 'impact', 'choices')
                properties = @{
                    question = @{ type = 'string'; minLength = 1; maxLength = 1500 }
                    impact = @{ type = 'string'; enum = @('scope', 'behavior', 'contract', 'acceptance', 'security', 'cost', 'consent') }
                    choices = @{ type = 'array'; maxItems = 5; items = @{ type = 'string'; minLength = 1; maxLength = 300 } }
                }
            }
        } }
        @{ type = 'function'; function = @{
            name = 'propose_plan'; description = 'Present or revise the high-level plan. Guided runs suspend for approval; revisions invalidate prior approval.'
            parameters = @{
                type = 'object'; additionalProperties = $false; required = @('goal', 'scope', 'nonGoals', 'assumptions', 'steps')
                properties = @{
                    goal = @{ type = 'string'; minLength = 1; maxLength = 1500 }
                    scope = $textList; nonGoals = $textList; assumptions = $textList
                    steps = @{
                        type = 'array'; minItems = 1; maxItems = 10
                        items = @{
                            type = 'object'; additionalProperties = $false; required = @('title', 'verification')
                            properties = @{
                                title = @{ type = 'string'; minLength = 1; maxLength = 300 }
                                verification = @{ type = 'string'; minLength = 1; maxLength = 600 }
                            }
                        }
                    }
                }
            }
        } }
        @{ type = 'function'; function = @{
            name = 'report_progress'; description = 'Report a current milestone outcome and honest evidence; this does not grant approval or certify review/tests.'
            parameters = @{
                type = 'object'; additionalProperties = $false; required = @('planVersion', 'stepId', 'status', 'summary', 'evidence')
                properties = @{
                    planVersion = @{ type = 'integer'; minimum = 1 }
                    stepId = @{ type = 'string'; pattern = '^s([1-9]|10)$' }
                    status = @{ type = 'string'; enum = @('in_progress', 'completed', 'blocked') }
                    summary = @{ type = 'string'; minLength = 1; maxLength = 1000 }
                    evidence = @{ type = 'string'; minLength = 1; maxLength = 1500 }
                }
            }
        } }
    )
}

function Get-RunnerSessionPath([string]$SessionId, [string]$Root, [string]$Suffix = '.json') {
    if ($SessionId -cnotmatch '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$') { throw 'Invalid session ID.' }
    $rootPath = [IO.Path]::GetFullPath($Root)
    $current = $rootPath
    foreach ($segment in @('.frontier', 'sessions', "$SessionId$Suffix")) {
        $current = Join-Path $current $segment
        $item = Get-Item -LiteralPath $current -Force -ErrorAction SilentlyContinue
        if ($item -and (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType -eq 'HardLink')) {
            throw 'Session storage must not contain links.'
        }
    }
    return $current
}

function Enter-RunnerSession([string]$SessionId, [string]$Root) {
    $file = Get-RunnerSessionPath $SessionId $Root '.lock'
    [void][IO.Directory]::CreateDirectory((Split-Path $file -Parent))
    try { return [IO.File]::Open($file, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch [IO.IOException] { throw "Session '$SessionId' already has an active writer or its lock is unavailable." }
}
