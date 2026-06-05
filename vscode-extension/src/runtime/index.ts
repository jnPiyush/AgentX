// ---------------------------------------------------------------------------
// AgentX -- Shared Runtime barrel
// ---------------------------------------------------------------------------
//
// Public surface of the framework-free loop runtime extracted for SPEC-401.
// The VS Code extension consumes this in-process today; a future Node CLI can
// require the compiled `out/runtime/*.js` without any extension dependency.
// ---------------------------------------------------------------------------

export {
  LoopState,
  LoopGateResult,
  LoopTaskClass,
  LoopHealthKind,
  LoopHealth,
  LOOP_STATE_REL,
  LOOP_STALE_AFTER_MS,
  LOOP_STUCK_AFTER_MS,
  DEFAULT_COMPLEX_MIN_ITERATIONS,
  DEFAULT_STANDARD_MIN_ITERATIONS,
  DEFAULT_AUTO_FIX_MIN_ITERATIONS,
  DEFAULT_AGENT_X_MIN_ITERATIONS,
  inferLoopTaskClass,
  getDefaultMinIterations,
  getEffectiveMinIterations,
  hasSubagentReviewIteration,
  getLoopHealth,
  getBudgetRemainingMs,
  evaluateHandoffGate,
  evaluateShouldAutoStart,
  buildLoopStatusDisplay,
  evaluateBudgetExceeded,
} from './loopState';

export {
  parseLoopState,
  readLoopStateFromFile,
} from './loopStateStore';
