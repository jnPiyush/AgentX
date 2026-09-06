# GenAI Model Drift Playbook

Use this playbook when a language model, prompt, tool schema, judge prompt, or
retrieval path changes observed agent behavior.

## Signals worth acting on

Watch for structured output failures, tool-call regressions, refusal-rate
changes, groundedness complaints, latency or token spikes, or a resolved model
identity that no longer matches the last accepted deployment. Each signal should
be interpreted against the service's own baseline and policy thresholds rather
than a universal percentage from a template.

## Investigation order

1. Confirm the actual deployment, alias mapping, prompt version, tool schema,
   and retrieval configuration that produced the response.
2. Check whether the change source is a planned migration, silent provider
   update, prompt edit, policy/config change, or downstream outage.
3. Re-run the fixed evaluation set and compare contract checks first: schema,
   tool arguments, latency, cost envelope, and safety outcomes.
4. Use judge or human review for qualities code cannot measure directly, and
   keep the evaluator prompt, model, and dataset version with the results.
5. Canary or roll back based on evidence; do not leave production on an
   unverified fallback indefinitely.

## Judge guidance

Use an independent judge model; do not self-evaluate. Calibrate it on known
examples. Record instability when repeated judge runs disagree, and do not
let a fluent narrative overrule objective contract breaks.

## Outcomes

- Promote only when the evaluated candidate stays within approved thresholds and
  introduces no new safety, privacy, or governance failures.
- Roll back or switch to fallback when contract breaks or material regressions
  affect live users.
- Hold and gather more evidence when the baseline, evaluator, or deployment
  identity is uncertain.
