#Requires -Version 7.4

function Get-RepositoryTextHash([string]$Text) {
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData(
        [Text.Encoding]::UTF8.GetBytes($Text))).ToLowerInvariant()
}

function ConvertTo-RepositoryMetadataText([string]$Text, [int]$Maximum = 400) {
    $text = [regex]::Replace($Text, '[\p{Cc}\u202A-\u202E\u2066-\u2069]', ' ')
    $text = [regex]::Replace($text, '(?i)\b(password|secret|api[_-]?key|token)\s*[:=]\s*["''][^"'']*["'']', '$1=[redacted]')
    $text = [regex]::Replace($text, '\s+', ' ').Trim()
    $length = [Math]::Min($Maximum, $text.Length)
    if ($length -gt 0 -and [char]::IsHighSurrogate($text[$length - 1])) { $length-- }
    return $text.Substring(0, $length)
}

function Invoke-RepositoryParserProcess {
    param(
        [Parameter(Mandatory)][string]$Executable,
        [Parameter(Mandatory)][string[]]$Arguments,
        [string]$InputText = '',
        [int]$TimeoutSeconds = 30
    )
    if ([Text.Encoding]::UTF8.GetByteCount($InputText) -gt 16MB) { throw 'Parser input exceeds 16 MiB.' }
    $start = [Diagnostics.ProcessStartInfo]::new($Executable)
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false, $true)
    $start.WorkingDirectory = $PSScriptRoot
    [void]$start.Environment.Remove('NODE_OPTIONS')
    [void]$start.Environment.Remove('NODE_PATH')
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    if (-not ('Frontier.RepositoryContext.BoundedProcessV1' -as [type])) {
        Add-Type -Path (Join-Path $PSScriptRoot 'repository-process.cs')
    }
    $result = [Frontier.RepositoryContext.BoundedProcessV1]::Run($start, $InputText, $TimeoutSeconds, 16MB)
    if ($result.ExitCode -ne 0) { throw "Repository parser failed: $($result.Error.Trim())" }
    return $result.Output | ConvertFrom-Json -AsHashtable -Depth 20 -ErrorAction Stop
}

function Get-FrontierRepositoryParserCapabilities([string]$WorkspaceRoot) {
    $diagnostics = [Collections.Generic.List[string]]::new()
    $node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $nodePath = ''
    if ($node) {
        $rootPrefix = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($WorkspaceRoot)) + [IO.Path]::DirectorySeparatorChar
        if ([IO.Path]::GetFullPath($node.Source).StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            $diagnostics.Add('Refusing a Node executable inside the analyzed workspace.')
        } else { $nodePath = $node.Source }
    } else { $diagnostics.Add('Node is unavailable; non-PowerShell files use explicit lexical fallback.') }
    $managed = @{ available = @(); identity = 'unavailable'; diagnostics = @() }
    if ($nodePath) {
        try {
            $managed = Invoke-RepositoryParserProcess $nodePath @(
                (Join-Path $PSScriptRoot 'repository-parser' 'index.js'), '--capabilities'
            ) -TimeoutSeconds 15
            if ($managed.version -ne 1 -or $managed.available -isnot [array] -or
                $managed.identity -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid managed parser capability response.' }
            foreach ($message in @($managed.diagnostics)) { $diagnostics.Add([string]$message) }
        } catch {
            $diagnostics.Add("Managed parser unavailable: $($_.Exception.Message)")
            $managed = @{ available = @(); identity = 'unavailable'; diagnostics = @() }
        }
    }
    $identity = @(
        'repository-symbols-v2',
        $PSVersionTable.PSVersion.ToString(),
        (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'repository-parser-worker.ps1') -Algorithm SHA256).Hash,
        (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'repository-symbols.ps1') -Algorithm SHA256).Hash,
        (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'repository-process.cs') -Algorithm SHA256).Hash,
        (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'repository-context.ps1') -Algorithm SHA256).Hash,
        $managed.identity
    ) -join '|'
    return @{
        identity = Get-RepositoryTextHash $identity
        node = $nodePath
        available = @('.ps1', '.psm1', '.psd1') + @($managed.available)
        diagnostics = @($diagnostics)
        managedIdentity = $managed.identity
    }
}

