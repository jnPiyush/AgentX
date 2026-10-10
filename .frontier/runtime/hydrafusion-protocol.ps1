#Requires -Version 7.0

function Stop-HydraFusionOperation([string]$Reason, [string]$Message) {
    $exception = [InvalidOperationException]::new($Message)
    $exception.Data['hydraFusionReason'] = $Reason
    throw $exception
}

function Get-HydraFusionProcessIdentity([Diagnostics.Process]$Process) {
    $watch = [Diagnostics.Stopwatch]::StartNew()
    do {
        $Process.Refresh()
        if ($Process.HasExited) { throw 'Process exited before its identity could be captured.' }
        # Windows may not expose MainModule immediately after Process.Start.
        $module = $Process.MainModule
        if ($null -ne $module -and -not [string]::IsNullOrWhiteSpace($module.FileName)) {
            return @{
                pid = $Process.Id
                startTicks = $Process.StartTime.ToUniversalTime().Ticks
                executable = $module.FileName
            }
        }
        Start-Sleep -Milliseconds 10
    } while ($watch.ElapsedMilliseconds -lt 1000)
    throw 'Process executable identity is unavailable after the startup deadline.'
}

function Get-HydraFusionOwnedProcess($Identity) {
    if ($Identity -isnot [System.Collections.IDictionary] -or
        ($Identity['pid'] -isnot [int] -and $Identity['pid'] -isnot [long]) -or $Identity['pid'] -le 0 -or
        ($Identity['startTicks'] -isnot [long] -and $Identity['startTicks'] -isnot [int]) -or $Identity['startTicks'] -le 0 -or
        $Identity['executable'] -isnot [string] -or [string]::IsNullOrWhiteSpace($Identity['executable'])) {
        throw 'A valid process identity is required before recovery.'
    }
    try { $process = [Diagnostics.Process]::GetProcessById([int]$Identity['pid']) }
    catch [ArgumentException] { return $null }
    if ($process.StartTime.ToUniversalTime().Ticks -ne [long]$Identity['startTicks']) {
        $process.Dispose()
        return $null
    }
    if ($process.MainModule.FileName -ne $Identity['executable']) {
        $process.Dispose()
        throw 'Process identity changed; recovery will not terminate an unrelated process.'
    }
    return $process
}

