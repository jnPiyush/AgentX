# Traditional ML Data Drift Playbook

Use this playbook for datasets that feed classical ML features, labels, or batch
decision pipelines.

## What to check first

Start with schema, freshness, volume, and nullability. A broken contract or late
data arrival can mimic feature drift and makes later statistics untrustworthy.

## Detection methods

Use tests that fit the data type and operating context: KS, PSI, or Wasserstein
for continuous features; chi-squared or divergence measures for categorical
features; correlation or multivariate checks when relationships matter more than
one feature alone. Compare rolling windows with a governed reference window and
interpret shifts together with business KPIs.

For joint distribution shifts, consider maximum mean discrepancy (MMD) or PCA
reconstruction error when marginal tests miss changing relationships. Calibrate
sample sizes, false-alert rates and thresholds against the reference data.

## Response path

1. Confirm the reference snapshot and pipeline version.
2. Isolate whether the issue is schema, freshness, feature drift, or semantic
   meaning change.
3. Investigate upstream source changes before retraining.
4. Retrain, recalibrate, or adjust thresholds only after root cause analysis.
5. Validate any replacement in shadow or staged rollout before promotion.

## Governance reminder

Record the affected fields, evidence window, remediation, and approval outcome so
future incidents can distinguish expected seasonal change from real pipeline or
data contract failure.
