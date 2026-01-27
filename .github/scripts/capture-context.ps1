#Requires -Version 7.0

<#
.SYNOPSIS
    Captures session context for agent handoffs and posts to GitHub issue.

.DESCRIPTION
    Creates a context file with session summary, deliverables, self-review results,
    and next agent information. Posts the context as a comment to the GitHub issue.

.PARAMETER Role
    The agent role completing work (pm, ux, architect, engineer, reviewer).

.PARAMETER IssueNumber
    The GitHub issue number to post context to.

.EXAMPLE
    .\capture-context.ps1 -Role pm -IssueNumber 48
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('pm', 'ux', 'architect', 'engineer', 'reviewer')]
    [string]$Role,

    [Parameter(Mandatory=$true)]
    [int]$IssueNumber
)

$ErrorActionPreference = "Stop"

# Configuration
$CONTEXT_DIR = ".agent-context"
$OWNER = "jnPiyush"
$REPO = "AgentX"

# Role display names
$roleNames = @{
    'pm' = 'Product Manager'
    'ux' = 'UX Designer'
    'architect' = 'Architect'
    'engineer' = 'Engineer'
    'reviewer' = 'Reviewer'
}

# Create context directory if it doesn't exist
if (-not (Test-Path $CONTEXT_DIR)) {
    New-Item -ItemType Directory -Path $CONTEXT_DIR | Out-Null
}

$contextFile = Join-Path $CONTEXT_DIR "issue-$IssueNumber-$Role.md"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "🔍 Capturing context for $($roleNames[$Role])..."

# Initialize context file
@"
# Session Context: Issue #$IssueNumber - $($roleNames[$Role])

**Generated:** $timestamp  
**Agent Role:** $($roleNames[$Role])  
**Issue:** #$IssueNumber

---

## 📋 Session Summary

"@ | Out-File -FilePath $contextFile -Encoding utf8

# Get issue details
try {
    $issueData = gh issue view $IssueNumber --json title,body,labels --repo "$OWNER/$REPO" | ConvertFrom-Json
    $issueTitle = $issueData.title
    $issueLabels = ($issueData.labels | ForEach-Object { $_.name }) -join ', '
    
    @"
**Issue Title:** $issueTitle  
**Labels:** $issueLabels

"@ | Out-File -FilePath $contextFile -Append -Encoding utf8
} catch {
    Write-Warning "Could not fetch issue details: $_"
}

# Role-specific deliverables
@"
---

## 📦 Deliverables Created

"@ | Out-File -FilePath $contextFile -Append -Encoding utf8