function Invoke-FrontierRepositoryParseBatch {
    param([array]$Files, [hashtable]$Capabilities, [ValidateSet('powershell', 'managed')][string]$Kind)
    if ($Files.Count -eq 0) { return @() }
    $request = @{ version = 1; files = @($Files | ForEach-Object { @{ path = $_.path; text = $_.text } }) }
    $text = $request | ConvertTo-Json -Depth 5 -Compress
    if ($Kind -eq 'powershell') {
        $executable = Join-Path $PSHOME $(if ($IsWindows) { 'pwsh.exe' } else { 'pwsh' })
        $arguments = @('-NoProfile', '-NonInteractive', '-File', (Join-Path $PSScriptRoot 'repository-parser-worker.ps1'))
    } else {
        if (-not $Capabilities.node) { throw 'Managed parser unavailable.' }
        $executable = $Capabilities.node
        $arguments = @((Join-Path $PSScriptRoot 'repository-parser' 'index.js'))
    }
    try { $result = Invoke-RepositoryParserProcess $executable $arguments $text }
    catch {
        $paths = ConvertTo-RepositoryMetadataText (($Files | ForEach-Object { $_.path }) -join ', ') 600
        throw "Repository $Kind parser batch failed for [$paths]: $($_.Exception.Message)"
    }
    if ($result.version -ne 1 -or $result.results -isnot [array] -or $result.results.Count -ne $Files.Count) {
        throw 'Repository parser returned an invalid batch shape.'
    }
    for ($index = 0; $index -lt $Files.Count; $index++) {
        $entry = $result.results[$index]
        if ($entry.path -cne $Files[$index].path -or $entry.symbols -isnot [array] -or
            $entry.calls -isnot [array] -or $entry.references -isnot [array] -or
            $entry.symbols.Count -gt 8192 -or $entry.calls.Count -gt 8192 -or $entry.references.Count -gt 8192) {
            throw 'Repository parser returned mismatched paths or unbounded metadata.'
        }
        Write-Output $entry
    }
}

function ConvertTo-FrontierRepositorySymbols {
    param([string]$Path, [array]$Symbols, [string]$Parser,
        [Collections.Generic.List[string]]$Diagnostics = $null)
    $occurrences = @{}
    $dropped = 0
    foreach ($symbol in $Symbols) {
        $name = ConvertTo-RepositoryMetadataText ([string]$symbol.Name) 160
        $kind = ConvertTo-RepositoryMetadataText ([string]$symbol.Kind) 40
        if (-not $name -or -not $kind) { $dropped++; continue }
        if ([int]$symbol.Line -lt 1) { throw "Parser returned an invalid symbol location in '$Path'." }
        $qualified = if ($symbol -is [System.Collections.IDictionary] -and $symbol.Contains('QualifiedName')) {
            [string]$symbol.QualifiedName
        } elseif ($symbol.PSObject.Properties['QualifiedName']) { [string]$symbol.QualifiedName } else { $name }
        $qualified = ConvertTo-RepositoryMetadataText $qualified 400
        $parent = if ($symbol -is [System.Collections.IDictionary] -and $symbol.Contains('ParentName')) {
            [string]$symbol.ParentName
        } elseif ($symbol.PSObject.Properties['ParentName']) { [string]$symbol.ParentName } else { '' }
        $endLine = if ($symbol -is [System.Collections.IDictionary] -and $symbol.Contains('EndLine')) {
            [int]$symbol.EndLine
        } elseif ($symbol.PSObject.Properties['EndLine']) { [int]$symbol.EndLine } else { [int]$symbol.Line }
        if ($endLine -lt [int]$symbol.Line) { throw "Parser returned an invalid symbol range in '$Path'." }
        $signature = if ($symbol -is [System.Collections.IDictionary] -and $symbol.Contains('Signature')) {
            [string]$symbol.Signature
        } elseif ($symbol.PSObject.Properties['Signature']) { [string]$symbol.Signature } else { "$kind $name" }
        $key = "$kind|$qualified"
        $ordinal = if ($occurrences.ContainsKey($key)) { [int]$occurrences[$key] + 1 } else { 0 }
        $occurrences[$key] = $ordinal
        [pscustomobject][ordered]@{
            id = Get-RepositoryTextHash "$Path|$kind|$qualified|$ordinal"
            Name = $name; Kind = $kind; QualifiedName = $qualified; ParentName = $parent
            Line = [int]$symbol.Line; EndLine = $endLine
            Signature = ConvertTo-RepositoryMetadataText $signature
            parser = $Parser
            confidence = $(if ($Parser -like 'lexical*') { 'heuristic' } else { 'observed' })
        }
    }
    if ($dropped) {
        $message = "Dropped $dropped symbol(s) with empty or unsafe normalized names in '$Path'."
        if ($null -ne $Diagnostics) { $Diagnostics.Add($message) }
        [Console]::Error.WriteLine("[frontier-context] $message")
    }
}

