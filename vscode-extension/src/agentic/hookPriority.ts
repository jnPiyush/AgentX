// ---------------------------------------------------------------------------
// AgentX -- Hook Priority System (US-4.5)
// ---------------------------------------------------------------------------
//
// Allows hooks to specify execution priority so developers can control
// the order hooks fire in. Lower priority numbers execute first.
//
// Key design:
//   - Priority field on hook registration (lower = earlier, default = 100)
//   - Hooks sorted by priority before execution
//   - Backward compatible: existing hooks without priority get default (100)
//   - Multiple hooks per event supported via registration API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A registered hook with priority metadata.
 */
export interface PrioritizedHook<TContext = unknown, TResult = void> {
  /** Unique identifier for this hook registration. */
  readonly id: string;
  /** Human-readable name for debugging. */
  readonly name: string;
  /** Priority: lower numbers execute first. Default: 100. */
  readonly priority: number;
  /** The hook function to execute. */
  readonly handler: (context: TContext) => Promise<TResult> | TResult;
}

/**
 * Options for registering a hook.
 */
export interface HookRegistrationOptions<TContext = unknown, TResult = void> {
  /** Unique identifier. If omitted, auto-generated. */
  readonly id?: string;
  /** Human-readable name. */
  readonly name: string;
  /** Priority (lower = earlier). Default: 100. */
  readonly priority?: number;
  /** The hook handler function. */
  readonly handler: (context: TContext) => Promise<TResult> | TResult;
}

/**
 * Result from executing a chain of prioritized hooks.
 */
export interface HookChainResult<TResult = void> {
  /** Results from each hook, in execution order. */
  readonly results: ReadonlyArray<{
    readonly hookId: string;
    readonly hookName: string;
    readonly priority: number;
    readonly result?: TResult;
    readonly error?: Error;
    readonly durationMs: number;
  }>;
  /** Total execution time for the entire chain. */
  readonly totalDurationMs: number;
  /** Number of hooks that executed successfully. */
  readonly successCount: number;
  /** Number of hooks that threw errors. */
  readonly errorCount: number;
}

// ---------------------------------------------------------------------------
// Default priority
// ---------------------------------------------------------------------------

/** Default priority for hooks that do not specify one. */
export const DEFAULT_HOOK_PRIORITY = 100;

// ---------------------------------------------------------------------------
// Hook Registry
// ---------------------------------------------------------------------------

/**
 * A registry for prioritized hooks on a specific event.
 *
 * Usage:
 * ```ts
 * const registry = new HookRegistry<ToolHookContext>('onBeforeToolUse');
 * registry.register({ name: 'logger', priority: 50, handler: logHook });
 * registry.register({ name: 'validator', priority: 10, handler: validateHook });
 *
 * // Executes validator (10) then logger (50)
 * const result = await registry.executeAll(context);
 * ```
 */
export class HookRegistry<TContext = unknown, TResult = void> {
  private readonly hooks: PrioritizedHook<TContext, TResult>[] = [];
  private nextAutoId = 1;

  constructor(
    /** Name of the event this registry manages (for debugging). */
    readonly eventName: string,
  ) {}

  /**
   * Register a hook with optional priority.
   * Returns the hook ID for later removal.
   */
  register(options: HookRegistrationOptions<TContext, TResult>): string {
    const id = options.id ?? `${this.eventName}-auto-${this.nextAutoId++}`;
    const priority = options.priority ?? DEFAULT_HOOK_PRIORITY;

    // Remove existing hook with same ID (re-registration)
    this.unregister(id);

    this.hooks.push({
      id,
      name: options.name,
      priority,
      handler: options.handler,
    });

    // Keep sorted by priority (stable sort)
    this.hooks.sort((a, b) => a.priority - b.priority);

    return id;
  }

  /**
   * Unregister a hook by ID.
   * Returns true if the hook was found and removed.
   */
  unregister(id: string): boolean {
    const idx = this.hooks.findIndex((h) => h.id === id);
    if (idx >= 0) {
      this.hooks.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Execute all registered hooks in priority order.
   * Hook errors are captured but do not stop the chain.
   */
  async executeAll(context: TContext): Promise<HookChainResult<TResult>> {
    const startAll = performance.now();
    const results: HookChainResult<TResult>['results'][number][] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const hook of this.hooks) {
      const startHook = performance.now();
      try {
        const result = await hook.handler(context);
        const durationMs = roundMs(performance.now() - startHook);
        results.push({
          hookId: hook.id,
          hookName: hook.name,
          priority: hook.priority,
          result,
          durationMs,
        });
        successCount++;
      } catch (err) {
        const durationMs = roundMs(performance.now() - startHook);
        results.push({
          hookId: hook.id,
          hookName: hook.name,
          priority: hook.priority,
          error: err instanceof Error ? err : new Error(String(err)),
          durationMs,
        });
        errorCount++;
      }
    }

    return {
      results,
      totalDurationMs: roundMs(performance.now() - startAll),
      successCount,
      errorCount,
    };
  }

  /**
   * Execute hooks until one returns a non-undefined result (first-wins).
   * Useful for hooks that produce a decision (e.g., onError -> action).
   */
  async executeUntilResult(context: TContext): Promise<{
    readonly result?: TResult;
    readonly hookId?: string;
    readonly hookName?: string;
    readonly totalDurationMs: number;
  }> {
    const startAll = performance.now();

    for (const hook of this.hooks) {
      try {
        const result = await hook.handler(context);
        if (result !== undefined && result !== null) {
          return {
            result,
            hookId: hook.id,
            hookName: hook.name,
            totalDurationMs: roundMs(performance.now() - startAll),
          };
        }
      } catch {
        // Skip errored hooks, try next
      }
    }

    return {
      totalDurationMs: roundMs(performance.now() - startAll),
    };
  }

  /**
   * Get all registered hooks in priority order (read-only).
   */
  getHooks(): ReadonlyArray<Readonly<PrioritizedHook<TContext, TResult>>> {
    return [...this.hooks];
  }

  /**
   * Get the number of registered hooks.
   */
  get size(): number {
    return this.hooks.length;
  }

  /**
   * Remove all registered hooks.
   */
  clear(): void {
    this.hooks.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundMs(ms: number): number {
  return Math.round(ms * 100) / 100;
}