switch ($Role) {
    'pm' {
        @"
### Product Manager Deliverables

"@ | Out-File -FilePath $contextFile -Append -Encoding utf8

        # Check for PRD
        $prdPath = "docs/prd/PRD-$IssueNumber.md"
        if (Test-Path $prdPath) {
            "- ✅ **PRD:** [$prdPath]($prdPath)" | Out-File -FilePath $contextFile -Append -Encoding utf8
            
            # Extract key sections
            $content = Get-Content $prdPath -Raw
            if ($content -match "## Overview\s+(.+?)(?=##|\z)") {
                $overview = $matches[1].Trim() -replace '\r?\n', ' ' | Select-Object -First 200
                "  - Overview: $overview..." | Out-File -FilePath $contextFile -Append -Encoding utf8
            }
        } else {
            "- ❌ **PRD:** Missing at $prdPath" | Out-File -FilePath $contextFile -Append -Encoding utf8
        }

        # Check for Feature issues created
        try {
            $features = gh issue list --search "parent:$IssueNumber label:type:feature" --json number,title --repo "$OWNER/$REPO" | ConvertFrom-Json
            "`n**Features Created:** $($features.Count)" | Out-File -FilePath $contextFile -Append -Encoding utf8
            foreach ($feature in $features) {
                "- Feature #$($feature.number): $($feature.title)" | Out-File -FilePath $contextFile -Append -Encoding utf8
            }
        } catch {
            Write-Warning "Could not fetch feature issues: $_"
        }

        # Check for Story issues created
        try {
            $stories = gh issue list --search "parent:$IssueNumber label:type:story" --json number,title --repo "$OWNER/$REPO" | ConvertFrom-Json
            "`n**User Stories Created:** $($stories.Count)" | Out-File -FilePath $contextFile -Append -Encoding utf8
            foreach ($story in $stories) {
                "- Story #$($story.number): $($story.title)" | Out-File -FilePath $contextFile -Append -Encoding utf8
            }
        } catch {
            Write-Warning "Could not fetch story issues: $_"
        }
    }

    'ux' {
        @"
### UX Designer Deliverables

"@ | Out-File -FilePath $contextFile -Append -Encoding utf8

        # Check for UX design docs
        $uxDocs = Get-ChildItem -Path "docs/ux" -Filter "UX-*.md" -ErrorAction SilentlyContinue
        if ($uxDocs) {
            foreach ($doc in $uxDocs) {
                "- ✅ **UX Design:** [$($doc.Name)](docs/ux/$($doc.Name))" | Out-File -FilePath $contextFile -Append -Encoding utf8
                
                # Extract design type
                $content = Get-Content $doc.FullName -Raw
                if ($content -match "## Design Type\s+(.+?)(?=##|\z)") {
                    $designType = $matches[1].Trim()
                    "  - Type: $designType" | Out-File -FilePath $contextFile -Append -Encoding utf8
                }
            }
        } else {
            "- ❌ **UX Design:** No UX documents found in docs/ux/" | Out-File -FilePath $contextFile -Append -Encoding utf8
        }

        # Check for wireframes/prototypes
        if (Test-Path "docs/ux/wireframes") {
            $wireframes = Get-ChildItem -Path "docs/ux/wireframes" -Recurse -File
            "`n**Wireframes/Prototypes:** $($wireframes.Count) files" | Out-File -FilePath $contextFile -Append -Encoding utf8
        }
    }

    'architect' {
        @"
### Architect Deliverables

"@ | Out-File -FilePath $contextFile -Append -Encoding utf8

        # Check for ADR
        $adrPath = "docs/adr/ADR-$IssueNumber.md"
        if (Test-Path $adrPath) {
            "- ✅ **ADR:** [$adrPath]($adrPath)" | Out-File -FilePath $contextFile -Append -Encoding utf8
            
            $content = Get-Content $adrPath -Raw
            if ($content -match "## Decision\s+(.+?)(?=##|\z)") {
                $decision = $matches[1].Trim() -replace '\r?\n', ' ' | Select-Object -First 200
                "  - Decision: $decision..." | Out-File -FilePath $contextFile -Append -Encoding utf8
            }
        } else {
            "- ❌ **ADR:** Missing at $adrPath" | Out-File -FilePath $contextFile -Append -Encoding utf8
        }

        # Check for Tech Spec
        $specPath = "docs/specs/SPEC-$IssueNumber.md"
        if (Test-Path $specPath) {
            "- ✅ **Tech Spec:** [$specPath]($specPath)" | Out-File -FilePath $contextFile -Append -Encoding utf8
            
            $content = Get-Content $specPath -Raw
            if ($content -match "## API Contracts\s+(.+?)(?=##|\z)") {
                $api = $matches[1].Trim() -replace '\r?\n', ' ' | Select-Object -First 200
                "  - API: $api..." | Out-File -FilePath $contextFile -Append -Encoding utf8
            }
        } else {
            "- ❌ **Tech Spec:** Missing at $specPath" | Out-File -FilePath $contextFile -Append -Encoding utf8
        }

        # Check for Architecture doc
        $archPath = "docs/architecture/ARCH-$IssueNumber.md"
        if (Test-Path $archPath) {
            "- ✅ **Architecture:** [$archPath]($archPath)" | Out-File -FilePath $contextFile -Append -Encoding utf8
        }
    }

    'engineer' {
        @"
### Engineer Deliverables

"@ | Out-File -FilePath $contextFile -Append -Encoding utf8

        # Check for commits referencing this issue
        try {
            $commits = git log --all --grep="#$IssueNumber" --oneline
            $commitCount = ($commits | Measure-Object).Count
            
            if ($commitCount -gt 0) {
                "- ✅ **Commits:** $commitCount commits referencing #$IssueNumber" | Out-File -FilePath $contextFile -Append -Encoding utf8
                "`n**Recent Commits:**" | Out-File -FilePath $contextFile -Append -Encoding utf8
                $commits | Select-Object -First 5 | ForEach-Object {
                    "  - $_" | Out-File -FilePath $contextFile -Append -Encoding utf8
                }
            } else {
                "- ❌ **Commits:** No commits found referencing #$IssueNumber" | Out-File -FilePath $contextFile -Append -Encoding utf8
            }
        } catch {
            Write-Warning "Could not fetch commits: $_"
        }

        # Check for test files
        $testFiles = Get-ChildItem -Path "tests" -Filter "*Tests.cs" -Recurse -ErrorAction SilentlyContinue
        $testFilesPy = Get-ChildItem -Path "tests" -Filter "test_*.py" -Recurse -ErrorAction SilentlyContinue
        $allTests = @($testFiles) + @($testFilesPy)
        
        if ($allTests.Count -gt 0) {
            "`n- ✅ **Tests:** $($allTests.Count) test files found" | Out-File -FilePath $contextFile -Append -Encoding utf8
            foreach ($test in ($allTests | Select-Object -First 5)) {
                "  - $($test.Name)" | Out-File -FilePath $contextFile -Append -Encoding utf8
            }
        } else {
            "`n- ⚠️ **Tests:** No test files found in tests/" | Out-File -FilePath $contextFile -Append -Encoding utf8
        }

        # Check for documentation
        $readmeFiles = Get-ChildItem -Path "." -Filter "README.md" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.DirectoryName -notmatch "node_modules|\.git" }
        if ($readmeFiles) {
            "`n- ✅ **Documentation:** $($readmeFiles.Count) README files" | Out-File -FilePath $contextFile -Append -Encoding utf8
        }
    }

    'reviewer' {
        @"
### Reviewer Deliverables

"@ | Out-File -FilePath $contextFile -Append -Encoding utf8

        # Check for review document
        $reviewPath = "docs/reviews/REVIEW-$IssueNumber.md"
        if (Test-Path $reviewPath) {
            "- ✅ **Review:** [$reviewPath]($reviewPath)" | Out-File -FilePath $contextFile -Append -Encoding utf8
            
            $content = Get-Content $reviewPath -Raw
            if ($content -match "## Decision\s+(.+?)(?=##|\z)") {
                $decision = $matches[1].Trim()
                "  - Decision: $decision" | Out-File -FilePath $contextFile -Append -Encoding utf8
            }
        } else {
            "- ❌ **Review:** Missing at $reviewPath" | Out-File -FilePath $contextFile -Append -Encoding utf8
        }
    }
}

