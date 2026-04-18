<#
.SYNOPSIS
  Run a Model Council deliberation: fan out the same prompt to multiple LLMs
  with diverse training and reasoning styles, then aggregate responses into a
  structured deliberation file.

.DESCRIPTION
  A Model Council is the model-side analogue of source triangulation. Three
  council members independently respond to the same research question, then
  the calling agent synthesizes consensus, contradictions, and blind spots.

  Default council (mix of vendors and reasoning styles for diversity):
    - Analyst   : openai/gpt-5.4    (structured, critical, decomposition)
    - Strategist: anthropic/claude-opus-4.7 (broad context, balanced synthesis)
    - Skeptic   : google/gemini-3.1-pro   (contrarian, adversarial critique)

  Purpose packs tune the per-member instructions and synthesis sections for
  the artifact being produced:
    - research    : generic deep-research deliberation (default; consulting style)
    - prd-scope   : PRD scope, priority, success metric, and assumption stress test
    - adr-options : ADR option selection, criteria weighting, contrarian recommendation
    - ai-design   : AI/ML model selection, evaluation strategy, drift/cost/safety risks
    - code-review : Code review decision, finding severity, and false-positive / missed-risk stress test

  INTERNAL AGENT MECHANISM. The Model Council is run BY the calling agent,
  not by the user. The script generates a Council Brief containing the
  role-specific prompts; the calling agent (Copilot, Claude Code, Cursor,
  local model) then internally adopts each role in turn, generates the three
  responses, writes them into the Member Responses section of the brief, and
  completes the Synthesis. The user is NEVER asked to copy/paste prompts.

  OPTIONAL AUTOMATION. Pass -AutoInvoke to drive the council via the GitHub
  Models CLI extension (`gh extension install github/gh-models`). This is one
  optional execution path; it is NOT a precondition for using the script.

.PARAMETER Topic
  Short slug for the deliberation (used in the output filename).

.PARAMETER Question
  The research question or prompt to put before the council.

.PARAMETER Context
  Optional supporting context (research log excerpts, key claims to stress-test).

.PARAMETER Members
  Optional override of council membership. Each entry is "Role:model-id".
  Default: Analyst:openai/gpt-5.4,Strategist:anthropic/claude-opus-4.7,Skeptic:google/gemini-3.1-pro

.PARAMETER OutputDir
  Where to write the council file. Default: docs/coaching

.PARAMETER Purpose
  Role-tuned prompt pack: research (default), prd-scope, adr-options, ai-design, code-review.

.PARAMETER AutoInvoke
  Optional. When set, attempts to drive the council automatically via the
  GitHub Models CLI (`gh models run`). Falls back to brief mode with a warning
  if the extension is not installed. Without this flag the calling agent runs
  the council internally by adopting each role -- the user is not involved.

