import { FrontierContext } from '../frontierContext';
import {
  buildTaskBundleListArgs,
  parseTaskBundle,
  parseTaskBundlePromotionResult,
  parseTaskBundleRecords,
  renderTaskBundlesText,
} from './taskBundlesEngine';
import type {
  TaskBundleCreateInput,
  TaskBundleListOptions,
  TaskBundlePromoteInput,
  TaskBundlePromotionResult,
  TaskBundleRecord,
  TaskBundleResolveInput,
} from './task-bundlesTypes';

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

export type {
  TaskBundleCreateInput,
  TaskBundleListOptions,
  TaskBundlePromoteInput,
  TaskBundlePromotionResult,
  TaskBundlePromotionTarget,
  TaskBundleRecord,
  TaskBundleResolveInput,
  TaskBundleState,
} from './task-bundlesTypes';

export { renderTaskBundlesText };

export async function listTaskBundles(
  agentx: FrontierContext,
  options: TaskBundleListOptions = {},
): Promise<TaskBundleRecord[]> {
  const output = await agentx.runCli('bundle', buildTaskBundleListArgs(options));
  return parseTaskBundleRecords(output);
}

export async function getTaskBundle(agentx: FrontierContext, bundleId: string): Promise<TaskBundleRecord> {
  const output = await agentx.runCli('bundle', ['get', '--id', bundleId, '--json']);
  return parseTaskBundle(output);
}

export async function createTaskBundle(
  agentx: FrontierContext,
  input: TaskBundleCreateInput,
): Promise<TaskBundleRecord> {
  const args = ['create', '--title-base64', encodeBase64(input.title), '--json'];
  if (input.summary) {
    args.push('--summary-base64', encodeBase64(input.summary));
  }
  if (input.issue) {
    args.push('--issue', String(input.issue));
  }
  if (input.plan) {
    args.push('--plan', input.plan);
  }
  if (input.owner) {
    args.push('--owner', input.owner);
  }
  if (input.priority) {
    args.push('--priority', input.priority);
  }
  if (input.promotionMode) {
    args.push('--promotion-mode', input.promotionMode);
  }
  if (input.evidence && input.evidence.length > 0) {
    args.push('--evidence', input.evidence.join(','));
  }
  if (input.tags && input.tags.length > 0) {
    args.push('--tags', input.tags.join(','));
  }

  const output = await agentx.runCli('bundle', args);
  return parseTaskBundle(output);
}

export async function resolveTaskBundle(
  agentx: FrontierContext,
  input: TaskBundleResolveInput,
): Promise<TaskBundleRecord> {
  const args = ['resolve', '--id', input.bundleId, '--json'];
  if (input.state) {
    args.push('--state', input.state);
  }
  if (input.archiveReason) {
    args.push('--archive-reason-base64', encodeBase64(input.archiveReason));
  }

  const output = await agentx.runCli('bundle', args);
  return parseTaskBundle(output);
}

export async function promoteTaskBundle(
  agentx: FrontierContext,
  input: TaskBundlePromoteInput,
): Promise<TaskBundlePromotionResult> {
  const args = ['promote', '--id', input.bundleId, '--json'];
  if (input.target) {
    args.push('--target', input.target);
  }

  const output = await agentx.runCli('bundle', args);
  return parseTaskBundlePromotionResult(output);
}