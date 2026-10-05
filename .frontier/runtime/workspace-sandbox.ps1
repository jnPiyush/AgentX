#Requires -Version 7.0

# Git metadata and gate implementations are protected because editing either can disable enforcement.
$Script:SANDBOX_BLOCKED_DIR_SEGMENTS = @('.ssh', '.aws', '.gnupg', '.azure', '.kube', '.docker', '.git')
$Script:SANDBOX_BLOCKED_RELATIVE_PATHS = @(
    '.config/gh',
    '.frontier/state',
    '.frontier/sessions',
    '.frontier/runtime/frontier-cli.ps1',
    '.frontier/runtime/agentic-runner.ps1',
    '.frontier/runtime/guided-interaction.ps1',
    '.frontier/runtime/repository-context.ps1',
    '.frontier/runtime/repository-symbols.ps1',
    '.frontier/runtime/repository-retrieval.ps1',
    '.frontier/runtime/repository-parser-worker.ps1',
    '.frontier/runtime/repository-process.cs',
    '.frontier/runtime/repository-parser',
    '.frontier/runtime/workspace-sandbox.ps1',
    '.frontier/runtime/workspace-state.ps1',
    '.frontier/runtime/loop-engineering.ps1',
    '.frontier/runtime/loop-static-checks.js',
    '.frontier/runtime/hydrafusion.ps1',
    '.frontier/runtime/hydrafusion-policy.ps1',
    '.frontier/runtime/hydrafusion-protocol.ps1',
    '.frontier/runtime/hydrafusion-workspace.ps1',
    '.frontier/runtime/frontier.ps1',
    '.frontier/runtime/frontier.sh',
    '.github/hooks'
)

