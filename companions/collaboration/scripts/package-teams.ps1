#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][guid]$AppId,
    [Parameter(Mandatory)][uri]$WebsiteUrl,
    [Parameter(Mandatory)][uri]$PrivacyUrl,
    [Parameter(Mandatory)][uri]$TermsUrl,
    [string]$OutputPath = (Join-Path $PSScriptRoot '../build/frontier-teams.zip')
)

$ErrorActionPreference = 'Stop'
foreach ($url in @($WebsiteUrl, $PrivacyUrl, $TermsUrl)) {
    if (-not $url.IsAbsoluteUri -or $url.Scheme -ne 'https') { throw 'Public app URLs must use HTTPS.' }
}
if ($AppId -eq [guid]::Empty) { throw 'AppId must be the registered Teams bot application ID.' }
if (-not $IsWindows) { throw 'This package helper requires Windows System.Drawing. On other hosts supply 192x192 color and 32x32 white transparent outline PNGs via Teams Developer Portal.' }
Add-Type -AssemblyName System.Drawing
$destination = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $destination) { throw 'Output already exists. Choose a new output path.' }
$working = Join-Path ([IO.Path]::GetTempPath()) "frontier-teams-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $working | Out-Null
try {
    $manifest = [ordered]@{
        '$schema' = 'https://developer.microsoft.com/en-us/json-schemas/teams/v1.20/MicrosoftTeams.schema.json'
        manifestVersion = '1.20'
        version = '0.1.0'
        id = $AppId.ToString()
        developer = @{
            name = 'Frontier Corp'; websiteUrl = $WebsiteUrl.AbsoluteUri
            privacyUrl = $PrivacyUrl.AbsoluteUri; termsOfUseUrl = $TermsUrl.AbsoluteUri
        }
        name = @{ short = 'Frontier'; full = 'Frontier Collaboration' }
        description = @{
            short = 'Progress and instructions for your Frontier FDE fleet.'
            full = 'View agent job progress and send confirmed instructions to the configured Frontier workspace from Teams.'
        }
        icons = @{ outline = 'outline.png'; color = 'color.png' }
        accentColor = '#087F5B'
        bots = @(@{
            botId = $AppId.ToString(); scopes = @('personal', 'team', 'groupChat')
            isNotificationOnly = $false; supportsFiles = $false
            commandLists = @(@{
                scopes = @('personal', 'team', 'groupChat')
                commands = @(
                    @{ title = 'status'; description = 'Show your recent agent jobs in this conversation' }
                    @{ title = 'help'; description = 'Show supported commands' }
                )
            })
        })
        permissions = @('identity')
        validDomains = @($WebsiteUrl.Host)
    }
    $manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $working 'manifest.json') -Encoding utf8
    $source = [Drawing.Image]::FromFile((Join-Path $PSScriptRoot '../../../vscode-extension/resources/icon.png'))
    try {
        $color = [Drawing.Bitmap]::new($source, 192, 192)
        try { $color.Save((Join-Path $working 'color.png'), [Drawing.Imaging.ImageFormat]::Png) }
        finally { $color.Dispose() }
    } finally { $source.Dispose() }
    $outline = [Drawing.Bitmap]::new(32, 32)
    $graphics = [Drawing.Graphics]::FromImage($outline)
    $font = [Drawing.Font]::new('Segoe UI', 24, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
    try {
        $graphics.Clear([Drawing.Color]::Transparent)
        $graphics.DrawString('F', $font, [Drawing.Brushes]::White, 5, 1)
        $outline.Save((Join-Path $working 'outline.png'), [Drawing.Imaging.ImageFormat]::Png)
    } finally { $font.Dispose(); $graphics.Dispose(); $outline.Dispose() }
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    [IO.Compression.ZipFile]::CreateFromDirectory($working, $destination)
    Write-Output "Teams package created: $destination"
} finally {
    Remove-Item -LiteralPath $working -Recurse -Force
}