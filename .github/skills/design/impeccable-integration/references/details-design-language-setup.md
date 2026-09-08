# Impeccable: Target-App Setup

AgentX supplies the bridge, not upstream code. Install only in the target app,
never in AgentX or its extension assets. Upstream is Apache-2.0; see NOTICE.

## Verified contract

Reviewed upstream commit `8b39f419497fb9eaacb12e19c059b2353a0956c3` and native
release `engine-v0.1.3`. Repository metadata says npm `4.0.4`, but the registry
probe on 2026-09-07 returned `3.6.0` and `4.0.4` returned 404. Do not assume
repository metadata proves a published package. Recheck before npm onboarding.

The npm shim may use an override, platform dependency, user cache, or download.
`npm exec --offline` only constrains npm; it does not constrain that shim.
AgentX instead requires an existing, hash-pinned native engine inside the app.
The check performs no install, update, provider call, or URL scan.

## Explicit onboarding

Requires user-approved network access for setup, plus PowerShell 7 and Node
22.18+ for the AgentX bridge. Example for Windows x64, from the target app:

```powershell
$bin = '.impeccable\bin\0.1.3'
New-Item -ItemType Directory -Path $bin -Force | Out-Null
gh release download engine-v0.1.3 --repo pbakaus/impeccable --dir $bin `
  --pattern impeccable-windows-x64.exe --pattern impeccable-windows-x64.exe.sha256
if ($LASTEXITCODE -ne 0) { throw 'Engine download failed' }
$engine = Join-Path $bin 'impeccable-windows-x64.exe'
$expected = ((Get-Content "$engine.sha256" -Raw).Trim() -split '\s+')[0]
$actual = (Get-FileHash $engine -Algorithm SHA256).Hash
if ($actual -ne $expected) { throw 'Engine checksum mismatch' }
@{
  enginePath = '.impeccable/bin/0.1.3/impeccable-windows-x64.exe'
  engineVersion = '0.1.3'
  sha256 = $expected
} | ConvertTo-Json | Set-Content '.impeccable\agentx.json'
```

For macOS/Linux select the matching `impeccable-{darwin|linux}-{arm64|x64}`
asset and sidecar, and make that verified file executable. Keep the binary
out of source control; track the pin. Restore only the pinned release asset
and check its recorded hash on new machines. Never rewrite a pin to accept a
checksum mismatch. Upgrades require contract review and a new pin.

Optionally install the upstream AI skill and agents using that verified engine:

```powershell
& $engine install -y --providers=github --scope=project --no-hooks
if ($LASTEXITCODE -ne 0) { throw 'Upstream skill installation failed' }
```

This separate operation downloads a signed skill bundle; record its installed
version because it is independent of the native engine pin. The installer uses
the nearest Git root: check monorepo placement first. Do not use `--force` to
overwrite consumer-owned files. `github` (alias `copilot`) provides the project
skill and native agent files for Copilot; there is no separate Agents-window
provider. Reload/discover skills in the host and confirm availability.
Upstream hooks are disabled here: their Bash dependency is not a portable
Windows/Agents-window guarantee. No hook is required for AgentX's explicit gate.

## Design language before UI

1. Read an existing brand reference, or clarify audience, tone and constraints.
2. `/impeccable init` captures product context in `PRODUCT.md`, not `DESIGN.md`.
3. For new UI follow upstream's new-work design-language workflow; for existing
   UI use `/impeccable document`. Cite `PRODUCT.md` and `DESIGN.md` in the UX spec.
4. Review `DESIGN.md` YAML token mappings (`colors`, `typography`, `rounded`).
   Prose alone does not enable deterministic token checks. The optional
   `.impeccable/design.json` or `DESIGN.json` sidecar supplements these tokens.
5. Build against that language; run Pass 0 before judgment-based critique.

If upstream skills are unavailable, author those artifacts using AgentX's
brand/design skills and explicitly record unavailable upstream authoring.
Do not fabricate slash-command execution.

## Run the gate

```powershell
.\.agentx\agentx.ps1 design-language check -Path src -Json
# Separate app root, including monorepos:
.\.agentx\agentx.ps1 design-language check -WorkspaceRoot C:\apps\example -Path src -Json
```

The Bash AgentX launcher forwards the same command to PowerShell. Installed
extension runtimes resolve the first-party helper without copying it into the
consumer workspace. The gate defaults to 60 seconds, accepts `-TimeoutSeconds`
from 1 to 300, and caps each subprocess capture at 4 MiB.

Use explicit source files or directories, not URLs. Missing/empty/unsupported
scopes degrade rather than producing a false clean scan. Directory traversal
skips upstream's generated/hidden directories. Nested `.git`, `package.json`,
`.impeccable`, or DESIGN documents (case variants and `docs`/`.agents/context`
fallbacks) require app-specific `WorkspaceRoot`. Token meaning, suppressions and all
AgentX-owned checks still require review; see
[detector governance](details-detector-governance.md).

## Upstream evidence

- [Launcher resolution](https://github.com/pbakaus/impeccable/blob/8b39f419497fb9eaacb12e19c059b2353a0956c3/cli/bin/cli.js)
- [Native detector contract](https://github.com/pbakaus/impeccable/blob/8b39f419497fb9eaacb12e19c059b2353a0956c3/crates/detect/src/cli.rs)
- [Current init behavior](https://github.com/pbakaus/impeccable/blob/8b39f419497fb9eaacb12e19c059b2353a0956c3/skill/reference/init.md)
- [Provider installation](https://github.com/pbakaus/impeccable/blob/8b39f419497fb9eaacb12e19c059b2353a0956c3/crates/skills/src/providers.rs)
