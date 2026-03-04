// ---------------------------------------------------------------------------
// AgentX -- Intelligence Pipeline: Dependency Monitor
// ---------------------------------------------------------------------------
//
// Scans issue state files for `Blocked-by:` dependencies and alerts
// when blockers are resolved or when circular dependencies are detected.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 4.1.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { readJsonSafe } from '../../utils/fileLock';
import { type IDetector, type DetectorResult } from '../backgroundTypes';

// ---------------------------------------------------------------------------
// State file shape (re-declared locally to avoid coupling)
// ---------------------------------------------------------------------------

interface AgentStateFile {
  readonly agent: string;
  readonly state: string;
  readonly issueNumber?: number;
  readonly updatedAt?: string;
  readonly blockedBy?: readonly number[];
  readonly blocks?: readonly number[];
}

// ---------------------------------------------------------------------------
// DependencyMonitor
// ---------------------------------------------------------------------------

/**
 * Monitors cross-issue dependencies declared via `Blocked-by:` /
 * `Blocks:` conventions. Detects resolved blockers and circular chains.
 */
export class DependencyMonitor implements IDetector {
  readonly name = 'dependency';

  private readonly stateDir: string;

  constructor(agentxDir: string) {
    this.stateDir = path.join(agentxDir, 'state');
  }

  async detect(): Promise<DetectorResult[]> {
    const results: DetectorResult[] = [];

    if (!fs.existsSync(this.stateDir)) {
      return results;
    }

    let files: string[];
    try {
      files = fs.readdirSync(this.stateDir).filter((f) => f.endsWith('.json'));
    } catch {
      return results;
    }

    // Build dependency graph
    const stateMap = new Map<number, AgentStateFile>();
    for (const file of files) {
      const state = readJsonSafe<AgentStateFile>(path.join(this.stateDir, file));
      if (state?.issueNumber) {
        stateMap.set(state.issueNumber, state);
      }
    }

    for (const [issueNum, state] of stateMap) {
      // Check if any blockers have been resolved (state === 'done')
      if (state.blockedBy && state.blockedBy.length > 0) {
        const resolvedBlockers: number[] = [];
        const unresolvedBlockers: number[] = [];

        for (const blocker of state.blockedBy) {
          const blockerState = stateMap.get(blocker);
          if (!blockerState || blockerState.state === 'done') {
            resolvedBlockers.push(blocker);
          } else {
            unresolvedBlockers.push(blocker);
          }
        }

        if (resolvedBlockers.length > 0 && unresolvedBlockers.length === 0) {
          results.push({
            detector: 'dependency',
            severity: 'info',
            message: `Issue #${issueNum} is now unblocked -- all blockers resolved (${resolvedBlockers.map((b) => `#${b}`).join(', ')})`,
            issueNumber: issueNum,
            actionLabel: 'View Ready Queue',
            actionCommand: 'agentx.readyQueue',
          });
        } else if (resolvedBlockers.length > 0) {
          results.push({
            detector: 'dependency',
            severity: 'info',
            message: `Issue #${issueNum}: blockers ${resolvedBlockers.map((b) => `#${b}`).join(', ')} resolved; still blocked by ${unresolvedBlockers.map((b) => `#${b}`).join(', ')}`,
            issueNumber: issueNum,
          });
        }
      }
    }

    // Detect circular dependencies
    const circularChains = this.findCircularDependencies(stateMap);
    for (const chain of circularChains) {
      results.push({
        detector: 'dependency',
        severity: 'critical',
        message: `Circular dependency detected: ${chain.map((n) => `#${n}`).join(' -> ')}`,
        issueNumber: chain[0],
        actionLabel: 'View Dependencies',
        actionCommand: 'agentx.readyQueue',
      });
    }

    return results;
  }

  /**
   * Finds circular dependency chains using DFS with visited/recStack tracking.
   */
  private findCircularDependencies(
    stateMap: Map<number, AgentStateFile>,
  ): number[][] {
    const visited = new Set<number>();
    const recStack = new Set<number>();
    const chains: number[][] = [];

    const dfs = (node: number, pathSoFar: number[]): void => {
      if (recStack.has(node)) {
        // Found a cycle -- extract the loop portion
        const cycleStart = pathSoFar.indexOf(node);
        if (cycleStart >= 0) {
          chains.push([...pathSoFar.slice(cycleStart), node]);
        }
        return;
      }
      if (visited.has(node)) { return; }

      visited.add(node);
      recStack.add(node);
      pathSoFar.push(node);

      const state = stateMap.get(node);
      if (state?.blockedBy) {
        for (const dep of state.blockedBy) {
          if (stateMap.has(dep)) {
            dfs(dep, [...pathSoFar]);
          }
        }
      }

      recStack.delete(node);
    };

    for (const issueNum of stateMap.keys()) {
      if (!visited.has(issueNum)) {
        dfs(issueNum, []);
      }
    }

    return chains;
  }
}
