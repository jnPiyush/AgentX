---
name: "environment-variables"
description: 'Author Microsoft Power Platform environment variables and connection references inside an unpacked solution so an agent can parameterize apps, flows, and plugins across dev/test/prod without hardcoding -- definitions, current values, data types (string/number/JSON/secret/Data Source), and Key Vault-backed secrets. Covers the ALM mechanism that makes a solution portable.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["power-platform", "dataverse", "alm"]
---

# Environment Variables & Connection References

> Purpose: emit environment variables + connection references so one solution moves cleanly across dev/test/prod -- the ALM parameterization layer. No environment-specific value should be hardcoded in an app or flow.

## When to Use

- Any value that differs per environment: API base URLs, IDs, feature flags, secrets
- Decoupling flows from specific connections so importers bind their own
- Reviewing a solution for hardcoded environment-specific values before export

## Environment Variables

Two parts: a **definition** (schema name, display name, type, default) and an optional **current value** (this environment's value). Ship the definition + a default in the solution; let each environment override the current value.

```
src/
  environmentvariabledefinitions/<prefix>_<name>/
    environmentvariabledefinition.xml   # type, default value, schema name
  environmentvariablevalues/...         # current value (often NOT shipped to prod; set on import)
```

| Type | Use for |
|------|---------|
| String / Number / Boolean | URLs, IDs, flags |
| JSON | Structured config |
| Data Source | Bind to a connector data source per environment |
| Secret | Key Vault-backed -- the value lives in Azure Key Vault, only a reference ships |

In a flow or app, read the variable rather than a literal (e.g. flows reference the environment variable; canvas reads it via the data source).

## Secrets Belong in Key Vault

For credentials/keys, use a **Secret** environment variable bound to an Azure Key Vault secret. The solution carries only the Key Vault reference (vault name + secret name), never the secret material. Grant the environment's identity GET access to the secret.

## Connection References

A **connection reference** is a named placeholder a flow points to instead of a concrete connection. On import, the admin maps each connection reference to an actual connection in the target environment -- so the same flow uses dev creds in dev and prod creds in prod.

```
src/
  connectionreferences/<prefix>_<name>/
    connectionreference.xml   # logical name, connector id
```

Every flow connector binding SHOULD go through a connection reference, not an embedded connection, or the flow breaks on import.

## Anti-Patterns

- Hardcoding URLs/IDs/secrets in flow or app definitions -- breaks portability and leaks secrets.
- Shipping production current values inside the solution -- set them at import time instead.
- Plaintext secret-type values instead of Key Vault references -- credential exposure in source.
- Embedded connections in flows instead of connection references -- import binding fails.

## Verify

```bash
pac solution pack ...    # definitions + connection references must pack
# Import to a second environment and confirm you are prompted to set values / map connections.
```

## Related

- [power-automate-flow-json](../power-automate-flow-json/SKILL.md) -- flows consume connection references + variables
- [pac-cli](../pac-cli/SKILL.md) -- import-time value and connection mapping
- [solution-anatomy](../solution-anatomy/SKILL.md) -- definition placement