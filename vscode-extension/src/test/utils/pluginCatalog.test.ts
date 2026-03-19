import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  getLatestCompatibleRelease,
  isAgentXVersionSupported,
  parsePluginManifest,
  parsePluginRegistryIndex,
  readPluginManifestFromDir,
  summarizePluginManifest,
} from '../../utils/pluginCatalog';

describe('pluginCatalog - parsePluginManifest', () => {
  it('should parse legacy plugin manifests and infer capabilities from type', () => {
    const manifest = parsePluginManifest({
      name: 'convert-docs',
      version: '1.0.0',
      description: 'Convert docs',
      type: 'tool',
      entry: {
        pwsh: 'convert-docs.ps1',
      },
    });

    assert.ok(manifest);
    assert.equal(manifest.name, 'convert-docs');
    assert.deepEqual(manifest.capabilities, ['tool']);
    assert.equal(manifest.entry?.pwsh, 'convert-docs.ps1');

    const summary = summarizePluginManifest(manifest, 'fallback-name');
    assert.equal(summary.pluginId, 'convert-docs');
    assert.equal(summary.qualifiedId, 'convert-docs');
    assert.equal(summary.label, 'convert-docs');
  });

  it('should parse v2 publication metadata when present', () => {
    const manifest = parsePluginManifest({
      schemaVersion: 2,
      name: 'convert-docs',
      id: 'convert-docs',
      publisher: 'agentx-labs',
      displayName: 'Convert Docs',
      version: '2.1.0',
      description: 'Convert Markdown to docx',
      type: 'tool',
      capabilities: ['tool', 'workflow'],
      entry: {
        pwsh: 'convert-docs.ps1',
        bash: 'convert-docs.sh',
      },
      engines: {
        agentx: '>=8.4.0 <9.0.0',
      },
      permissions: {
        filesystem: 'read-write',
        network: 'allowlist',
        remoteHosts: ['github.com'],
      },
      distribution: {
        artifactUrl: 'https://example.test/convert-docs.zip',
        checksum: 'sha256:abc123',
        signatureMode: 'optional',
      },
    });

    assert.ok(manifest);
    assert.equal(manifest.publisher, 'agentx-labs');
    assert.equal(manifest.displayName, 'Convert Docs');
    assert.equal(manifest.engines?.agentx, '>=8.4.0 <9.0.0');
    assert.equal(manifest.permissions?.filesystem, 'read-write');
    assert.deepEqual(manifest.permissions?.remoteHosts, ['github.com']);
    assert.equal(manifest.distribution?.artifactUrl, 'https://example.test/convert-docs.zip');

    const summary = summarizePluginManifest(manifest, 'fallback-name');
    assert.equal(summary.pluginId, 'convert-docs');
    assert.equal(summary.qualifiedId, 'agentx-labs.convert-docs');
    assert.equal(summary.label, 'Convert Docs');
    assert.equal(summary.agentxRange, '>=8.4.0 <9.0.0');
  });

  it('should return undefined for invalid manifest payloads', () => {
    assert.equal(parsePluginManifest(undefined), undefined);
    assert.equal(parsePluginManifest({ name: 'missing-fields' }), undefined);
  });
});

describe('pluginCatalog - readPluginManifestFromDir', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-plugin-catalog-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('should read plugin.json from a plugin directory', () => {
    fs.writeFileSync(path.join(tempRoot, 'plugin.json'), JSON.stringify({
      name: 'convert-docs',
      version: '1.0.0',
      description: 'Convert docs',
      type: 'tool',
      entry: { pwsh: 'convert-docs.ps1' },
    }), 'utf-8');

    const manifest = readPluginManifestFromDir(tempRoot);
    assert.ok(manifest);
    assert.equal(manifest.name, 'convert-docs');
  });
});

describe('pluginCatalog - isAgentXVersionSupported', () => {
  it('should accept empty or wildcard ranges', () => {
    assert.equal(isAgentXVersionSupported(undefined, '8.4.5'), true);
    assert.equal(isAgentXVersionSupported('*', '8.4.5'), true);
  });

  it('should support exact versions and comparator ranges', () => {
    assert.equal(isAgentXVersionSupported('8.4.5', '8.4.5'), true);
    assert.equal(isAgentXVersionSupported('>=8.4.0 <9.0.0', '8.4.5'), true);
    assert.equal(isAgentXVersionSupported('>=8.5.0 <9.0.0', '8.4.5'), false);
  });

  it('should support wildcard, caret, tilde, and alternates', () => {
    assert.equal(isAgentXVersionSupported('8.4.x', '8.4.5'), true);
    assert.equal(isAgentXVersionSupported('8.x', '8.4.5'), true);
    assert.equal(isAgentXVersionSupported('^8.4.0', '8.4.5'), true);
    assert.equal(isAgentXVersionSupported('~8.4.0', '8.4.5'), true);
    assert.equal(isAgentXVersionSupported('^8.5.0 || ^9.0.0', '8.4.5'), false);
    assert.equal(isAgentXVersionSupported('^8.4.0 || ^9.0.0', '8.4.5'), true);
  });
});

describe('pluginCatalog - parsePluginRegistryIndex', () => {
  it('should parse registry entries and resolve the latest compatible release', () => {
    const registry = parsePluginRegistryIndex({
      schemaVersion: 1,
      generatedAt: '2026-03-18T00:00:00Z',
      plugins: [
        {
          publisher: 'agentx-labs',
          pluginId: 'convert-docs',
          displayName: 'Convert Docs',
          description: 'Convert Markdown to docx',
          latestVersion: '2.0.0',
          releases: [
            {
              version: '1.5.0',
              artifactUrl: 'https://example.test/1.5.0.zip',
              engines: { agentx: '>=8.3.0 <8.4.0' },
            },
            {
              version: '2.0.0',
              artifactUrl: 'https://example.test/2.0.0.zip',
              pluginPath: '.agentx/plugins/convert-docs',
              engines: { agentx: '>=8.4.0 <9.0.0' },
            },
          ],
        },
      ],
    });

    assert.ok(registry);
    assert.equal(registry.plugins.length, 1);
    assert.equal(registry.plugins[0].qualifiedId, 'agentx-labs.convert-docs');

    const release = getLatestCompatibleRelease(registry.plugins[0], '8.4.5');
    assert.ok(release);
    assert.equal(release.version, '2.0.0');
    assert.equal(release.pluginPath, '.agentx/plugins/convert-docs');
  });

  it('should reject registry payloads with no valid plugin entries', () => {
    assert.equal(parsePluginRegistryIndex({ schemaVersion: 1, plugins: [] }), undefined);
  });
});
