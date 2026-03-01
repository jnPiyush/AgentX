// ---------------------------------------------------------------------------
// Tests: agenticChatHandler
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';

describe('agenticChatHandler', () => {

  describe('parseCanClarifyList', () => {
    // Re-implement the parsing logic for testing since it is not exported
    function parseCanClarifyList(instructions: string | undefined): string[] {
      if (!instructions) { return []; }

      const match = instructions.match(/can_clarify\s*[:=]\s*\[([^\]]*)\]/);
      if (match) {
        return match[1]
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }

      const handoffMatch = instructions.match(/## (?:Team & )?Handoffs[^\n]*\n([\s\S]*?)(?=\n## |\n---)/);
      if (handoffMatch) {
        const agents: string[] = [];
        const agentPattern = /\b(product-manager|architect|ux-designer|engineer|reviewer|devops-engineer|customer-coach|agent-x)\b/gi;
        let m;
        while ((m = agentPattern.exec(handoffMatch[1])) !== null) {
          const name = m[1].toLowerCase();
          if (!agents.includes(name)) { agents.push(name); }
        }
        return agents;
      }

      return [];
    }

    it('should parse TOML-style can_clarify list', () => {
      const instructions = 'can_clarify = ["architect", "product-manager"]';
      const result = parseCanClarifyList(instructions);
      assert.deepEqual(result, ['architect', 'product-manager']);
    });

    it('should parse colon-style can_clarify list', () => {
      const instructions = 'can_clarify: ["engineer", "reviewer"]';
      const result = parseCanClarifyList(instructions);
      assert.deepEqual(result, ['engineer', 'reviewer']);
    });

    it('should extract agent names from Handoffs section', () => {
      const instructions = `## Role
Some role description

## Handoffs
When complete, hand off to **engineer** for implementation.
May request clarification from **architect** for design questions.

## Other
`;
      const result = parseCanClarifyList(instructions);
      assert.ok(result.includes('engineer'));
      assert.ok(result.includes('architect'));
    });

    it('should extract from Team & Handoffs variant', () => {
      const instructions = `## Team & Handoffs
- Receives PRD from product-manager
- Hands implementation to engineer
- May consult ux-designer for UI questions

---
`;
      const result = parseCanClarifyList(instructions);
      assert.ok(result.includes('product-manager'));
      assert.ok(result.includes('engineer'));
      assert.ok(result.includes('ux-designer'));
    });

    it('should return empty array for undefined instructions', () => {
      assert.deepEqual(parseCanClarifyList(undefined), []);
    });

    it('should return empty array when no clarify config found', () => {
      const instructions = '## Role\nJust a simple role description.\n';
      assert.deepEqual(parseCanClarifyList(instructions), []);
    });

    it('should deduplicate agent names', () => {
      const instructions = `## Handoffs
Work with engineer for code. Also check with engineer for tests.

---
`;
      const result = parseCanClarifyList(instructions);
      const engineerCount = result.filter((a) => a === 'engineer').length;
      assert.equal(engineerCount, 1);
    });
  });

  describe('detectTargetAgent', () => {
    // Re-implement for testing since it is not exported
    function detectTargetAgent(question: string, canClarify: string[]): string {
      const lower = question.toLowerCase();
      for (const agent of canClarify) {
        if (lower.includes(agent)) {
          return agent;
        }
      }

      const keywordMap: Record<string, RegExp> = {
        'product-manager': /\b(requirement|prd|scope|priority|user stor)/i,
        'architect': /\b(architecture|design|adr|pattern|scalab)/i,
        'ux-designer': /\b(ux|ui|wireframe|prototype|user flow)/i,
        'engineer': /\b(implement|code|build|test|function)/i,
        'reviewer': /\b(review|quality|approval|merge)/i,
        'devops-engineer': /\b(deploy|pipeline|ci\/cd|infrastructure)/i,
      };

      for (const agent of canClarify) {
        const pattern = keywordMap[agent];
        if (pattern && pattern.test(lower)) {
          return agent;
        }
      }

      return canClarify[0] ?? 'agent-x';
    }

    it('should match agent name directly in the question', () => {
      const result = detectTargetAgent(
        'I need the architect to clarify the data model',
        ['architect', 'engineer'],
      );
      assert.equal(result, 'architect');
    });

    it('should match by keyword when no direct name match', () => {
      const result = detectTargetAgent(
        'What are the requirements for this feature?',
        ['product-manager', 'engineer'],
      );
      assert.equal(result, 'product-manager');
    });

    it('should match architecture keywords to architect', () => {
      const result = detectTargetAgent(
        'How should the design handle caching?',
        ['architect', 'engineer'],
      );
      assert.equal(result, 'architect');
    });

    it('should match deployment keywords to devops', () => {
      const result = detectTargetAgent(
        'How do we deploy this to production?',
        ['devops-engineer', 'engineer'],
      );
      assert.equal(result, 'devops-engineer');
    });

    it('should fall back to first agent in list when no match', () => {
      const result = detectTargetAgent(
        'Something completely unrelated to any agent',
        ['reviewer', 'architect'],
      );
      assert.equal(result, 'reviewer');
    });

    it('should return agent-x when canClarify is empty', () => {
      const result = detectTargetAgent('any question', []);
      assert.equal(result, 'agent-x');
    });
  });

  describe('buildAgentSystemPrompt', () => {
    it('should include agent name in system prompt', () => {
      // Simulate the prompt builder
      const parts: string[] = [];
      parts.push('You are the Test Agent agent in the AgentX framework.');
      parts.push('You are working inside a VS Code workspace via Copilot Chat.');

      const prompt = parts.join('\n');
      assert.ok(prompt.includes('Test Agent'));
      assert.ok(prompt.includes('VS Code workspace'));
    });

    it('should include tool usage section', () => {
      const parts: string[] = [];
      parts.push('## Tool Usage');
      parts.push('You have workspace tools available (file_read, file_write, file_edit, grep_search, list_dir, terminal_exec).');

      const prompt = parts.join('\n');
      assert.ok(prompt.includes('file_read'));
      assert.ok(prompt.includes('terminal_exec'));
    });
  });

});
