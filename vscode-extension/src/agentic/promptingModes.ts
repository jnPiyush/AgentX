// ---------------------------------------------------------------------------
// AgentX -- Prompting Modes (US-4.4)
// ---------------------------------------------------------------------------
//
// Allows agents to operate in different prompting modes (write, refactor,
// test, docs) without creating new agent definitions. Each mode loads a
// mode-specific system prompt suffix that adjusts the agent's behavior.
//
// Built-in modes for the Engineer agent:
//   - write:    Default coding mode -- implement features, fix bugs
//   - refactor: Focus on code quality, readability, performance
//   - test:     Focus on writing tests, improving coverage
//   - docs:     Focus on documentation, comments, README updates
//
// Custom modes can be registered at runtime.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Built-in prompting modes available for the Engineer agent.
 * Custom string modes are also allowed.
 */
export type BuiltInMode = 'write' | 'refactor' | 'test' | 'docs';

/**
 * A prompting mode definition.
 */
export interface PromptMode {
  /** Unique mode identifier. */
  readonly name: string;
  /** Human-readable description. */
  readonly description: string;
  /** System prompt suffix appended to the agent's base prompt. */
  readonly systemPromptSuffix: string;
  /** Optional tool category filter -- restricts which tools the agent sees. */
  readonly allowedToolCategories?: readonly string[];
}

/**
 * Options for resolving a mode-adjusted system prompt.
 */
export interface ModeResolutionOptions {
  /** The agent's base system prompt (from .agent.md or config). */
  readonly baseSystemPrompt: string;
  /** The requested mode name. Undefined or 'default' uses base prompt as-is. */
  readonly mode?: string;
  /** The agent role (e.g., 'engineer'). Used to find role-specific modes. */
  readonly role?: string;
}

/**
 * Result of mode resolution.
 */
export interface ModeResolutionResult {
  /** The final system prompt (base + mode suffix). */
  readonly systemPrompt: string;
  /** The resolved mode name ('default' if no mode was requested). */
  readonly resolvedMode: string;
  /** Tool category filter from the mode, if any. */
  readonly allowedToolCategories?: readonly string[];
  /** Whether a non-default mode was applied. */
  readonly modeApplied: boolean;
}

// ---------------------------------------------------------------------------
// Built-in Mode Definitions
// ---------------------------------------------------------------------------

const ENGINEER_WRITE_MODE: PromptMode = {
  name: 'write',
  description: 'Default coding mode -- implement features, fix bugs, write new code.',
  systemPromptSuffix: [
    '',
    '## Mode: Write',
    'Focus on implementing the requested feature or fix:',
    '- Write clean, well-structured code following project conventions',
    '- Include inline comments for non-obvious logic',
    '- Handle edge cases and error conditions',
    '- Keep changes minimal and focused on the task',
  ].join('\n'),
};

const ENGINEER_REFACTOR_MODE: PromptMode = {
  name: 'refactor',
  description: 'Code quality mode -- improve structure, readability, performance.',
  systemPromptSuffix: [
    '',
    '## Mode: Refactor',
    'Focus on improving existing code quality:',
    '- Improve naming, structure, and readability',
    '- Extract functions/classes where logic is duplicated',
    '- Reduce complexity (cyclomatic, cognitive)',
    '- Preserve existing behavior -- do NOT change functionality',
    '- Run existing tests after changes to verify no regressions',
  ].join('\n'),
};

const ENGINEER_TEST_MODE: PromptMode = {
  name: 'test',
  description: 'Testing mode -- write tests, improve coverage, add assertions.',
  systemPromptSuffix: [
    '',
    '## Mode: Test',
    'Focus on testing and code coverage:',
    '- Write unit tests for uncovered functions and branches',
    '- Add edge case tests (null, empty, boundary values)',
    '- Use descriptive test names that explain the scenario',
    '- Mock external dependencies (file system, network, LLM)',
    '- Target >= 80% code coverage on modified modules',
  ].join('\n'),
  allowedToolCategories: ['read', 'edit', 'execute', 'search'],
};