function Invoke-HydraFusionProcess {
    param(
        [Parameter(Mandatory)][string]$FileName,
        [string[]]$Arguments = @(),
        [Parameter(Mandatory)][string]$WorkingDirectory,
        [ValidateRange(1, 86400)][int]$TimeoutSeconds = 60,
        [ValidateRange(1024, 67108864)][int]$MaxOutputBytes = 8388608,
        [hashtable]$Environment = @{},
        [switch]$PrivateEnvironment,
        [string]$InputText = '',
        [scriptblock]$OnStdoutLine,
        [string]$LifecyclePath = '',
        [Threading.CancellationToken]$CancellationToken = [Threading.CancellationToken]::None
    )
    $start = [Diagnostics.ProcessStartInfo]::new($FileName)
    $start.WorkingDirectory = $WorkingDirectory
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false, $true)
    $start.StandardErrorEncoding = [Text.UTF8Encoding]::new($false, $true)
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    if ($PrivateEnvironment) {
        foreach ($key in @($start.Environment.Keys)) {
            if ($key -notin @('PATH', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL')) {
                [void]$start.Environment.Remove($key)
            }
        }
    }
    foreach ($key in $Environment.Keys) {
        if ($null -eq $Environment[$key]) { [void]$start.Environment.Remove($key) }
        else { $start.Environment[$key] = [string]$Environment[$key] }
    }
    $stdout = [Text.StringBuilder]::new()
    $stderr = [Text.StringBuilder]::new()
    $process = $null
    $failure = ''
    $reason = ''
    $exitCode = -1
    $terminated = $true
    $lifecycle = $null
    $watch = [Diagnostics.Stopwatch]::StartNew()
    try {
        if ($LifecyclePath) {
            $owner = [Diagnostics.Process]::GetCurrentProcess()
            try { $ownerIdentity = Get-HydraFusionProcessIdentity $owner } finally { $owner.Dispose() }
            $lifecycle = @{
                schemaVersion = 1; phase = 'launching'; owner = $ownerIdentity; child = $null
                terminationConfirmed = $false; exitReason = ''; startedAt = [DateTime]::UtcNow.ToString('o')
            }
            Write-HydraFusionJson $LifecyclePath $lifecycle
        }
        $CancellationToken.ThrowIfCancellationRequested()
        $process = [Diagnostics.Process]::Start($start)
        if ($lifecycle) {
            $lifecycle['child'] = Get-HydraFusionProcessIdentity $process
            $lifecycle['phase'] = 'running'
            Write-HydraFusionJson $LifecyclePath $lifecycle
        }
        $process.StandardInput.AutoFlush = $true
        $inputTask = if ($InputText.Length) { $process.StandardInput.WriteAsync($InputText) } else { $null }
        $inputClosed = $false
        $inputFailure = ''
        if ($null -eq $inputTask) { $process.StandardInput.Close(); $inputClosed = $true }
        # Fixed-size reads bound partial lines as well as complete JSON records.
        $outBuffer = [char[]]::new(4096)
        $errBuffer = [char[]]::new(4096)
        $outTask = $process.StandardOutput.ReadAsync($outBuffer, 0, $outBuffer.Length)
        $errTask = $process.StandardError.ReadAsync($errBuffer, 0, $errBuffer.Length)
        $pending = [Text.StringBuilder]::new()
        $bytes = 0L
        $outClosed = $false
        $errClosed = $false
        while (-not ($inputClosed -and $outClosed -and $errClosed -and $process.HasExited)) {
            $CancellationToken.ThrowIfCancellationRequested()
            if ($watch.Elapsed.TotalSeconds -ge $TimeoutSeconds) {
                Stop-HydraFusionOperation 'timeout' "Process exceeded the $TimeoutSeconds second deadline."
            }
            if (-not $inputClosed -and $inputTask.IsCompleted) {
                try {
                    $inputTask.GetAwaiter().GetResult()
                    $process.StandardInput.Close()
                } catch { $inputFailure = $_.Exception.Message }
                $inputClosed = $true
            }
            foreach ($stream in @('stdout', 'stderr')) {
                $task = if ($stream -eq 'stdout') { $outTask } else { $errTask }
                if ($null -eq $task -or -not $task.IsCompleted) { continue }
                $count = $task.GetAwaiter().GetResult()
                if ($count -eq 0) {
                    if ($stream -eq 'stdout') { $outClosed = $true; $outTask = $null }
                    else { $errClosed = $true; $errTask = $null }
                    continue
                }
                $buffer = if ($stream -eq 'stdout') { $outBuffer } else { $errBuffer }
                $text = [string]::new($buffer, 0, $count)
                $bytes += [Text.Encoding]::UTF8.GetByteCount($text)
                if ($bytes -gt $MaxOutputBytes) {
                    Stop-HydraFusionOperation 'output_limit' "Process output exceeded $MaxOutputBytes bytes."
                }
                if ($stream -eq 'stdout') {
                    [void]$stdout.Append($text)
                    if ($OnStdoutLine) {
                        [void]$pending.Append($text)
                        $lines = $pending.ToString().Split("`n")
                        for ($index = 0; $index -lt $lines.Length - 1; $index++) {
                            & $OnStdoutLine $lines[$index].TrimEnd("`r") | Out-Null
                        }
                        [void]$pending.Clear().Append($lines[-1])
                    }
                    $outTask = $process.StandardOutput.ReadAsync($outBuffer, 0, $outBuffer.Length)
                } else {
                    [void]$stderr.Append($text)
                    $errTask = $process.StandardError.ReadAsync($errBuffer, 0, $errBuffer.Length)
                }
            }
            Start-Sleep -Milliseconds 10
        }
        if ($OnStdoutLine -and $pending.Length) { & $OnStdoutLine $pending.ToString() | Out-Null }
        $exitCode = $process.ExitCode
        if ($inputFailure -and $exitCode -eq 0) {
            Stop-HydraFusionOperation 'input_error' "Process did not receive its complete input: $inputFailure"
        }
    } catch {
        $failure = $_.Exception.Message
        $reason = if ($CancellationToken.IsCancellationRequested -or $_.Exception -is [OperationCanceledException]) { 'cancelled' }
            elseif ($_.Exception.Data.Contains('hydraFusionReason')) { [string]$_.Exception.Data['hydraFusionReason'] }
            else { 'error' }
    } finally {
        # Pipeline cancellation may bypass catch, but finally still closes the owned execution.
        if ($exitCode -eq -1 -and -not $reason) { $reason = 'cancelled'; $failure = 'The owner interrupted the process invocation.' }
        if ($null -ne $process) {
            try {
                if (-not $process.HasExited) {
                    $process.Kill($true)
                    if (-not $process.WaitForExit(10000)) { throw 'The owned process did not exit after tree termination.' }
                }
            } catch {
                $terminated = $false
                $failure = "$failure Process-tree termination is unconfirmed: $($_.Exception.Message)".Trim()
                $reason = 'termination_unconfirmed'
            } finally { $process.Dispose() }
        }
        if ($lifecycle) {
            $lifecycle['phase'] = 'stopped'
            $lifecycle['terminationConfirmed'] = $terminated
            $lifecycle['exitReason'] = $reason
            $lifecycle['finishedAt'] = [DateTime]::UtcNow.ToString('o')
            try { Write-HydraFusionJson $LifecyclePath $lifecycle }
            catch {
                $failure = "$failure Process receipt could not be written: $($_.Exception.Message)".Trim()
                $reason = 'recovery_required'
            }
        }
    }
    return [pscustomobject]@{
        exitCode = $exitCode; stdout = $stdout.ToString(); stderr = $stderr.ToString()
        exitReason = $reason; error = $failure; timedOut = $reason -eq 'timeout'
        terminationConfirmed = $terminated; elapsedMs = $watch.ElapsedMilliseconds
    }
}

