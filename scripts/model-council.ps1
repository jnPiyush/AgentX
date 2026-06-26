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
    - Analyst   : openai/gpt-5.5    (structured, critical, decomposition)
    - Strategist: anthropic/claude-opus-4.8 (broad context, balanced synthesis)
    - Skeptic   : google/gemini-3.1-pro   (contrarian, adversarial critique)

  Purpose packs tune the per-member instructions and synthesis sections for
  the artifact being produced:
    - research    : generic deep-research deliberation (default; consulting style)
    - prd-scope   : PRD scope, priority, success metric, and assumption stress test
    - adr-options : ADR option selection, criteria weighting, contrarian recommendation
    - ai-design   : AI/ML model selection, evaluation strategy, drift/cost/safety risks
    - code-review : Code review decision, finding severity, and false-positive / missed-risk stress test

  MULTIPLE TOPICS. A council is not limited to one topic. Pass several decisions
  in a single run with -Questions (optionally plus a primary -Question); every
  member addresses each topic in turn and the Synthesis attributes findings to
  each topic.

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
  A single research question or prompt to put before the council. Optional when
  -Questions is supplied. Provide -Question, -Questions, or both.

.PARAMETER Questions
  One or more topics for the council to deliberate on in a SINGLE run. A council
  is NOT limited to one topic: every member addresses each topic in turn and the
  Synthesis attributes findings to each topic. Combine with -Question to add a
  primary topic plus several secondary ones.

.PARAMETER Context
  Optional supporting context (research log excerpts, key claims to stress-test).

.PARAMETER Members
  Optional override of council membership. Each entry is "Role:model-id".
  Default: Analyst:openai/gpt-5.5,Strategist:anthropic/claude-opus-4.8,Skeptic:google/gemini-3.1-pro

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