function Get-FrontierRepositoryRelations {
    param([array]$Nodes, [array]$Edges)
    $relations = [Collections.Generic.List[object]]::new()
    $definitions = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)
    $neighbors = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)
    foreach ($node in $Nodes) {
        $neighbors[$node.path] = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($symbol in $node.symbols) {
            $key = if ($node.parser -like 'powershell-ast*') { $symbol.Name.ToLowerInvariant() } else { $symbol.Name }
            if (-not $definitions.ContainsKey($key)) { $definitions[$key] = [Collections.Generic.List[object]]::new() }
            $definitions[$key].Add(@{ path = $node.path; symbol = $symbol })
        }
    }
    foreach ($edge in $Edges) {
        if ($relations.Count -ge 100000) { break }
        [void]$neighbors[$edge.from].Add($edge.to)
        $kind = if ($edge.from -match '(?i)\.(md|mdx|txt|rst|adoc)$') { 'documents' } else { 'imports' }
        $relations.Add([pscustomobject][ordered]@{
            fromPath = $edge.from; toPath = $edge.to; fromSymbol = ''; toSymbol = ''
            kind = $kind; line = $edge.line; confidence = 'observed'; resolver = 'literal-path'
        })
    }
    $unresolved = 0
    $truncated = $Edges.Count -gt 100000
    foreach ($node in $Nodes) {
        $scopes = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)
        foreach ($symbol in $node.symbols) {
            if (-not $scopes.ContainsKey($symbol.QualifiedName)) { $scopes[$symbol.QualifiedName] = @() }
            $scopes[$symbol.QualifiedName] += $symbol
        }
        foreach ($symbol in $node.symbols) {
            if ($relations.Count -ge 100000) { $truncated = $true; break }
            if ($symbol.ParentName -and $scopes.ContainsKey($symbol.ParentName)) {
                $parents = @($scopes[$symbol.ParentName] | Where-Object { $_.Line -le $symbol.Line -and $_.EndLine -ge $symbol.EndLine })
                if ($parents.Count -eq 1) {
                    $relations.Add([pscustomobject][ordered]@{
                        fromPath = $node.path; toPath = $node.path; fromSymbol = $parents[0].id; toSymbol = $symbol.id
                        kind = 'contains'; line = $symbol.Line; confidence = 'observed'; resolver = $node.parser
                    })
                }
            }
        }
        foreach ($call in $node.calls) {
            if ($relations.Count -ge 100000) { $truncated = $true; break }
            $name = if ($node.parser -like 'powershell-ast*') { ([string]$call.Name).ToLowerInvariant() } else { [string]$call.Name }
            if (-not $definitions.ContainsKey($name)) { $unresolved++; continue }
            $candidates = @($definitions[$name] | Where-Object {
                ($_.path -ceq $node.path -or $neighbors[$node.path].Contains($_.path)) -and
                    $_.symbol.parser -eq $node.parser
            })
            $local = @($candidates | Where-Object {
                $_.path -ceq $node.path -and (-not $_.symbol.ParentName -or
                    [string]$call.Scope -ceq $_.symbol.ParentName -or
                    ([string]$call.Scope).StartsWith($_.symbol.ParentName + '.', [StringComparison]::Ordinal))
            })
            if ($local.Count -eq 1) { $candidates = $local }
            if ($candidates.Count -ne 1) { $unresolved++; continue }
            $source = @()
            if ($scopes.ContainsKey([string]$call.Scope)) { $source = @($scopes[[string]$call.Scope]) }
            $target = $candidates[0]
            $relations.Add([pscustomobject][ordered]@{
                fromPath = $node.path; toPath = $target.path
                fromSymbol = $(if ($source.Count -eq 1) { $source[0].id } else { '' })
                toSymbol = $target.symbol.id; kind = 'calls'; line = [int]$call.Line
                confidence = 'heuristic'; resolver = 'syntax-name-and-import'
            })
        }
    }
    return @{ relations = @($relations); unresolved = $unresolved; truncated = $truncated }
}

function Get-FrontierRepositoryHierarchy {
    param([array]$Nodes, [array]$Edges)
    $groups = [Collections.Generic.SortedDictionary[string, object]]::new([StringComparer]::Ordinal)
    foreach ($node in $Nodes) {
        $parts = $node.path.Split('/')
        $names = @()
        if ($parts.Count -eq 1) { $names = @('(root)') }
        else {
            for ($depth = 1; $depth -le [Math]::Min(3, $parts.Count - 1); $depth++) {
                $names += ($parts[0..($depth - 1)] -join '/')
            }
        }
        foreach ($name in $names) {
            if (-not $groups.ContainsKey($name)) { $groups[$name] = [Collections.Generic.List[object]]::new() }
            $groups[$name].Add($node)
        }
    }
    foreach ($name in $groups.Keys) {
        $members = $groups[$name]
        $paths = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($node in $members) { [void]$paths.Add($node.path) }
        $outgoing = @($Edges | Where-Object { $paths.Contains($_.from) -and -not $paths.Contains($_.to) } |
            ForEach-Object { if ($_.to.Contains('/')) { $_.to.Split('/')[0] } else { '(root)' } } | Sort-Object -Unique)
        $entryPoints = @($members | Sort-Object @{
            Expression = { [int]($_.path -match '(?i)(^|/)(readme|index|main|program|app|startup|__init__)\.') }; Descending = $true
        }, path | Select-Object -First 5 -ExpandProperty path)
        $symbolCount = 0
        foreach ($node in $members) { $symbolCount += @($node.symbols).Count }
        [pscustomobject][ordered]@{
            id = $name; files = $members.Count; symbols = $symbolCount
            entryPoints = $entryPoints; dependsOn = $outgoing
            summary = "${name}: $($members.Count) files, $symbolCount indexed definitions; dependencies: $($outgoing -join ', ')."
        }
    }
}
