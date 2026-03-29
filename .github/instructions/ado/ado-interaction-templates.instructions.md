---
name: 'ADO Interaction Templates'
description: 'Work item description and comment templates for Azure DevOps API calls -- Markdown and HTML formats.'
applyTo: '**/.copilot-tracking/workitems/**'
---

# Azure DevOps Interaction Templates

## Usage

Apply these templates when composing work item descriptions, acceptance criteria,
and comments for ADO API write calls. Select the format matching the detected
content format from `ado-wit-planning.instructions.md`.

Do not use emoji in any work item field content.

---

## A1: User Story Description

### Markdown

```markdown
## Overview
As a {{persona}}, I want {{capability}} so that {{outcome}}.

## Context
{{background}}

## Technical Notes
{{technical_notes}}
```

### HTML

```html
<h2>Overview</h2>
<p>As a {{persona}}, I want {{capability}} so that {{outcome}}.</p>
<h2>Context</h2>
<p>{{background}}</p>
<h2>Technical Notes</h2>
<p>{{technical_notes}}</p>
```

---

## A2: User Story Acceptance Criteria

### Markdown

```markdown
## Acceptance Criteria
* {{criterion_1}}
* {{criterion_2}}
* {{criterion_3}}

## Out of Scope
* {{out_of_scope_1}}
```

### HTML

```html
<h2>Acceptance Criteria</h2>
<ul>
  <li>{{criterion_1}}</li>
  <li>{{criterion_2}}</li>
  <li>{{criterion_3}}</li>
</ul>
<h2>Out of Scope</h2>
<ul>
  <li>{{out_of_scope_1}}</li>
</ul>
```

---

## A3: Bug Description

### Markdown

```markdown
## Summary
{{short_description}}

## Repro Steps
1. {{step_1}}
2. {{step_2}}
3. {{step_3}}

## Expected Behavior
{{expected}}

## Actual Behavior
{{actual}}

## Environment
* Component: {{component}}
* Version: {{version}}
* OS / Browser: {{environment}}
```

### HTML

```html
<h2>Summary</h2>
<p>{{short_description}}</p>
<h2>Repro Steps</h2>
<ol>
  <li>{{step_1}}</li>
  <li>{{step_2}}</li>
  <li>{{step_3}}</li>
</ol>
<h2>Expected Behavior</h2>
<p>{{expected}}</p>
<h2>Actual Behavior</h2>
<p>{{actual}}</p>
<h2>Environment</h2>
<ul>
  <li>Component: {{component}}</li>
  <li>Version: {{version}}</li>
  <li>OS / Browser: {{environment}}</li>
</ul>
```

---

## A4: Task Description

### Markdown

```markdown
## Objective
{{objective}}

## Approach
{{approach}}

## Definition of Done
* {{done_criterion_1}}
* {{done_criterion_2}}
```

### HTML

```html
<h2>Objective</h2>
<p>{{objective}}</p>
<h2>Approach</h2>
<p>{{approach}}</p>
<h2>Definition of Done</h2>
<ul>
  <li>{{done_criterion_1}}</li>
  <li>{{done_criterion_2}}</li>
</ul>
```

---

## A5: Epic Description

### Markdown

```markdown
## Business Goal
{{business_goal}}

## Scope
### In Scope
* {{in_scope_1}}
### Out of Scope
* {{out_of_scope_1}}

## Success Metrics
* {{metric_1}}
* {{metric_2}}

## Dependencies
* {{dependency_1}}
```

### HTML

```html
<h2>Business Goal</h2>
<p>{{business_goal}}</p>
<h2>Scope</h2>
<h3>In Scope</h3>
<ul><li>{{in_scope_1}}</li></ul>
<h3>Out of Scope</h3>
<ul><li>{{out_of_scope_1}}</li></ul>
<h2>Success Metrics</h2>
<ul>
  <li>{{metric_1}}</li>
  <li>{{metric_2}}</li>
</ul>
<h2>Dependencies</h2>
<ul><li>{{dependency_1}}</li></ul>
```

---

## A6: Feature Description

### Markdown

```markdown
## Overview
{{overview}}

## User Impact
{{user_impact}}

## Technical Approach
{{technical_approach}}

## Acceptance Criteria
* {{criterion_1}}
* {{criterion_2}}
```

### HTML

```html
<h2>Overview</h2>
<p>{{overview}}</p>
<h2>User Impact</h2>
<p>{{user_impact}}</p>
<h2>Technical Approach</h2>
<p>{{technical_approach}}</p>
<h2>Acceptance Criteria</h2>
<ul>
  <li>{{criterion_1}}</li>
  <li>{{criterion_2}}</li>
</ul>
```

---

## Comment Templates (B-series)

Use these when adding comments to existing work items through the Azure CLI or Azure DevOps REST comment path.

### B1: Status Update

```
Status Update - {{date}}

Progress: {{progress_summary}}

Completed:
- {{completed_item_1}}

Next:
- {{next_item_1}}

Blockers: {{blockers_or_none}}
```

### B2: State Transition

```
Transitioning work item from {{old_state}} to {{new_state}}.

Reason: {{reason}}
{{conditional_notes}}
```

### B3: Duplicate Closure

```
Closing as duplicate of #{{original_id}}.

Reason: {{reason}}

Original: {{original_id}}
```

### B4: Blocking Issue

```
Blocking issue identified.

Blocked by: {{blocking_item}}

Impact: {{impact_description}}

Resolution path: {{resolution_path}}
```

### B5: Request for Information

```
Requesting clarification.

Questions:
1. {{question_1}}
2. {{question_2}}

Needed by: {{date_or_asap}}
```

### B6: Sprint Rollover

```
Rolling over to {{new_sprint}}.

Reason: {{reason}}

Remaining work: {{remaining_estimate}}
```

### B7: PR Linked

```
Pull request linked.

PR: {{pr_url}} - {{pr_title}}

Status: {{pr_status}}
```

---

## Voice and Tone

- Write in clear, direct language. Use active voice.
- Do not use emoji.
- Adjust formality to match the team context (technical teams prefer concise language).
- Use imperative mood for task titles and acceptance criteria.
- Use present tense for descriptions and state observations.
