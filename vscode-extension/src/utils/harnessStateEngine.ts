import * as fs from 'fs';
import * as path from 'path';
import {
 createDefaultState,
 findMarkdownFiles,
 getActiveThread,
 getActiveTurn,
 makeId,
 nowIso,
 replaceThread,
 replaceTurn,
 toPosixRelative,
 writeHarnessState,
} from './harnessStateInternals';
import type {
 AddHarnessContractFindingOptions,
 CreateHarnessCheckpointOptions,
 CompleteHarnessThreadOptions,
 EvaluateHarnessStopGateOptions,
 HarnessContract,
 HarnessContractFinding,
 HarnessContextBudgetSnapshot,
 HarnessEvidence,
 HarnessEvidenceClass,
 HarnessItem,
 HarnessPermissionRecord,
 HarnessState,
 HarnessStopGate,
 HarnessStopGateCheck,
 HarnessTeamTask,
 HarnessThread,
 HarnessTurn,
 RecordHarnessContextBudgetOptions,
 RecordHarnessEvidenceOptions,
 RecordHarnessPermissionOptions,
 SetHarnessContractStateOptions,
 StartHarnessThreadOptions,
 UpsertHarnessNoteOptions,
 UpsertHarnessTeamTaskOptions,
} from './harnessStateTypes';

const DEFAULT_CONTEXT_WINDOW_TOKENS = 200_000;
const DEFAULT_STOP_GATE_CLASSES: readonly HarnessEvidenceClass[] = [
 'implementation',
 'verification',
 'review',
];

