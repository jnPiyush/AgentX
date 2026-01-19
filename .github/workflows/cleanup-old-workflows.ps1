# Workflow Cleanup Script
# Removes old/redundant workflows after migrating to unified orchestrator

Write-Host "🧹 AgentX Workflow Cleanup" -ForegroundColor Cyan
Write-Host "This script will remove old workflow files" -ForegroundColor Yellow
Write-Host ""

$workflowsToRemove = @(
    "orchestrate.yml",
    "run-product-manager.yml", 
    "architect.yml",
    "engineer.yml",
    "ux-designer.yml",
    "reviewer.yml",
    "process-ready-issues.yml",
    "enforce-issue-workflow.yml"
)

$workflowsToKeep = @(
    "agent-orchestrator.yml",
    "sync-status-to-labels.yml",
    "test-e2e.yml"
)

$workflowDir = ".github/workflows"

Write-Host "📋 Workflows to remove:" -ForegroundColor Red
foreach ($file in $workflowsToRemove) {
    $path = Join-Path $workflowDir $file
    if (Test-Path $path) {
        Write-Host "  ❌ $file" -ForegroundColor Red
    } else {
        Write-Host "  ⏭️  $file (already deleted)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "📋 Workflows to keep:" -ForegroundColor Green
foreach ($file in $workflowsToKeep) {
    $path = Join-Path $workflowDir $file
    if (Test-Path $path) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $file (missing - needs creation)" -ForegroundColor Yellow
    }
}

Write-Host ""
$confirm = Read-Host "Do you want to proceed with deletion? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "❌ Cleanup cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🗑️  Removing old workflows..." -ForegroundColor Cyan

$removedCount = 0
foreach ($file in $workflowsToRemove) {
    $path = Join-Path $workflowDir $file
    if (Test-Path $path) {
        try {
            Remove-Item $path -Force
            Write-Host "  ✅ Removed $file" -ForegroundColor Green
            $removedCount++
        } catch {
            Write-Host "  ❌ Failed to remove $file: $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "✅ Cleanup complete! Removed $removedCount files" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Commit changes: git add .github/workflows && git commit -m 'chore: simplify workflows to unified orchestrator'"
Write-Host "  2. Push changes: git push"
Write-Host "  3. Test new orchestrator: gh workflow run agent-orchestrator.yml -f issue_number=<TEST_ISSUE>"
Write-Host ""
