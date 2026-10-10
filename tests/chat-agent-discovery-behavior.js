#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const setting = 'frontier.useBundledAgents';
const condition = `config.${setting}`;

test('agent generation gates only bundled agents and preserves nested discovery', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-agent-discovery-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const write = (relative, content) => {
    const target = path.join(fixture, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  write('vscode-extension/scripts/prepare-chat-contributions.js',
    fs.readFileSync(path.join(root, 'vscode-extension/scripts/prepare-chat-contributions.js')));
  write('.github/agents/engineer.agent.md', '---\nname: Frontier Engineer\n---\n');
  write('.github/agents/internal/reviewer.agent.md',
    '---\nname: Frontier Internal Reviewer\nuser-invocable: false\n---\n');
  write('.github/instructions/coding.instructions.md', '---\napplyTo: "**"\n---\n');
  write('.github/prompts/review.prompt.md', '---\nname: Review\n---\n');
  write('.github/skills/development/testing/SKILL.md', '---\nname: testing\n---\n');
  const original = {
    name: 'fixture',
    contributes: {
      commands: [{ command: 'frontier.refresh', title: 'Refresh' }],
      configuration: { properties: { [setting]: { type: 'boolean', default: true } } },
    },
  };
  write('vscode-extension/package.json', JSON.stringify(original));
  const generator = path.join(fixture, 'vscode-extension/scripts/prepare-chat-contributions.js');
  execFileSync(process.execPath, [generator]);
  const manifestPath = path.join(fixture, 'vscode-extension/package.json');
  const firstOutput = fs.readFileSync(manifestPath, 'utf8');
  const generated = JSON.parse(firstOutput);
  assert.deepEqual(generated.contributes.chatAgents, [
    { path: './.github/frontier/agents/engineer.agent.md', when: condition },
    { path: './.github/frontier/agents/internal/reviewer.agent.md', when: condition },
  ]);
  for (const kind of ['chatSkills', 'chatInstructions', 'chatPromptFiles']) {
    assert.equal(generated.contributes[kind].length, 1);
    assert.ok(generated.contributes[kind].every(entry => !Object.hasOwn(entry, 'when')));
  }
  assert.deepEqual(generated.contributes.commands, original.contributes.commands);
  assert.deepEqual(generated.contributes.configuration, original.contributes.configuration);
  execFileSync(process.execPath, [generator]);
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), firstOutput);
});

test('bundled agents remain the default and this source workspace selects local definitions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'vscode-extension/package.json'), 'utf8'));
  const config = manifest.contributes.configuration.properties[setting];
  assert.equal(config?.type, 'boolean');
  assert.equal(config?.default, true);
  assert.equal(config?.scope, 'window');
  assert.equal(manifest.contributes.chatAgents.length, 26);
  assert.ok(manifest.contributes.chatAgents.every(agent => agent.when === condition));
  const workspace = JSON.parse(fs.readFileSync(path.join(root, '.vscode/settings.json'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(workspace[setting], false);
  assert.equal(workspace['chat.agentFilesLocations']['.github/agents'], true);
});