export function readHarnessState(workspaceRoot: string): HarnessState {
 const filePath = path.join(workspaceRoot, '.agentx', 'state', 'harness-state.json');
 try {
  if (!fs.existsSync(filePath)) {
   return createDefaultState();
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<HarnessState>;
  return {
   version: 1,
   threads: parsed.threads ?? [],
   turns: parsed.turns ?? [],
   items: parsed.items ?? [],
   evidence: parsed.evidence ?? [],
   contracts: parsed.contracts ?? [],
   contractFindings: parsed.contractFindings ?? [],
  stopGates: parsed.stopGates ?? [],
  contextBudgets: parsed.contextBudgets ?? [],
  notes: parsed.notes ?? [],
  checkpoints: parsed.checkpoints ?? [],
  permissionRecords: parsed.permissionRecords ?? [],
  teamTasks: parsed.teamTasks ?? [],
  };
 } catch {
  return createDefaultState();
 }
}

function getCurrentThreadAndTurn(state: HarnessState): {
 readonly thread?: HarnessThread;
 readonly turn?: HarnessTurn;
} {
 const thread = getActiveThread(state) ?? [...state.threads].reverse()[0];
 const turn = thread ? getActiveTurn(state, thread.id) : undefined;
 return { thread, turn };
}

function toEvidenceClass(type: RecordHarnessEvidenceOptions['evidenceType']): HarnessEvidenceClass | undefined {
 if (type === 'implementation' || type === 'verification' || type === 'runtime' || type === 'security' || type === 'review') {
  return type;
 }
 return undefined;
}

function estimateTokens(text: string): number {
 return Math.ceil(text.length / 4);
}

function readLoopComplete(workspaceRoot: string): boolean {
 const loopStatePath = path.join(workspaceRoot, '.agentx', 'state', 'loop-state.json');
 try {
  if (!fs.existsSync(loopStatePath)) {
  return false;
  }
  const parsed = JSON.parse(fs.readFileSync(loopStatePath, 'utf-8')) as { active?: boolean; status?: string };
  return parsed.active === false && parsed.status === 'complete';
 } catch {
  return false;
 }
}

function classifyCommand(command: string): Pick<HarnessPermissionRecord, 'risk' | 'decision' | 'reason'> {
 const normalized = command.trim().toLowerCase();
 if (/\b(git\s+reset\s+--hard|git\s+push\s+--force|rm\s+-rf\s+\/|drop\s+database|drop\s+table|truncate\s+table)\b/.test(normalized)) {
  return { risk: 'critical', decision: 'block', reason: 'Command matches a destructive operation.' };
 }
 if (/\b(vsce\s+publish|npm\s+publish|az\s+deployment|terraform\s+apply|kubectl\s+apply|docker\s+push)\b/.test(normalized)) {
  return { risk: 'high', decision: 'confirm', reason: 'Command can publish, deploy, or mutate external infrastructure.' };
 }
 if (/\b(git\s+commit|git\s+push|npm\s+install|pnpm\s+install|yarn\s+install)\b/.test(normalized)) {
  return { risk: 'medium', decision: 'confirm', reason: 'Command mutates repository or dependencies.' };
 }
 return { risk: 'low', decision: 'allow', reason: 'Command is not known to be destructive.' };
}

export function getActiveHarnessContract(workspaceRoot: string): HarnessContract | undefined {
 const state = readHarnessState(workspaceRoot);
 const thread = getActiveThread(state);
 if (!thread) {
  return undefined;
 }

 return [...state.contracts]
  .reverse()
  .find((contract) => contract.threadId === thread.id && contract.status !== 'Superseded');
}

export function getHarnessContractFindings(
 workspaceRoot: string,
 contractId: string,
): HarnessContractFinding[] {
 const state = readHarnessState(workspaceRoot);
 return state.contractFindings.filter((finding) => finding.contractId === contractId);
}

export function findDefaultExecutionPlanPath(workspaceRoot: string): string | undefined {
 // Canonical location per docs/WORKFLOW.md is docs/execution/plans/.
 // Legacy docs/plans/ is checked as a fallback for older workspaces.
 const canonicalPlansDir = path.join(workspaceRoot, 'docs', 'execution', 'plans');
 const legacyPlansDir = path.join(workspaceRoot, 'docs', 'plans');
 const candidates: string[] = [];
 findMarkdownFiles(canonicalPlansDir, candidates);

 if (candidates.length === 0) {
  findMarkdownFiles(legacyPlansDir, candidates);
 }

 if (candidates.length === 0) {
  const docsDir = path.join(workspaceRoot, 'docs');
  findMarkdownFiles(docsDir, candidates);
 }

 return candidates
  .map((candidate) => toPosixRelative(workspaceRoot, candidate))
  .sort()
  .find(
   (candidate) =>
    candidate.startsWith('docs/execution/plans/') ||
    candidate.startsWith('docs/plans/') ||
    /(^|\/)EXEC-PLAN.+\.md$/i.test(candidate),
  );
}

export function startHarnessThread(
 workspaceRoot: string,
 options: StartHarnessThreadOptions,
): HarnessThread {
 let state = readHarnessState(workspaceRoot);
 const existingThread = getActiveThread(state);
 if (existingThread) {
  return existingThread;
 }

 const createdAt = nowIso();
 const threadId = makeId('thread', state.threads.length);
 const turnId = makeId('turn', state.turns.length);
 const planPath = options.planPath ?? findDefaultExecutionPlanPath(workspaceRoot);

 const thread: HarnessThread = {
  id: threadId,
  title: options.title,
  taskType: options.taskType,
  status: 'active',
  issueNumber: options.issueNumber,
  planPath,
  startedAt: createdAt,
  updatedAt: createdAt,
  currentTurnId: turnId,
 };

 const turn: HarnessTurn = {
  id: turnId,
  threadId,
  sequence: 1,
  status: 'active',
  startedAt: createdAt,
 };

 const items: HarnessItem[] = [
  {
   id: makeId('item', state.items.length),
   threadId,
   turnId,
   itemType: 'command',
   summary: `Started ${options.taskType} harness thread`,
   createdAt,
   metadata: {
    completionCriteria: options.completionCriteria ?? null,
    prompt: options.prompt ?? null,
   },
  },
 ];

 if (planPath) {
  items.push({
   id: makeId('item', state.items.length + items.length),
   threadId,
   turnId,
   itemType: 'status',
   summary: `Linked execution plan: ${planPath}`,
   createdAt,
  });
 }

 const evidence: HarnessEvidence = {
  id: makeId('evidence', state.evidence.length),
  threadId,
  turnId,
  evidenceType: 'loop-output',
  summary: options.prompt ?? options.title,
  createdAt,
 };

 state = {
  ...state,
  threads: [...state.threads, thread],
  turns: [...state.turns, turn],
  items: [...state.items, ...items],
  evidence: [...state.evidence, evidence],
 };

 writeHarnessState(workspaceRoot, state);
 return thread;
}

export function recordHarnessStatusCheck(workspaceRoot: string, summary: string): void {
 const state = readHarnessState(workspaceRoot);
 const thread = getActiveThread(state);
 if (!thread) {
  return;
 }

 const turn = getActiveTurn(state, thread.id);
 const createdAt = nowIso();
 const nextState: HarnessState = {
  ...state,
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: thread.id,
    turnId: turn?.id,
    itemType: 'status',
    summary,
    createdAt,
   },
  ],
  evidence: [
   ...state.evidence,
   {
    id: makeId('evidence', state.evidence.length),
    threadId: thread.id,
    turnId: turn?.id,
    evidenceType: 'status-check',
    summary,
    createdAt,
   },
  ],
 };

 writeHarnessState(workspaceRoot, nextState);
}

