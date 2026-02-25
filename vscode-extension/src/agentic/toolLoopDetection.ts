// ---------------------------------------------------------------------------
// AgentX -- Tool Loop Detection
// ---------------------------------------------------------------------------
//
// Ported from OpenClaw's hash-based loop detection pattern. Detects when the
// LLM gets stuck in repetitive tool-call cycles:
//
//   1. generic_repeat   -- same tool call N times in a row
//   2. ping_pong        -- alternating A-B-A-B pattern
//   3. poll_no_progress -- repeated identical calls with same results
//
// All detection is based on SHA-256 hashes of (toolName + stableJSON(params)).
// ---------------------------------------------------------------------------

import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoopSeverity = 'none' | 'warning' | 'critical' | 'circuit_breaker';

export type LoopDetectorKind =
  | 'generic_repeat'
  | 'ping_pong'
  | 'poll_no_progress';

export interface LoopDetectionResult {
  readonly severity: LoopSeverity;
  readonly detector: LoopDetectorKind | null;
  readonly message: string;
  readonly count: number;
}

export interface ToolCallRecord {
  readonly callHash: string;
  readonly resultHash: string;
  readonly toolName: string;
  readonly timestamp: number;
}

export interface LoopDetectionConfig {
  /** Consecutive identical calls before WARNING (default 10). */
  readonly warningThreshold: number;
  /** Consecutive identical calls before CRITICAL (default 20). */
  readonly criticalThreshold: number;
  /** Total repeated calls before hard stop (default 30). */
  readonly circuitBreakerThreshold: number;
  /** Sliding window size for recent history (default 30). */
  readonly windowSize: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: LoopDetectionConfig = {
  warningThreshold: 10,
  criticalThreshold: 20,
  circuitBreakerThreshold: 30,
  windowSize: 30,
};

// ---------------------------------------------------------------------------
// Hashing utilities
// ---------------------------------------------------------------------------

/**
 * Produce a stable JSON string by sorting object keys recursively.
 * This ensures that `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` hash identically.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * Hash a tool call (name + params) using SHA-256.
 */
export function hashToolCall(
  toolName: string,
  params: Record<string, unknown>,
): string {
  const input = `${toolName}::${stableStringify(params)}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Hash a tool result for poll-no-progress detection.
 */
export function hashToolResult(resultText: string): string {
  return crypto
    .createHash('sha256')
    .update(resultText)
    .digest('hex')
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

/**
 * Detect generic repeated calls -- N identical consecutive tool calls.
 */
function detectGenericRepeat(
  window: readonly ToolCallRecord[],
  config: LoopDetectionConfig,
): LoopDetectionResult {
  if (window.length === 0) {
    return { severity: 'none', detector: null, message: '', count: 0 };
  }

  const lastHash = window[window.length - 1].callHash;
  let streak = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    if (window[i].callHash === lastHash) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= config.circuitBreakerThreshold) {
    return {
      severity: 'circuit_breaker',
      detector: 'generic_repeat',
      message: `Tool call repeated ${streak} times -- circuit breaker tripped.`,
      count: streak,
    };
  }
  if (streak >= config.criticalThreshold) {
    return {
      severity: 'critical',
      detector: 'generic_repeat',
      message: `Tool call repeated ${streak} times -- critical loop detected.`,
      count: streak,
    };
  }
  if (streak >= config.warningThreshold) {
    return {
      severity: 'warning',
      detector: 'generic_repeat',
      message: `Tool call repeated ${streak} times -- possible loop.`,
      count: streak,
    };
  }

  return { severity: 'none', detector: null, message: '', count: streak };
}

/**
 * Detect ping-pong pattern -- alternating A-B-A-B calls.
 */
function detectPingPong(
  window: readonly ToolCallRecord[],
  config: LoopDetectionConfig,
): LoopDetectionResult {
  if (window.length < 4) {
    return { severity: 'none', detector: null, message: '', count: 0 };
  }

  // Walk backwards and check for alternation
  const last = window[window.length - 1].callHash;
  const secondLast = window[window.length - 2].callHash;

  if (last === secondLast) {
    return { severity: 'none', detector: null, message: '', count: 0 };
  }

  let alternations = 0;
  for (let i = window.length - 1; i >= 1; i--) {
    const expected = i % 2 === (window.length - 1) % 2 ? last : secondLast;
    if (window[i].callHash === expected) {
      alternations++;
    } else {
      break;
    }
  }

  const pairs = Math.floor(alternations / 2);

  if (pairs >= config.circuitBreakerThreshold / 2) {
    return {
      severity: 'circuit_breaker',
      detector: 'ping_pong',
      message: `Ping-pong loop detected: ${pairs} alternating pairs -- circuit breaker.`,
      count: pairs,
    };
  }
  if (pairs >= config.criticalThreshold / 2) {
    return {
      severity: 'critical',
      detector: 'ping_pong',
      message: `Ping-pong loop detected: ${pairs} alternating pairs.`,
      count: pairs,
    };
  }
  if (pairs >= config.warningThreshold / 2) {
    return {
      severity: 'warning',
      detector: 'ping_pong',
      message: `Possible ping-pong loop: ${pairs} alternating pairs.`,
      count: pairs,
    };
  }

  return { severity: 'none', detector: null, message: '', count: pairs };
}

/**
 * Detect poll-with-no-progress -- same tool call AND same result repeatedly.
 */
function detectPollNoProgress(
  window: readonly ToolCallRecord[],
  config: LoopDetectionConfig,
): LoopDetectionResult {
  if (window.length === 0) {
    return { severity: 'none', detector: null, message: '', count: 0 };
  }

  const last = window[window.length - 1];
  let streak = 0;

  for (let i = window.length - 1; i >= 0; i--) {
    if (
      window[i].callHash === last.callHash &&
      window[i].resultHash === last.resultHash
    ) {
      streak++;
    } else {
      break;
    }
  }

  // Use tighter thresholds for poll-no-progress (half the generic ones)
  const warnAt = Math.ceil(config.warningThreshold / 2);
  const critAt = Math.ceil(config.criticalThreshold / 2);
  const breakAt = Math.ceil(config.circuitBreakerThreshold / 2);

  if (streak >= breakAt) {
    return {
      severity: 'circuit_breaker',
      detector: 'poll_no_progress',
      message: `Polling with no progress ${streak} times -- circuit breaker.`,
      count: streak,
    };
  }
  if (streak >= critAt) {
    return {
      severity: 'critical',
      detector: 'poll_no_progress',
      message: `Polling with no progress ${streak} times -- critical.`,
      count: streak,
    };
  }
  if (streak >= warnAt) {
    return {
      severity: 'warning',
      detector: 'poll_no_progress',
      message: `Polling with no progress ${streak} times -- warning.`,
      count: streak,
    };
  }

  return { severity: 'none', detector: null, message: '', count: streak };
}

// ---------------------------------------------------------------------------
// ToolLoopDetector
// ---------------------------------------------------------------------------

/**
 * Stateful loop detector that tracks recent tool calls and runs all three
 * detection algorithms on each new entry.
 *
 * Usage:
 * ```ts
 * const detector = new ToolLoopDetector();
 * detector.record('file_read', { filePath: 'readme.md' }, 'file content...');
 * const result = detector.detect();
 * if (result.severity === 'circuit_breaker') { abort(); }
 * ```
 */
export class ToolLoopDetector {
  private readonly config: LoopDetectionConfig;
  private readonly history: ToolCallRecord[] = [];

  constructor(config?: Partial<LoopDetectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Record a completed tool call for analysis. */
  record(
    toolName: string,
    params: Record<string, unknown>,
    resultText: string,
  ): void {
    const record: ToolCallRecord = {
      callHash: hashToolCall(toolName, params),
      resultHash: hashToolResult(resultText),
      toolName,
      timestamp: Date.now(),
    };

    this.history.push(record);

    // Maintain sliding window
    while (this.history.length > this.config.windowSize) {
      this.history.shift();
    }
  }

  /**
   * Run all detectors and return the most severe result.
   * The severity order is: circuit_breaker > critical > warning > none.
   */
  detect(): LoopDetectionResult {
    const window = this.history;
    const results = [
      detectGenericRepeat(window, this.config),
      detectPingPong(window, this.config),
      detectPollNoProgress(window, this.config),
    ];

    // Return the most severe
    const order: LoopSeverity[] = ['circuit_breaker', 'critical', 'warning'];
    for (const sev of order) {
      const match = results.find((r) => r.severity === sev);
      if (match) {
        return match;
      }
    }

    return { severity: 'none', detector: null, message: '', count: 0 };
  }

  /** Get the current history window (read-only copy). */
  getHistory(): readonly ToolCallRecord[] {
    return [...this.history];
  }

  /** Reset all history. */
  reset(): void {
    this.history.length = 0;
  }

  /** Get the number of recorded calls in the current window. */
  get size(): number {
    return this.history.length;
  }
}