const ENGINEER_DOCS_MODE: PromptMode = {
  name: 'docs',
  description: 'Documentation mode -- write docs, comments, README updates.',
  systemPromptSuffix: [
    '',
    '## Mode: Docs',
    'Focus on documentation and developer experience:',
    '- Add JSDoc/TSDoc comments to public APIs',
    '- Update README and GUIDE with usage examples',
    '- Write inline comments for complex algorithms',
    '- Create or update CHANGELOG entries',
    '- Keep docs concise, accurate, and up to date',
  ].join('\n'),
  allowedToolCategories: ['read', 'edit', 'search'],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Internal storage: role -> mode name -> PromptMode */
const modeRegistry = new Map<string, Map<string, PromptMode>>();

/**
 * Register built-in modes. Called once at module load.
 */
function registerBuiltInModes(): void {
  const engineerModes = new Map<string, PromptMode>();
  engineerModes.set('write', ENGINEER_WRITE_MODE);
  engineerModes.set('refactor', ENGINEER_REFACTOR_MODE);
  engineerModes.set('test', ENGINEER_TEST_MODE);
  engineerModes.set('docs', ENGINEER_DOCS_MODE);
  modeRegistry.set('engineer', engineerModes);
}

// Auto-register on module load
registerBuiltInModes();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a custom prompting mode for a given role.
 * Overwrites if a mode with the same name already exists for that role.
 */
export function registerMode(role: string, mode: PromptMode): void {
  if (!role || !mode.name) {
    throw new Error('registerMode requires a non-empty role and mode.name');
  }
  let roleModes = modeRegistry.get(role);
  if (!roleModes) {
    roleModes = new Map<string, PromptMode>();
    modeRegistry.set(role, roleModes);
  }
  roleModes.set(mode.name, mode);
}

/**
 * Unregister a custom prompting mode.
 * Returns true if the mode was found and removed.
 */
export function unregisterMode(role: string, modeName: string): boolean {
  const roleModes = modeRegistry.get(role);
  if (!roleModes) { return false; }
  return roleModes.delete(modeName);
}

/**
 * List all registered modes for a given role.
 */
export function listModes(role: string): readonly PromptMode[] {
  const roleModes = modeRegistry.get(role);
  if (!roleModes) { return []; }
  return Array.from(roleModes.values());
}

/**
 * Get a specific mode definition.
 */
export function getMode(role: string, modeName: string): PromptMode | undefined {
  return modeRegistry.get(role)?.get(modeName);
}

/**
 * Resolve a mode-adjusted system prompt.
 *
 * If modeName is undefined, empty, or 'default', the base prompt is returned
 * unchanged (backward-compatible). Otherwise, the mode's systemPromptSuffix
 * is appended to the base prompt.
 *
 * @throws Error if the requested mode is not registered for the role.
 */
export function resolveMode(options: ModeResolutionOptions): ModeResolutionResult {
  const { baseSystemPrompt, mode, role } = options;

  // No mode or 'default' -- return base prompt unchanged
  if (!mode || mode === 'default') {
    return {
      systemPrompt: baseSystemPrompt,
      resolvedMode: 'default',
      modeApplied: false,
    };
  }

  // Look up mode in registry
  const resolvedRole = role ?? 'engineer';
  const modeConfig = getMode(resolvedRole, mode);

  if (!modeConfig) {
    const available = listModes(resolvedRole).map((m) => m.name);
    throw new Error(
      `Unknown prompting mode '${mode}' for role '${resolvedRole}'. ` +
      `Available modes: ${available.length > 0 ? available.join(', ') : '(none)'}`,
    );
  }

  return {
    systemPrompt: baseSystemPrompt + modeConfig.systemPromptSuffix,
    resolvedMode: mode,
    allowedToolCategories: modeConfig.allowedToolCategories,
    modeApplied: true,
  };
}

/**
 * Reset the mode registry to built-in defaults.
 * Useful for testing.
 */
export function resetModeRegistry(): void {
  modeRegistry.clear();
  registerBuiltInModes();
}
