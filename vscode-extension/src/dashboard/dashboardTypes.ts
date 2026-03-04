// ---------------------------------------------------------------------------
// AgentX -- Dashboard: Types
// ---------------------------------------------------------------------------
//
// Phase 3 type definitions for the MCP App Dashboard.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 3.3 and 6.
// ---------------------------------------------------------------------------

import { type AgentStateItem, type ReadyQueueItem } from '../mcp/mcpTypes';
import { type SessionIndex } from '../memory/sessionTypes';

// ---------------------------------------------------------------------------
// Dashboard-specific health types (lightweight, not tied to memory HealthReport)
// ---------------------------------------------------------------------------

/** Per-subsystem health status for dashboard display. */
export interface DashboardSubsystemHealth {
  readonly name: string;
  readonly status: 'healthy' | 'missing' | 'degraded';
  readonly issues: readonly string[];
  readonly lastChecked: string;
}

/** Dashboard health report assembled from manifest checks. */
export interface DashboardHealthReport {
  readonly overallStatus: 'healthy' | 'degraded' | 'error';
  readonly subsystems: readonly DashboardSubsystemHealth[];
  readonly totalSizeBytes: number;
  readonly checkedAt: string;
}

// ---------------------------------------------------------------------------
// Dashboard data (aggregated)
// ---------------------------------------------------------------------------

/**
 * All data needed to render the dashboard in a single payload.
 * Returned by the `agentx://dashboard/data` resource.
 */
export interface DashboardData {
  readonly agentStates: AgentStateItem[];
  readonly readyQueue: ReadyQueueItem[];
  readonly outcomeTrends: OutcomeTrendPoint[];
  readonly recentSessions: SessionIndex[];
  readonly healthReport: DashboardHealthReport | null;
  readonly activeWorkflows: WorkflowStatus[];
  readonly lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Outcome trend point  
// ---------------------------------------------------------------------------

/**
 * A single data point for the outcome trends chart.
 * Represents pass/fail/partial counts for one day.
 */
export interface OutcomeTrendPoint {
  /** Date string: YYYY-MM-DD */
  readonly date: string;
  /** Number of pass outcomes on this date. */
  readonly pass: number;
  /** Number of fail outcomes on this date. */
  readonly fail: number;
  /** Number of partial outcomes on this date. */
  readonly partial: number;
}

// ---------------------------------------------------------------------------
// Workflow status
// ---------------------------------------------------------------------------

/**
 * Status of an in-flight workflow for dashboard display.
 */
export interface WorkflowStatus {
  /** Issue number. */
  readonly issueNumber: number;
  /** Workflow type (story, feature, bug, etc.). */
  readonly workflowType: string;
  /** Current step index (1-based). */
  readonly currentStep: number;
  /** Total number of steps. */
  readonly totalSteps: number;
  /** Active agent name. */
  readonly agent: string;
  /** Iteration count (for iterative loops). */
  readonly iterationCount: number;
  /** Workflow execution status. */
  readonly status: 'running' | 'paused' | 'blocked';
}
