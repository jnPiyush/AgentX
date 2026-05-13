# VS Extension Marketplace Publish Dry-Run

| Field         | Value                                                                                                |
|---------------|------------------------------------------------------------------------------------------------------|
| Date          | 2026-05-12                                                                                           |
| Reviewer      | RPI Agent                                                                                            |
| Build         | `vs-extension/AgentX.VisualStudio/bin/Release/net8.0-windows/AgentX.VisualStudio.vsix` (4,017,172 B) |
| Decision      | **CONDITIONAL PASS** - safe to publish as Preview; flip `Preview=false` only after smoke test.       |

This report verifies the VSIX produced by `dotnet build .\vs-extension\AgentX.VisualStudio.sln -c Release` is shaped correctly for the Visual Studio Marketplace **without** uploading anything. Real upload is gated behind manual smoke-test sign-off (Item 4).

---

## 1. Identity

| Field         | Value                            | Source                                        |
|---------------|----------------------------------|-----------------------------------------------|
| Identity Id   | `AgentX.VisualStudio.jnPiyush`   | `extension.vsixmanifest` -> `Identity Id`     |
| Version       | `8.4.45.0`                       | `extension.vsixmanifest` -> `Identity Version`|
| Publisher     | `Piyush Jain`                    | `extension.vsixmanifest` -> `Publisher`       |
| Language      | `en-US`                          | `extension.vsixmanifest` -> `Language`        |
| version.json  | `8.4.45`                         | repo root `version.json`                      |

[PASS] Manifest version (`8.4.45.0`) matches `version.json` (`8.4.45`) with the four-part suffix that VS marketplace expects.

---

## 2. Display Metadata

| Field            | Value                                                                                              |
|------------------|----------------------------------------------------------------------------------------------------|
| DisplayName      | `AgentX - Multi-Agent Orchestration`                                                               |
| Description      | `AI-powered multi-agent orchestration for Visual Studio. Coordinates PM, Architect, Engineer,...`  |
| Preview          | `true`                                                                                             |
| MoreInfo         | `https://github.com/jnPiyush/AgentX`                                                               |
| ReleaseNotes     | `https://github.com/jnPiyush/AgentX/blob/master/CHANGELOG.md`                                      |
| License          | `LICENSE` (Apache-2.0, 11,338 B)                                                                   |
| Icon             | `resources\icon.png` (4,489 B)                                                                     |
| Tags             | `agent;ai;multi-agent;workflow;automation;llm;copilot;powershell;orchestration`                    |

[PASS] All required marketplace metadata fields are present. Description fits within the 200-character marketplace short-description limit.

---

## 3. Asset References (manifest -> file)

| Manifest Reference       | File in VSIX            | Status |
|--------------------------|-------------------------|--------|
| `<Icon>resources\icon.png` | `resources\icon.png`  | [PASS] |
| `<License>LICENSE`         | `LICENSE`             | [PASS] |
| `<MoreInfo>` URL           | n/a (URL only)        | [PASS] |
| `<ReleaseNotes>` URL       | n/a (URL only)        | [PASS] |

All asset references resolve. No broken paths.

---

## 4. Installation Targets

| Field                   | Value                                                  |
|-------------------------|--------------------------------------------------------|
| ExtensionType           | `VisualStudio.Extensibility` (out-of-process, modern)  |
| InstallationTarget Id   | `Microsoft.VisualStudio.Community`                     |
| Min Version             | `[17.14,)`                                             |
| Architectures           | `amd64`, `arm64`                                       |
| DotnetTargetVersions    | `net8.0`                                               |
| Prerequisite            | `Microsoft.VisualStudio.Component.CoreEditor` `[17.14,)` |

[PASS] Targets VS 17.14+ on amd64 and arm64. CoreEditor prerequisite is the minimum needed for the tool window surface.

---

## 5. Catalog (catalog.json)

| Field                   | Value                                                                                  |
|-------------------------|----------------------------------------------------------------------------------------|
| manifestVersion         | `1.1`                                                                                  |
| Component Id            | `Component.AgentX.VisualStudio.jnPiyush`                                               |
| Hot-loadable            | `true`                                                                                 |
| Localized Title (en-US) | `AgentX - Multi-Agent Orchestration`                                                   |
| Install size            | `9,522,590` bytes target-drive footprint                                               |

