export type HarnessThreadStatus = 'active' | 'complete' | 'cancelled' | 'blocked' | 'waiting-approval';
export type HarnessTurnStatus = 'active' | 'complete' | 'cancelled';
export type HarnessItemType =
  | 'command'
  | 'iteration'
  | 'status'
  | 'summary'
  | 'approval'
  | 'gate'
  | 'note'
  | 'checkpoint'
  | 'team-task';
export type HarnessEvidenceType =
  | 'loop-output'
  | 'iteration-summary'
  | 'status-check'
  | 'completion'
  | 'implementation'
  | 'verification'
  | 'runtime'
  | 'security'
  | 'review'
  | 'command-output';
export type HarnessEvidenceClass = 'implementation' | 'verification' | 'runtime' | 'security' | 'review';
export type HarnessEvidenceStatus = 'pass' | 'fail' | 'partial';
export type HarnessContractStatus = 'Proposed' | 'Active' | 'Blocked' | 'Complete' | 'Superseded';
export type HarnessContractFindingSeverity = 'high' | 'medium' | 'low';
export type HarnessStopGateStatus = 'passed' | 'blocked';
export type HarnessPermissionRisk = 'low' | 'medium' | 'high' | 'critical';
export type HarnessPermissionDecision = 'allow' | 'confirm' | 'block';
export type HarnessTeamTaskStatus = 'planned' | 'active' | 'blocked' | 'review' | 'complete';

export interface HarnessThread {
  readonly id: string;
  readonly title: string;
  readonly taskType: string;
  readonly status: HarnessThreadStatus;
  readonly issueNumber?: number | null;
  readonly planPath?: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly currentTurnId?: string;
}

export interface HarnessTurn {
  readonly id: string;
  readonly threadId: string;
  readonly sequence: number;
  readonly status: HarnessTurnStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly summary?: string;
}

export interface HarnessItem {
  readonly id: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly itemType: HarnessItemType;
  readonly summary: string;
  readonly createdAt: string;
  readonly metadata?: Record<string, string | number | boolean | null>;
}

export interface HarnessEvidence {
  readonly id: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly evidenceType: HarnessEvidenceType;
  readonly evidenceClass?: HarnessEvidenceClass;
  readonly summary: string;
  readonly artifactPath?: string;
  readonly command?: string;
  readonly exitCode?: number;
  readonly status?: HarnessEvidenceStatus;
  readonly metadata?: Record<string, string | number | boolean | null>;
  readonly createdAt: string;
}

export interface HarnessStopGateCheck {
  readonly id: string;
  readonly label: string;
  readonly passed: boolean;
  readonly summary: string;
}

export interface HarnessStopGate {
  readonly id: string;
  readonly threadId?: string;
  readonly turnId?: string;
  readonly status: HarnessStopGateStatus;
  readonly checks: ReadonlyArray<HarnessStopGateCheck>;
  readonly blockers: ReadonlyArray<string>;
  readonly createdAt: string;
}

export interface HarnessContextBudgetSnapshot {
  readonly id: string;
  readonly threadId?: string;
  readonly turnId?: string;
  readonly maxTokens: number;
  readonly estimatedTokens: number;
  readonly percentUsed: number;
  readonly summary: string;
  readonly createdAt: string;
}

