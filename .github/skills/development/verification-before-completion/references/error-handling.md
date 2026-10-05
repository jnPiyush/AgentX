# Error Handling

Reference for the [verification-before-completion skill](../SKILL.md).

| Symptom | Action |
|---------|--------|
| Command fails on the current commit | Do not report completion. Fix the failure, then re-run the gate. |
| Command hangs | Treat as failure. Investigate before claiming completion. |
| Command output is suspiciously fast (no tests found, cached result) | Force a clean run. `dotnet test --no-build` is not a substitute for `dotnet test`. |
| Cannot run the command locally | Run it in CI on the current commit and link the run. Do not claim completion from a prior run. |
| The claim is unprovable in the current environment | Restate the claim as "claimed but not verified in this session" and surface the gap. |