[PASS] Catalog references the same Identity Id and Version as the manifest.

---

## 6. Payload Inventory

Total VSIX payload: **141** entries.

| Category                              | Count | Notes                                                                                |
|---------------------------------------|------:|--------------------------------------------------------------------------------------|
| Production extension assembly         |     1 | `AgentX.VisualStudio.dll` (88,064 B)                                                 |
| Marketplace assets                    |     2 | `resources\icon.png`, `LICENSE`                                                      |
| Manifests                             |     4 | `extension.vsixmanifest`, `manifest.json`, `catalog.json`, `[Content_Types].xml`     |
| `.vsextension/` registration          |     2 | `extension.json`, `settingsRegistration.json`                                        |
| Resource strings                      |     1 | `string-resources.json`                                                              |
| VS Extensibility SDK + dependencies   |    23 | `Microsoft.VisualStudio.*.dll`, `System.*.dll`, `Newtonsoft.Json` is NOT shipped     |
| Localized satellite resources         |   ~98 | 14 cultures x ~7 satellite assemblies (cs, de, en, es, fr, it, ja, ko, pl, pt-BR, ru, tr, zh-Hans, zh-Hant) |
| Native runtimes                       |     3 | `runtimes\browser`, `runtimes\win` (Threading.AccessControl, Management)             |

[PASS] Payload contains nothing surprising. No `.pdb` files in Release. No source files. No test assemblies. AgentX CLI scripts are NOT bundled (the extension shells out to whatever `agentx` is on PATH or in the workspace, which is the documented behavior).

---

## 7. Findings

### Pass

1. Manifest schema is `2.0.0` and validates against `http://schemas.microsoft.com/developer/vsx-schema/2011`.
2. Identity, Version, Publisher all match the producer (`jnPiyush`) and `version.json`.
3. Apache-2.0 license is shipped as a file referenced by the manifest's `<License>` element.
4. PNG icon ships at the documented relative path.
5. Targets the modern `VisualStudio.Extensibility` (out-of-process) extension type, not the legacy VSPackage type.
6. Both amd64 and arm64 architectures are listed.
7. `Preview=true` correctly flags this as an early release that the marketplace will badge accordingly.

### Watch

1. **Preview flag is on.** Intentional for the first publish - the smoke-test pass (Item 4) is the gate for flipping to `false` in a follow-up.
2. **CHANGELOG.md must list 8.4.45.** ReleaseNotes URL points at `master`, so the link will work, but the entry needs to exist before publish. Verified separately when the polish set lands.
3. **Catalog reports an `installSizes.targetDrive` of ~9.5 MB.** Reasonable for a tool-window extension that ships its own copy of the VS Extensibility runtime DLLs.
4. **No VSIX signature.** Marketplace will accept unsigned VSIX for Preview, but signing is recommended before flipping `Preview=false`. Tracked as a Phase 5 Discover candidate.

### Fail

None.

---

## 8. Reproduction

```powershell
$root = 'C:\Engagements\Learnings\AgentX\vs-extension\AgentX.VisualStudio\bin\Release\net8.0-windows'
$vsix = Join-Path $root 'AgentX.VisualStudio.vsix'
$out  = Join-Path $root '_vsix-extracted'
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
Expand-Archive -Path $vsix -DestinationPath $out -Force
Get-Content (Join-Path $out 'extension.vsixmanifest') -Raw
Get-Content (Join-Path $out 'catalog.json') -Raw
```

---

## 9. Decision

**CONDITIONAL PASS.** The VSIX is shaped correctly for the marketplace and is safe to publish as a Preview. The flip to GA (`Preview=false`) is gated on:

1. Smoke-test sign-off (see [docs/ux/vs-extension-smoke-test.md](../../ux/vs-extension-smoke-test.md)).
2. Optional VSIX signing.
3. CHANGELOG.md entry for `8.4.45` confirmed visible at the ReleaseNotes URL.

No blocking findings.