.EXAMPLE
  pwsh scripts/model-council.ps1 -Topic sovereign-ai `
    -Question "What are the strongest contrarian arguments against sovereign AI for FS clients in EMEA?" `
    -Context "Phase 6 triangulation log shows consensus on regulatory pressure but weak evidence on operating-cost claims."
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $Topic,
    [Parameter(Mandatory)] [string] $Question,
    [string] $Context = "",
    [string] $Members = "Analyst:openai/gpt-5.4,Strategist:anthropic/claude-opus-4.7,Skeptic:google/gemini-3.1-pro",
    [string] $OutputDir = "docs/coaching",
    [ValidateSet('research','prd-scope','adr-options','ai-design','code-review')]
    [string] $Purpose = 'research',
    [switch] $AutoInvoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-GhModelsAvailable {
    try {
        $null = & gh models --help 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Get-CouncilRoster {
    param([string] $Spec)
    $roster = @()
    foreach ($entry in ($Spec -split ',')) {
        $parts = $entry.Trim() -split ':', 2
        if ($parts.Count -ne 2) { continue }
        $roster += [pscustomobject]@{
            Role  = $parts[0].Trim()
            Model = $parts[1].Trim()
        }
    }
    return $roster
}

function Get-RolePack {
    param([string] $Purpose)

    switch ($Purpose) {
        'prd-scope' {
            return @{
                Analyst    = "Decompose the user need. Identify the smallest scope that delivers value, the must-have requirements vs. nice-to-haves, and the success metric that would prove the feature worked. Flag any vague or unmeasurable claims."
                Strategist = "Frame the strategic value. What user job is really being done? What second-order effects (engagement, support cost, retention, regulatory exposure) does this feature create? What is the right priority and sequencing for a senior PM?"
                Skeptic    = "Argue against shipping this feature. What is the strongest case for cutting it, deprioritizing it, or solving the underlying problem differently (docs, support, automation, partner integration)? What adoption, security, support, or compliance risks would block real users?"
                Sections   = @(
                    @{ Title = 'Consensus on Scope and Priority'; Hint = 'Requirements at least two members agree should be in scope and at the same priority tier.' },
                    @{ Title = 'Divergences on Scope, Priority, or Success Metric'; Hint = 'Material disagreements that must be resolved or recorded as open questions in the PRD.' },
                    @{ Title = 'Risks and Adoption Blockers Surfaced'; Hint = 'Skeptic-raised risks the original research missed; promote into PRD Risks section.' },
                    @{ Title = 'Net Adjustment to PRD'; Hint = 'How the council changed scope cuts, priority labels, success metrics, or open questions. If no change, state why.' }
                )
            }
        }
        'adr-options' {
            return @{
                Analyst    = "Decompose the decision. List the candidate options with the criteria that actually differentiate them (cost, risk, time-to-deliver, operational burden, vendor lock-in). Demand evidence for any claimed advantage and flag missing benchmarks or version-verification gaps."
                Strategist = "Step back. Which option fits the long-term direction of the system, the team's operating model, and the cost-of-change profile? Recommend the option a senior architect would pick and explain the trade-off they would accept."
                Skeptic    = "Argue against the front-runner. What is the strongest case for the option most likely to be dismissed? Identify the failure mode, post-mortem, or vendor risk that would make the recommended option look wrong in 18 months."
                Sections   = @(
                    @{ Title = 'Consensus on the Recommended Option'; Hint = 'Option(s) that at least two members would pick; treat as higher-confidence ADR Decision input.' },
                    @{ Title = 'Divergences on Option Ranking or Criteria Weighting'; Hint = 'Material disagreements; record as ADR Consequences or open architecture questions.' },
                    @{ Title = 'Failure Modes and Vendor Risks Surfaced'; Hint = 'Skeptic-raised risks the original landscape scan missed; promote into ADR Consequences and Tech Spec risk register.' },
                    @{ Title = 'Net Adjustment to ADR'; Hint = 'How the council changed the chosen option, criteria weighting, or recorded consequences. If no change, state why.' }
                )
            }
        }
        'ai-design' {
            return @{
                Analyst    = "Decompose the AI/ML task. Compare candidate models on benchmark evidence, cost-per-task, latency, structured-output reliability, and known failure modes. Demand sources for any benchmark claim and flag stale or unverified assumptions."
                Strategist = "Step back. What is the right end-to-end design (model + prompt strategy + retrieval + evaluation + guardrails + fallback) for this workload? Recommend the approach a senior ML lead would choose and explain the cost/quality/risk trade-off they would accept."
                Skeptic    = "Argue against the recommended model and approach. What is the strongest case for a different model family, a smaller cheaper model, a non-LLM baseline, or a different evaluation strategy? Surface drift, safety, hallucination, vendor-lock, and regulatory risks the design must mitigate."
                Sections   = @(
                    @{ Title = 'Consensus on Model Selection and Pipeline Shape'; Hint = 'Choices at least two members agree on; treat as higher-confidence Model Card and pipeline inputs.' },
                    @{ Title = 'Divergences on Model, Eval Strategy, or Guardrails'; Hint = 'Material disagreements; record as Model Card limitations or open evaluation questions.' },
                    @{ Title = 'Drift, Safety, and Cost Risks Surfaced'; Hint = 'Skeptic-raised risks the SOTA survey missed; promote into Drift Monitoring Plan and Model Card limitations.' },
                    @{ Title = 'Net Adjustment to Pipeline and Eval Plan'; Hint = 'How the council changed the model choice, eval rubric, drift thresholds, or fallback strategy. If no change, state why.' }
                )
            }
        }
        'code-review' {
            return @{
                Analyst    = "Decompose the diff. Enumerate concrete defects with file:line evidence across spec conformance, security, testing, error handling, and performance. For each finding, state the category, the proposed severity (Critical/Major/Minor/Nit), and the evidence trail. Flag any claim that lacks a reproduction path."
                Strategist = "Step back from the diff. Which findings actually block shipping vs. which are advisory? Recommend the right severity for each, the smallest fix that resolves blockers, and the overall Approve / Request Changes decision a senior reviewer would defend. Preserve original PRD intent in the assessment."
                Skeptic    = "Argue the opposite of the leaning decision. If the review leans Approve, find the concrete reason to reject (hidden security flaw, missing edge case, spec drift, brittle test). If the review leans Reject, identify findings that are likely false positives or over-classified. Surface risks the diff alone hides: production behavior, concurrency, data shape, dependency upgrade impact."
                Sections   = @(
                    @{ Title = 'Consensus on Blocking Defects'; Hint = 'Findings at least two members agree must block approval; lock these in at the proposed severity.' },
                    @{ Title = 'Divergences on Severity or Decision'; Hint = 'Findings where members disagree on severity or on Approve vs. Request Changes; resolve before issuing the decision or record as open questions.' },
                    @{ Title = 'Hidden Risks and False Positives Surfaced'; Hint = 'Skeptic-raised risks the diff scan missed AND findings the Skeptic argues are false positives; both classes promote into the review document with explicit rationale.' },
                    @{ Title = 'Net Adjustment to Review Decision'; Hint = 'How the council changed the Approve/Reject decision, severity assignments, or recommended changes. If no change, state why.' }
                )
            }
        }
        default {
            return @{
                Analyst    = "Decompose the question. Identify what evidence would settle it. Flag weak claims and demand specifics."
                Strategist = "Step back. Identify the strategic frame, second-order effects, and the recommendation a senior partner would give."
                Skeptic    = "Be contrarian. Identify the strongest argument AGAINST the consensus position. Surface failure modes and missing counter-evidence."
                Sections   = @(
                    @{ Title = 'Consensus Claims'; Hint = 'Claims at least two members support; treat as higher-confidence inputs to the deliverable.' },
                    @{ Title = 'Divergences'; Hint = 'Claims where members materially disagree; surface as risk callouts or open questions in the deliverable.' },
                    @{ Title = 'Blind Spots Identified'; Hint = 'Topics or counter-evidence raised by the Skeptic that the original research log missed.' },
                    @{ Title = 'Net Adjustment to Deliverable'; Hint = 'How the council changed the recommendation, framing, or evidence ranking. If no change, state why.' }
                )
            }
        }
    }
}

function Invoke-CouncilMember {
    param(
        [string] $Model,
        [string] $Role,
        [string] $Prompt,
        [hashtable] $Pack
    )

    $roleInstruction = if ($Pack.ContainsKey($Role)) { $Pack[$Role] } else { "Speak from your assigned role." }

    $body = @"
You are sitting on a Model Council as the **$Role**. Three council members
with different reasoning styles are independently answering the same question.
Do NOT try to be balanced -- speak from your assigned role.

Your role-specific instruction:
$roleInstruction

Respond in this structure:
  ## Position
  (2-4 sentences -- your top-line answer from your role)

  ## Key Reasoning
  (3-6 bullets -- the most important supporting points)

  ## What Could Make Me Wrong
  (2-3 bullets -- concrete evidence that would change your view)

Question:
$Prompt
"@

    try {
        $response = $body | & gh models run $Model 2>&1
        if ($LASTEXITCODE -ne 0) {
            return "[FAIL] $Model returned exit code $LASTEXITCODE`n$response"
        }
        return ($response | Out-String).Trim()
    } catch {
        return "[FAIL] $Model invocation error: $($_.Exception.Message)"
    }
}

# --- Main ---

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$outDir   = Join-Path $repoRoot $OutputDir
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$slug    = ($Topic -replace '[^a-zA-Z0-9-]', '-').ToLower()
$outPath = Join-Path $outDir "COUNCIL-$slug.md"
$roster  = Get-CouncilRoster -Spec $Members
$pack    = Get-RolePack -Purpose $Purpose

$prompt = if ($Context) { "$Question`n`nSupporting context:`n$Context" } else { $Question }

# Brief mode is the default (provider-agnostic). -AutoInvoke opts into gh models automation.
$useGh = $false
if ($AutoInvoke) {
    if (Test-GhModelsAvailable) {
        $useGh = $true
    } else {
        Write-Warning "-AutoInvoke requested but 'gh models' extension is not installed. Falling back to brief mode. Install with: gh extension install github/gh-models"
    }
}
$timestamp   = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# Model Council: $Topic")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("**Convened:** $timestamp")
[void]$sb.AppendLine("**Mode:** $(if ($useGh) { 'automated (gh models)' } else { 'agent-internal (calling agent adopts each role and writes responses below)' })")
[void]$sb.AppendLine("**Purpose pack:** $Purpose")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Question")
[void]$sb.AppendLine("")
[void]$sb.AppendLine($Question)
[void]$sb.AppendLine("")
if ($Context) {
    [void]$sb.AppendLine("## Supporting Context")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($Context)
    [void]$sb.AppendLine("")
}
[void]$sb.AppendLine("## Council Roster")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("| Role | Model |")
[void]$sb.AppendLine("|------|-------|")
foreach ($m in $roster) {
    [void]$sb.AppendLine("| $($m.Role) | ``$($m.Model)`` |")
}
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Member Responses")
[void]$sb.AppendLine("")

foreach ($m in $roster) {
    [void]$sb.AppendLine("### $($m.Role) -- ``$($m.Model)``")
    [void]$sb.AppendLine("")
    if ($useGh) {
        Write-Host "Consulting $($m.Role) ($($m.Model))..."
        $resp = Invoke-CouncilMember -Model $m.Model -Role $m.Role -Prompt $prompt -Pack $pack
        [void]$sb.AppendLine($resp)
    } else {
        [void]$sb.AppendLine("[AGENT-TODO] Calling agent: adopt the role below, generate the response in this file (replacing this block), then move to the next role. Do NOT ask the user to do this -- run it yourself as part of the active workflow phase.")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine('```')
        [void]$sb.AppendLine("Role: $($m.Role)")
        [void]$sb.AppendLine("Suggested model bias: $($m.Model)")
        $roleInstr = if ($pack.ContainsKey($m.Role)) { $pack[$m.Role] } else { 'Speak from your assigned role.' }
        [void]$sb.AppendLine("Role instruction: $roleInstr")
        [void]$sb.AppendLine("Prompt: see top of file (Question + Supporting Context)")
        [void]$sb.AppendLine("Response format: ## Position (2-4 sentences) / ## Key Reasoning (3-6 bullets) / ## What Could Make Me Wrong (2-3 bullets)")
        [void]$sb.AppendLine('```')
    }
    [void]$sb.AppendLine("")
}

[void]$sb.AppendLine("## Synthesis")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("**To be completed by the calling agent after writing all three Member Responses above. The user is not in the loop.**")
[void]$sb.AppendLine("")
foreach ($section in $pack.Sections) {
    [void]$sb.AppendLine("### $($section.Title)")
    [void]$sb.AppendLine("($($section.Hint))")
    [void]$sb.AppendLine("")
}

Set-Content -Path $outPath -Value $sb.ToString() -Encoding UTF8
Write-Host "[OK] Council file written: $outPath"
if (-not $useGh) {
    Write-Host "[INFO] Agent-internal mode (default). The CALLING AGENT now adopts each role in turn, writes the response into the file in place of each [AGENT-TODO] block, then completes the Synthesis section. Do not surface this prompt-running step to the user. Optional gh-models automation: gh extension install github/gh-models  &&  re-run with -AutoInvoke"
}