.EXAMPLE
  # Multi-topic: deliberate on several contested decisions in one council run.
  pwsh scripts/model-council.ps1 -Topic adr-412-payments -Purpose adr-options `
    -Questions "Which of the distinct solution approaches (build vs. buy vs. managed) should we recommend?","What is the 18-month failure mode of the front-runner?","Was a simpler architecture unfairly excluded?" `
    -Context "Options summary and evaluation matrix from the draft ADR." `
    -OutputDir docs/artifacts/adr
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $Topic,
    [string] $Question = "",
    [string[]] $Questions = @(),
    [string] $Context = "",
    [string] $Members = "Analyst:openai/gpt-5.5,Strategist:anthropic/claude-opus-4.8,Skeptic:google/gemini-3.1-pro",
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
                Analyst    = "Grill the PRD contents. State exactly what MUST appear in this PRD: the concrete in-scope requirement list, the explicit non-goals, the smallest MVP slice that delivers value vs. what defers to a later release, the single measurable success metric (with target and how it is instrumented) that would prove the feature worked, the key user journeys / edge cases / data states that need acceptance criteria, and the assumptions that must be validated. For every requirement demand that it is specific and testable; reject vague, unmeasurable, or scope-creeping claims and name exactly what to cut."
                Strategist = "Frame the approach and sequencing. Name the real user job-to-be-done, the recommended build approach, and the release sequencing (what ships first, what is fast-follow, what is explicitly deferred), including dependency ordering. Call out second-order effects (engagement, support cost, retention, regulatory exposure), recommend the priority tiering a senior PM would defend, and say which requirements to include now vs. later and why."
                Skeptic    = "Argue against shipping as framed. Make the strongest case to cut, defer, or solve the underlying problem a different way (docs, support, automation, partner/integration, manual workaround). Attack the riskiest assumption, the gameable or vanity success metric, and the adoption, security, privacy, support, or compliance blockers that would stop real users. Name the single change that would most de-risk the PRD."
                Sections   = @(
                    @{ Title = 'Consensus on Scope, Approach, and Priority'; Hint = 'Requirements and the build/sequencing approach at least two members agree on, at the same priority tier; promote into PRD requirements.' },
                    @{ Title = 'Divergences on Scope, Priority, or Success Metric'; Hint = 'Material disagreements that must be resolved or recorded as open questions in the PRD.' },
                    @{ Title = 'Risks and Adoption Blockers Surfaced'; Hint = 'Skeptic-raised risks the original research missed; promote into PRD Risks section.' },
                    @{ Title = 'Net Adjustment to PRD'; Hint = 'How the council changed what to include, scope cuts, priority labels, success metrics, sequencing, or open questions. If no change, state why.' }
                )
            }
        }
        'adr-options' {
            return @{
                Analyst    = "Enumerate the genuinely DIFFERENT ways to solve the same problem -- distinct approaches, not variants of one idea (e.g. build vs. buy, monolith vs. service-split, synchronous vs. event-driven, managed vs. self-hosted, relational vs. document) -- and lay each out against the criteria that actually differentiate them: cost, delivery time, operational burden, scalability, reversibility / cost-of-change, vendor lock-in, team fit, and security blast radius. Demand benchmark or version evidence for every claimed advantage and flag unverified or stale assumptions."
                Strategist = "Recommend the architecture approach. Name which of the distinct solution approaches fits the long-term system direction, the team's operating model, and the cost-of-change profile; state explicitly why each REJECTED approach was rejected, not just why the winner won. Recommend the option a senior architect would pick, the trade-off they would knowingly accept, and the conditions under which that recommendation would flip."
                Skeptic    = "Argue for the approach most likely to be dismissed and against the front-runner. Identify the 18-month failure mode, the post-mortem headline, the scaling cliff, and the vendor / lock-in or migration risk that would make the recommended architecture look wrong. Challenge whether a simpler or a more radically different architecture was unfairly excluded, and name the evidence that would settle the disagreement."
                Sections   = @(
                    @{ Title = 'Consensus on the Recommended Approach'; Hint = 'Approach/option at least two members would pick; treat as higher-confidence ADR Decision input.' },
                    @{ Title = 'Divergences on Approach Ranking or Criteria Weighting'; Hint = 'Material disagreements; record as ADR Consequences or open architecture questions, including why rejected approaches were rejected.' },
                    @{ Title = 'Failure Modes and Vendor Risks Surfaced'; Hint = 'Skeptic-raised risks the original landscape scan missed; promote into ADR Consequences and Tech Spec risk register.' },
                    @{ Title = 'Net Adjustment to ADR'; Hint = 'How the council changed the chosen approach, criteria weighting, or recorded consequences. If no change, state why.' }
                )
            }
        }
        'ai-design' {
            return @{
                Analyst    = "Decompose the AI/ML task and compare the candidate models AND the candidate approaches (single LLM call, smaller fine-tuned model, retrieval-augmented, agentic, or a non-LLM baseline) on benchmark evidence, cost-per-task, latency, structured-output reliability, and known failure modes. Demand a source for every benchmark claim and flag stale or unverified assumptions."
                Strategist = "Recommend the end-to-end design (model + prompt strategy + retrieval + evaluation + guardrails + fallback) a senior ML lead would choose; state why each rejected approach was rejected and the cost / quality / risk trade-off they would accept."
                Skeptic    = "Argue against the recommended model and approach. Make the case for a different model family, a smaller cheaper model, a non-LLM baseline, or a different evaluation strategy, and surface the drift, safety, hallucination, vendor-lock, and regulatory risks the design must mitigate."
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
        [hashtable] $Pack,
        [string] $ResponseFormat = ''
    )

    $roleInstruction = if ($Pack.ContainsKey($Role)) { $Pack[$Role] } else { "Speak from your assigned role." }
    $format = if ($ResponseFormat) { $ResponseFormat } else {
@"
Respond in this structure:
  ## Position
  (2-4 sentences -- your top-line answer from your role)

  ## Key Reasoning
  (3-6 bullets -- the most important supporting points)

  ## What Could Make Me Wrong
  (2-3 bullets -- concrete evidence that would change your view)
"@
    }

    $body = @"
You are sitting on a Model Council as the **$Role**. Three council members
with different reasoning styles are independently answering the same question(s).
Do NOT try to be balanced -- speak from your assigned role.

Your role-specific instruction:
$roleInstruction

$format

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

# Honor the workspace root the agentx CLI exports so council files land in the
# user's workspace, not the bundled extension dir, after a zero-copy
# "Initialize Local Runtime". Fall back to the repo layout when run directly.
if ($env:AGENTX_WORKSPACE_ROOT -and (Test-Path $env:AGENTX_WORKSPACE_ROOT)) {
    $repoRoot = (Resolve-Path $env:AGENTX_WORKSPACE_ROOT).Path
} else {
    $repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
}
$outDir   = Join-Path $repoRoot $OutputDir
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$slug    = ($Topic -replace '[^a-zA-Z0-9-]', '-').ToLower()
$outPath = Join-Path $outDir "COUNCIL-$slug.md"
$roster  = Get-CouncilRoster -Spec $Members
$pack    = Get-RolePack -Purpose $Purpose

# Normalize topics: a council is NOT limited to one. -Question adds a primary
# topic; -Questions adds one or more. Blank entries are dropped.
$topicList = @()
if ($Question -and $Question.Trim()) { $topicList += $Question.Trim() }
foreach ($q in $Questions) { if ($q -and $q.Trim()) { $topicList += $q.Trim() } }
if ($topicList.Count -eq 0) {
    throw "Provide at least one topic via -Question or -Questions."
}
$multiTopic = $topicList.Count -gt 1

if ($multiTopic) {
    $qb = [System.Text.StringBuilder]::new()
    [void]$qb.AppendLine("This council deliberates on $($topicList.Count) related topics. Address EACH topic explicitly and keep them distinct.")
    [void]$qb.AppendLine("")
    for ($i = 0; $i -lt $topicList.Count; $i++) {
        [void]$qb.AppendLine("Topic $($i + 1): $($topicList[$i])")
    }
    $questionBlock = $qb.ToString().TrimEnd()
    $responseFormat = @"
For EACH topic (Topic 1..$($topicList.Count)) respond in this structure:
  ### Topic <n>
  **Position** (2-4 sentences from your role)
  **Key Reasoning** (3-6 bullets)
  **What Could Make Me Wrong** (2-3 bullets)
Then close with:
  ### Cross-Topic Take
  (2-3 bullets on tensions, dependencies, or sequencing across the topics)
"@
    $responseFormatHint = "For EACH of the $($topicList.Count) topics: '### Topic <n>' with Position / Key Reasoning / What Could Make Me Wrong; then a '### Cross-Topic Take'."
} else {
    $questionBlock      = $topicList[0]
    $responseFormat     = ''
    $responseFormatHint = "## Position (2-4 sentences) / ## Key Reasoning (3-6 bullets) / ## What Could Make Me Wrong (2-3 bullets)"
}

$prompt = if ($Context) { "$questionBlock`n`nSupporting context:`n$Context" } else { $questionBlock }

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
[void]$sb.AppendLine($questionBlock)
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
        $resp = Invoke-CouncilMember -Model $m.Model -Role $m.Role -Prompt $prompt -Pack $pack -ResponseFormat $responseFormat
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
        [void]$sb.AppendLine("Response format: $responseFormatHint")
        [void]$sb.AppendLine('```')
    }
    [void]$sb.AppendLine("")
}

[void]$sb.AppendLine("## Synthesis")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("**To be completed by the calling agent after writing all three Member Responses above. The user is not in the loop.**")
[void]$sb.AppendLine("")
if ($multiTopic) {
    [void]$sb.AppendLine("This council covered $($topicList.Count) topics. In each section below, attribute findings to the relevant Topic <n> so the deliverable can trace each decision back to its topic.")
    [void]$sb.AppendLine("")
}
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
