#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$directory = Join-Path $repo '.github/templates'
$passed = 0
function Assert-True([bool]$Value, [string]$Label) {
    if (-not $Value) { throw "[FAIL] $Label" }
    $script:passed++
    Write-Host "[PASS] $Label"
}
$contracts = Get-Content -LiteralPath (Join-Path $repo 'tests/fixtures/canonical-template-inputs.json') -Raw | ConvertFrom-Json
$files = @(Get-ChildItem -LiteralPath $directory -File -Filter '*-TEMPLATE.md')
Assert-True ($files.Count -eq $contracts.Count) 'Canonical template inventory matches its contract fixture'
$content = @{}
foreach ($file in $files) {
    $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8
    $content[$file.BaseName] = $text
    $fences = [regex]::Matches($text, '(?ms)^```([^\r\n]*)\r?\n(.*?)^```[ \t]*\r?$')
    $diagrams = @($fences | Where-Object { $_.Groups[1].Value.Trim() -eq 'mermaid' })
    Assert-True ($diagrams.Count -ge 1 -and $diagrams.Count -le 3) "$($file.Name) has 1-3 focused visual views"
    Assert-True ($text -notmatch '[^\x00-\x7F]') "$($file.Name) remains ASCII"
    Assert-True ($text -notmatch '(?m)^## Table of Contents|^## Appendix [AB]:.*Rich Visual') "$($file.Name) does not restore generic visual appendices"
    if ($file.BaseName -in @('ADR-TEMPLATE', 'SPEC-TEMPLATE')) {
        Assert-True ($fences.Count -eq $diagrams.Count) "$($file.Name) contains diagrams, not implementation code examples"
    }
}

$adr = $content['ADR-TEMPLATE']
Assert-True ([regex]::Matches($adr, '(?m)^### Option \d+:').Count -ge 3) 'ADR retains three explicit alternative options'
Assert-True ($adr.Contains('[Confidence:]') -and $adr -match 'Council and Evidence') 'ADR retains decision confidence and actual council evidence'
Assert-True ($adr -match 'idle/active cost' -and $adr -match 'Unknown cost is not zero') 'ADR cost comparison retains an operating envelope and uncertainty'

$spec = $content['SPEC-TEMPLATE']
foreach ($marker in @('Selected Tech Stack', 'AI-first assessment', 'Goals', 'Migration', 'Open Questions', 'Data Scientist', 'Fallback Trigger', 'Schema Validation Path')) {
    Assert-True ($spec.Contains($marker)) "SPEC retains $marker"
}
Assert-True ($spec -notmatch 'model name with version date') 'SPEC does not require fabricated dated model identifiers'

$review = $content['REVIEW-TEMPLATE']
Assert-True ($review.Contains('documentationReview') -and $review.Contains('code-quality.md')) 'Review binds mandatory documentation and canonical quality evidence'
Assert-True ($review -notmatch 'Weighted Score \(optional for non-UI') 'Implementation review cannot make the canonical rubric optional'
Assert-True ($review -match '(?i)zero.*findings|findings.*zero') 'Review permits evidence-backed zero findings'
Assert-True ($review -notmatch 'Version pinned with date suffix') 'Review verifies real model identity instead of invented suffixes'
Assert-True ($review -notmatch '\| Quality loop completed \|') 'Review does not require its own loop closure before review begins'

$plan = $content['EXEC-PLAN-TEMPLATE']
Assert-True ($plan.IndexOf('## Alternatives Considered') -lt $plan.IndexOf('## Plan of Work') -and $plan.Contains('## Alternatives Considered')) 'Execution plan records alternatives before planning'
Assert-True ($plan.Contains('agentx doc-drift check') -and $plan -match 'reviewed document hashes') 'Execution plan retains mandatory drift evidence'
Assert-True ($plan -match "must not reset or complete the parent's loop") 'Execution plan preserves shared-loop ownership'

Assert-True ($content['PRD-TEMPLATE'] -match 'Research Summary' -and $content['PRD-TEMPLATE'] -match 'Council') 'PRD retains research and council evidence'
Assert-True ($content['ARCH-REVIEW-TEMPLATE'] -notmatch 'Medium.*Usually no') 'Architecture review does not waive Medium blockers'
Assert-True ($content['UX-TEMPLATE'] -match 'Actually run' -and $content['UX-TEMPLATE'] -match '320 CSS px') 'UX records actual execution and reflow requirements'
Assert-True ($content['SECURITY-PLAN-TEMPLATE'] -match 'Catalog / version / source / verified on') 'Security assessment declares its actual threat-catalog version'
Assert-True ($content['CONTRACT-TEMPLATE'] -match 'File ownership' -and $content['CONTRACT-TEMPLATE'] -match 'required approval') 'Work contract declares file and action boundaries'
Assert-True ($content['EVIDENCE-SUMMARY-TEMPLATE'] -match 'Executed at' -and $content['EVIDENCE-SUMMARY-TEMPLATE'] -match 'Not run') 'Evidence summary distinguishes execution from missing checks'
Assert-True ($content['DESIGN-SYSTEM-TEMPLATE'] -match '## 9\. Anti-Patterns' -and $content['DESIGN-SYSTEM-TEMPLATE'] -match 'NOTICE') 'Design-system template retains its nine-section schema and attribution'
Assert-True ($content['BACKLOG-TEMPLATE'] -match 'No unresolved High/Medium') 'Backlog Done gate retains blocking review criteria'
Assert-True ($content['PROGRESS-TEMPLATE'] -match 'Unmeasured coverage remains unknown') 'Progress does not invent unmeasured coverage'
Assert-True ($content['LEARNING-TEMPLATE'] -match 'Record the actual promotion result') 'Learning thresholds do not claim unexecuted promotion'
Assert-True ($content['ROADMAP-TEMPLATE'] -notmatch 'Sprint 1 is technical foundation only') 'Roadmap does not impose an unsupported foundation-only first sprint'
Write-Host "[PASS] $passed template content checks passed."
