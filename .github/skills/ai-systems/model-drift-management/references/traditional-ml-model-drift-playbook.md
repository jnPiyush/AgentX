# Traditional ML Model Drift Playbook

Use this playbook for supervised or statistical models whose quality depends on
feature distributions, labels, calibration, or delayed outcome data.

## Common drift types

Concept drift changes the relationship between features and outcomes.
Covariate or feature drift changes the input distribution. Prior shift changes
the label mix. Calibration drift appears when probabilities no longer match real
outcomes even if rank ordering still looks acceptable.

## Detection approach

Validate the data pipeline first, then compare production windows with the
reference window using methods appropriate to the feature type and business risk.
Common options include KS or Wasserstein tests for continuous features,
chi-squared or divergence measures for categorical features, and rolling quality
metrics when labels arrive later. Pair statistical tests with business KPIs so a
benign seasonal shift does not trigger unnecessary retraining.

For delayed labels, consider no-label performance estimation (for example,
NannyML) and validate the estimate when outcomes arrive. Use change-point
detectors such as Page-Hinkley for sudden shifts; treat an alert as evidence to
investigate, not automatic retraining authority.

## Response workflow

1. Confirm the reference dataset, model registry entry, and serving version.
2. Rule out schema, freshness, or upstream extraction issues before retraining.
3. Quantify the impact on model quality, calibration, and downstream decisions.
4. Retrain, recalibrate, threshold-tune, or feature-engineer only after the root
   cause is understood.
5. Validate in shadow or champion-challenger mode before full promotion, and
   keep rollback ready.

## Governance reminder

Store the retraining reason, reference window, metrics, and approval outcome
with the promoted model so later incidents can distinguish true drift from an
unsafe release process.
