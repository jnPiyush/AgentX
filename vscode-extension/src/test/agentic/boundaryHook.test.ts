import { strict as assert } from 'assert';
import {
  BoundaryRules,
  BoundaryViolationError,
  buildBoundaryHooks,
  composeBoundaryHooks,
  matchesBoundaryPattern,
  checkBoundary,
} from '../../agentic/boundaryHook';
import { AgenticLoopHooks, ToolHookContext } from '../../agentic/agenticLoop';

// ---------------------------------------------------------------------------
// matchesBoundaryPattern
// ---------------------------------------------------------------------------
describe('matchesBoundaryPattern', () => {
  it('should match recursive wildcard patterns', () => {
    assert.ok(matchesBoundaryPattern('src/foo.ts', 'src/**'));
    assert.ok(matchesBoundaryPattern('src/bar/baz.ts', 'src/**'));
    assert.ok(matchesBoundaryPattern('docs/adr/ADR-1.md', 'docs/adr/**'));
  });

  it('should not match when prefix differs', () => {
    assert.ok(!matchesBoundaryPattern('lib/foo.ts', 'src/**'));
    assert.ok(!matchesBoundaryPattern('tests/foo.ts', 'src/**'));
  });

  it('should match exact paths', () => {
    assert.ok(matchesBoundaryPattern('docs/README.md', 'docs/README.md'));
    assert.ok(!matchesBoundaryPattern('docs/OTHER.md', 'docs/README.md'));
  });

  it('should normalize backslashes', () => {
    assert.ok(matchesBoundaryPattern('src\\bar\\baz.ts', 'src/**'));
  });

  it('should strip leading ./', () => {
    assert.ok(matchesBoundaryPattern('./src/foo.ts', 'src/**'));
    assert.ok(matchesBoundaryPattern('src/foo.ts', './src/**'));
  });

  it('should handle single-level wildcard', () => {
    assert.ok(matchesBoundaryPattern('docs/a.md', 'docs/*'));
    assert.ok(!matchesBoundaryPattern('docs/sub/a.md', 'docs/*'));
  });

  it('should handle file extension wildcards', () => {
    assert.ok(matchesBoundaryPattern('foo.ts', '*.ts'));
    assert.ok(!matchesBoundaryPattern('foo.js', '*.ts'));
  });
});

// ---------------------------------------------------------------------------
// checkBoundary
// ---------------------------------------------------------------------------
describe('checkBoundary', () => {
  const architectRules: BoundaryRules = {
    agentName: 'architect',
    canModify: ['docs/adr/**', 'docs/specs/**', 'docs/architecture/**'],
    cannotModify: ['src/**', 'docs/prd/**', 'docs/ux/**', 'tests/**'],
    constraints: [
      '[PASS] CAN research codebase patterns, create ADR/specs with diagrams',
      '[FAIL] CANNOT write implementation code or include code examples in specs',
    ],
  };

  it('should allow writing to canModify paths', () => {
    const result = checkBoundary(architectRules, 'file_write', {
      filePath: 'docs/adr/ADR-42.md',
    });
    assert.equal(result.allowed, true);
  });

  it('should block writing to cannotModify paths', () => {
    const result = checkBoundary(architectRules, 'file_write', {
      filePath: 'src/index.ts',
    });
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes('cannot modify'));
  });

  it('should block writing to paths not in canModify', () => {
    const result = checkBoundary(architectRules, 'file_edit', {
      filePath: 'scripts/deploy.sh',
    });
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes('can only modify'));
  });

  it('should allow read tools regardless of boundaries', () => {
    const result = checkBoundary(architectRules, 'file_read', {
      filePath: 'src/index.ts',
    });
    assert.equal(result.allowed, true);
  });

  it('should allow tools with no filePath param', () => {
    const result = checkBoundary(architectRules, 'file_write', {});
    assert.equal(result.allowed, true);
  });

  it('should block constraint-matched tools on source paths', () => {
    const result = checkBoundary(architectRules, 'file_write', {
      filePath: 'src/services/auth.ts',
    });
    assert.equal(result.allowed, false);
  });

  it('should allow constraint-matched tools on non-source paths', () => {
    // Docs are not source code, so constraint rule shouldn't fire
    const rules: BoundaryRules = {
      agentName: 'architect',
      canModify: ['docs/**'],
      cannotModify: [],
      constraints: ['MUST NOT write implementation code'],
    };
    const result = checkBoundary(rules, 'file_write', {
      filePath: 'docs/design.md',
    });
    assert.equal(result.allowed, true);
  });
});

