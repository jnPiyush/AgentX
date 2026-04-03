import * as vscode from 'vscode';

export interface SkillScaffoldDetails {
  readonly name: string;
  readonly slug: string;
  readonly category: string;
  readonly description: string;
}

export interface AgentScaffoldDetails {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly model: string;
  readonly role: string;
  readonly constraints: string[];
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function stripCodeFences(value: string): string {
  return value
    .replace(/^```[a-zA-Z0-9_-]*\r?\n/, '')
    .replace(/\r?\n```\s*$/, '')
    .trim();
}

function isAscii(value: string): boolean {
  return !/[^\x00-\x7F]/.test(value);
}

function normalizeGeneratedMarkdown(value: string): string | undefined {
  const normalized = stripCodeFences(value).replace(/\r\n/g, '\n').trim();
  if (!normalized.startsWith('---\n')) {
    return undefined;
  }
  if (!isAscii(normalized)) {
    return undefined;
  }
  return `${normalized}\n`;
}

async function tryGenerateWithCopilot(prompt: string, token?: vscode.CancellationToken): Promise<string | undefined> {
  const api = (vscode as unknown as {
    lm?: {
      selectChatModels?: (selector?: Record<string, unknown>) => Promise<any[]>;
    };
    LanguageModelChatMessage?: {
      User?: (content: string) => unknown;
    };
  });

  if (!api.lm?.selectChatModels || !api.LanguageModelChatMessage?.User) {
    return undefined;
  }

  try {
    const models = await api.lm.selectChatModels({});
    const model = models[0];
    if (!model?.sendRequest) {
      return undefined;
    }

    const messages = [api.LanguageModelChatMessage.User(prompt)];
    const response = await model.sendRequest(messages, {}, token);
    if (!response?.text) {
      return undefined;
    }

    let output = '';
    for await (const chunk of response.text as AsyncIterable<unknown>) {
      if (typeof chunk === 'string') {
        output += chunk;
        continue;
      }

      if (chunk && typeof chunk === 'object') {
        const maybeText = (chunk as { value?: string; text?: string }).value
          ?? (chunk as { value?: string; text?: string }).text
          ?? '';
        output += maybeText;
      }
    }

    return normalizeGeneratedMarkdown(output);
  } catch {
    return undefined;
  }
}

function buildSkillPrompt(details: SkillScaffoldDetails): string {
  return [
    'You are AgentX Auto generating a complete SKILL.md file.',
    'Return raw markdown only. Do not use code fences. Use ASCII only.',
    'The file must start with YAML frontmatter and be valid markdown.',
    `Skill name: ${details.name}`,
    `Skill slug: ${details.slug}`,
    `Category: ${details.category}`,
    `User description: ${details.description}`,
    'Required frontmatter:',
    '---',
    `name: "${details.slug}"`,
    `description: "${details.description}"`,
    'metadata:',
    ' author: "AgentX Auto"',
    ' version: "1.0.0"',
    ` created: "${todayIsoDate()}"`,
    ` updated: "${todayIsoDate()}"`,
    '---',
    'Required body sections in this order:',
    '# <display name>',
    '> one-line summary',
    '## When to Use',
    '## Decision Tree',
    '## Quick Start',
    '## Core Rules',
    '## Common Patterns',
    '## Anti-Patterns',
    '## References',
    '## Assets',
    '## Scripts',
    'Write concrete, useful content derived from the user description. Avoid placeholders like TODO.',
  ].join('\n');
}

function buildAgentPrompt(details: AgentScaffoldDetails): string {
  return [
    'You are AgentX Auto generating a complete .agent.md file.',
    'Return raw markdown only. Do not use code fences. Use ASCII only.',
    'The file must start with YAML frontmatter and be valid markdown.',
    `Agent name: ${details.name}`,
    `Agent id: ${details.id}`,
    `Role: ${details.role}`,
    `Model: ${details.model}`,
    `User description: ${details.description}`,
    'Required frontmatter keys:',
    'name, description, model, tools, constraints',
    'Use tools: ["any"]',
    'Required body sections in this order:',
    '# <agent name>',
    '**Role**: <role>',
    '## Mission',
    '## Use When',
    '## Responsibilities',
    '## Constraints',
    '## Workflow',
    '## Deliverables',
    '## Self-Review Checklist',
    'Write concrete responsibilities and workflow guidance derived from the user description.',
  ].join('\n');
}

function titleCaseWords(value: string): string[] {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2)
    .slice(0, 4);
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function buildSkillContentFallback(details: SkillScaffoldDetails): string {
  const today = todayIsoDate();
  const focusTerms = titleCaseWords(details.description);
  const focusText = focusTerms.length > 0 ? focusTerms.join(', ') : details.category;

  return `---
name: "${details.slug}"
description: "${details.description}"
metadata:
 author: "AgentX Auto"
 version: "1.0.0"
 created: "${today}"
 updated: "${today}"
---

# ${details.name}

> ${details.description}

## When to Use

- Use this skill when a task needs repeatable guidance for ${lowerFirst(details.description)}.
- Apply it when the work falls under the ${details.category} category and needs consistent decision-making.
- Reach for it when the output should use a known pattern instead of improvised one-off instructions.

## Decision Tree


Is the task primarily about ${details.name}?
+- Yes -> Apply this skill.
| +- Need fast execution? -> Start with Quick Start.
| - Need edge-case handling? -> Review Common Patterns and Anti-Patterns.
- No -> Pick a skill whose scope matches the main task more closely.

## Quick Start

1. Confirm the goal, inputs, and constraints for ${lowerFirst(details.description)}.
2. Choose an approach that matches the expected outcome and complexity.
3. Apply the core rules before making edits or generating deliverables.
4. Validate the result against the user request and repository conventions.

## Core Rules

1. Keep outputs tightly aligned to ${lowerFirst(details.description)} instead of expanding into unrelated scope.
2. Prefer reusable, explicit patterns over ad hoc instructions.
3. Validate assumptions early and make tradeoffs visible when requirements are ambiguous.
4. Keep examples and artifacts grounded in ${focusText} rather than generic filler.

## Common Patterns

### Discovery Pattern

- Clarify the intended outcome and success criteria.
- Identify the minimum context needed before acting.
- Capture key domain terms such as ${focusText} to keep wording consistent.

### Execution Pattern

- Start with the smallest implementation that satisfies the request.
- Structure the output so the most important guidance appears first.
- Use concrete examples that reflect ${lowerFirst(details.description)}.

### Validation Pattern

- Check whether the output matches the requested format and scope.
- Remove placeholders, filler language, and duplicated instructions.
- Verify that the result can be reused by another engineer without extra explanation.

## Anti-Patterns

- Do not leave TODO markers, placeholder bullets, or empty sections.
- Do not broaden the skill into adjacent domains unless the description explicitly requires it.
- Do not hide assumptions that materially affect the recommended approach.
- Do not produce examples that contradict the stated purpose of ${details.name}.

## References

- Add extended examples in references/ when the skill needs domain-specific depth.
- Link repository standards, specs, or templates that regularly inform this skill.

## Assets

- Use assets/ for reusable templates, sample inputs, or starter artifacts tied to ${details.name}.
- Keep assets lightweight and directly connected to the skill workflow.

## Scripts

- Use scripts/ for repeatable helpers that support ${lowerFirst(details.description)}.
- Keep script behavior deterministic and document its purpose near the script entrypoint.
`;
}

export function buildAgentContentFallback(details: AgentScaffoldDetails): string {
  const escapedConstraints = details.constraints.map((item) => `  - "${item}"`).join('\n');

  return `---
name: ${details.name}
description: "${details.description}"
model: "${details.model}"
tools:
  - "any"
constraints:
${escapedConstraints}
---

# ${details.name}

**Role**: ${details.role}

## Mission

${details.description}

## Use When

- Use this agent when the task clearly aligns to ${details.role} responsibilities.
- Use it when ${lowerFirst(details.description)} is the primary outcome.
- Use it when a dedicated role should own the work instead of a generic agent response.

## Responsibilities

- Translate the request into a focused ${details.role} workflow.
- Produce concrete outputs that match the stated mission and repository conventions.
- Surface assumptions, blockers, and tradeoffs before they become delivery risks.
- Finish with validation rather than handing off unverified work.

## Constraints

${details.constraints.map((item) => `- ${item}`).join('\n')}

## Workflow

1. Clarify the requested outcome and gather the minimum context required.
2. Plan the work around the mission and role-specific boundaries.
3. Execute the task with outputs that stay within the described scope.
4. Review the result for correctness, completeness, and safety before delivery.

## Deliverables

- Primary deliverables relevant to the ${details.role} role.
- Supporting notes or evidence needed to explain decisions and validation.
- Clear next steps when additional work remains outside the agent's scope.

## Self-Review Checklist

Before completing work, verify:

- [ ] The output directly supports the stated mission.
- [ ] The result stays inside the ${details.role} role boundaries.
- [ ] Constraints and repository conventions were followed.
- [ ] Risks, assumptions, and validation outcomes are clearly stated.
`;
}

export async function generateSkillContent(
  details: SkillScaffoldDetails,
  token?: vscode.CancellationToken,
): Promise<string> {
  const prompt = buildSkillPrompt(details);
  return (await tryGenerateWithCopilot(prompt, token)) ?? buildSkillContentFallback(details);
}

export async function generateAgentContent(
  details: AgentScaffoldDetails,
  token?: vscode.CancellationToken,
): Promise<string> {
  const prompt = buildAgentPrompt(details);
  return (await tryGenerateWithCopilot(prompt, token)) ?? buildAgentContentFallback(details);
}