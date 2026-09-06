#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$temp = Join-Path ([IO.Path]::GetTempPath()) ("agentx-registries-" + [guid]::NewGuid().ToString('N'))
$passed = 0
function Assert-True([bool]$Value, [string]$Label) {
    if (-not $Value) { throw "[FAIL] $Label" }
    $script:passed++
    Write-Host "[PASS] $Label"
}
function Invoke-Generator {
    $output = & pwsh -NoProfile -File (Join-Path $repo 'scripts/generate-registries.ps1') -RepoRoot $temp -Quiet 2>&1 | Out-String
    [pscustomobject]@{ code = $LASTEXITCODE; output = $output }
}
function Write-Skill([string]$Name, [string]$Content) {
    $directory = Join-Path $temp ".github/skills/testing/$Name"
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $directory 'SKILL.md') -Value $Content -Encoding utf8
}
function Read-Registry([string]$Name) {
    Get-Content -LiteralPath (Join-Path $temp ".github/registries/$Name.json") -Raw | ConvertFrom-Json
}
try {
    New-Item -ItemType Directory -Path (Join-Path $temp '.github/skills'), (Join-Path $temp '.github/templates'), (Join-Path $temp '.github/registries') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $temp '.github/registries/routing.json') -Value '{"keep":"user-owned"}'
    $routingHash = (Get-FileHash (Join-Path $temp '.github/registries/routing.json')).Hash

    Write-Skill 'folded' "---`nname: folded`ndescription: >-`n  First line with a colon:`n  and the second line.`nmetadata:`n  version: '1.0.0'`ncompatibility:`n  model_providers: ['example']`n---`n# Folded"
    Set-Content -LiteralPath (Join-Path $temp '.github/templates/ONE-TEMPLATE.md') -Value "<!-- Inputs: {title} -->`n# {title}`n## Required section"
    $run = Invoke-Generator
    Assert-True ($run.code -eq 0) "Generator succeeds: $($run.output)"
    $skills = Read-Registry 'skills'
    $templates = Read-Registry 'templates'
    Assert-True ($skills.skills[0].description -eq 'First line with a colon: and the second line.') 'Folded YAML description is content, not a block marker'
    Assert-True ($skills.skills -is [array] -and $skills.skills.Count -eq 1) 'Singleton skills remain a JSON array'
    Assert-True ($skills.countsByCategory -is [array] -and $skills.countsByCategory.Count -eq 1) 'Singleton category counts remain a JSON array'
    Assert-True ($templates.templates -is [array] -and $templates.templates.Count -eq 1) 'Singleton templates remain a JSON array'
    Assert-True ($templates.templates[0].declaredInputs -is [array] -and $templates.templates[0].declaredInputs[0] -eq 'title') 'Singleton declared inputs remain a JSON array'

    Write-Skill 'literal' "---`nname: literal`ndescription: |-`n  Line one.`n  Line two.`n---"
    Write-Skill 'quoted' "---`nname: quoted`ndescription: 'It''s a quoted value: # retained'`n---"
    Write-Skill 'plain' "---`nname: plain`ndescription: User's `"quoted`" text # ignored comment`n---"
    Write-Skill 'empty' "---`nname: empty`ndescription: `"`"`n---"
    Write-Skill 'missing' '# No frontmatter'
    Assert-True ((Invoke-Generator).code -eq 0) 'Multiple supported metadata styles generate successfully'
    $skills = Read-Registry 'skills'
    Assert-True ($skills.totalCount -eq 6 -and $skills.skills.Count -eq 6) 'Multiple skills have accurate count and array shape'
    Assert-True (($skills.skills | Where-Object name -eq 'literal').description -eq "Line one.`nLine two.") 'Literal YAML preserves line breaks'
    Assert-True (($skills.skills | Where-Object name -eq 'quoted').description -eq "It's a quoted value: # retained") 'Quoted scalar escapes and punctuation are preserved'
    Assert-True (($skills.skills | Where-Object name -eq 'plain').description -eq "User's `"quoted`" text") 'Plain scalars preserve embedded quotes and exclude comments'
    Assert-True (($skills.skills | Where-Object name -eq 'empty').description -ceq '') 'Explicit empty description stays a string'
    Assert-True ($null -eq ($skills.skills | Where-Object name -eq 'missing').description) 'Absent description stays null with directory-name fallback'
    Assert-True ((Get-FileHash (Join-Path $temp '.github/registries/routing.json')).Hash -eq $routingHash) 'Hand-authored routing registry is untouched'

    $standalone = Join-Path $temp 'standalone/parse-yaml.js'
    New-Item -ItemType Directory -Path (Split-Path $standalone -Parent) | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo 'scripts/parse-yaml.js') -Destination $standalone
    $paths = @(Get-ChildItem -LiteralPath (Join-Path $temp '.github/skills') -Recurse -Filter SKILL.md -File | ForEach-Object { $_.FullName })
    $batch = (ConvertTo-Json -InputObject $paths -Compress) | & node $standalone --frontmatter-files | Out-String
    Assert-True ($LASTEXITCODE -eq 0) 'Batch parsing works without installed YAML dependencies'
    $parsed = $batch | ConvertFrom-Json
    Assert-True ($parsed.Count -eq 6) 'Standalone batch preserves every file entry'
    Assert-True (($parsed.frontmatter | Where-Object { $_.PSObject.Properties['name'] -and $_.name -eq 'folded' }).description -eq 'First line with a colon: and the second line.') 'Standalone batch preserves folded description semantics'
    Assert-True (($parsed.frontmatter | Where-Object { $_.PSObject.Properties['name'] -and $_.name -eq 'literal' }).description -eq "Line one.`nLine two.") 'Standalone batch preserves literal description semantics'
    Assert-True (($parsed.frontmatter | Where-Object { $_.PSObject.Properties['name'] -and $_.name -eq 'folded' }).compatibility.model_providers[0] -eq 'example') 'Standalone batch accepts underscored metadata keys used by canonical skills'
    Assert-True (($parsed.frontmatter | Where-Object { $_.PSObject.Properties['name'] -and $_.name -eq 'plain' }).description -eq "User's `"quoted`" text") 'Standalone batch accepts embedded quotes in plain scalars'
    $single = "name: single`ndescription: 'Single YAML mapping contract'" | & node $standalone | Out-String
    Assert-True ($LASTEXITCODE -eq 0 -and ($single | ConvertFrom-Json).name -eq 'single') 'Existing stdin YAML interface remains unchanged'
    foreach ($invalidBatch in @('{}', '[""]', '[42]', '["missing-skill.md"]')) {
        $batchError = $invalidBatch | & node $standalone --frontmatter-files 2>&1 | Out-String
        Assert-True ($LASTEXITCODE -ne 0 -and $batchError -match '\[FAIL\]') 'Invalid or unreadable batch input fails explicitly'
    }

    $goodHash = (Get-FileHash (Join-Path $temp '.github/registries/skills.json')).Hash
    foreach ($invalid in @(
        "---`nname: invalid`ndescription: 'unterminated`n---",
        "---`nname: invalid`ndescription: first`ndescription: duplicate`n---",
        "---`nname: invalid`ndescription: [not, a, string]`n---",
        "---`nname: 42`ndescription: Text`n---",
        "---`nname: invalid`ndescription: Missing closing delimiter"
    )) {
        Write-Skill 'invalid' $invalid
        $run = Invoke-Generator
        Assert-True ($run.code -ne 0) 'Invalid metadata fails instead of generating success-shaped content'
        Assert-True ($run.output -match 'invalid') 'Metadata failure identifies the affected input'
        Assert-True ((Get-FileHash (Join-Path $temp '.github/registries/skills.json')).Hash -eq $goodHash) 'Metadata failure does not replace the last valid registry'
    }
    Remove-Item -LiteralPath (Join-Path $temp '.github/skills/testing') -Recurse -Force
    Remove-Item -LiteralPath (Join-Path $temp '.github/templates/ONE-TEMPLATE.md')
    Assert-True ((Invoke-Generator).code -eq 0) 'Empty inventories generate successfully'
    $skills = Read-Registry 'skills'
    $templates = Read-Registry 'templates'
    Assert-True ($skills.totalCount -eq 0 -and $skills.skills -is [array] -and $skills.skills.Count -eq 0) 'Empty skills serialize as an empty array'
    Assert-True ($skills.countsByCategory -is [array] -and $skills.countsByCategory.Count -eq 0) 'Empty categories serialize as an empty array'
    Assert-True ($templates.totalCount -eq 0 -and $templates.templates -is [array] -and $templates.templates.Count -eq 0) 'Empty templates serialize as an empty array'
} finally {
    Remove-Item -LiteralPath $temp -Recurse -Force
}
Write-Host "[PASS] $passed registry generation checks passed."