# Self-review checklist
@"

---

## ✅ Self-Review Checklist

"@ | Out-File -FilePath $contextFile -Append -Encoding utf8

switch ($Role) {
    'pm' {
        @"
- [ ] PRD created with all required sections (Overview, User Stories, Acceptance Criteria)
- [ ] All Features created as child issues
- [ ] All User Stories created with parent references
- [ ] Backlog is complete and properly hierarchical (Epic → Features → Stories)
- [ ] Each User Story has clear acceptance criteria
- [ ] Priorities assigned (p0/p1/p2/p3)
"@ | Out-File -FilePath $contextFile -Append -Encoding utf8
    }

    'ux' {
        @"
- [ ] Wireframes created for all user-facing features
- [ ] HTML prototypes generated for interactive flows
- [ ] User personas documented with pain points
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Responsive layouts designed (mobile, tablet, desktop)
- [ ] Component consistency verified with design system
"@ | Out-File -FilePath $contextFile -Append -Encoding utf8
    }

    'architect' {
        @"
- [ ] ADR created with Context, Decision, Consequences sections
- [ ] Tech Spec includes API contracts and data models
- [ ] Architecture document covers system design
- [ ] Security considerations documented
- [ ] Performance requirements specified
- [ ] Implementation feasibility verified
"@ | Out-File -FilePath $contextFile -Append -Encoding utf8
    }

    'engineer' {
        @"
- [ ] Low-level design created (if complex story)
- [ ] Code follows SOLID principles and Skills.md standards
- [ ] Unit tests written (70% of test suite)
- [ ] Integration tests written (20% of test suite)
- [ ] E2E tests written (10% of test suite)
- [ ] Test coverage ≥80%
- [ ] XML docs added for all public APIs
- [ ] No security vulnerabilities (secrets, SQL injection, XSS)
- [ ] Error handling implemented with try-catch
- [ ] Performance optimized (async, caching)
"@ | Out-File -FilePath $contextFile -Append -Encoding utf8
    }

    'reviewer' {
        @"
- [ ] Code quality verified against Skills.md standards
- [ ] Test coverage checked (≥80%)
- [ ] Security reviewed (no secrets, SQL parameterization)
- [ ] Documentation completeness verified
- [ ] Performance considerations noted
- [ ] Review document created with clear decision
"@ | Out-File -FilePath $contextFile -Append -Encoding utf8
    }
}