// ---------------------------------------------------------------------------
// buildBoundaryHooks
// ---------------------------------------------------------------------------
describe('buildBoundaryHooks', () => {
  const rules: BoundaryRules = {
    agentName: 'reviewer',
    canModify: ['docs/reviews/**'],
    cannotModify: ['src/**', 'tests/**'],
    constraints: [],
  };

  it('should throw BoundaryViolationError for blocked paths', async () => {
    const hooks = buildBoundaryHooks(rules);
    const ctx: ToolHookContext = {
      sessionId: 'test-session',
      agentName: 'reviewer',
      toolName: 'file_write',
      params: { filePath: 'src/app.ts', content: 'forbidden' },
      iteration: 1,
    };

    try {
      await hooks.onBeforeToolUse!(ctx);
      assert.fail('Expected BoundaryViolationError');
    } catch (err) {
      assert.ok(err instanceof BoundaryViolationError);
      assert.ok((err as BoundaryViolationError).isBoundaryViolation);
    }
  });

  it('should pass through allowed paths', async () => {
    const hooks = buildBoundaryHooks(rules);
    const ctx: ToolHookContext = {
      sessionId: 'test-session',
      agentName: 'reviewer',
      toolName: 'file_write',
      params: { filePath: 'docs/reviews/REVIEW-42.md', content: 'ok' },
      iteration: 1,
    };

    const result = await hooks.onBeforeToolUse!(ctx);
    assert.equal(result, undefined); // No patched params
  });

  it('should invoke onViolation callback', async () => {
    let violationCalled = false;
    const hooks = buildBoundaryHooks(rules, (_ctx, _violation) => {
      violationCalled = true;
    });
    const ctx: ToolHookContext = {
      sessionId: 'test-session',
      agentName: 'reviewer',
      toolName: 'file_edit',
      params: { filePath: 'src/foo.ts', oldText: 'a', newText: 'b' },
      iteration: 1,
    };

    try {
      await hooks.onBeforeToolUse!(ctx);
      assert.fail('Expected BoundaryViolationError');
    } catch {
      assert.ok(violationCalled);
    }
  });
});

// ---------------------------------------------------------------------------
// composeBoundaryHooks
// ---------------------------------------------------------------------------
describe('composeBoundaryHooks', () => {
  it('should run boundary hook before existing hook', async () => {
    const callOrder: string[] = [];
    const boundaryHooks: Partial<AgenticLoopHooks> = {
      async onBeforeToolUse() {
        callOrder.push('boundary');
        return undefined;
      },
    };
    const existingHooks: Partial<AgenticLoopHooks> = {
      async onBeforeToolUse() {
        callOrder.push('existing');
        return undefined;
      },
    };

    const composed = composeBoundaryHooks(boundaryHooks, existingHooks);
    const ctx: ToolHookContext = {
      sessionId: 'test-session',
      agentName: 'test-agent',
      toolName: 'file_read',
      params: {},
      iteration: 1,
    };

    await composed.onBeforeToolUse!(ctx);
    assert.deepEqual(callOrder, ['boundary', 'existing']);
  });

  it('should propagate BoundaryViolationError without calling existing hook', async () => {
    const existingCalled = { value: false };
    const boundaryHooks: Partial<AgenticLoopHooks> = {
      async onBeforeToolUse() {
        throw new BoundaryViolationError('test violation');
      },
    };
    const existingHooks: Partial<AgenticLoopHooks> = {
      async onBeforeToolUse() {
        existingCalled.value = true;
        return undefined;
      },
    };

    const composed = composeBoundaryHooks(boundaryHooks, existingHooks);
    const ctx: ToolHookContext = {
      sessionId: 'test-session',
      agentName: 'test-agent',
      toolName: 'file_write',
      params: { filePath: 'src/foo.ts' },
      iteration: 1,
    };

    try {
      await composed.onBeforeToolUse!(ctx);
      assert.fail('Expected BoundaryViolationError');
    } catch (err) {
      assert.ok(err instanceof BoundaryViolationError);
    }
    assert.equal(existingCalled.value, false);
  });

  it('should compose with empty boundary hooks (no rules)', async () => {
    const existingCalled = { value: false };
    const existingHooks: Partial<AgenticLoopHooks> = {
      async onBeforeToolUse() {
        existingCalled.value = true;
        return undefined;
      },
    };

    const composed = composeBoundaryHooks({}, existingHooks);
    const ctx: ToolHookContext = {
      sessionId: 'test-session',
      agentName: 'test-agent',
      toolName: 'file_read',
      params: {},
      iteration: 1,
    };

    await composed.onBeforeToolUse!(ctx);
    assert.ok(existingCalled.value);
  });

  it('should delegate onHookError to both hooks', () => {
    const errors: string[] = [];
    const boundaryHooks: Partial<AgenticLoopHooks> = {
      onHookError: (name) => errors.push(`boundary:${name}`),
    };
    const existingHooks: Partial<AgenticLoopHooks> = {
      onHookError: (name) => errors.push(`existing:${name}`),
    };

    const composed = composeBoundaryHooks(boundaryHooks, existingHooks);
    composed.onHookError!('test', new Error('oops'));
    assert.deepEqual(errors, ['boundary:test', 'existing:test']);
  });
});

// ---------------------------------------------------------------------------
// BoundaryViolationError
// ---------------------------------------------------------------------------
describe('BoundaryViolationError', () => {
  it('should have isBoundaryViolation marker', () => {
    const err = new BoundaryViolationError('test');
    assert.equal(err.isBoundaryViolation, true);
    assert.equal(err.message, 'test');
    assert.ok(err instanceof Error);
  });
});