export function recordHarnessIteration(workspaceRoot: string, summary: string): void {
 let state = readHarnessState(workspaceRoot);
 let thread = getActiveThread(state);

 if (!thread) {
  thread = startHarnessThread(workspaceRoot, {
   taskType: 'iterative-loop',
   title: 'Iterative Loop',
   prompt: summary,
  });
  state = readHarnessState(workspaceRoot);
 }

 const currentTurn = getActiveTurn(state, thread.id);
 const createdAt = nowIso();
 let nextState = state;

 let nextSequence = 1;
 if (currentTurn) {
  nextSequence = currentTurn.sequence + 1;
  nextState = replaceTurn(nextState, {
   ...currentTurn,
   status: 'complete',
   completedAt: createdAt,
   summary,
  });
 }

 const nextTurn: HarnessTurn = {
  id: makeId('turn', nextState.turns.length),
  threadId: thread.id,
  sequence: nextSequence,
  status: 'active',
  startedAt: createdAt,
 };

 nextState = replaceThread(nextState, {
  ...thread,
  updatedAt: createdAt,
  currentTurnId: nextTurn.id,
 });

 nextState = {
  ...nextState,
  turns: [...nextState.turns, nextTurn],
  items: [
   ...nextState.items,
   {
    id: makeId('item', nextState.items.length),
    threadId: thread.id,
    turnId: nextTurn.id,
    itemType: 'iteration',
    summary,
    createdAt,
   },
  ],
  evidence: [
   ...nextState.evidence,
   {
    id: makeId('evidence', nextState.evidence.length),
    threadId: thread.id,
    turnId: nextTurn.id,
    evidenceType: 'iteration-summary',
    summary,
    createdAt,
   },
  ],
 };

 writeHarnessState(workspaceRoot, nextState);
}

export function setHarnessContractState(
 workspaceRoot: string,
 options: SetHarnessContractStateOptions,
): HarnessContract {
 const state = readHarnessState(workspaceRoot);
 const thread = getActiveThread(state);
 if (!thread) {
  throw new Error('No active harness thread exists for storing contract state.');
 }

 const turn = getActiveTurn(state, thread.id);
 const createdAt = nowIso();
 const existing = [...state.contracts]
  .reverse()
  .find((contract) => contract.threadId === thread.id && contract.contractPath === options.contractPath);

 const contract: HarnessContract = existing
  ? {
   ...existing,
   evidencePath: options.evidencePath ?? existing.evidencePath,
   status: options.status,
   title: options.title,
   summary: options.summary,
   nextAction: options.nextAction,
   blocker: options.blocker,
   turnId: turn?.id,
   updatedAt: createdAt,
  }
  : {
   id: makeId('contract', state.contracts.length),
   threadId: thread.id,
   turnId: turn?.id,
   contractPath: options.contractPath,
   evidencePath: options.evidencePath,
   status: options.status,
   title: options.title,
   summary: options.summary,
   nextAction: options.nextAction,
   blocker: options.blocker,
   createdAt,
   updatedAt: createdAt,
  };

 const contracts = existing
  ? state.contracts.map((candidate) => candidate.id === existing.id ? contract : candidate)
  : [...state.contracts, contract];

 writeHarnessState(workspaceRoot, {
  ...state,
  contracts,
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: thread.id,
    turnId: turn?.id,
    itemType: 'status',
    summary: `Contract ${options.status}: ${options.contractPath}`,
    createdAt,
    metadata: {
     contractPath: options.contractPath,
     nextAction: options.nextAction ?? null,
     blocker: options.blocker ?? null,
    },
   },
  ],
 });

 return contract;
}

