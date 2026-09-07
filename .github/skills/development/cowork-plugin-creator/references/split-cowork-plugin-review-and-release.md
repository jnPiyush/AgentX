# split-cowork-plugin-review-and-release

> Source: [cowork-plugin-authoring-guide.md](cowork-plugin-authoring-guide.md)
> Source hash (LF-normalized original file): `5B3C79113DC0F1C41A25DBA51F309D2DB2D58F77FEC9E5ED3359AC97016A69F8`
> Relocation manifest:
- `## Quality Review` -> original lines 127-163
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

## Quality Review

| Area | Question |
|------|----------|
| Routing | Can Cowork tell when each skill applies from its description alone? |
| Non-overlap | Does exactly one skill own each scenario? |
| Output format | Does each skill define a reusable output structure? |
| Connector usage | Are tool names distinguishable and non-duplicative? |
| Boundaries | Does each skill state when not to use it and what it must not assume? |
| Safety | Is the package free of passwords, API keys, client secrets, personal data, and unapproved customer data? |

## Test Cases

1. Each skill activates for its intended request.
2. Skills do not activate for unrelated requests.
3. Similar skills route to the correct owner.
4. References are available to the relevant skill.
5. Connectors initialize and each tool returns the expected result.
6. Authentication and consent behave as designed.
7. Actions requiring approval do not execute without user approval.
8. Missing inputs are reported rather than fabricated.
9. Outputs follow the prescribed structure.
10. In a pipeline, each stage refuses to start when the previous artifact is missing.

## Deployment

1. Complete business owner, security, and privacy review.
2. Validate authentication and connector permissions.
3. Assign an accountable owner and establish versioning with release notes.
4. Upload the package for personal testing, then publish to the tenant through Microsoft 365 administration.
5. Assign the plugin to approved users or groups and validate the deployed experience.
6. Monitor adoption, failures, and connector usage, then republish updates through the governed release process.

## Sources

* [Build plugins for Copilot Cowork](https://learn.microsoft.com/en-us/microsoft-365/copilot/cowork/cowork-plugin-development)
* [Manage plugins for Copilot Cowork](https://learn.microsoft.com/en-us/microsoft-365/copilot/cowork/cowork-manage-plugins)
