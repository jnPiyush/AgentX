#Requires -Version 7.4
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-ScopeName($Node) {
    $names = [Collections.Generic.List[string]]::new()
    $parent = $Node.Parent
    while ($null -ne $parent) {
        if (($parent -is [Management.Automation.Language.FunctionDefinitionAst] -and
                $parent.Parent -isnot [Management.Automation.Language.FunctionMemberAst]) -or
            $parent -is [Management.Automation.Language.TypeDefinitionAst] -or
            $parent -is [Management.Automation.Language.FunctionMemberAst]) { $names.Insert(0, $parent.Name) }
        $parent = $parent.Parent
    }
    return $names -join '.'
}

try {
    $inputText = [Console]::In.ReadToEnd()
    if ([Text.Encoding]::UTF8.GetByteCount($inputText) -gt 16MB) { throw 'Parser input exceeds 16 MiB.' }
    $request = $inputText | ConvertFrom-Json -AsHashtable -Depth 8
    if ($request -isnot [System.Collections.IDictionary] -or
        @($request.Keys | Where-Object { $_ -notin @('version', 'files') }).Count -gt 0 -or
        $request.version -ne 1 -or $request.files -isnot [array] -or $request.files.Count -gt 32) {
        throw 'Expected a bounded version-1 parser batch.'
    }
    $results = @(
        foreach ($file in $request.files) {
            if ($file -isnot [System.Collections.IDictionary] -or
                @($file.Keys | Where-Object { $_ -notin @('path', 'text') }).Count -gt 0 -or
                $file.path -isnot [string] -or $file.path.Length -gt 1024 -or $file.text -isnot [string] -or
                [Text.Encoding]::UTF8.GetByteCount($file.text) -gt 1MB) { throw 'Invalid parser file input.' }
            $tokens = $null; $errors = $null
            $ast = [Management.Automation.Language.Parser]::ParseInput($file.text, [ref]$tokens, [ref]$errors)
            $definitions = @($ast.FindAll({
                param($node)
                ($node -is [Management.Automation.Language.FunctionDefinitionAst] -and
                    $node.Parent -isnot [Management.Automation.Language.FunctionMemberAst]) -or
                $node -is [Management.Automation.Language.TypeDefinitionAst] -or
                $node -is [Management.Automation.Language.FunctionMemberAst]
            }, $true))
            $commands = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.CommandAst] }, $true))
            $symbols = @(
                foreach ($definition in @($definitions | Select-Object -First 8192)) {
                    $scope = Get-ScopeName $definition
                    $kind = if ($definition -is [Management.Automation.Language.TypeDefinitionAst]) {
                        if ($definition.IsEnum) { 'enum' } else { 'class' }
                    } elseif ($definition -is [Management.Automation.Language.FunctionMemberAst]) { 'method' } else { 'function' }
                    $parameters = @()
                    if ($definition -is [Management.Automation.Language.FunctionDefinitionAst]) {
                        $parameters = if ($definition.Parameters) { @($definition.Parameters) }
                            elseif ($definition.Body.ParamBlock) { @($definition.Body.ParamBlock.Parameters) } else { @() }
                    } elseif ($definition -is [Management.Automation.Language.FunctionMemberAst]) {
                        $parameters = @($definition.Parameters)
                    }
                    $parameterNames = @($parameters | ForEach-Object { '$' + $_.Name.VariablePath.UserPath })
                    [ordered]@{
                        Name = $definition.Name; Kind = $kind
                        QualifiedName = $(if ($scope) { "$scope.$($definition.Name)" } else { $definition.Name })
                        ParentName = $scope
                        Line = $definition.Extent.StartLineNumber; EndLine = $definition.Extent.EndLineNumber
                        Signature = "$kind $($definition.Name)($($parameterNames -join ', '))"
                        Confidence = 'observed'
                    }
                }
            )
            $calls = @(
                foreach ($command in @($commands | Select-Object -First 8192)) {
                    $name = $command.GetCommandName()
                    if ($name) {
                        [ordered]@{ Name = $name; Scope = Get-ScopeName $command; Line = $command.Extent.StartLineNumber; Receiver = '' }
                    }
                }
            )
            [ordered]@{
                path = $file.path; parser = "powershell-ast@$($PSVersionTable.PSVersion)"
                symbols = $symbols; calls = $calls; references = @()
                parseErrors = @($errors).Count
                metadataTruncated = ($definitions.Count -gt 8192 -or $commands.Count -gt 8192)
                diagnostics = @()
            }
        }
    )
    $output = @{ version = 1; results = $results } | ConvertTo-Json -Depth 12 -Compress
    if ([Text.Encoding]::UTF8.GetByteCount($output) -gt 16MB) { throw 'Parser output exceeds 16 MiB.' }
    [Console]::Out.WriteLine($output)
} catch {
    [Console]::Error.WriteLine("[frontier-parser] $($_.Exception.Message)")
    exit 1
}