export function addHarnessContractFinding(
 workspaceRoot: string,
 options: AddHarnessContractFindingOptions,
): HarnessContractFinding {
 const contract = getActiveHarnessContract(workspaceRoot);
 if (!contract || contract.contractPath !== options.contractPath) {
  throw new Error('The requested contract is not the active harness contract.');
 }

 const state = readHarnessState(workspaceRoot);
 const createdAt = nowIso();
 const finding: HarnessContractFinding = {
  id: makeId('contract-finding', state.contractFindings.length),
  contractId: contract.id,
  threadId: contract.threadId,
  turnId: contract.turnId,
  severity: options.severity,
  summary: options.summary,
  nextAction: options.nextAction,
  createdAt,
 };

 writeHarnessState(workspaceRoot, {
  ...state,
  contractFindings: [...state.contractFindings, finding],
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: contract.threadId,
    turnId: contract.turnId,
    itemType: 'status',
    summary: `Contract finding ${options.severity}: ${options.summary}`,
    createdAt,
    metadata: {
     contractPath: options.contractPath,
     nextAction: options.nextAction,
    },
   },
  ],
 });

 return finding;
}

export function recordHarnessEvidence(
 workspaceRoot: string,
 options: RecordHarnessEvidenceOptions,
): HarnessEvidence {
 const state = readHarnessState(workspaceRoot);
 const { thread, turn } = getCurrentThreadAndTurn(state);
 const createdAt = nowIso();
 const evidenceClass = options.evidenceClass ?? toEvidenceClass(options.evidenceType);
 const evidence: HarnessEvidence = {
  id: makeId('evidence', state.evidence.length),
  threadId: thread?.id ?? 'workspace',
  turnId: turn?.id,
  evidenceType: options.evidenceType,
  evidenceClass,
  summary: options.summary,
  artifactPath: options.artifactPath,
  command: options.command,
  exitCode: options.exitCode,
  status: options.status,
  metadata: options.metadata,
  createdAt,
 };

 writeHarnessState(workspaceRoot, {
  ...state,
  evidence: [...state.evidence, evidence],
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: evidence.threadId,
    turnId: evidence.turnId,
    itemType: 'status',
    summary: `Evidence recorded: ${options.summary}`,
    createdAt,
    metadata: {
     evidenceClass: evidenceClass ?? null,
     artifactPath: options.artifactPath ?? null,
    },
   },
  ],
 });

 return evidence;
}

export function recordHarnessContextBudget(
 workspaceRoot: string,
 options: RecordHarnessContextBudgetOptions = {},
): HarnessContextBudgetSnapshot {
 const state = readHarnessState(workspaceRoot);
 const { thread, turn } = getCurrentThreadAndTurn(state);
 const maxTokens = options.maxTokens ?? DEFAULT_CONTEXT_WINDOW_TOKENS;
 const estimatedTokens = estimateTokens(JSON.stringify(state));
 const percentUsed = Math.min(100, Math.round((estimatedTokens / maxTokens) * 100));
 const createdAt = nowIso();
 const snapshot: HarnessContextBudgetSnapshot = {
  id: makeId('context-budget', state.contextBudgets.length),
  threadId: thread?.id,
  turnId: turn?.id,
  maxTokens,
  estimatedTokens,
  percentUsed,
  summary: options.summary ?? `${percentUsed}% of ${maxTokens} token context budget estimated`,
  createdAt,
 };

 writeHarnessState(workspaceRoot, {
  ...state,
  contextBudgets: [...state.contextBudgets, snapshot],
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: thread?.id ?? 'workspace',
    turnId: turn?.id,
    itemType: 'status',
    summary: `Context budget: ${snapshot.summary}`,
    createdAt,
    metadata: { percentUsed, estimatedTokens, maxTokens },
   },
  ],
 });

 return snapshot;
}

