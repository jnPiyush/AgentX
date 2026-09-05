# Tokenomics Examples

All values below are synthetic fixtures for offline documentation/testing only.

## Example 1: priced cache-aware request

```json
{"version":1,"suppliedCapabilities":["tool-calls"],"enforce":{"contextWindow":true,"outputCap":true,"pricing":true,"capabilities":true,"hostCredits":false},"caps":{"costUSD":0.00175},"rates":[{"id":"synthetic-fast","model":"example/fast","currency":"USD","source":"synthetic-fixture","asOf":"2026-09-05T08:07:47Z","perMillion":{"input":2.0,"cacheRead":0.5,"cacheWrite":3.0,"output":5.0}}],"calls":[{"id":"primary","model":"example/fast","rateId":"synthetic-fast","contextWindowTokens":1000,"outputCapTokens":50,"promptTokens":900,"reservedOutputTokens":50,"safetyMarginTokens":50,"requiredCapabilities":["tool-calls"],"inputTokens":1000,"cacheReadTokens":400,"cacheWriteTokens":100,"outputTokens":50}]}
```

Expected:

- `uncachedInputTokens = 500`
- `costUSD = 0.00175`
- exact context/output/cost caps stay `within`

## Example 2: explicit retry accounting

```json
{"version":1,"rates":[{"id":"synthetic-balanced","model":"example/balanced","currency":"USD","source":"synthetic-fixture","asOf":"2026-09-05","perMillion":{"input":1.0,"cacheRead":0.0,"cacheWrite":2.0,"output":4.0}}],"calls":[{"id":"attempt-1","model":"example/balanced","rateId":"synthetic-balanced","contextWindowTokens":100,"outputCapTokens":10,"promptTokens":100,"reservedOutputTokens":0,"safetyMarginTokens":0,"inputTokens":100,"cacheReadTokens":0,"cacheWriteTokens":0,"outputTokens":10},{"id":"attempt-2","model":"example/balanced","rateId":"synthetic-balanced","contextWindowTokens":190,"outputCapTokens":20,"promptTokens":190,"reservedOutputTokens":0,"safetyMarginTokens":0,"inputTokens":200,"cacheReadTokens":50,"cacheWriteTokens":50,"outputTokens":20}]}
```

Expected:

- retries stay separate; no averaging
- `callCount = 2`
- known USD subtotal = full USD total = `0.00042`

## Example 3: host credits without USD conversion

```json
{"version":1,"caps":{"hostCredits":2.0},"calls":[{"id":"credit-only","model":"example/hosted","contextWindowTokens":100,"outputCapTokens":10,"promptTokens":90,"reservedOutputTokens":5,"safetyMarginTokens":5,"inputTokens":90,"cacheReadTokens":0,"cacheWriteTokens":0,"outputTokens":5,"hostCreditsUsed":1.5}]}
```

Expected:

- `totals.costUSD = null`
- `totals.knownCostSubtotalUSD = 0`
- `totals.hostCreditsUsed = 1.5`
- `caps.hostCredits.status = "within"`

## Example 4: zero-call baseline

```json
{"version":1,"caps":{"costUSD":0,"hostCredits":0},"calls":[]}
```

Expected:

- `callCount = 0`
- `totals.costUSD = 0`
- `totals.hostCreditsUsed = 0`

## Example 5: per-call capability override

```json
{"version":1,"calls":[{"id":"mixed-model-call","model":"example/override","suppliedCapabilities":["tool-calls"],"requiredCapabilities":["tool-calls"],"contextWindowTokens":10,"outputCapTokens":1,"promptTokens":9,"reservedOutputTokens":1,"safetyMarginTokens":0,"inputTokens":10,"cacheReadTokens":0,"cacheWriteTokens":0,"outputTokens":1}]}
```

Expected:

- no global capability catalog is required for this call
- the call-level capability override satisfies `requiredCapabilities`

## Selected response fields for Example 1

```json
{"status":"ok","estimatesOnly":true,"totals":{"costUSD":0.00175,"knownCostSubtotalUSD":0.00175,"hostCreditsUsed":null,"knownHostCreditsSubtotal":0},"unknown":{"hostCreditsCallIds":["primary"]}}
```
