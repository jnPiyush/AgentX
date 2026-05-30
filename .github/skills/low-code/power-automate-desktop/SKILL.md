---
name: "power-automate-desktop"
description: 'Author Microsoft Power Automate desktop (RPA) flows -- attended and unattended robotic process automation that drives UI, browsers, files, and Excel -- so an agent can design the action sequence, variables, error handling, and cloud-flow trigger wiring. Covers when RPA is appropriate versus API/connector automation and the desktop-flow execution model.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["power-platform", "power-automate-desktop", "rpa"]
---

# Power Automate Desktop (RPA)

> Purpose: design Power Automate desktop flows that automate UI-driven work no API exposes -- the automation of last resort -- with robust selectors, variables, and error handling.

## When to Use (RPA Is a Last Resort)

Use a desktop flow only when there is no connector, API, or cloud flow that can do the job:
- Driving a legacy desktop app or a website with no API
- Screen-scraping or form-filling a system you cannot change

Always prefer, in order: native connector -> custom connector over a documented API -> HTTP action -> desktop flow (RPA). RPA is brittle (UI changes break selectors) and needs a machine/runtime -- only choose it when nothing higher wins.

## Attended vs Unattended

| | Attended | Unattended |
|--|----------|------------|
| Runs | With a signed-in user watching | On a machine with no interactive user |
| Trigger | User starts it, or a cloud flow | Scheduled / cloud-flow, queued on a machine group |
| Use for | Human-in-the-loop, desktop apps the user owns | Lights-out batch processing |

## Flow Structure (Designer Model)

A desktop flow is an ordered list of **actions** grouped into optional **subflows**, operating on **variables**.

```
Main (subflow)
  1. Set variable  NewVar = %FormInput%
  2. Launch browser (or Run application)
  3. Populate text field on window  (UI element selector)
  4. Click UI element
  5. If <condition> ... Else ... End
  6. Loop / For each %item% in %list%
  7. On block error -> retry / continue / go to label
```

- **UI elements / selectors**: captured per target window/control; the most fragile part. Prefer stable attributes (id, name, accessible role) over screen coordinates and ordinal indexes.
- **Variables**: `%VarName%` syntax; typed at runtime (text, number, list, datatable, custom object).
- **Excel / file / data actions**: first-class actions for spreadsheets, CSV, folders -- prefer these over UI automation of Office where possible.

## Error Handling

- Wrap fragile UI actions in **On block error** with retry counts and a fallback path.
- Set per-action timeouts; do not let a missing window hang the run.
- Capture a screenshot + log on failure for unattended diagnosis.

## Cloud Flow Integration

Desktop flows are invoked from a cloud flow via the **"Run a flow built with Power Automate for desktop"** action: the cloud flow passes inputs, the desktop flow runs on a machine/machine-group, and returns outputs. This is how RPA participates in an end-to-end automation (trigger in Dataverse/Teams -> cloud flow -> desktop flow -> result back).

## Anti-Patterns

- Choosing RPA when an API/connector exists -- accept brittleness only when unavoidable.
- Coordinate-based clicks / ordinal selectors -- break on resolution, theme, or layout change.
- Hardcoded credentials in the flow -- use the credential store / environment variables / Key Vault.
- No error handling on UI actions -- one moved button fails the whole unattended run silently.
- Long unattended runs with no logging/screenshots -- undebuggable failures.

## Related

- [power-automate-flow-json](../power-automate-flow-json/SKILL.md) -- the cloud flow that triggers the desktop flow
- [pac-cli](../pac-cli/SKILL.md) -- environment + connection management