# Next steps
@"

---

## 🚀 Next Steps

"@ | Out-File -FilePath $contextFile -Append -Encoding utf8

switch ($Role) {
    'pm' {
        "- Status updated to **Ready** in Projects board" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- UX Designer (if needs:ux) or Architect picks up next" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- Next agent will review backlog and PRD" | Out-File -FilePath $contextFile -Append -Encoding utf8
    }

    'ux' {
        "- Status updated to **Ready** in Projects board" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- Architect will review UX designs and PRD" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- Architect will create ADR, Tech Specs, and Architecture docs" | Out-File -FilePath $contextFile -Append -Encoding utf8
    }

    'architect' {
        "- Status updated to **Ready** in Projects board" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- Engineer can now start implementing User Stories" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- Engineer will read ADR, Tech Specs, and UX designs" | Out-File -FilePath $contextFile -Append -Encoding utf8
    }

    'engineer' {
        "- Status updated to **In Review** in Projects board" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- Reviewer will check code quality, tests, security, docs" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- If approved: Issue closed, Status → Done" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- If changes needed: Status → In Progress" | Out-File -FilePath $contextFile -Append -Encoding utf8
    }

    'reviewer' {
        "- If approved: Issue closed, Status → Done" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- If changes needed: Engineer will address feedback" | Out-File -FilePath $contextFile -Append -Encoding utf8
        "- Review cycle continues until approval" | Out-File -FilePath $contextFile -Append -Encoding utf8
    }
}

@"

---

**Context captured at:** $timestamp  
**Context file:** $contextFile

"@ | Out-File -FilePath $contextFile -Append -Encoding utf8

Write-Host "✅ Context captured to: $contextFile"

# Post context to GitHub issue as comment
Write-Host "📤 Posting context to GitHub issue #$IssueNumber..."

try {
    $contextContent = Get-Content $contextFile -Raw
    gh issue comment $IssueNumber --body $contextContent --repo "$OWNER/$REPO"
    Write-Host "✅ Context posted successfully!"
} catch {
    Write-Warning "Failed to post context to GitHub: $_"
    Write-Host "⚠️ Context saved locally but not posted to GitHub"
    exit 1
}

Write-Host ""
Write-Host "📊 Summary:"
Write-Host "  - Role: $($roleNames[$Role])"
Write-Host "  - Issue: #$IssueNumber"
Write-Host "  - Context: $contextFile"
Write-Host "  - Posted: ✅"