function Get-HydraFusionRequiredText($Data, [string]$Key) {
    if ($Data -isnot [System.Collections.IDictionary] -or $Data[$Key] -isnot [string] -or
        [string]::IsNullOrWhiteSpace($Data[$Key]) -or $Data[$Key].Length -gt 4096) {
        Stop-HydraFusionOperation 'protocol_error' "Protocol field '$Key' must be a non-empty bounded string."
    }
    return [string]$Data[$Key]
}

function New-HydraFusionProtocolState([ValidateRange(1, 1000)][int]$MaxModelCalls) {
    return @{
        routes = @{}; phases = @{}; models = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        calls = 0; toolCalls = 0; maxCalls = $MaxModelCalls; finalText = ''; result = $null
        followUpModels = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    }
}

function Add-HydraFusionProtocolEvent {
    param([hashtable]$State, [System.Collections.IDictionary]$Record)
    $type = Get-HydraFusionRequiredText $Record 'type'
    $data = $Record['data']
    $known = @('session.fusion_resolved', 'assistant.fusion_phase_started', 'assistant.fusion_phase_completed',
        'session.fusion_completed', 'model.call_start', 'assistant.message', 'result')
    if ($type -notin $known) { return }
    if ($null -ne $State.result) { Stop-HydraFusionOperation 'protocol_error' 'An execution event followed the terminal result.' }
    if ($type -ne 'result' -and $data -isnot [System.Collections.IDictionary]) {
        Stop-HydraFusionOperation 'protocol_error' "Event '$type' has no data object."
    }
    switch ($type) {
        'session.fusion_resolved' {
            $id = Get-HydraFusionRequiredText $data 'fusionId'
            $null = Get-HydraFusionRequiredText $data 'syntheticModel'
            $null = Get-HydraFusionRequiredText $data 'pattern'
            if ($data['syntheticModel'] -cne 'hydrafusion' -or $data['pattern'] -cnotin @('single', 'cascade', 'critique') -or
                $State.routes.ContainsKey($id) -or ($data.Contains('contractVersion') -and $data['contractVersion'] -ne 1)) {
                Stop-HydraFusionOperation 'protocol_error' 'Invalid or duplicate HydraFusion route.'
            }
            $State.routes[$id] = @{ pattern = $data['pattern']; outcome = ''; degradedReason = $null }
        }
        'assistant.fusion_phase_started' {
            $route = Get-HydraFusionRequiredText $data 'fusionId'
            $phase = Get-HydraFusionRequiredText $data 'phaseId'
            $model = Get-HydraFusionRequiredText $data 'model'
            if (-not $State.routes.ContainsKey($route) -or $State.phases.ContainsKey($phase)) {
                Stop-HydraFusionOperation 'protocol_error' 'Phase has no resolved route or duplicates an existing phase.'
            }
            $State.phases[$phase] = @{ fusionId = $route; model = $model; status = ''; role = [string]$data['role'] }
            [void]$State.models.Add($model)
        }
        'assistant.fusion_phase_completed' {
            $phase = Get-HydraFusionRequiredText $data 'phaseId'
            if (-not $State.phases.ContainsKey($phase) -or $State.phases[$phase].status -or
                $State.phases[$phase].fusionId -cne $data['fusionId'] -or $State.phases[$phase].model -cne $data['model']) {
                Stop-HydraFusionOperation 'protocol_error' 'Phase completion does not match a started phase.'
            }
            $State.phases[$phase].status = Get-HydraFusionRequiredText $data 'status'
        }
        'session.fusion_completed' {
            $id = Get-HydraFusionRequiredText $data 'fusionId'
            if (-not $State.routes.ContainsKey($id) -or $State.routes[$id].outcome -or
                $data['syntheticModel'] -cne 'hydrafusion' -or $data['pattern'] -cne $State.routes[$id].pattern) {
                Stop-HydraFusionOperation 'protocol_error' 'Completion requires a matching resolved HydraFusion route.'
            }
            $State.routes[$id].outcome = Get-HydraFusionRequiredText $data 'outcome'
            $State.routes[$id].degradedReason = $data['degradedReason']
            if ($data['followUpModel']) { [void]$State.followUpModels.Add((Get-HydraFusionRequiredText $data 'followUpModel')) }
        }
        'model.call_start' {
            $model = Get-HydraFusionRequiredText $data 'model'
            if ($State.routes.Count -eq 0) { Stop-HydraFusionOperation 'hydrafusion_not_engaged' 'A model call preceded a resolved HydraFusion route.' }
            $active = @($State.phases.Values | Where-Object { $_.model -ceq $model -and -not $_.status })
            if (-not $active.Count -and -not $State.followUpModels.Contains($model)) {
                Stop-HydraFusionOperation 'protocol_error' 'A model call is not bound to a started phase or declared follow-up model.'
            }
            $State.calls++
            if ($State.calls -gt $State.maxCalls) { Stop-HydraFusionOperation 'call_limit' 'HydraFusion model-call limit exceeded.' }
            [void]$State.models.Add($model)
        }
        'assistant.message' {
            if ($data.Contains('content') -and $data['content'] -isnot [string]) {
                Stop-HydraFusionOperation 'protocol_error' 'Assistant content must be a string.'
            }
            if ($data['content'] -and [string]$data['phase'] -in @('', 'final_answer')) { $State.finalText = $data['content'] }
            if ($data.Contains('toolRequests') -and $null -ne $data['toolRequests']) {
                if ($data['toolRequests'] -isnot [array]) { Stop-HydraFusionOperation 'protocol_error' 'toolRequests must be an array.' }
                $State.toolCalls += $data['toolRequests'].Count
            }
        }
        'result' {
            if ($Record['exitCode'] -isnot [int] -and $Record['exitCode'] -isnot [long]) {
                Stop-HydraFusionOperation 'protocol_error' 'Terminal result requires an integer exitCode.'
            }
            $null = Get-HydraFusionRequiredText $Record 'sessionId'
            $State.result = $Record
        }
    }
}

