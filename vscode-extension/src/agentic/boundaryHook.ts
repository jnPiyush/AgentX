// ---------------------------------------------------------------------------
// AgentX -- Boundary Enforcement Hook
// ---------------------------------------------------------------------------
//
// Enforces agent boundary rules (canModify / cannotModify) and constraint
// rules at runtime via the AgenticLoopHooks interface.
//
// When an agent tries to write/edit a file that violates its declared
// boundaries, the hook intercepts onBeforeToolUse and returns an error
// result instead of allowing the tool to execute.
// ---------------------------------------------------------------------------

import { AgenticLoopHooks, ToolHookContext, ToolResultHookContext, CompactionHookContext } from './agenticLoop';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Boundary rules extracted from an agent definition.
 */
export interface BoundaryRules {
  /** Agent name for diagnostics. */
  readonly agentName: string;
  /** Glob-like path patterns the agent CAN modify (e.g., "docs/adr/**"). */
  readonly canModify: readonly string[];
  /** Glob-like path patterns the agent CANNOT modify (e.g., "src/**"). */
  readonly cannotModify: readonly string[];
  /** Raw constraint strings from frontmatter. */
  readonly constraints: readonly string[];
}

/**
 * Result of a boundary check. When `allowed` is false, `reason` explains why.
 */
export interface BoundaryCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * Callback invoked when a boundary violation is detected.
 */
export type BoundaryViolationHandler = (
  context: ToolHookContext,
  violation: BoundaryCheckResult,
) => void;

// ---------------------------------------------------------------------------
// Constraint Pattern Matching
// ---------------------------------------------------------------------------

/**
 * MUST NOT constraint patterns that map to specific tool behaviors.
 * Each entry matches a constraint string and defines which tools/params
 * should be blocked.
 */
interface ConstraintRule {
  /** Regex to match against constraint text. */
  readonly pattern: RegExp;
  /** Tool names to block when this constraint matches. */
  readonly blockedTools: readonly string[];
  /** Human-readable description for violation messages. */
  readonly description: string;
}

const CONSTRAINT_RULES: readonly ConstraintRule[] = [
  {
    pattern: /MUST NOT write (?:implementation )?code/i,
    blockedTools: ['file_write', 'file_edit'],
    description: 'Agent is constrained from writing implementation code',
  },
  {
    pattern: /MUST NOT include code examples/i,
    blockedTools: ['file_write', 'file_edit'],
    description: 'Agent is constrained from including code examples',
  },
  {
    pattern: /MUST NOT modify (?:application )?source/i,
    blockedTools: ['file_write', 'file_edit'],
    description: 'Agent is constrained from modifying application source code',
  },
  {
    pattern: /CANNOT modify source code/i,
    blockedTools: ['file_write', 'file_edit'],
    description: 'Agent cannot modify source code directly',
  },
];

// ---------------------------------------------------------------------------
// Path Matching
// ---------------------------------------------------------------------------

/**
 * Check if a relative path matches a boundary glob pattern.
 *
 * Supports:
 * - `**` as recursive wildcard (matches any depth)
 * - `*` as single-segment wildcard
 * - Exact prefix matching
 *
 * Examples:
 *   - "src/**" matches "src/foo.ts", "src/bar/baz.ts"
 *   - "docs/adr/**" matches "docs/adr/ADR-1.md"
 *   - ".github/workflows/**" matches ".github/workflows/ci.yml"
 */
