#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$passed = 0
function Assert-True([bool]$Value, [string]$Label) {
    if (-not $Value) { throw "[FAIL] $Label" }
    $script:passed++
    Write-Host "[PASS] $Label"
}
$cases = @(
    @{
        file = 'code-review'; name = 'Code Review'; agent = 'AgentX Reviewer'
        contracts = @{
            'zero-findings review is valid' = 'Zero findings is valid'
            'documentation evidence is mandatory' = 'documentationReview'
            'findings require actionable evidence' = 'location, severity, impact, evidence'
            'verification distinguishes unavailable checks' = 'not run, blocked and failed'
            'review source stays unchanged' = 'Keep reviewed source unchanged'
        }
    },
    @{
        file = 'refactor'; name = 'Refactoring'; agent = 'AgentX Engineer'
        contracts = @{
            'observable behavior must survive' = 'preserving its observable\s+behavior'
            'size heuristics are not mandatory rewrites' = 'not mandatory extraction thresholds'
            'move-only extraction preserves declarations' = 'preserve declaration bodies'
            'unrelated user work is preserved' = 'preserving unrelated user work'
            'tests cannot be weakened' = 'never weaken tests or acceptance criteria'
        }
    },
    @{
        file = 'bug-triage'; name = 'Bug Triage'; agent = 'AgentX Engineer'
        contracts = @{
            'triage does not grant mutation authority' = 'does not authorize a code fix'
            'uncertainty is not a negative result' = 'unknown, not false'
            'service commitments must not be invented' = '(?s)Do not invent\s+response SLAs'
            'proposed and executed actions are distinguished' = 'proposed or actually applied'
            'reproduction limitations are explicit' = 'not-reproduced or blocked'
        }
    }
)
foreach ($case in $cases) {
    $file = Join-Path $repo ".github/prompts/$($case.file).prompt.md"
    $content = Get-Content -LiteralPath $file -Raw -Encoding utf8
    $frontmatter = [regex]::Match($content, '(?s)\A---\r?\n.*?\r?\n---').Value
    Assert-True ($frontmatter -match ('(?m)^name: "' + [regex]::Escape($case.name) + '"\r?$')) "$($case.file) preserves its host-visible name"
    Assert-True ($frontmatter -match ('(?m)^agent: "' + [regex]::Escape($case.agent) + '"\r?$')) "$($case.file) preserves its agent route"
    Assert-True ($content.Contains('{{issue_number}}')) "$($case.file) preserves its issue input"
    Assert-True ($content -match 'documentation-drift') "$($case.file) retains the documentation gate"
    Assert-True ($content -notmatch '[^\x00-\x7F]') "$($case.file) remains ASCII"
    foreach ($contract in $case.contracts.GetEnumerator()) {
        Assert-True ($content -match $contract.Value) "$($case.file): $($contract.Key)"
    }
    foreach ($link in [regex]::Matches($content, '\[[^\]]+\]\(([^)]+)\)')) {
        $target = $link.Groups[1].Value
        if ($target -match '^(https?://|mailto:|#)') { continue }
        $targetPath = Join-Path (Split-Path $file -Parent) (($target -split '#')[0])
        Assert-True (Test-Path -LiteralPath $targetPath) "$($case.file) resolves $target"
    }
}
$aiRoot = Join-Path $repo '.github/skills/ai-systems'
$agentSkill = Get-Content -LiteralPath (Join-Path $aiRoot 'ai-agent-development/SKILL.md') -Raw
$modelSkill = Get-Content -LiteralPath (Join-Path $aiRoot 'model-drift-management/SKILL.md') -Raw
$dataSkill = Get-Content -LiteralPath (Join-Path $aiRoot 'data-drift-strategy/SKILL.md') -Raw
$automation = Get-Content -LiteralPath (Join-Path $aiRoot 'ai-agent-development/references/model-change-test-automation.md') -Raw
foreach ($capability in @('Fast', 'Balanced', 'Deep reasoning', 'Coding agent', 'Multimodal')) {
    Assert-True ($agentSkill.Contains("| $capability |")) "Model selection retains the $capability evidence class"
}
Assert-True ($agentSkill -match 'record discovery date and source') 'Model discovery provenance remains mandatory'
Assert-True ($agentSkill.Contains('(references/multi-model-patterns.md)')) 'Multi-model fallback guidance stays reachable from the skill root'
Assert-True ($modelSkill -match 'different approved provider') 'Production fallback retains provider diversity and approval'
Assert-True ($modelSkill -match 'scheduled cadence') 'Model monitoring retains proactive evaluation'
Assert-True ($modelSkill -match 'independent judge model') 'Drift review cannot rely on self-evaluation'
Assert-True ($dataSkill -match 'halt live scoring' -and $dataSkill -match 'rules-based fallback') 'Critical data failure guidance covers live recovery, not just release blocking'
Assert-True ($dataSkill -match 'Schedule embedding/topic checks') 'Input monitoring retains proactive sampling'
foreach ($required in @('config/models.yaml', 'primary', 'scores.task_completion', 'scores.format_compliance', 'comparison-report.json')) {
    Assert-True ($automation.Contains($required)) "Comparison helper documentation retains $required"
}
Assert-True ($automation -match 'can yield exit 0' -and $automation -match 'Fail CI preflight') 'Missing baseline/primary false-pass behavior is disclosed and guarded'
Assert-True ($automation -match 'runner sends no tools' -and $automation -match 'non-errored calls') 'Heuristic evaluator limits cannot be advertised as task/tool correctness'
Assert-True ($automation -match 'verification timestamp' -and $automation -match 'Unknown cost is not zero') 'Cost estimates retain provenance and uncertainty'
Assert-True ($automation -match 'Pass `--baseline` explicitly' -and $automation -match 'Reject empty cases') 'Comparison preflight guards stale baselines and empty-query false passes'
Assert-True ($automation.Contains('--with-eval') -and $automation.Contains('-Path <workspace> -Strict')) 'Scaffold and strict-validator invocation contracts remain documented'
Assert-True ($dataSkill -match '(?s)timestamps, response latency and\s+token counts') 'Input monitoring retains minimum governed telemetry fields'
$modelPlaybook = Get-Content -LiteralPath (Join-Path $aiRoot 'model-drift-management/references/traditional-ml-model-drift-playbook.md') -Raw
$dataPlaybook = Get-Content -LiteralPath (Join-Path $aiRoot 'data-drift-strategy/references/traditional-ml-data-drift.md') -Raw
Assert-True ($modelPlaybook -match 'NannyML' -and $modelPlaybook -match 'Page-Hinkley') 'Delayed-label and change-point detection methods remain available'
Assert-True ($dataPlaybook -match 'MMD' -and $dataPlaybook -match 'PCA') 'Joint-distribution detection methods remain available'
$protocol = Get-Content -LiteralPath (Join-Path $repo '.github/AGENT-PROTOCOL.md') -Raw
Assert-True ($protocol -match 'three independently invoked, diverse models') 'Shared council contract requires genuine model diversity'
Assert-True ($protocol -match 'Brief generation is not a completed\s+council') 'A council template cannot masquerade as executed evidence'
foreach ($role in @('product-manager', 'consulting-research')) {
    $roleContent = Get-Content -LiteralPath (Join-Path $repo ".github/agents/$role.agent.md") -Raw
    Assert-True ($roleContent -match 'Model Council execution contract' -and $roleContent -notmatch 'YOU immediately adopt all three roles') "$role uses the shared honest council contract"
}
Write-Host "[PASS] $passed prompt and skill contract checks passed."