export interface HarnessNote {
  readonly id: string;
  readonly threadId?: string;
  readonly scope: string;
  readonly content: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HarnessCheckpoint {
  readonly id: string;
  readonly threadId?: string;
  readonly turnId?: string;
  readonly title: string;
  readonly summary: string;
  readonly filePaths: ReadonlyArray<string>;
  readonly restoreHint?: string;
  readonly createdAt: string;
}

export interface HarnessPermissionRecord {
  readonly id: string;
  readonly command: string;
  readonly risk: HarnessPermissionRisk;
  readonly decision: HarnessPermissionDecision;
  readonly reason: string;
  readonly createdAt: string;
}

export interface HarnessTeamTask {
  readonly id: string;
  readonly teamId: string;
  readonly title: string;
  readonly assignee: string;
  readonly status: HarnessTeamTaskStatus;
  readonly scope: string;
  readonly evidencePath?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HarnessContract {
  readonly id: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly contractPath: string;
  readonly evidencePath?: string;
  readonly status: HarnessContractStatus;
  readonly title: string;
  readonly summary?: string;
  readonly nextAction?: string;
  readonly blocker?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HarnessContractFinding {
  readonly id: string;
  readonly contractId: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly severity: HarnessContractFindingSeverity;
  readonly summary: string;
  readonly nextAction: string;
  readonly createdAt: string;
}

export interface HarnessState {
  readonly version: 1;
  readonly threads: ReadonlyArray<HarnessThread>;
  readonly turns: ReadonlyArray<HarnessTurn>;
  readonly items: ReadonlyArray<HarnessItem>;
  readonly evidence: ReadonlyArray<HarnessEvidence>;
  readonly contracts: ReadonlyArray<HarnessContract>;
  readonly contractFindings: ReadonlyArray<HarnessContractFinding>;
  readonly stopGates: ReadonlyArray<HarnessStopGate>;
  readonly contextBudgets: ReadonlyArray<HarnessContextBudgetSnapshot>;
  readonly notes: ReadonlyArray<HarnessNote>;
  readonly checkpoints: ReadonlyArray<HarnessCheckpoint>;
  readonly permissionRecords: ReadonlyArray<HarnessPermissionRecord>;
  readonly teamTasks: ReadonlyArray<HarnessTeamTask>;
}

export interface StartHarnessThreadOptions {
  readonly taskType: string;
  readonly title: string;
  readonly prompt?: string;
  readonly completionCriteria?: string;
  readonly issueNumber?: number | null;
  readonly planPath?: string;
}

export interface CompleteHarnessThreadOptions {
  readonly status: Extract<HarnessThreadStatus, 'complete' | 'cancelled' | 'blocked'>;
  readonly summary: string;
}

export interface SetHarnessContractStateOptions {
  readonly contractPath: string;
  readonly evidencePath?: string;
  readonly status: HarnessContractStatus;
  readonly title: string;
  readonly summary?: string;
  readonly nextAction?: string;
  readonly blocker?: string;
}

export interface AddHarnessContractFindingOptions {
  readonly contractPath: string;
  readonly severity: HarnessContractFindingSeverity;
  readonly summary: string;
  readonly nextAction: string;
}

export interface RecordHarnessEvidenceOptions {
  readonly evidenceType: HarnessEvidenceType;
  readonly evidenceClass?: HarnessEvidenceClass;
  readonly summary: string;
  readonly artifactPath?: string;
  readonly command?: string;
  readonly exitCode?: number;
  readonly status?: HarnessEvidenceStatus;
  readonly metadata?: Record<string, string | number | boolean | null>;
}

export interface EvaluateHarnessStopGateOptions {
  readonly requiredEvidenceClasses?: ReadonlyArray<HarnessEvidenceClass>;
  readonly requireLoopComplete?: boolean;
  readonly maxContextPercent?: number;
}

export interface RecordHarnessContextBudgetOptions {
  readonly maxTokens?: number;
  readonly summary?: string;
}

export interface UpsertHarnessNoteOptions {
  readonly scope: string;
  readonly content: string;
}

export interface CreateHarnessCheckpointOptions {
  readonly title: string;
  readonly summary: string;
  readonly filePaths: ReadonlyArray<string>;
  readonly restoreHint?: string;
}

export interface RecordHarnessPermissionOptions {
  readonly command: string;
}

export interface UpsertHarnessTeamTaskOptions {
  readonly id?: string;
  readonly teamId: string;
  readonly title: string;
  readonly assignee: string;
  readonly status: HarnessTeamTaskStatus;
  readonly scope: string;
  readonly evidencePath?: string;
}