export function matchesBoundaryPattern(filePath: string, pattern: string): boolean {
  // Normalize: strip quotes, parenthetical descriptions, and trim
  const cleanPattern = pattern
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .trim();

  // Normalize path separators to forward slashes
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = cleanPattern.replace(/\\/g, '/');

  // Strip leading ./ from both
  const cleanPath = normalizedPath.replace(/^\.\//, '');
  const cleanGlob = normalizedPattern.replace(/^\.\//, '');

  // Handle ** (recursive wildcard)
  if (cleanGlob.endsWith('/**')) {
    const prefix = cleanGlob.slice(0, -3); // Remove /**
    return cleanPath.startsWith(prefix + '/') || cleanPath === prefix;
  }

  // Handle /* (single-level wildcard)
  if (cleanGlob.endsWith('/*')) {
    const prefix = cleanGlob.slice(0, -2); // Remove /*
    const rest = cleanPath.slice(prefix.length + 1);
    return cleanPath.startsWith(prefix + '/') && !rest.includes('/');
  }

  // Handle *glob patterns like *test* or *.ts
  if (cleanGlob.includes('*')) {
    const regexStr = cleanGlob
      .replace(/\*\*/g, '__DOUBLE_STAR__')
      .replace(/\*/g, '[^/]*')
      .replace(/__DOUBLE_STAR__/g, '.*');
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(cleanPath);
  }

  // Exact match
  return cleanPath === cleanGlob || cleanPath.startsWith(cleanGlob + '/');
}

// ---------------------------------------------------------------------------
// Boundary Checking
// ---------------------------------------------------------------------------

/**
 * Tools that write or modify files. Only these need boundary checking.
 */
const FILE_MUTATING_TOOLS = new Set(['file_write', 'file_edit']);

/**
 * Check if a tool call violates the agent's boundary rules.
 */
export function checkBoundary(
  rules: BoundaryRules,
  toolName: string,
  params: Record<string, unknown>,
): BoundaryCheckResult {
  // 1. Check constraints (MUST NOT rules)
  for (const constraint of rules.constraints) {
    for (const rule of CONSTRAINT_RULES) {
      if (rule.pattern.test(constraint) && rule.blockedTools.includes(toolName)) {
        // Only block if the file path suggests source code
        const filePath = (params.filePath as string) ?? '';
        if (filePath && isSourceCodePath(filePath)) {
          return {
            allowed: false,
            reason: `Boundary violation: ${rule.description}. `
              + `Constraint: "${constraint}". `
              + `Tool "${toolName}" targeting "${filePath}" was blocked.`,
          };
        }
      }
    }
  }

  // 2. Check file path boundaries for file-mutating tools
  if (FILE_MUTATING_TOOLS.has(toolName)) {
    const filePath = (params.filePath as string) ?? '';
    if (!filePath) {
      return { allowed: true }; // No path to check
    }

    // Normalize the path relative to workspace
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\.\//, '');

    // Check cannotModify first (deny list takes precedence)
    for (const pattern of rules.cannotModify) {
      if (matchesBoundaryPattern(normalizedPath, pattern)) {
        return {
          allowed: false,
          reason: `Boundary violation: Agent "${rules.agentName}" cannot modify `
            + `files matching "${pattern}". `
            + `Tool "${toolName}" targeting "${normalizedPath}" was blocked.`,
        };
      }
    }

    // If canModify is specified, check allowlist
    if (rules.canModify.length > 0) {
      const isAllowed = rules.canModify.some(
        (pattern) => matchesBoundaryPattern(normalizedPath, pattern),
      );
      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Boundary violation: Agent "${rules.agentName}" can only modify `
            + `files matching: ${rules.canModify.join(', ')}. `
            + `Tool "${toolName}" targeting "${normalizedPath}" was blocked.`,
        };
      }
    }
  }

  // 3. Terminal commands: warn but don't block (too broad to enforce reliably)
  // The constraint check above already handles MUST NOT patterns.

  return { allowed: true };
}

/**
 * Heuristic: check if a path looks like application source code.
 * Used for constraint rules that block writing "implementation code".
 */
function isSourceCodePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const sourcePatterns = [
    /^src\//,
    /^lib\//,
    /^app\//,
    /^packages\//,
    /^tests?\//,
    /\.(ts|tsx|js|jsx|py|cs|java|go|rs|rb|swift|kt)$/,
  ];
  return sourcePatterns.some((p) => p.test(normalized));
}

// ---------------------------------------------------------------------------
// Hook Builder
// ---------------------------------------------------------------------------

/**
 * Build AgenticLoopHooks that enforce boundary rules.
 *
 * The returned hooks merge cleanly with existing hooks via
 * `composeBoundaryHooks()`.
 *
 * @param rules - Boundary rules from the agent definition
 * @param onViolation - Optional callback for violation handling
 * @returns Partial AgenticLoopHooks with boundary enforcement
 */
export function buildBoundaryHooks(
  rules: BoundaryRules,
  onViolation?: BoundaryViolationHandler,
): Partial<AgenticLoopHooks> {
  return {
    async onBeforeToolUse(context: ToolHookContext) {
      const check = checkBoundary(rules, context.toolName, context.params);
      if (!check.allowed) {
        onViolation?.(context, check);
        // Return a special params object that signals the tool engine to
        // return an error. We use a convention: set __boundary_blocked to
        // the reason. The tool execution won't actually run because we
        // throw from this hook, which the loop catches via handleHookError.
        // Instead, we return modified params that won't match any file --
        // the better approach is to signal via a sentinel.
        //
        // Since onBeforeToolUse can return patched params, and the loop
        // will use those, we return a flagged params object. However, the
        // agent should be told why the call failed. The cleanest approach:
        // throw an error with a specific marker that executeLoop catches.
        throw new BoundaryViolationError(check.reason ?? 'Boundary violation');
      }
      // No modification needed
      return undefined;
    },
  };
}

/**
 * Error thrown by boundary hooks to signal a blocked tool call.
 * The agentic loop's hook error handler should detect this and inject
 * a tool-result message explaining the violation.
 */
export class BoundaryViolationError extends Error {
  readonly isBoundaryViolation = true;
  constructor(message: string) {
    super(message);
    this.name = 'BoundaryViolationError';
  }
}

/**
 * Compose boundary hooks with existing hooks, ensuring both run.
 * Boundary hooks run FIRST (to block before other hooks see the call).
 */
export function composeBoundaryHooks(
  boundaryHooks: Partial<AgenticLoopHooks>,
  existingHooks: Partial<AgenticLoopHooks>,
): AgenticLoopHooks {
  return {
    async onBeforeToolUse(context: ToolHookContext) {
      // Boundary check runs first. If it throws, we propagate.
      const boundaryResult = await boundaryHooks.onBeforeToolUse?.(context);

      // Then run existing hooks
      const existingResult = await existingHooks.onBeforeToolUse?.(context);

      // If existing hook returned patched params, prefer those
      // (boundary hook only throws on violation, never returns patches)
      return existingResult ?? boundaryResult;
    },

    async onAfterToolUse(context: ToolResultHookContext) {
      await boundaryHooks.onAfterToolUse?.(context);
      await existingHooks.onAfterToolUse?.(context);
    },

    async onCompaction(context: CompactionHookContext) {
      await boundaryHooks.onCompaction?.(context);
      await existingHooks.onCompaction?.(context);
    },

    async onBeforeClarification(context) {
      const boundaryResult = await boundaryHooks.onBeforeClarification?.(context);
      const existingResult = await existingHooks.onBeforeClarification?.(context);
      return existingResult ?? boundaryResult;
    },

    async onAfterClarification(context) {
      await boundaryHooks.onAfterClarification?.(context);
      await existingHooks.onAfterClarification?.(context);
    },

    onHookError(hookName: string, error: unknown) {
      boundaryHooks.onHookError?.(hookName, error);
      existingHooks.onHookError?.(hookName, error);
    },
  };
}
