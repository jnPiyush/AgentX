import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import {
  GitStorageProvider,
  GitStorageError,
  DATA_BRANCH,
} from '../../utils/gitStorageProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

/** Create a fresh Git repository in a temp directory. */
function createTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-git-test-'));
  execFileSync('git', ['init', dir], { encoding: 'utf-8' });
  // Configure user for commits
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test User'], { encoding: 'utf-8' });
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com'], { encoding: 'utf-8' });
  return dir;
}

function makeProvider(dir?: string): GitStorageProvider {
  return new GitStorageProvider({ workspaceRoot: dir ?? tmpDir });
}

// ---------------------------------------------------------------------------
// GitStorageProvider
// ---------------------------------------------------------------------------

describe('GitStorageProvider', () => {

  // Setup / teardown -- scoped to this describe block
  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // init()
  // -------------------------------------------------------------------------

  describe('init()', () => {
    it('creates the orphan data branch on first call', async () => {
      const provider = makeProvider();
      await provider.init();

      assert.ok(provider.branchExists(), 'data branch should exist after init');
    });

    it('is idempotent (safe to call multiple times)', async () => {
      const provider = makeProvider();
      await provider.init();
      await provider.init();
      await provider.init();

      assert.ok(provider.branchExists());
    });

    it('throws GitStorageError for non-Git directories', async () => {
      const plainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-nongit-'));
      const provider = makeProvider(plainDir);

      try {
        await provider.init();
        assert.fail('Should have thrown GitStorageError');
      } catch (err) {
        assert.ok(err instanceof GitStorageError, 'should be GitStorageError');
        assert.ok((err as GitStorageError).operation === 'init');
      } finally {
        fs.rmSync(plainDir, { recursive: true, force: true });
      }
    });
  });

  // -------------------------------------------------------------------------
  // readFile() / writeFile()
  // -------------------------------------------------------------------------

  describe('readFile() / writeFile()', () => {
    it('returns null for non-existent file', async () => {
      const provider = makeProvider();
      const result = await provider.readFile('nonexistent.json');
      assert.strictEqual(result, null);
    });

    it('writes and reads back a file', async () => {
      const provider = makeProvider();
      const content = '{"hello":"world"}';

      await provider.writeFile('test.json', content, 'test: write file');
      const read = await provider.readFile('test.json');

      assert.strictEqual(read, content);
    });

    it('overwrites an existing file', async () => {
      const provider = makeProvider();

      await provider.writeFile('data.txt', 'version 1', 'test: v1');
      await provider.writeFile('data.txt', 'version 2', 'test: v2');

      const read = await provider.readFile('data.txt');
      assert.strictEqual(read, 'version 2');
    });

    it('handles nested directory paths', async () => {
      const provider = makeProvider();
      const content = 'nested content';

      await provider.writeFile('a/b/c/deep.txt', content, 'test: nested');
      const read = await provider.readFile('a/b/c/deep.txt');

      assert.strictEqual(read, content);
    });

    it('does not create files in the working tree', async () => {
      const provider = makeProvider();
      await provider.writeFile('data.json', '{}', 'test: no working tree');

      assert.ok(!fs.existsSync(path.join(tmpDir, 'data.json')),
        'file should NOT exist in working tree');
    });
  });

  // -------------------------------------------------------------------------
  // readJson() / writeJson()
  // -------------------------------------------------------------------------

  describe('readJson() / writeJson()', () => {
    it('reads and writes JSON objects', async () => {
      const provider = makeProvider();
      const data = { name: 'agentx', version: 1, tags: ['a', 'b'] };

      await provider.writeJson('config.json', data, 'test: json');
      const read = await provider.readJson<typeof data>('config.json');

      assert.deepStrictEqual(read, data);
    });

    it('returns null for non-existent JSON file', async () => {
      const provider = makeProvider();
      const result = await provider.readJson('missing.json');
      assert.strictEqual(result, null);
    });

    it('returns null for invalid JSON content', async () => {
      const provider = makeProvider();
      await provider.writeFile('bad.json', 'not json', 'test: bad json');
      const result = await provider.readJson('bad.json');
      assert.strictEqual(result, null);
    });
  });

  // -------------------------------------------------------------------------
  // writeFiles() (atomic multi-file commit)
  // -------------------------------------------------------------------------

  describe('writeFiles()', () => {
    it('writes multiple files in a single commit', async () => {
      const provider = makeProvider();

      const commitHash = await provider.writeFiles([
        { filePath: 'issues/1.json', content: '{"number":1}' },
        { filePath: 'issues/2.json', content: '{"number":2}' },
        { filePath: 'state/status.json', content: '{"active":true}' },
      ], 'test: batch write');

      assert.ok(commitHash.length > 0, 'should return a commit hash');

      const file1 = await provider.readJson<{ number: number }>('issues/1.json');
      const file2 = await provider.readJson<{ number: number }>('issues/2.json');
      const state = await provider.readJson<{ active: boolean }>('state/status.json');

      assert.strictEqual(file1?.number, 1);
      assert.strictEqual(file2?.number, 2);
      assert.strictEqual(state?.active, true);
    });

    it('throws for empty entries array', async () => {
      const provider = makeProvider();

      try {
        await provider.writeFiles([], 'test: empty');
        assert.fail('Should throw for empty entries');
      } catch (err) {
        assert.ok(err instanceof GitStorageError);
      }
    });
  });

  // -------------------------------------------------------------------------
  // deleteFile() / deleteFiles()
  // -------------------------------------------------------------------------

  describe('deleteFile()', () => {
    it('deletes an existing file', async () => {
      const provider = makeProvider();
      await provider.writeFile('to-delete.txt', 'bye', 'test: create');

      const hash = await provider.deleteFile('to-delete.txt', 'test: delete');
      assert.ok(hash, 'should return a commit hash');

      const read = await provider.readFile('to-delete.txt');
      assert.strictEqual(read, null, 'file should be deleted');
    });

    it('returns null when deleting non-existent file', async () => {
      const provider = makeProvider();
      const hash = await provider.deleteFile('nope.txt', 'test: delete missing');
      assert.strictEqual(hash, null);
    });
  });

  // -------------------------------------------------------------------------
  // listFiles()
  // -------------------------------------------------------------------------

  describe('listFiles()', () => {
    it('lists files in a directory', async () => {
      const provider = makeProvider();

      await provider.writeFiles([
        { filePath: 'issues/1.json', content: '{}' },
        { filePath: 'issues/2.json', content: '{}' },
        { filePath: 'state/status.json', content: '{}' },
      ], 'test: setup');

      const issueFiles = await provider.listFiles('issues');
      assert.ok(issueFiles.length === 2, `expected 2 files, got ${issueFiles.length}`);
      assert.ok(issueFiles.includes('1.json'), 'should include 1.json');
      assert.ok(issueFiles.includes('2.json'), 'should include 2.json');
    });

    it('returns empty array for non-existent directory', async () => {
      const provider = makeProvider();
      const files = await provider.listFiles('nonexistent');
      assert.deepStrictEqual(files, []);
    });
  });

  // -------------------------------------------------------------------------
  // fileExists()
  // -------------------------------------------------------------------------

  describe('fileExists()', () => {
    it('returns true for existing file', async () => {
      const provider = makeProvider();
      await provider.writeFile('exists.txt', 'hi', 'test: create');

      assert.ok(await provider.fileExists('exists.txt'));
    });

    it('returns false for non-existent file', async () => {
      const provider = makeProvider();
      await provider.init();

      assert.ok(!(await provider.fileExists('missing.txt')));
    });
  });

  // -------------------------------------------------------------------------
  // getHistory()
  // -------------------------------------------------------------------------

  describe('getHistory()', () => {
    it('returns commit history for a file', async () => {
      const provider = makeProvider();

      await provider.writeFile('log.txt', 'v1', 'first version');
      await provider.writeFile('log.txt', 'v2', 'second version');
      await provider.writeFile('log.txt', 'v3', 'third version');

      const history = await provider.getHistory('log.txt');
      assert.ok(history.length === 3, `expected 3 entries, got ${history.length}`);
      assert.strictEqual(history[0].message, 'third version');
      assert.strictEqual(history[2].message, 'first version');
    });

    it('respects the limit parameter', async () => {
      const provider = makeProvider();

      await provider.writeFile('log.txt', 'v1', 'msg1');
      await provider.writeFile('log.txt', 'v2', 'msg2');
      await provider.writeFile('log.txt', 'v3', 'msg3');

      const history = await provider.getHistory('log.txt', 2);
      assert.strictEqual(history.length, 2);
    });

    it('returns empty for non-existent file', async () => {
      const provider = makeProvider();
      await provider.init();
      const history = await provider.getHistory('nofile.txt');
      assert.deepStrictEqual(history, []);
    });
  });

  // -------------------------------------------------------------------------
  // getLatestCommit()
  // -------------------------------------------------------------------------

  describe('getLatestCommit()', () => {
    it('returns latest commit hash', async () => {
      const provider = makeProvider();
      const writeHash = await provider.writeFile('test.txt', 'data', 'test');
      const latest = await provider.getLatestCommit();

      assert.strictEqual(latest, writeHash);
    });
  });

  // -------------------------------------------------------------------------
  // getBranch()
  // -------------------------------------------------------------------------

  describe('getBranch()', () => {
    it('returns the configured branch name', () => {
      const provider = makeProvider();
      assert.strictEqual(provider.getBranch(), DATA_BRANCH);
    });

    it('supports custom branch names', () => {
      const provider = new GitStorageProvider({
        workspaceRoot: tmpDir,
        branch: 'custom/data',
      });
      assert.strictEqual(provider.getBranch(), 'custom/data');
    });
  });

  // -------------------------------------------------------------------------
  // Working tree isolation
  // -------------------------------------------------------------------------

  describe('working tree isolation', () => {
    it('does not affect the working tree on writes', async () => {
      const provider = makeProvider();
      // Create a file in the working tree first
      fs.writeFileSync(path.join(tmpDir, 'local.txt'), 'keep me');

      await provider.writeFile('data.json', '{}', 'test: isolation');

      // Working tree file should still exist
      assert.ok(fs.existsSync(path.join(tmpDir, 'local.txt')));
      assert.strictEqual(
        fs.readFileSync(path.join(tmpDir, 'local.txt'), 'utf-8'),
        'keep me',
      );

      // Data file should NOT be in working tree
      assert.ok(!fs.existsSync(path.join(tmpDir, 'data.json')));
    });
  });
});
