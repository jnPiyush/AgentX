// ---------------------------------------------------------------------------
// AgentX -- Intelligence Pipeline: Stale Issue Detector
// ---------------------------------------------------------------------------
//
// Scans agent state files to identify issues stuck in a status
// longer than configurable thresholds.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 4.1.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { readJsonSafe } from '../../utils/fileLock';
import {
  type IDetector,
  type DetectorResult,
  type StaleIssueThresholds,
  DEFAULT_IN_PROGRESS_HOURS,
  DEFAULT_IN_REVIEW_HOURS,
  DEFAULT_BACKLOG_DAYS,
} from '../backgroundTypes';

// ---------------------------------------------------------------------------
// State file shape (matches .agentx/state/*.json)
// ---------------------------------------------------------------------------

interface AgentStateFile {
  readonly agent: string;
  readonly state: string;
  readonly issueNumber?: number;
  readonly updatedAt?: string;
}

// ---------------------------------------------------------------------------
// StaleIssueDetector
// ---------------------------------------------------------------------------

/**
 * Detects issues that have been in a status longer than the configured
 * thresholds. Reads state files from `.agentx/state/` directory.
 */
export class StaleIssueDetector implements IDetector {
  readonly name = 'stale-issue';

  private readonly stateDir: string;
  private readonly thresholds: StaleIssueThresholds;

  constructor(
    agentxDir: string,
    thresholds?: Partial<StaleIssueThresholds>,
  ) {
    this.stateDir = path.join(agentxDir, 'state');
    this.thresholds = {
      inProgressHours: thresholds?.inProgressHours ?? DEFAULT_IN_PROGRESS_HOURS,
      inReviewHours: thresholds?.inReviewHours ?? DEFAULT_IN_REVIEW_HOURS,
      backlogDays: thresholds?.backlogDays ?? DEFAULT_BACKLOG_DAYS,
    };
  }

  async detect(): Promise<DetectorResult[]> {
    const results: DetectorResult[] = [];

    if (!fs.existsSync(this.stateDir)) {
      return results;
    }

    const now = Date.now();
    let files: string[];
    try {
      files = fs.readdirSync(this.stateDir).filter((f) => f.endsWith('.json'));
    } catch {
      return results;
    }

    for (const file of files) {
      const filePath = path.join(this.stateDir, file);
      const state = readJsonSafe<AgentStateFile>(filePath);
      if (!state || !state.updatedAt) { continue; }

      const updatedAt = new Date(state.updatedAt).getTime();
      if (isNaN(updatedAt)) { continue; }

      const ageMs = now - updatedAt;
      const ageHours = ageMs / (1000 * 60 * 60);
      const ageDays = ageHours / 24;

      const issue = state.issueNumber;

      if (state.state === 'working' && ageHours > this.thresholds.inProgressHours) {
        results.push({
          detector: 'stale',
          severity: ageHours > this.thresholds.inProgressHours * 2 ? 'critical' : 'warning',
          message: `Issue #${issue ?? '?'} has been In Progress for ${Math.round(ageHours)}h (threshold: ${this.thresholds.inProgressHours}h)`,
          issueNumber: issue,
          actionLabel: 'View Issue',
          actionCommand: 'agentx.readyQueue',
        });
      }

      if (state.state === 'blocked' && ageHours > this.thresholds.inReviewHours) {
        results.push({
          detector: 'stale',
          severity: 'warning',
          message: `Issue #${issue ?? '?'} has been In Review for ${Math.round(ageHours)}h (threshold: ${this.thresholds.inReviewHours}h)`,
          issueNumber: issue,
          actionLabel: 'View Issue',
          actionCommand: 'agentx.readyQueue',
        });
      }

      if (state.state === 'idle' && ageDays > this.thresholds.backlogDays && issue) {
        results.push({
          detector: 'stale',
          severity: 'info',
          message: `Issue #${issue} has been in Backlog for ${Math.round(ageDays)} days (threshold: ${this.thresholds.backlogDays}d)`,
          issueNumber: issue,
          actionLabel: 'View Ready Queue',
          actionCommand: 'agentx.readyQueue',
        });
      }
    }

    return results;
  }
}
