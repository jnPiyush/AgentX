# Tokenomics Reference

Reference material for the [token-optimizer](../SKILL.md) skill.

## Command

```powershell
pwsh scripts/budget.ps1 -File request.json -Json
```

Properties:

- Offline
- Deterministic
- Read-only
- Caller-evidence-driven

It does not send provider requests, fetch live prices, estimate token counts
from text, or enforce provider billing/settings.

## Exit codes

- `0` valid request; no blocking failures
- `1` valid request; blocked by an exceeded cap, a configured cap whose full
  total is still unknown, a missing required capability, or unknown evidence
  whose matching `enforce.*` flag is `true`
- `2` invalid JSON, invalid schema, invalid numeric shape, duplicate/unknown
  IDs, or other request/runtime error

Known failures always block. Unknown evidence blocks only when explicitly
enforced.

## Request contract (version 1)

Top level:

| Field | Type | Notes |
|---|---|---|
| `version` | integer | must be `1` |
| `calls` | array | required; may be empty |
| `rates` | array/null | caller-supplied USD rate cards |
| `suppliedCapabilities` | string array/null | omit or `null` when unknown |
| `enforce` | object/null | unknown-evidence blocking flags |
| `caps` | object/null | optional USD and host-credit caps |

`enforce` booleans default to `false`: `contextWindow`, `outputCap`, `pricing`,
`capabilities`, `hostCredits`.

`caps`:

- `costUSD`: non-negative number or `null`
- `hostCredits`: non-negative number or `null`

`rates[]` fields:

- `id`, `model`, `currency`, `source`, `asOf`, `perMillion`
- `currency` must be exactly `USD`
- `asOf` must be an actual ISO 8601 date or timestamp, not free text
- `perMillion` requires non-negative `input`, `cacheRead`, `cacheWrite`,
  `output`
- `id` must be unique
- `model` must match `calls[].model` when referenced by `rateId`

`calls[]` fields:

- required: `id`, `model`
- optional: `rateId`, `contextWindowTokens`, `outputCapTokens`,
  `promptTokens`, `reservedOutputTokens`, `safetyMarginTokens`,
  `requiredCapabilities`, `suppliedCapabilities`, `inputTokens`, `cacheReadTokens`,
  `cacheWriteTokens`, `outputTokens`, `hostCreditsUsed`

Rules:

- `id` must be unique per call
- each retry/delegation/attempt is a separate call item
- top-level `suppliedCapabilities` must be valid for every call unless a call
  provides its own `suppliedCapabilities` override
- `promptTokens` is complete prompt size: system + history + tools + user
- `inputTokens` includes cached subsets
- `cacheReadTokens` and `cacheWriteTokens` are subsets of `inputTokens`
- `outputTokens` includes reasoning when the provider counts it there
- `reservedOutputTokens` and `safetyMarginTokens` must be explicit; use `0`
  when intentionally zero
- host credits are tracked separately and never converted to USD

Strict rejection:

- unsupported properties / typos
- malformed JSON
- duplicate `calls[].id` or `rates[].id`
- unknown `calls[].rateId`
- non-USD rate cards
- negative/fractional token counts
- strings used where numbers are required
- numeric overflow / unsupported range
- cache subsets exceeding `inputTokens`

Missing or `null` evidence stays unknown; it is never treated as zero.

## Response contract

Top-level response fields:

- `version`, `status`, `exitCode`, `estimatesOnly`, `readOnly`, `callCount`
- `suppliedCapabilities`, `enforce`, `totals`, `caps`, `failures`, `unknown`,
  `calls`, `notes`

`status` is `ok`, `blocked`, or `invalid`.

Totals:

- `totals.costUSD` is the full USD total only when every call is priced;
  otherwise `null`
- `totals.knownCostSubtotalUSD` is the priced subset only
- `totals.hostCreditsUsed` is the full host-credit total only when tracked
  values are complete; otherwise `null`
- `totals.knownHostCreditsSubtotal` is the known host-credit subtotal
- Unknown credit call IDs are retained regardless of call ordering; adding a
  known call never turns earlier missing usage into zero.

Cap statuses:

- `within`
- `exceeded`
- `unknown`
- `unconfigured`

Use `failures.*CallIds` for known blocking failures and `unknown.*CallIds` for
missing evidence by category.

## Examples

Complete synthetic fixtures and a sample response live in
[tokenomics-examples.md](tokenomics-examples.md).

## Limitations

- Estimates only; not actual spend
- No live pricing or live capability lookup
- USD rate cards only
- `promptTokens` and `inputTokens` are caller evidence; the script does not
  force them to match
- A known subtotal can prove a cap is exceeded, but cannot prove an unknown
  total is within cap; configured caps therefore block until the full total is
  known or already exceeded

## See also

- [SKILL.md](../SKILL.md)
- [tokenomics-examples.md](tokenomics-examples.md)
- [`scripts/budget.ps1`](../../../../../scripts/budget.ps1)
