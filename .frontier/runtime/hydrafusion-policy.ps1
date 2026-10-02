#Requires -Version 7.0
param([string]$PolicyPath = '')

function Resolve-HydraFusionPolicyPath {
    param([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$Path)
    if ($Path -match '[\x00-\x1f]' -or $Path -match '^[\\/]{2}|^\\\\\?') {
        throw 'Unsafe candidate path.'
    }
    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $full = if ([IO.Path]::IsPathFullyQualified($Path)) { [IO.Path]::GetFullPath($Path) }
        else { [IO.Path]::GetFullPath([IO.Path]::Combine($rootPath, $Path)) }
    $comparison = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
    if (-not $full.Equals($rootPath, $comparison) -and
        -not $full.StartsWith($rootPath + [IO.Path]::DirectorySeparatorChar, $comparison)) {
        throw 'Candidate tool path is outside its isolated workspace.'
    }
    $relative = [IO.Path]::GetRelativePath($rootPath, $full).Replace('\', '/')
    if ($relative -match ':|(^|/)\.\.(/|$)') { throw 'Unsafe candidate path.' }
    $current = $full
    while ($current) {
        if ([IO.File]::Exists($current) -or [IO.Directory]::Exists($current)) {
            if ([IO.File]::GetAttributes($current) -band [IO.FileAttributes]::ReparsePoint) {
                throw 'Candidate paths must not traverse links or reparse points.'
            }
        }
        if ($current.Equals($rootPath, $comparison)) { break }
        $current = [IO.Path]::GetDirectoryName($current)
    }
    return $relative
}

function Test-HydraFusionSensitivePath([string]$Path) {
    return $Path -match '(?i)(^|/)(\.env[^/]*|\.npmrc|\.pypirc|\.netrc|\.git-credentials|\.gitconfig|\.ssh|\.aws|\.azure|\.kube|\.gnupg|\.docker|\.config/(gh|gcloud)|credentials(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|tokens?\.json|id_(rsa|dsa|ecdsa|ed25519))(/|$)|\.(pem|key|pfx|p12|jks|keystore|kdbx)$'
}

function Test-HydraFusionProtectedPath([string]$Path) {
    return $Path -match '(?i)(^|/)(\.git|\.frontier|\.agentx|\.claude|\.copilot|\.vscode)(/|$)|(^|/)AGENTS\.md$|(^|/)CLAUDE\.md$|^\.github/(hooks|copilot|agents|instructions)(/|$)|(^|/)(plugin\.json|mcp\.json)$'
}

function Test-HydraFusionPathAllowed {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][System.Collections.IDictionary]$Rules)
    $relative = $Path.Replace('\', '/')
    if ([string]::IsNullOrWhiteSpace($relative) -or $relative -match '^[\\/]|:|[\x00-\x1f]|(^|/)\.\.?(/|$)' -or
        (Test-HydraFusionSensitivePath $relative) -or (Test-HydraFusionProtectedPath $relative)) { return $false }
    foreach ($pattern in @($Rules['cannotModify'])) {
        if (-not $pattern) { continue }
        $regex = '^' + ([regex]::Escape(([string]$pattern).Replace('\', '/')).
            Replace('\*\*', '.*').Replace('\*', '[^/]*').Replace('\?', '.')) + '$'
        if ($relative -match $regex) { return $false }
    }
    foreach ($pattern in @($Rules['canModify'])) {
        if (-not $pattern) { continue }
        $regex = '^' + ([regex]::Escape(([string]$pattern).Replace('\', '/')).
            Replace('\*\*', '.*').Replace('\*', '[^/]*').Replace('\?', '.')) + '$'
        if ($relative -match $regex) { return $true }
    }
    return $false
}

function Get-HydraFusionPolicyDecision {
    param([System.Collections.IDictionary]$Policy, [System.Collections.IDictionary]$InputData)
    $deny = { param($Reason) @{ permissionDecision = 'deny'; permissionDecisionReason = [string]$Reason } }
    if ($Policy['schemaVersion'] -ne 1 -or $Policy['workspace'] -isnot [string] -or
        $Policy['rules'] -isnot [System.Collections.IDictionary]) { return & $deny 'Invalid Frontier candidate policy.' }
    $tool = if ($InputData.Contains('toolName')) { [string]$InputData['toolName'] } else { [string]$InputData['tool_name'] }
    $arguments = if ($InputData.Contains('toolArgs')) { $InputData['toolArgs'] } else { $InputData['tool_input'] }
    if ($arguments -is [string]) {
        try { $arguments = ConvertFrom-Json -InputObject $arguments -AsHashtable -Depth 15 -ErrorAction Stop }
        catch { return & $deny 'Malformed candidate tool arguments.' }
    }
    if ($arguments -isnot [System.Collections.IDictionary]) { return & $deny 'Candidate tool arguments must be an object.' }
    $tool = $tool.ToLowerInvariant()
    $readTools = @('view', 'read', 'grep', 'rg', 'glob')
    $writeTools = @('create', 'write', 'edit', 'str_replace_editor', 'apply_patch')
    if ($tool -notin $readTools -and $tool -notin $writeTools) {
        return & $deny "Tool '$tool' is unavailable in the isolated read/edit pilot."
    }
    $paths = [Collections.Generic.List[string]]::new()
    foreach ($key in @('path', 'filePath', 'file_path', 'old_path', 'new_path', 'cwd', 'directory')) {
        if ($arguments.Contains($key)) {
            if ($arguments[$key] -isnot [string]) { return & $deny 'Candidate file paths must be strings.' }
            $paths.Add($arguments[$key])
        }
    }
    foreach ($key in @('paths', 'directories')) {
        if (-not $arguments.Contains($key)) { continue }
        if ($arguments[$key] -isnot [array] -and $arguments[$key] -isnot [string]) { return & $deny 'Invalid search paths.' }
        foreach ($path in @($arguments[$key])) {
            if ($path -isnot [string]) { return & $deny 'Search paths must be strings.' }
            $paths.Add($path)
        }
    }
    if ($tool -eq 'glob' -and $arguments.Contains('pattern')) {
        if ($arguments['pattern'] -isnot [string]) { return & $deny 'Glob pattern must be a string.' }
        $paths.Add($arguments['pattern'])
    }
    if ($tool -eq 'apply_patch') {
        $patch = if ($arguments.Contains('patch')) { $arguments['patch'] } else { $arguments['input'] }
        if ($patch -isnot [string]) { return & $deny 'A patch must have inspectable file headers.' }
        foreach ($match in [regex]::Matches($patch, '(?m)^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+?)\r?$')) {
            $paths.Add($match.Groups[1].Value)
        }
    }
    if ($tool -in $writeTools -and ($Policy['readOnly'] -ne $false -or $paths.Count -eq 0)) {
        return & $deny 'File edits require a writable role and explicit in-scope paths.'
    }
    if ($paths.Count -eq 0) { $paths.Add('.') }
    try {
        if ($InputData.Contains('cwd')) { $null = Resolve-HydraFusionPolicyPath $Policy['workspace'] ([string]$InputData['cwd']) }
        foreach ($path in $paths) {
            $relative = Resolve-HydraFusionPolicyPath -Root $Policy['workspace'] -Path $path
            if ($relative -ne '.' -and (Test-HydraFusionSensitivePath $relative)) { return & $deny 'Sensitive candidate paths are unavailable.' }
            if ($relative -match '(^|/)\.git(/|$)|^\.frontier/') { return & $deny 'Runtime and Git control state are unavailable to candidate tools.' }
            if ($tool -in $writeTools -and -not (Test-HydraFusionPathAllowed $relative $Policy['rules'])) {
                return & $deny "The role cannot modify '$relative'."
            }
        }
    } catch { return & $deny $_.Exception.Message }
    return @{ permissionDecision = 'allow' }
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        if (-not $PolicyPath) { throw 'A trusted candidate policy is required.' }
        $policy = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($PolicyPath)) -AsHashtable -Depth 15
        $raw = [Console]::In.ReadToEnd()
        if ($raw.Length -gt 1048576) { throw 'Candidate hook input exceeds its limit.' }
        $inputData = ConvertFrom-Json -InputObject $raw -AsHashtable -Depth 20
        if ($inputData -isnot [System.Collections.IDictionary]) { throw 'Candidate hook input must be an object.' }
        $decision = Get-HydraFusionPolicyDecision $policy $inputData
        if ($policy['auditPath'] -isnot [string]) { throw 'The policy audit sink is missing.' }
        $audit = @{
            at = [DateTime]::UtcNow.ToString('o')
            tool = $(if ($inputData.Contains('toolName')) { $inputData['toolName'] } else { $inputData['tool_name'] })
            decision = $decision['permissionDecision']
        } | ConvertTo-Json -Compress
        $stream = $null
        for ($attempt = 0; $attempt -lt 10 -and $null -eq $stream; $attempt++) {
            try { $stream = [IO.File]::Open($policy['auditPath'], [IO.FileMode]::Append, [IO.FileAccess]::Write, [IO.FileShare]::Read) }
            catch [IO.IOException] {
                if (($_.Exception.HResult -band 0xffff) -notin @(32, 33, 11) -or $attempt -eq 9) { throw }
                Start-Sleep -Milliseconds 20
            }
        }
        try {
            $bytes = [Text.Encoding]::UTF8.GetBytes($audit + "`n")
            if ($stream.Length + $bytes.Length -gt 1048576) { throw 'Candidate policy audit limit reached.' }
            $stream.Write($bytes, 0, $bytes.Length)
        } finally { $stream.Dispose() }
        [Console]::Out.WriteLine((ConvertTo-Json -InputObject $decision -Compress))
    } catch {
        [Console]::Out.WriteLine((@{
            permissionDecision = 'deny'; permissionDecisionReason = "Frontier candidate policy failed: $($_.Exception.Message)"
        } | ConvertTo-Json -Compress))
        exit 2
    }
}
