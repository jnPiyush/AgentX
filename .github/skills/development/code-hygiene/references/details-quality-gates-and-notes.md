# code-hygiene: Quality Gates, Notes

> MUST read before work involving **quality gates, notes**. This reference preserves complete source guidance relocated for context-budget compliance.

## Quality Gates

Before presenting findings:

1. Every finding must be actionable -- say what to change and where
2. No false positives from skimming -- verify before flagging
3. Line numbers must be accurate
4. Respect project conventions -- if the project uses JSDoc everywhere, do not flag JSDoc
5. Do not flag generated code in dist/, build/, node_modules/, or similar directories

## Notes

- This skill is read-only by default. It reports but does not edit files unless fix mode is specified.
- UI Quality pass is automatically skipped for backend-only projects.
- Works on any language/framework -- the patterns are universal.
- Pairs well with the code-review skill (which checks correctness) -- code-hygiene checks aesthetics and quality.
