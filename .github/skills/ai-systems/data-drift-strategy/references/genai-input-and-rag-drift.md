# GenAI Input and RAG Drift Playbook

Use this playbook when real user inputs or retrieval behavior no longer match
the data you designed and evaluated the agent against.

## Signals to monitor

Track query length and language mix, topic and intent distribution,
out-of-scope rates, adversarial patterns, conversation depth, tool-request mix,
embedding movement, retrieval score trends, and content staleness. Treat any
threshold as service-specific; a useful trigger is one tied to your accepted
baseline and user-impact evidence, not to a generic template value.

## Response path

1. Confirm logging, anonymization, and sampling controls.
2. Compare the current input window with the baseline dataset and recent release
   notes for prompt, tool, or corpus changes.
3. Distinguish new demand from system breakage: new valid topics may require
   scope expansion, while retrieval decay may require re-indexing, chunk review,
   or corpus refresh.
4. Update evaluation sets with representative production samples before claiming
   the agent improved.
5. Add or tighten guardrails when the shift is adversarial or outside scope.

## Practical reminders

Do not store unnecessary raw prompts or personal data. Retrieval metrics are not
enough by themselves; pair them with sampled response quality and safety review.
If the corpus is stale, fix the corpus before tuning the model.
