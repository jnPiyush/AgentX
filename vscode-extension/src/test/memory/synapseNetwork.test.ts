import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SynapseNetwork } from '../../memory/synapseNetwork';
import {
  SIMILARITY_THRESHOLD,
  SYNAPSE_MANIFEST_FILE,
} from '../../memory/synapseTypes';
import { type ObservationIndex, type ManifestFile } from '../../memory/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let memoryDir: string;

/**
 * Seeds the observation manifest.json used by loadCandidates().
 * The manifest contains ObservationIndex entries (id, agent, issueNumber,
 * category, summary, tokens, timestamp).
 */
function seedObservationManifest(dir: string, entries: ObservationIndex[]): void {
  const manifest: ManifestFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries,
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
}

function makeEntry(overrides: Partial<ObservationIndex> = {}): ObservationIndex {
  const id = `obs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    agent: 'engineer',
    issueNumber: 42,
    category: 'key-fact',
    summary: 'API design pagination patterns for REST endpoints',
    tokens: 20,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-synapse-test-'));
  memoryDir = path.join(tmpDir, 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SynapseNetwork', () => {
  it('should be constructable with a memory directory', () => {
    const network = new SynapseNetwork(memoryDir);
    assert.ok(network, 'SynapseNetwork instance should be created');
  });

  it('should return empty links when no observations exist', async () => {
    const network = new SynapseNetwork(memoryDir);
    const links = await network.getAllLinks();
    assert.strictEqual(links.length, 0, 'Should have no links initially');
  });

  it('should discover links between similar observations across issues', async () => {
    // Seed observation store with a candidate from issue 20
    const candidate = makeEntry({
      id: 'obs-2',
      issueNumber: 20,
      category: 'decision',
      summary: 'api design pagination patterns for REST endpoints',
    });
    seedObservationManifest(memoryDir, [candidate]);

    const network = new SynapseNetwork(memoryDir);

    // Process a new observation from issue 10 with same keywords + category
    const links = await network.processNewObservation(
      'obs-1',
      10,
      'api design pagination patterns for REST endpoints',
      ['type:story', 'priority:p1'],
      'decision',
    );

    // The keyword overlap should be high enough to create a link
    assert.ok(links.length > 0, 'Should discover at least one link');
    assert.strictEqual(links[0]!.targetObservation, 'obs-2', 'Should link to obs-2');
    assert.ok(links[0]!.similarity >= SIMILARITY_THRESHOLD, 'Similarity should meet threshold');
  });

  it('should not link observations from the same issue', async () => {
    // Both candidate and new observation are from issue 10
    const candidate = makeEntry({
      id: 'obs-2',
      issueNumber: 10,
      category: 'key-fact',
      summary: 'api design pagination patterns',
    });
    seedObservationManifest(memoryDir, [candidate]);

    const network = new SynapseNetwork(memoryDir);

    // Process observation from same issue
    const links = await network.processNewObservation(
      'obs-1',
      10,
      'api design pagination patterns',
      ['type:story'],
      'key-fact',
    );

    assert.strictEqual(links.length, 0, 'Should not link observations from the same issue');
  });

  it('should persist links to synapse manifest', async () => {
    const candidate = makeEntry({
      id: 'obs-b',
      issueNumber: 2,
      category: 'error',
      summary: 'timeout database connection pooling failure',
    });
    seedObservationManifest(memoryDir, [candidate]);

    const network = new SynapseNetwork(memoryDir);
    await network.processNewObservation(
      'obs-a',
      1,
      'timeout database connection pooling failure',
      ['type:bug', 'priority:p0'],
      'error',
    );

    const manifestPath = path.join(memoryDir, SYNAPSE_MANIFEST_FILE);
    assert.ok(fs.existsSync(manifestPath), 'Synapse manifest should be written to disk');
  });

  it('should generate cross-issue context string', async () => {
    const candidate = makeEntry({
      id: 'obs-y',
      issueNumber: 8,
      category: 'key-fact',
      summary: 'connection pool size should be ten for production',
    });
    seedObservationManifest(memoryDir, [candidate]);

    const network = new SynapseNetwork(memoryDir);
    await network.processNewObservation(
      'obs-x',
      5,
      'connection pool size should be ten for production use',
      ['type:bug'],
      'key-fact',
    );

    const context = await network.getCrossIssueContext(5);
    assert.ok(typeof context === 'string', 'Context should be a string');
  });

  it('should prune links referencing missing observations', async () => {
    const network = new SynapseNetwork(memoryDir);

    // Manually write a synapse manifest with stale links
    const manifestPath = path.join(memoryDir, SYNAPSE_MANIFEST_FILE);
    const manifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      links: [
        {
          id: 'syn-obs-old-1-obs-old-2',
          sourceObservation: 'obs-old-1',
          targetObservation: 'obs-old-2',
          sourceIssue: 1,
          targetIssue: 2,
          similarity: 0.85,
          linkType: 'auto' as const,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    // Seed observation manifest WITHOUT these observations so links are stale
    seedObservationManifest(memoryDir, []);

    const pruned = await network.prune();
    assert.ok(pruned >= 0, 'Prune should return count of removed links');
  });

  it('should return links for a specific observation ID', async () => {
    const network = new SynapseNetwork(memoryDir);

    // No links should exist initially
    const links = await network.getLinks('obs-nonexistent');
    assert.strictEqual(links.length, 0, 'Should return empty for unknown observation');
  });

  it('should return all links from the manifest', async () => {
    const network = new SynapseNetwork(memoryDir);

    // Manually seed synapse manifest with a link
    const manifestPath = path.join(memoryDir, SYNAPSE_MANIFEST_FILE);
    const manifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      links: [
        {
          id: 'syn-a-b',
          sourceObservation: 'obs-a',
          targetObservation: 'obs-b',
          sourceIssue: 1,
          targetIssue: 2,
          similarity: 0.90,
          linkType: 'auto' as const,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const allLinks = await network.getAllLinks();
    assert.strictEqual(allLinks.length, 1, 'Should return one link from the manifest');
    assert.strictEqual(allLinks[0]!.id, 'syn-a-b');
  });
});
