# Security Policy

## Scope

AgentX is a **local developer tool**: a VS Code extension, a PowerShell CLI, and a corpus of Markdown agent/skill definitions. It runs on a developer's machine with that developer's privileges. It does not host a service, store customer data, or provision cloud infrastructure.

The security properties that matter for this threat model are:

1. **Command execution safety** -- AgentX executes shell commands, some of them proposed by a language model that may have read untrusted content (a repository file, an issue body, a web page). A destructive command must not run just because a model emitted it.
2. **Secret hygiene** -- agent transcripts, error messages, and loop evidence are written to `.agentx/state/` and to VS Code output channels. Credentials must not be persisted there.
3. **Supply chain of the published extension** -- a compromised dependency would reach every user through the VS Code Marketplace.

## Supported Versions

| Version | Supported |
|---|---|
| Latest published Marketplace release | Yes |
| Older releases | No -- upgrade to the latest |

## Reporting a Vulnerability

**Do not open a public issue for a security vulnerability.**

Report privately through GitHub's coordinated disclosure flow:

1. Go to the [Security Advisories page](https://github.com/jnPiyush/AgentX/security/advisories/new).
2. Provide: affected version, reproduction steps, impact, and any suggested fix.

If GitHub private reporting is unavailable to you, open a public issue containing **only** the words "security report request" and no technical detail, and a maintainer will arrange a private channel.

### What to Expect

| Stage | Target |
|---|---|
| Acknowledgement | 5 business days |
| Initial assessment and severity | 10 business days |
| Fix or documented mitigation | Depends on severity; critical issues are prioritised over feature work |

Please allow a reasonable window for a fix before public disclosure.

## In Scope

- Bypass of the blocked-command policy in `vscode-extension/src/utils/commandValidator.ts` (for example, a command shape that reaches `execShell` and performs a destructive action)
- Secret leakage into `.agentx/state/`, loop evidence archives, log files, or output channels
- Path traversal that lets an agent read or write outside the opened workspace
- Prompt-injection chains that lead to command execution or file exfiltration
- Dependency vulnerabilities reachable from extension code
- Privilege or token misuse in the GitHub Actions workflows

## Out of Scope

- Behaviour of the underlying language model (GitHub Copilot, GitHub Models, or any configured provider). Report model-level issues to that provider.
- Quality, correctness, or safety of code an agent generates -- the developer remains the reviewer and is responsible for what they commit.
- Findings that require an attacker to already have local execution rights on the developer's machine.
- Content of the Markdown skills corpus, which is documentation and carries no execution privilege of its own.
- Social-engineering the human operator into approving a command.

## Current Security Controls

| Control | Where | Enforcement |
|---|---|---|
| Blocked-command patterns | `vscode-extension/src/utils/commandValidatorPolicy.ts` | Enforced at both shell entry points (`execShell`, `execShellStreaming`) |
| Secret redaction | `vscode-extension/src/utils/secretRedactor.ts` | Applied to shell error paths before they surface or persist |
| Path sandbox | `vscode-extension/src/utils/pathSandbox.ts` | Plugin targets require lexical and canonical containment; linked destination ancestors are rejected |
| SSRF validation | `vscode-extension/src/utils/ssrfValidator.ts` | Every A/AAAA result is validated and each initial/redirect request is pinned to an approved address |
| Plugin integrity | `vscode-extension/src/utils/pluginIntegrity.ts` | Checksum verification on plugin install |
| Dependency audit | `.github/workflows/dependency-scanning.yml` | Runtime `npm audit` fails on high/critical across all package trees |
| Routing evaluation | `scripts/classify-issue.js` + `ai-evaluation.yml` | Production issue triage and threshold evaluation invoke the same classifier |
| Release evidence | `.github/workflows/auto-release.yml` | CycloneDX SBOMs from unpacked final VSIX/MCP artifacts plus Sigstore provenance and SBOM attestations for both |
| Publish gate | `.github/workflows/publish-marketplace.yml` | Publishes the GitHub release VSIX only after `gh attestation verify` succeeds |
| Pinned actions | All workflows | Every GitHub Action pinned to a full commit SHA |
| Least-privilege tokens | All workflows | Explicit `permissions:` blocks |

## Known Limitations

Stated plainly so users can make their own risk decisions:

- The blocked-command list is a **denylist of catastrophic operations**, not a full sandbox. `execShell` deliberately allows unrecognised commands through, because a coding harness must run arbitrary build and test tooling. Do not run AgentX against a repository you do not trust with your shell.
- The quality-loop iteration state remains a local hook control because `.agentx/state/loop-state.json` is intentionally untracked. Model Council, Compound Capture, and scrub parity checks also run in CI, but development-process gates are not security boundaries.
- SBOM/provenance workflow wiring is locally validated; attestation generation and Marketplace verification require a successful remote release run before they are operationally proven.
