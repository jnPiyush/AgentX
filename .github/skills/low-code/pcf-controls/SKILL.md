---
name: "pcf-controls"
description: 'Build Microsoft Power Apps Component Framework (PCF) code components in TypeScript so an agent can generate a pro-code control that drops into canvas and model-driven apps. Covers ControlManifest.Input.xml, the index.ts lifecycle (init/updateView/getOutputs/destroy), property types, dataset vs field controls, pcfproj/npm build, and solution packaging.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["power-platform", "power-apps", "pcf", "typescript"]
---

# PCF Code Components

> Purpose: emit a TypeScript PCF control that builds with `pac pcf` + npm and packs into a solution -- the pro-code escape hatch when canvas/model-driven controls are not enough.

## When to Use

- A required UX (custom chart, map, rich editor, signature pad) is not expressible with stock controls
- Reusing a JS/TS library inside a Power Apps form or canvas app
- Replacing a single field or a whole dataset (grid) with custom rendering

> First decide low-code vs pro-code (see architecture/low-code-vs-pro-code). PCF is pro-code: it carries a build pipeline and maintenance cost.

## Project Layout

```
<control-root>/
  <ControlName>/
    ControlManifest.Input.xml   # manifest: type-group, properties, resources
    index.ts                    # the control class (lifecycle)
    generated/                  # ManifestTypes.d.ts (pac generates)
  package.json                  # pcf-scripts, pcf-start, build
  pcfproj / .pcfproj            # MSBuild project
  tsconfig.json
```

Scaffold: `pac pcf init --namespace AgentX --name IssueRating --template field` (or `--template dataset`).

## ControlManifest.Input.xml

```xml
<manifest>
  <control namespace="AgentX" constructor="IssueRating" version="1.0.0"
           display-name-key="Issue Rating" control-type="standard">
    <property name="value" display-name-key="Value" of-type="Whole.None"
              usage="bound" required="true" />
    <resources>
      <code path="index.ts" order="1" />
      <css path="css/style.css" order="1" />
    </resources>
  </control>
</manifest>
```

- `usage="bound"` ties the property to a column; `usage="input"` is a config value.
- `of-type` must be a valid PCF type (`SingleLine.Text`, `Whole.None`, `TwoOptions`, `OptionSet`, `DateAndTime.DateOnly`, ...).
- `control-type="standard"` (field) vs a `data-set` element for dataset/grid controls.

## index.ts Lifecycle

```typescript
import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class IssueRating implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private container: HTMLDivElement;
  private notifyOutputChanged: () => void;
  private value: number;

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    this.container = container;
    this.notifyOutputChanged = notifyOutputChanged;
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this.value = context.parameters.value.raw ?? 0;
    // render into this.container from context.parameters (re-runs on every change)
  }

  public getOutputs(): IOutputs {
    return { value: this.value };  // pushed back to the bound column
  }

  public destroy(): void {
    // remove listeners / unmount
  }
}
```

Contract:
- `updateView` re-runs whenever any input, layout, or data changes -- keep it idempotent and cheap.
- Call `notifyOutputChanged()` only when an output actually changed; then the platform calls `getOutputs()`.
- Read all data from `context.parameters` / `context.mode` -- never assume DOM state survives between calls.

## Build & Package

```bash
npm install
npm run build                         # pcf-scripts build -> bundle.js
pac pcf push --publisher-prefix agx   # dev inner loop (quick deploy)
# OR for a solution:
pac solution add-reference --path <control-root>
pac solution pack ...                 # control travels as a CustomControl component
```

## Anti-Patterns

- Heavy synchronous work in `updateView` -- it runs often; debounce and offload.
- Mutating the bound value without `notifyOutputChanged()` -- the column never updates.
- Bundling huge libraries -- inflates form load; tree-shake and lazy-load.
- Using PCF for layout a canvas/model-driven app already does -- adds a build pipeline for no benefit.

## Related

- [model-driven-app](../model-driven-app/SKILL.md) -- where field/dataset controls attach
- [canvas-app-yaml](../canvas-app-yaml/SKILL.md) -- canvas also hosts PCF controls
- [solution-anatomy](../solution-anatomy/SKILL.md) -- CustomControl packaging