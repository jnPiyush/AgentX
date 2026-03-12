import { strict as assert } from 'assert';
import * as path from 'path';
import {
  loadAgentDefinitions,
  REQUIRED_AGENT_TOOLS,
  validateMinimumTooling,
} from './agentRunner';

describe('agentRunner integration helpers', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const agentsDir = path.join(repoRoot, '.github', 'agents');

  it('parses multiline tools and agents arrays from agent frontmatter', () => {
    const agents = loadAgentDefinitions(agentsDir);
    const productManager = agents.find((agent) => agent.name === 'AgentX Product Manager');

    assert.ok(productManager, 'expected AgentX Product Manager definition');
    assert.ok(productManager!.tools.includes('runCommands'));
    assert.ok(productManager!.tools.includes('usages'));
    assert.ok(productManager!.agents.includes('AgentX Architect'));
    assert.ok(productManager!.agents.includes('AgentX GitHub Ops'));
  });

  it('enforces the standard minimum tool baseline for all agents', () => {
    const agents = loadAgentDefinitions(agentsDir);
    const results = validateMinimumTooling(agents, REQUIRED_AGENT_TOOLS);
    const failures = results.filter((result) => !result.passed);

    assert.deepEqual(
      failures,
      [],
      failures.map((failure) => `${failure.agent}: ${failure.detail}`).join('\n'),
    );
  });
});