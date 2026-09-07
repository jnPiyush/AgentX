import { strict as assert } from 'assert';
import {
  createTaskBundle,
  listTaskBundles,
  promoteTaskBundle,
  resolveTaskBundle,
} from '../../taskBundles/task-bundles';
import { AgentXContext } from '../../agentxContext';

describe('task bundles facade', () => {
  it('builds create arguments and parses the returned bundle', async () => {
    const calls: Array<{ readonly subcommand: string; readonly args: ReadonlyArray<string> }> = [];
    const agentx = {
      runCli: async (subcommand: string, args: string[]) => {
        calls.push({ subcommand, args });
        return JSON.stringify({
          bundle_id: 'bundle-1',
          title: 'Slice work',
          summary: 'Track a narrow slice',
          parent_context: { issue_number: 42, source: 'explicit-issue' },
          priority: 'p1',
          state: 'Ready',
          owner: 'engineer',
          evidence_links: ['issue:#42'],
          promotion_mode: 'story_candidate',
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
          tags: [],
        });
      },
    } as unknown as AgentXContext;

    const bundle = await createTaskBundle(agentx, {
      title: 'Slice work',
      summary: 'Track a narrow slice',
      issue: 42,
      promotionMode: 'story_candidate',
      priority: 'p1',
    });

    assert.equal(bundle.bundleId, 'bundle-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].subcommand, 'bundle');
    assert.ok(calls[0].args.includes('create'));
    assert.ok(calls[0].args.includes('--title-base64'));
    assert.ok(calls[0].args.includes('--json'));
  });

  it('lists bundles through the shared CLI contract', async () => {
    const agentx = {
      runCli: async () => JSON.stringify([
        {
          bundle_id: 'bundle-1',
          title: 'Slice work',
          summary: '',
          parent_context: { issue_number: 42, source: 'explicit-issue' },
          priority: 'p1',
          state: 'Ready',
          owner: 'engineer',
          evidence_links: ['issue:#42'],
          promotion_mode: 'none',
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
          tags: [],
        },
      ]),
    } as unknown as AgentXContext;

    const bundles = await listTaskBundles(agentx, { all: true });
    assert.equal(bundles.length, 1);
    assert.equal(bundles[0].bundleId, 'bundle-1');
  });

  it('parses resolve results from the CLI contract', async () => {
    const agentx = {
      runCli: async () => JSON.stringify({
        bundle_id: 'bundle-1',
        title: 'Slice work',
        summary: '',
        parent_context: { issue_number: 42, source: 'explicit-issue' },
        priority: 'p1',
        state: 'Archived',
        owner: 'engineer',
        evidence_links: ['issue:#42'],
        promotion_mode: 'none',
        created_at: '2026-03-13T00:00:00.000Z',
        updated_at: '2026-03-13T00:10:00.000Z',
        archive_reason: 'Merged into parent',
        tags: [],
      }),
    } as unknown as AgentXContext;

    const bundle = await resolveTaskBundle(agentx, {
      bundleId: 'bundle-1',
      state: 'Archived',
      archiveReason: 'Merged into parent',
    });
    assert.equal(bundle.state, 'Archived');
    assert.equal(bundle.archiveReason, 'Merged into parent');
  });

  it('parses promotion results from the CLI contract', async () => {
    const agentx = {
      runCli: async () => JSON.stringify({
        bundle: {
          bundle_id: 'bundle-1',
          title: 'Slice work',
          summary: '',
          parent_context: { issue_number: 42, source: 'explicit-issue' },
          priority: 'p1',
          state: 'Archived',
          owner: 'engineer',
          evidence_links: ['issue:#42'],
          promotion_mode: 'story_candidate',
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:20:00.000Z',
          tags: [],
          promotion_history: {
            promotion_decision: 'story',
            target_type: 'story',
            target_reference: '#73',
            duplicate_check_result: 'linked-existing',
            searchable_status: 'archived',
          },
        },
        targetType: 'story',
        targetReference: '#73',
        duplicateCheckResult: 'linked-existing',
      }),
    } as unknown as AgentXContext;

    const result = await promoteTaskBundle(agentx, { bundleId: 'bundle-1', target: 'story' });
    assert.equal(result.targetReference, '#73');
    assert.equal(result.duplicateCheckResult, 'linked-existing');
    assert.equal(result.bundle.promotionHistory?.targetReference, '#73');
  });
});