export function evaluateHarnessStopGate(
 workspaceRoot: string,
 options: EvaluateHarnessStopGateOptions = {},
): HarnessStopGate {
 const state = readHarnessState(workspaceRoot);
 const { thread, turn } = getCurrentThreadAndTurn(state);
 const requiredClasses = options.requiredEvidenceClasses ?? DEFAULT_STOP_GATE_CLASSES;
 const evidenceClasses = new Set(state.evidence.map((entry) => entry.evidenceClass).filter(Boolean));
 const latestBudget = [...state.contextBudgets].reverse()[0];
 const checks: HarnessStopGateCheck[] = [];

 for (const requiredClass of requiredClasses) {
  checks.push({
   id: `evidence-${requiredClass}`,
   label: `${requiredClass} evidence`,
   passed: evidenceClasses.has(requiredClass),
   summary: evidenceClasses.has(requiredClass)
    ? `${requiredClass} evidence is recorded`
    : `${requiredClass} evidence is missing`,
  });
 }

 if (options.requireLoopComplete) {
  const loopComplete = readLoopComplete(workspaceRoot);
  checks.push({
   id: 'loop-complete',
   label: 'Loop complete',
   passed: loopComplete,
   summary: loopComplete ? 'Quality loop is complete' : 'Quality loop is not complete',
  });
 }

 if (typeof options.maxContextPercent === 'number') {
  checks.push({
   id: 'context-budget',
   label: 'Context budget',
   passed: !!latestBudget && latestBudget.percentUsed <= options.maxContextPercent,
   summary: latestBudget
    ? `Context budget is ${latestBudget.percentUsed}% used`
    : 'No context budget snapshot is recorded',
  });
 }

 const blockers = checks.filter((check) => !check.passed).map((check) => check.summary);
 const createdAt = nowIso();
 const gate: HarnessStopGate = {
  id: makeId('stop-gate', state.stopGates.length),
  threadId: thread?.id,
  turnId: turn?.id,
  status: blockers.length === 0 ? 'passed' : 'blocked',
  checks,
  blockers,
  createdAt,
 };

 writeHarnessState(workspaceRoot, {
  ...state,
  stopGates: [...state.stopGates, gate],
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: thread?.id ?? 'workspace',
    turnId: turn?.id,
    itemType: 'gate',
    summary: `Stop gate ${gate.status}`,
    createdAt,
    metadata: { blockerCount: blockers.length },
   },
  ],
 });

 return gate;
}

export function upsertHarnessNote(workspaceRoot: string, options: UpsertHarnessNoteOptions): void {
 const state = readHarnessState(workspaceRoot);
 const { thread } = getCurrentThreadAndTurn(state);
 const createdAt = nowIso();
 const existing = state.notes.find((note) => note.threadId === thread?.id && note.scope === options.scope);
 const note = existing
  ? { ...existing, content: options.content, updatedAt: createdAt }
  : {
   id: makeId('note', state.notes.length),
   threadId: thread?.id,
   scope: options.scope,
   content: options.content,
   createdAt,
   updatedAt: createdAt,
  };

 writeHarnessState(workspaceRoot, {
  ...state,
  notes: existing ? state.notes.map((candidate) => candidate.id === existing.id ? note : candidate) : [...state.notes, note],
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: thread?.id ?? 'workspace',
    itemType: 'note',
    summary: `Note updated: ${options.scope}`,
    createdAt,
   },
  ],
 });
}

