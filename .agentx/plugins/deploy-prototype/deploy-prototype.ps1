[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('vercel','netlify','cloudflare','github-pages','surge')]
    [string]$Target,

    [string]$BuildDir = 'dist',
    [string]$ProjectName,
    [string]$Branch = 'gh-pages',
    [switch]$Prod
)

# deploy-prototype.ps1
# Thin adapter that shells out to the chosen target's official CLI.
# The plugin NEVER reads or stores tokens. Credentials live in the user's
# shell session (env vars or the CLI's own auth store).

$ErrorActionPreference = 'Stop'

function Require-Command {
    param([string]$Name, [string]$InstallHint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Error "[deploy-prototype] '$Name' is not on PATH. $InstallHint"
        exit 2
    }
}

if (-not (Test-Path $BuildDir)) {
    Write-Error "[deploy-prototype] Build directory '$BuildDir' does not exist. Run your build first (for example 'npm run build')."
    exit 3
}

Write-Host "[deploy-prototype] Target=$Target BuildDir=$BuildDir Prod=$($Prod.IsPresent)"

switch ($Target) {
    'vercel' {
        Require-Command 'vercel' "Install with: npm i -g vercel"
        $args = @($BuildDir, '--yes')
        if ($Prod) { $args += '--prod' }
        & vercel @args
    }
    'netlify' {
        Require-Command 'netlify' "Install with: npm i -g netlify-cli"
        $args = @('deploy', '--dir', $BuildDir)
        if ($ProjectName) { $args += @('--site', $ProjectName) }
        if ($Prod) { $args += '--prod' }
        & netlify @args
    }
    'cloudflare' {
        Require-Command 'wrangler' "Install with: npm i -g wrangler"
        if (-not $ProjectName) {
            Write-Error "[deploy-prototype] Cloudflare Pages requires -ProjectName"
            exit 4
        }
        & wrangler pages deploy $BuildDir --project-name $ProjectName
    }
    'github-pages' {
        Require-Command 'gh' "Install GitHub CLI: https://cli.github.com/"
        # Uses gh + git to push the build dir to the chosen branch via a worktree.
        $tmp = Join-Path $env:TEMP ("ghp-" + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $tmp | Out-Null
        try {
            git worktree add $tmp $Branch 2>$null
            if ($LASTEXITCODE -ne 0) {
                git worktree add -B $Branch $tmp
            }
            Get-ChildItem $tmp -Force -Exclude '.git' | Remove-Item -Recurse -Force
            Copy-Item (Join-Path $BuildDir '*') $tmp -Recurse -Force
            Push-Location $tmp
            git add -A
            git commit -m "deploy: prototype build" 2>$null
            git push origin $Branch
            Pop-Location
        } finally {
            git worktree remove $tmp --force 2>$null | Out-Null
        }
    }
    'surge' {
        Require-Command 'surge' "Install with: npm i -g surge"
        $args = @($BuildDir)
        if ($ProjectName) { $args += "$ProjectName.surge.sh" }
        & surge @args
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "[deploy-prototype] Target CLI exited with code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "[deploy-prototype] OK"
