# Governance Rule Catalog

Detection logic, rationale, and remediation for rules IG-01 to IG-10, applied by
[check-infra-governance.ps1](../scripts/check-infra-governance.ps1).

**Severity contract**: `Blocking` fails the gate under `-FailOnBlocking`. `Advisory`
reports only. Detection is text-based and approximate -- treat every finding as a
review prompt to confirm, not a verdict.

---

## Blocking Rules

### IG-01 -- Auth disabled without a companion identity

**Trigger**: a resource disables key or password authentication
(`local_auth_enabled = false`, `disableLocalAuth: true`,
`shared_access_key_enabled = false`, or ARM `allowSharedKeyAccess: false`) but the
scanned deployment unit contains no role assignment that links a managed identity to
that specific target.

**Why it matters**: disabling key auth is a *security improvement* only if something
replaces it. On its own it produces a resource nothing can reach, so the usual fix under
deadline pressure is to turn keys back on -- ending in a worse state than before.

**Fix**: add a managed identity to the consumer and an explicit role assignment granting
least privilege on the target, in the same unit of deployment.

---

### IG-02 -- Hardcoded credential

**Trigger**: an assignment to a `password`, `secret`, `connection_string`, `access_key`, or
`client_secret` field whose value is a literal. Detection evaluates the assigned value,
not surrounding lines, so punctuation and unrelated variable references do not bypass it.

**Exempt** when the value references a variable, parameter, secret store, or data source,
or is an obvious placeholder (`REPLACE`, `EXAMPLE`, `CHANGEME`, `xxx`, `***`).

**Why it matters**: credentials in IaC reach version control, CI logs, and state files.
Rotation then requires a code change, so it does not happen.

**Fix**: reference a managed secret store, or inject at deploy time as a secure parameter.

---

### IG-03 -- Hardcoded cross-module reference

**Trigger**: a string literal containing an absolute resource path such as
`/subscriptions/<guid>/...`.

**Why it matters**: hardcoded ids silently bind an environment to another environment's
resources. The stack still deploys, so the defect surfaces only when prod points at dev.

**Fix**: consume the producing module's output, or a remote-state / parameter reference.

---

### IG-04 -- Secret exposed as an output

**Trigger**: an output whose name contains `secret`, `password`, `key`, `token`, or
`connection`, without Terraform `sensitive = true`, Bicep `@secure()`, or ARM
`secureString` / `secureObject`.

**Why it matters**: outputs are printed by CI, stored in state, and surfaced by tooling.
An unmarked secret output leaks into every one of those.

**Fix**: mark the output sensitive, or stop exporting it and have consumers read the
secret store directly. Prefer the latter.

---

### IG-05 -- Encryption or TLS explicitly weakened

**Trigger**: transport/storage encryption set to `false`, or a minimum TLS version below 1.2.

**Why it matters**: these settings are secure by default. Reaching in to disable one is
almost always a workaround for a client problem that should be fixed in the client.

**Fix**: restore the secure default and fix the client. If genuinely required, record a
`# governance-exception` comment stating why and when it will be removed.

---

## Advisory Rules

### IG-06 -- Public network access without rationale

**Trigger**: `public_network_access_enabled = true` with no adjacent `# rationale` or
`// rationale` comment.

Public access is legitimate for a public API and wrong for a database. The rule does not
guess which one you have -- it asks for the reasoning to be written down next to the setting.

---

### IG-07 -- Name not produced by the resolver

**Trigger**: reviewer-applied. Resource names that do not match the resolver's output for
the same inputs.

**Fix**: generate names with
[resolve-resource-name.ps1](../scripts/resolve-resource-name.ps1). Convention-based
discovery breaks quietly when names drift.

---

### IG-08 -- Unpinned provider or module version

**Trigger**: a version constraint of `>=`, `~> 0`, or `*`.

Floating versions make builds non-reproducible: the same commit produces different
infrastructure on different days, which makes failures very hard to attribute.

**Fix**: pin an exact version and upgrade deliberately.

---

### IG-09 -- Billable component with no cost envelope

**Trigger**: a known billable resource declaration when the scanned deployment unit has no
reference to a cost model or envelope. Outputs and comments that merely mention a resource
type do not create a finding.

**Fix**: add the component to the cost model and re-run the estimator. See the
[cost-analysis](../../cost-analysis/SKILL.md) skill.

---

### IG-10 -- Runtime service without observability

**Trigger**: a web app, container app, or function app declaration when the scanned
deployment unit contains no diagnostic settings, log workspace, or application telemetry.

**Fix**: wire a log sink before deploy. Retrofitting observability after an incident means
the incident itself went unrecorded.

---

## Recording Exceptions

Deliberate deviations are recorded in the code, not by weakening a rule:

```hcl
# governance-exception: legacy client cannot negotiate TLS 1.2; removed when client v3 ships (#412)
min_tls_version = "1.1"
```

An exception without a reason and an exit condition is a suppression. Reviewers should
reject it.

> **Do not edit a rule pattern to make a scan pass.** Fix the finding, or record the
> exception. Silently narrowing a rule disables it for every future scan as well.

---

## See Also

- [SKILL.md](../SKILL.md)
- [Naming and Topologies](naming-and-topologies.md)
- [Security](../../security/SKILL.md)