function Complete-HydraFusionProtocol([hashtable]$State, [int]$ProcessExitCode) {
    if ($ProcessExitCode -ne 0 -or $null -eq $State.result -or $State.result['exitCode'] -ne 0) {
        Stop-HydraFusionOperation 'protocol_error' 'A successful process and terminal result are required.'
    }
    if ($State.routes.Count -eq 0 -or $State.phases.Count -eq 0 -or $State.calls -lt 1 -or -not $State.finalText) {
        Stop-HydraFusionOperation 'protocol_error' 'HydraFusion route, phase and final-response evidence are required.'
    }
    foreach ($routeId in $State.routes.Keys) {
        $route = $State.routes[$routeId]
        if ($route.outcome -cne 'completed' -or $route.degradedReason) {
            Stop-HydraFusionOperation 'hydrafusion_degraded' 'A fusion did not complete successfully without degradation.'
        }
        if (@($State.phases.Values | Where-Object { $_.fusionId -ceq $routeId }).Count -eq 0) {
            Stop-HydraFusionOperation 'protocol_error' 'Every resolved fusion must have phase evidence.'
        }
    }
    foreach ($phase in $State.phases.Values) {
        if ($phase.status -cne 'succeeded') { Stop-HydraFusionOperation 'hydrafusion_degraded' 'A phase failed or did not report completion.' }
    }
}

function ConvertFrom-HydraFusionUsage([string]$Text) {
    $usage = ConvertFrom-Json -InputObject $Text -AsHashtable -Depth 25 -ErrorAction Stop
    if ($usage -isnot [System.Collections.IDictionary] -or $usage['codeChanges'] -isnot [System.Collections.IDictionary] -or
        $usage['codeChanges']['filesModified'] -isnot [array]) {
        Stop-HydraFusionOperation 'usage_error' 'Usage filesModified must be an array, including for a no-change run.'
    }
    $paths = [Collections.Generic.List[string]]::new()
    foreach ($path in $usage['codeChanges']['filesModified']) {
        if ($path -isnot [string] -or [string]::IsNullOrWhiteSpace($path) -or $path -match '[\x00-\x1f]') {
            Stop-HydraFusionOperation 'usage_error' 'Usage filesModified contains an invalid path.'
        }
        $paths.Add($path)
    }
    if (($usage['totalNanoAiu'] -isnot [long] -and $usage['totalNanoAiu'] -isnot [int]) -or $usage['totalNanoAiu'] -lt 0) {
        Stop-HydraFusionOperation 'usage_error' 'Usage totalNanoAiu must be a non-negative integer; unknown cost is not zero.'
    }
    return @{ nanoCredits = [long]$usage['totalNanoAiu']; filesModified = [string[]]$paths.ToArray(); raw = $usage }
}
