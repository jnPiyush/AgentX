import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  clearRegistryCache,
  loadSkillsRegistry,
  loadTemplatesRegistry,
  resolveRegistryAssetPath,
} from '../../utils/registryLoader';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

describe('registryLoader', () => {
  let wsRoot: string;
  let extRoot: string;

  beforeEach(() => {
    wsRoot = makeTempDir('agentx-rl-ws-');
    extRoot = makeTempDir('agentx-rl-ext-');
    clearRegistryCache();
  });

  afterEach(() => {
    fs.rmSync(wsRoot, { recursive: true, force: true });
    fs.rmSync(extRoot, { recursive: true, force: true });
    clearRegistryCache();
  });

  describe('loadSkillsRegistry', () => {
    it('returns null when no registry exists in workspace or extension', () => {
      const result = loadSkillsRegistry(wsRoot, extRoot);
      assert.equal(result, null);
    });

    it('loads a valid skills.json from the workspace', () => {
      const skillsPath = path.join(wsRoot, '.github', 'registries', 'skills.json');
      writeJson(skillsPath, {
        $schemaVersion: 1,
        totalCount: 1,
        skills: [
          {
            id: 'arch/security',
            name: 'security',
            category: 'architecture',
            path: '.github/skills/architecture/security/SKILL.md',
            description: 'Security skill',
          },
        ],
      });

      const result = loadSkillsRegistry(wsRoot, extRoot);
      assert.notEqual(result, null);
      assert.equal(result!.totalCount, 1);
      assert.equal(result!.skills.length, 1);
      assert.equal(result!.skills[0].name, 'security');
    });

    it('falls back to the extension bundle when workspace registry is missing', () => {
      const skillsPath = path.join(extRoot, '.github', 'agentx', 'registries', 'skills.json');
      writeJson(skillsPath, {
        $schemaVersion: 1,
        totalCount: 1,
        skills: [
          {
            id: 'dev/testing',
            name: 'testing',
            category: 'development',
            path: '.github/skills/development/testing/SKILL.md',
            description: 'Testing skill',
          },
        ],
      });

      const result = loadSkillsRegistry(wsRoot, extRoot);
      assert.notEqual(result, null);
      assert.equal(result!.skills[0].name, 'testing');
    });

    it('returns null when JSON is malformed', () => {
      const skillsPath = path.join(wsRoot, '.github', 'registries', 'skills.json');
      fs.mkdirSync(path.dirname(skillsPath), { recursive: true });
      fs.writeFileSync(skillsPath, '{ not valid json', 'utf8');

      const result = loadSkillsRegistry(wsRoot, extRoot);
      assert.equal(result, null);
    });
  });

  describe('loadTemplatesRegistry', () => {
    it('returns null when registry does not exist', () => {
      assert.equal(loadTemplatesRegistry(wsRoot, extRoot), null);
    });

    it('loads a valid templates.json from the workspace', () => {
      const templatesPath = path.join(wsRoot, '.github', 'registries', 'templates.json');
      writeJson(templatesPath, {
        $schemaVersion: 1,
        totalCount: 1,
        templates: [
          { name: 'ADR', path: '.github/templates/ADR-TEMPLATE.md' },
        ],
      });

      const result = loadTemplatesRegistry(wsRoot, extRoot);
      assert.notEqual(result, null);
      assert.equal(result!.templates.length, 1);
      assert.equal(result!.templates[0].name, 'ADR');
    });
  });

  describe('resolveRegistryAssetPath', () => {
    it('returns workspace-rooted path when file exists in workspace', () => {
      const rel = '.github/templates/ADR-TEMPLATE.md';
      const wsFile = path.join(wsRoot, '.github', 'templates', 'ADR-TEMPLATE.md');
      fs.mkdirSync(path.dirname(wsFile), { recursive: true });
      fs.writeFileSync(wsFile, '# ADR', 'utf8');

      const resolved = resolveRegistryAssetPath(wsRoot, extRoot, rel);
      assert.equal(resolved, wsFile);
    });

    it('returns extension-bundle path when only the bundle has the file', () => {
      const rel = '.github/templates/PRD-TEMPLATE.md';
      const extFile = path.join(extRoot, '.github', 'agentx', 'templates', 'PRD-TEMPLATE.md');
      fs.mkdirSync(path.dirname(extFile), { recursive: true });
      fs.writeFileSync(extFile, '# PRD', 'utf8');

      const resolved = resolveRegistryAssetPath(wsRoot, extRoot, rel);
      assert.equal(resolved, extFile);
    });

    it('returns null when neither workspace nor extension has the file', () => {
      const resolved = resolveRegistryAssetPath(wsRoot, extRoot, '.github/templates/MISSING.md');
      assert.equal(resolved, null);
    });
  });

  describe('cache behavior', () => {
    it('caches a successful load and clearRegistryCache resets it', () => {
      const skillsPath = path.join(wsRoot, '.github', 'registries', 'skills.json');
      writeJson(skillsPath, {
        $schemaVersion: 1,
        totalCount: 0,
        skills: [],
      });

      const first = loadSkillsRegistry(wsRoot, extRoot);
      assert.notEqual(first, null);

      // Replace file content but keep file present. Cache validates by mtime,
      // so an explicit mtime bump triggers a reload.
      writeJson(skillsPath, {
        $schemaVersion: 1,
        totalCount: 2,
        skills: [],
      });
      const future = new Date(Date.now() + 5000);
      fs.utimesSync(skillsPath, future, future);

      const second = loadSkillsRegistry(wsRoot, extRoot);
      assert.equal(second!.totalCount, 2);

      // After clearing, the loader still returns the latest content.
      clearRegistryCache();
      const third = loadSkillsRegistry(wsRoot, extRoot);
      assert.equal(third!.totalCount, 2);
    });
  });
});