export function createHarnessCheckpoint(
 workspaceRoot: string,
 options: CreateHarnessCheckpointOptions,
): void {
 const state = readHarnessState(workspaceRoot);
 const { thread, turn } = getCurrentThreadAndTurn(state);
 const createdAt = nowIso();
 const checkpoint = {
  id: makeId('checkpoint', state.checkpoints.length),
  threadId: thread?.id,
  turnId: turn?.id,
  title: options.title,
  summary: options.summary,
  filePaths: options.filePaths,
  restoreHint: options.restoreHint,
  createdAt,
 };

 writeHarnessState(workspaceRoot, {
  ...state,
  checkpoints: [...state.checkpoints, checkpoint],
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: thread?.id ?? 'workspace',
    turnId: turn?.id,
    itemType: 'checkpoint',
    summary: `Checkpoint created: ${options.title}`,
    createdAt,
   },
  ],
 });
}

export function recordHarnessPermission(
 workspaceRoot: string,
 options: RecordHarnessPermissionOptions,
): HarnessPermissionRecord {
 const state = readHarnessState(workspaceRoot);
 const createdAt = nowIso();
 const classification = classifyCommand(options.command);
 const record: HarnessPermissionRecord = {
  id: makeId('permission', state.permissionRecords.length),
  command: options.command,
  ...classification,
  createdAt,
 };

 writeHarnessState(workspaceRoot, {
  ...state,
  permissionRecords: [...state.permissionRecords, record],
 });

 return record;
}

export function upsertHarnessTeamTask(
 workspaceRoot: string,
 options: UpsertHarnessTeamTaskOptions,
): HarnessTeamTask {
 const state = readHarnessState(workspaceRoot);
 const createdAt = nowIso();
 const existing = options.id ? state.teamTasks.find((task) => task.id === options.id) : undefined;
 const task: HarnessTeamTask = existing
  ? { ...existing, ...options, updatedAt: createdAt }
  : {
   id: options.id ?? makeId('team-task', state.teamTasks.length),
   teamId: options.teamId,
   title: options.title,
   assignee: options.assignee,
   status: options.status,
   scope: options.scope,
   evidencePath: options.evidencePath,
   createdAt,
   updatedAt: createdAt,
  };

 writeHarnessState(workspaceRoot, {
  ...state,
  teamTasks: existing ? state.teamTasks.map((candidate) => candidate.id === existing.id ? task : candidate) : [...state.teamTasks, task],
 });

 return task;
}

export function completeHarnessThread(
 workspaceRoot: string,
 options: CompleteHarnessThreadOptions,
): void {
 const state = readHarnessState(workspaceRoot);
 const thread = getActiveThread(state);
 if (!thread) {
  return;
 }

 const turn = getActiveTurn(state, thread.id);
 const createdAt = nowIso();
 let nextState = state;

 if (turn) {
  nextState = replaceTurn(nextState, {
   ...turn,
   status: options.status === 'cancelled' ? 'cancelled' : 'complete',
   completedAt: createdAt,
   summary: options.summary,
  });
 }

 nextState = replaceThread(nextState, {
  ...thread,
  status: options.status,
  updatedAt: createdAt,
  currentTurnId: undefined,
 });

 nextState = {
  ...nextState,
  items: [
   ...nextState.items,
   {
    id: makeId('item', nextState.items.length),
    threadId: thread.id,
    turnId: turn?.id,
    itemType: 'summary',
    summary: options.summary,
    createdAt,
   },
  ],
  evidence: [
   ...nextState.evidence,
   {
    id: makeId('evidence', nextState.evidence.length),
    threadId: thread.id,
    turnId: turn?.id,
    evidenceType: 'completion',
    summary: options.summary,
    createdAt,
   },
  ],
 };

 writeHarnessState(workspaceRoot, nextState);
}

export function getHarnessStatusDisplay(workspaceRoot: string): string {
 const state = readHarnessState(workspaceRoot);
 const activeThread = getActiveThread(state);
 if (activeThread) {
  const activeTurn = getActiveTurn(state, activeThread.id);
  return `Harness ${activeThread.taskType} turn ${activeTurn?.sequence ?? 0} [active]`;
 }

 const latestThread = [...state.threads].reverse()[0];
 if (!latestThread) {
  return 'No harness';
 }

 return `Harness ${latestThread.status} (${state.threads.length} thread${state.threads.length === 1 ? '' : 's'})`;
}