function Test-SandboxDeniedFileName([string]$Name) {
    $leaf = $Name.ToLowerInvariant()
    if ($leaf -eq '.env' -or $leaf.StartsWith('.env.')) { return $true }
    if ($leaf -in @('.netrc', '_netrc', '.npmrc', '.git-credentials', '.gitconfig', '.envrc', '.pgpass', '.pypirc', 'kubeconfig', 'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'credentials')) { return $true }
    foreach ($extension in @('.pem', '.key', '.pfx', '.p12', '.p8', '.jks', '.ppk', '.asc')) {
        if ($leaf.EndsWith($extension)) { return $true }
    }
    return $false
}

function Test-SandboxPath {
    param([string]$Path, [string]$WorkspaceRoot)
    if ([string]::IsNullOrWhiteSpace($Path)) {
        return @{ allowed = $false; resolvedPath = ''; reason = 'Path is required.' }
    }
    if ([string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
        return @{ allowed = $false; resolvedPath = ''; reason = 'Workspace root is not configured.' }
    }
    # Validate one literal path: wildcard expansion and alternate streams can escape a lexical check.
    if ($Path -match '[*?]' -or $Path -match '\[[^\]]*\]') {
        return @{ allowed = $false; resolvedPath = ''; reason = 'Wildcard characters are not allowed in a path' }
    }
    $streamProbe = if ($Path -match '^[A-Za-z]:') { $Path.Substring(2) } else { $Path }
    if ($streamProbe.Contains(':')) {
        return @{ allowed = $false; resolvedPath = ''; reason = 'Alternate data stream syntax is not allowed' }
    }
    if ($Path -match '(^|[\\/])\.\.([\\/]|$)') {
        return @{ allowed = $false; resolvedPath = ''; reason = 'Path traversal attempt detected' }
    }
    $rootFull = [IO.Path]::GetFullPath($WorkspaceRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $resolved = if ([IO.Path]::IsPathRooted($Path)) {
        [IO.Path]::GetFullPath($Path)
    } else { [IO.Path]::GetFullPath((Join-Path $rootFull $Path)) }
    $containment = Test-SandboxContainment -Resolved $resolved -RootFull $rootFull
    if (-not $containment.allowed) { return $containment }
    $linkCheck = Test-SandboxLinkChain -Resolved $resolved -RootFull $rootFull
    if (-not $linkCheck.allowed) { return $linkCheck }
    return @{ allowed = $true; resolvedPath = $resolved; actualPath = $linkCheck.resolvedPath; reason = '' }
}

function Test-SandboxLinkChain {
    param([string]$Resolved, [string]$RootFull)
    $relative = [IO.Path]::GetRelativePath($RootFull, $Resolved)
    if ($relative -eq '.') { return @{ allowed = $true; resolvedPath = $Resolved; reason = '' } }
    $current = $RootFull
    $rebased = $false
    foreach ($segment in @(($relative -replace '\\', '/') -split '/' | Where-Object { $_ -and $_ -ne '.' })) {
        $parent = $current
        $current = Join-Path $parent $segment
        $item = $null
        try { $item = Get-Item -LiteralPath $current -Force -ErrorAction SilentlyContinue } catch { $item = $null }
        if (-not $item) { continue }
        # A hardlink can alias protected state without exposing a ResolveLinkTarget.
        if (-not $item.PSIsContainer -and [string]$item.LinkType -eq 'HardLink') {
            return @{ allowed = $false; resolvedPath = $Resolved; reason = 'Hardlinked files are not allowed in autonomous file tools' }
        }
        if ($segment -like '*~*') {
            $siblingNames = @()
            try { $siblingNames = @(Get-ChildItem -LiteralPath $parent -Force -Name -ErrorAction SilentlyContinue) } catch { $siblingNames = @() }
            # A resolved child absent from its parent's listing may be an NTFS short-name alias.
            if ($siblingNames -notcontains $segment) {
                return @{ allowed = $false; resolvedPath = $Resolved; reason = 'Short (8.3) path aliases are not allowed' }
            }
        }
        $target = $null
        try {
            $resolvedLink = $item.ResolveLinkTarget($true)
            if ($resolvedLink) { $target = $resolvedLink.FullName }
        } catch { $target = $null }
        if (-not $target) { continue }
        $targetFull = [IO.Path]::GetFullPath($target)
        $targetContainment = Test-SandboxContainment -Resolved $targetFull -RootFull $RootFull
        if (-not $targetContainment.allowed) {
            return @{ allowed = $false; resolvedPath = $Resolved; reason = 'Path resolves through a link to outside the workspace' }
        }
        $current = $targetFull
        $rebased = $true
    }
    if ($rebased) {
        # Links may target a parent of a protected location, so recheck the completed real path.
        $rebasedContainment = Test-SandboxContainment -Resolved $current -RootFull $RootFull
        if (-not $rebasedContainment.allowed) {
            return @{ allowed = $false; resolvedPath = $Resolved; reason = $rebasedContainment.reason }
        }
    }
    return @{ allowed = $true; resolvedPath = $current; reason = '' }
}

function Test-SandboxContainment {
    param([string]$Resolved, [string]$RootFull)
    $relative = [IO.Path]::GetRelativePath($RootFull, $Resolved)
    if ($relative -eq '..' -or $relative.StartsWith('..' + [IO.Path]::DirectorySeparatorChar) -or [IO.Path]::IsPathRooted($relative)) {
        return @{ allowed = $false; resolvedPath = $Resolved; reason = 'Path is outside workspace root' }
    }
    foreach ($segment in @(($relative -replace '\\', '/') -split '/' | Where-Object { $_ -and $_ -ne '.' })) {
        if ($Script:SANDBOX_BLOCKED_DIR_SEGMENTS -contains $segment.ToLowerInvariant()) {
            return @{ allowed = $false; resolvedPath = $Resolved; reason = "Access to sensitive directory is blocked: $segment" }
        }
    }
    $posixRelative = ($relative -replace '\\', '/').ToLowerInvariant()
    foreach ($blocked in $Script:SANDBOX_BLOCKED_RELATIVE_PATHS) {
        if ($posixRelative -eq $blocked -or $posixRelative -like "$blocked/*" -or $posixRelative -like "*/$blocked" -or $posixRelative -like "*/$blocked/*") {
            return @{ allowed = $false; resolvedPath = $Resolved; reason = "Access to protected location is blocked: $blocked" }
        }
    }
    $leaf = [IO.Path]::GetFileName($Resolved)
    if ($leaf -and (Test-SandboxDeniedFileName -Name $leaf)) {
        return @{ allowed = $false; resolvedPath = $Resolved; reason = "Access to sensitive file pattern is blocked: $leaf" }
    }
    return @{ allowed = $true; resolvedPath = $Resolved; reason = '' }
}
