# Fabric Data Agent Details

This required-read reference preserves complete baseline sections relocated from `SKILL.md` during budget remediation.

## Livy Session Management

When using Livy for SDK operations (Phase 2 & 3):

```
1. Always check for existing sessions FIRST
2. Reuse idle sessions (state: idle -> reuse)
3. Create only if none exist (cold start: 3-6+ minutes)
4. Never close sessions unless explicitly requested
5. Use timestamped session names: data-agent-{lakehouse}-{timestamp}
6. Check session status before submitting statements
```

## Error Handling

### Retry Protocol

```
Attempt 1 -> Execute operation
 (down) (on failure)
Attempt 2 -> Diagnose error, apply fix, retry
 (down) (on failure)
Attempt 3 -> Try alternative approach
 (down) (on failure)
Escalate to user with error details + options
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|---------|
| Agent creation fails | SDK initialization issue | Verify workspace access and SDK version |
| Table not found in agent | Table not in selected scope | Re-add datasource with correct table list |
| Query returns wrong results | Incorrect few-shot SQL syntax | Validate SQL against endpoint first |
| Session timeout | Livy cold start | Increase timeout, reuse existing sessions |
| Permission denied | Workspace role insufficient | Need Contributor or higher role |

## Output Artifacts

All output goes to timestamped folders:

```
run/{timestamp}_{lakehouse}/
+-- implementation_plan.md # Phase 1 output
+-- agent_creation.ipynb # Phase 2 reproducible notebook
+-- agent_validation.ipynb # Phase 3 reproducible notebook
+-- validation_report.md # Phase 3 accuracy results
-- completion_report.md # Cross-phase handover document
```

## Anti-Patterns

- **Skip planning phase**: Creating agents without understanding schema -> poor accuracy
- **Use Bronze tables**: Raw data with duplicates/nulls -> unreliable answers
- **Spark SQL in few-shots**: Agent generates invalid SQL -> query failures
- **No validation**: Deploying without testing -> users lose trust quickly
- **Monolithic instructions**: Long, unfocused system prompts -> agent confusion
- **Too many tables**: Adding all tables -> slow queries, irrelevant joins

## Reference Index

| Document | Description |
|----------|-------------|
| [references/agent-sdk-patterns.md](agent-sdk-patterns.md) | Data Agent SDK code patterns and API reference |
| [references/instruction-templates.md](instruction-templates.md) | System prompt templates for different domains |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/completion-report-template.md](../assets/completion-report-template.md) | Cross-phase handover document template |
| [assets/sample-few-shot-queries.sql](../assets/sample-few-shot-queries.sql) | Example few-shot query templates |
