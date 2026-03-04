// ---------------------------------------------------------------------------
// AgentX -- Timing Utilities (US-3.2)
// ---------------------------------------------------------------------------
//
// Performance measurement utilities for async and sync operations.
//   - time()     : Wraps an async function, returns result + durationMs
//   - timeSync() : Wraps a sync function, returns result + durationMs
//
// Both utilities log results to the ThinkingLog (if provided) and
// integrate with the structured logger for operational telemetry.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of a timed operation.
 */
export interface TimedResult<T> {
  /** The value returned by the wrapped function. */
  readonly result: T;
  /** Wall-clock duration in milliseconds (fractional). */
  readonly durationMs: number;
  /** ISO timestamp when the operation started. */
  readonly startedAt: string;
  /** Label used for logging (the operation name). */
  readonly label: string;
}

/**
 * Optional logger interface so timing utilities can report without
 * depending on concrete ThinkingLog or StructuredLogger classes.
 */
export interface TimingLogger {
  /** Log a timing entry. */
  log(message: string, metadata?: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Measure the wall-clock duration of an async operation.
 *
 * @param label - Human-readable name for the operation (e.g., 'LLM call').
 * @param fn - The async function to execute and time.
 * @param logger - Optional logger for recording the result.
 * @returns A TimedResult containing the function's return value and timing.
 *
 * @example
 * ```ts
 * const { result, durationMs } = await time('fetchData', () => fetch(url));
 * console.log(`Fetched in ${durationMs}ms`);
 * ```
 */
export async function time<T>(
  label: string,
  fn: () => Promise<T>,
  logger?: TimingLogger,
): Promise<TimedResult<T>> {
  const startedAt = new Date().toISOString();
  const start = performance.now();

  try {
    const result = await fn();
    const durationMs = roundMs(performance.now() - start);

    if (logger) {
      logger.log(`[TIMING] ${label}: ${durationMs}ms`, {
        label,
        durationMs,
        startedAt,
        status: 'success',
      });
    }

    return { result, durationMs, startedAt, label };
  } catch (err) {
    const durationMs = roundMs(performance.now() - start);

    if (logger) {
      logger.log(`[TIMING] ${label}: ${durationMs}ms (error)`, {
        label,
        durationMs,
        startedAt,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    throw err;
  }
}

/**
 * Measure the wall-clock duration of a synchronous operation.
 *
 * @param label - Human-readable name for the operation.
 * @param fn - The sync function to execute and time.
 * @param logger - Optional logger for recording the result.
 * @returns A TimedResult containing the function's return value and timing.
 *
 * @example
 * ```ts
 * const { result, durationMs } = timeSync('parseJSON', () => JSON.parse(data));
 * console.log(`Parsed in ${durationMs}ms`);
 * ```
 */
export function timeSync<T>(
  label: string,
  fn: () => T,
  logger?: TimingLogger,
): TimedResult<T> {
  const startedAt = new Date().toISOString();
  const start = performance.now();

  try {
    const result = fn();
    const durationMs = roundMs(performance.now() - start);

    if (logger) {
      logger.log(`[TIMING] ${label}: ${durationMs}ms`, {
        label,
        durationMs,
        startedAt,
        status: 'success',
      });
    }

    return { result, durationMs, startedAt, label };
  } catch (err) {
    const durationMs = roundMs(performance.now() - start);

    if (logger) {
      logger.log(`[TIMING] ${label}: ${durationMs}ms (error)`, {
        label,
        durationMs,
        startedAt,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Round to 2 decimal places for clean output.
 */
function roundMs(ms: number): number {
  return Math.round(ms * 100) / 100;
}
