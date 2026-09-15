import { strict as assert } from 'assert';
import * as path from 'path';
import {
  loadAgentDefinitions,
  REQUIRED_AGENT_TOOLS,
  validateAgentReferences,
  validateMinimumTooling,
} from './agentRunner';

describe('agentRunner integration helpers', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const agentsDir = path.join(repoRoot, '.github', 'agents');

  it('parses multiline tools and agents arrays from agent frontmatter', () => {
    const agents = loadAgentDefinitions(agentsDir);
    const productManager = agents.find((agent) => agent.name === 'Frontier Product FDE');

    assert.ok(productManager, 'expected Frontier Product FDE definition');
    assert.ok(productManager!.tools.includes('runCommands'));
    assert.ok(productManager!.tools.includes('usages'));
    assert.ok(productManager!.agents.includes('Frontier Architecture FDE'));
    assert.ok(productManager!.agents.includes('Frontier GitHub Ops FDE'));
  });

  it('enforces the safe common tool baseline for all agents', () => {
    const agents = loadAgentDefinitions(agentsDir);
    const results = validateMinimumTooling(agents, REQUIRED_AGENT_TOOLS);
    const failures = results.filter((result) => !result.passed);

    assert.deepEqual(
      failures,
      [],
      failures.map((failure) => `${failure.agent}: ${failure.detail}`).join('\n'),
    );
  });

  it('enforces least privilege for internal specialists', () => {
    const agents = loadAgentDefinitions(agentsDir);
    const internalAgents = agents.filter((agent) => agent.filePath.includes('internal'));

    for (const agent of internalAgents) {
      if (agent.name === 'Frontier GitHub Ops FDE') {
        assert.ok(agent.tools.includes('github/*'), 'GitHub Ops requires GitHub tools');
      } else {
        assert.ok(!agent.tools.includes('github/*'), `${agent.name} should not receive broad GitHub tools`);
      }
    }

    const visibleAgents = agents.filter((agent) => !agent.filePath.includes('internal'));
    for (const agent of visibleAgents) {
      assert.ok(agent.tools.includes('editFiles'), `${agent.name} should retain its owned-output edit capability`);
    }

    for (const reviewerName of ['Frontier Architecture Review FDE', 'Frontier Functional Review FDE']) {
      const reviewer = agents.find((agent) => agent.name === reviewerName);
      assert.ok(reviewer, `expected ${reviewerName} definition`);
      assert.ok(!reviewer!.tools.includes('editFiles'), `${reviewerName} should be analysis-only`);
      assert.ok(!reviewer!.tools.includes('runCommands'), `${reviewerName} should not execute terminal commands`);
    }
  });

  it('resolves every delegated agent name', () => {
    const agents = loadAgentDefinitions(agentsDir);
    const failures = validateAgentReferences(agents).filter((result) => !result.passed);
    assert.deepEqual(
      failures,
      [],
      failures.map((failure) => `${failure.agent}: ${failure.detail}`).join('\n'),
    );
  });
});