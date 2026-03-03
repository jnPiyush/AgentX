// ---------------------------------------------------------------------------
// Tests -- Codebase Analysis Tools
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  analyzeCo,
  findDependencies,
  mapArchitecture,
  CodebaseStats,
  DependencyInfo,
  ArchitectureMap,
} from '../../agentic/codebaseAnalysis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ca-test-'));
}

function writeFile(base: string, relPath: string, content: string): void {
  const full = path.join(base, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* best effort */ }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CodebaseAnalysis', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // -----------------------------------------------------------------------
  // analyzeCo
  // -----------------------------------------------------------------------
  describe('analyzeCo', () => {
    it('should return zero stats for a non-existent directory', () => {
      const stats = analyzeCo(path.join(tmpDir, 'nonexistent'));
      assert.equal(stats.totalFiles, 0);
      assert.equal(stats.totalDirectories, 0);
      assert.equal(stats.totalLines, 0);
      assert.deepEqual(stats.technologies, []);
      assert.ok(stats.tree.includes('not found'));
    });

    it('should count files and lines', () => {
      writeFile(tmpDir, 'app.ts', 'const x = 1;\nconst y = 2;\nconst z = 3;\n');
      writeFile(tmpDir, 'utils.ts', 'export function foo() {}\n');

      const stats = analyzeCo(tmpDir);
      assert.equal(stats.totalFiles, 2);
      assert.ok(stats.totalLines >= 4, `Expected >= 4 lines, got ${stats.totalLines}`);
      assert.ok(stats.filesByExtension['.ts'] >= 2, 'Should count .ts files');
    });

    it('should detect technologies from file extensions', () => {
      writeFile(tmpDir, 'main.py', 'print("hello")\n');
      writeFile(tmpDir, 'app.ts', 'console.log("hi");\n');
      writeFile(tmpDir, 'style.css', 'body { color: red; }\n');

      const stats = analyzeCo(tmpDir);
      assert.ok(stats.technologies.includes('Python'), 'Should detect Python');
      assert.ok(stats.technologies.includes('TypeScript'), 'Should detect TypeScript');
      assert.ok(stats.technologies.includes('CSS'), 'Should detect CSS');
    });

    it('should build a directory tree', () => {
      writeFile(tmpDir, 'src/index.ts', 'export {};\n');
      writeFile(tmpDir, 'src/utils/helper.ts', 'export {};\n');

      const stats = analyzeCo(tmpDir, 3);
      assert.ok(stats.tree.includes('src/'), 'Tree should include src/');
      assert.ok(stats.tree.includes('index.ts'), 'Tree should include index.ts');
    });

    it('should ignore node_modules and .git directories', () => {
      writeFile(tmpDir, 'src/app.ts', 'export {};\n');
      writeFile(tmpDir, 'node_modules/pkg/index.js', 'module.exports = {};\n');
      writeFile(tmpDir, '.git/config', '[core]\n');

      const stats = analyzeCo(tmpDir);
      assert.equal(stats.totalFiles, 1, 'Should ignore node_modules and .git files');
      assert.ok(!stats.tree.includes('node_modules'), 'Tree should not include node_modules');
    });

    it('should respect maxDepth', () => {
      writeFile(tmpDir, 'a/b/c/d/e/deep.ts', 'export {};\n');

      const shallow = analyzeCo(tmpDir, 1);
      const deep = analyzeCo(tmpDir, 10);

      // Shallow tree should show fewer entries than deep
      assert.ok(
        shallow.tree.split('\n').length <= deep.tree.split('\n').length,
        'Deeper traversal should show more entries',
      );
    });

    it('should count directories', () => {
      writeFile(tmpDir, 'src/a.ts', ';\n');
      writeFile(tmpDir, 'lib/b.ts', ';\n');
      writeFile(tmpDir, 'test/c.ts', ';\n');

      const stats = analyzeCo(tmpDir);
      assert.ok(stats.totalDirectories >= 3, `Expected >= 3 dirs, got ${stats.totalDirectories}`);
    });
  });

  // -----------------------------------------------------------------------
  // findDependencies
  // -----------------------------------------------------------------------
  describe('findDependencies', () => {
    it('should return empty array for a bare directory', () => {
      const deps = findDependencies(tmpDir);
      assert.deepEqual(deps, []);
    });

    it('should parse package.json dependencies', () => {
      writeFile(tmpDir, 'package.json', JSON.stringify({
        dependencies: { express: '^4.18.0', lodash: '4.17.21' },
        devDependencies: { mocha: '^10.0.0' },
      }));

      const deps = findDependencies(tmpDir);
      assert.equal(deps.length, 1);
      assert.equal(deps[0].manager, 'npm');
      assert.equal(deps[0].dependencies['express'], '^4.18.0');
      assert.equal(deps[0].devDependencies['mocha'], '^10.0.0');
    });

    it('should parse requirements.txt', () => {
      writeFile(tmpDir, 'requirements.txt', 'flask>=2.0\nrequests==2.28.1\n# comment\nnumpy\n');

      const deps = findDependencies(tmpDir);
      const pip = deps.find((d) => d.manager === 'pip');
      assert.ok(pip, 'Should detect pip');
      assert.ok(pip!.dependencies['flask'], 'Should parse flask');
      assert.ok(pip!.dependencies['requests'], 'Should parse requests');
      assert.ok(pip!.dependencies['numpy'], 'Should parse numpy');
    });

    it('should parse go.mod', () => {
      writeFile(tmpDir, 'go.mod', [
        'module example.com/myapp',
        '',
        'go 1.21',
        '',
        'require (',
        '    github.com/gin-gonic/gin v1.9.1',
        '    github.com/stretchr/testify v1.8.4',
        ')',
      ].join('\n'));

      const deps = findDependencies(tmpDir);
      const goDep = deps.find((d) => d.manager === 'go');
      assert.ok(goDep, 'Should detect go.mod');
      assert.equal(goDep!.dependencies['github.com/gin-gonic/gin'], 'v1.9.1');
    });

    it('should parse Cargo.toml', () => {
      writeFile(tmpDir, 'Cargo.toml', [
        '[package]',
        'name = "myapp"',
        '',
        '[dependencies]',
        'serde = "1.0"',
        'tokio = "1.28"',
        '',
        '[dev-dependencies]',
        'criterion = "0.5"',
      ].join('\n'));

      const deps = findDependencies(tmpDir);
      const cargo = deps.find((d) => d.manager === 'cargo');
      assert.ok(cargo, 'Should detect Cargo.toml');
      assert.equal(cargo!.dependencies['serde'], '1.0');
      assert.equal(cargo!.devDependencies['criterion'], '0.5');
    });

    it('should detect multiple package managers', () => {
      writeFile(tmpDir, 'package.json', JSON.stringify({ dependencies: {} }));
      writeFile(tmpDir, 'requirements.txt', 'flask\n');

      const deps = findDependencies(tmpDir);
      assert.ok(deps.length >= 2, 'Should detect both npm and pip');
    });
  });

  // -----------------------------------------------------------------------
  // mapArchitecture
  // -----------------------------------------------------------------------
  describe('mapArchitecture', () => {
    it('should identify entry points', () => {
      writeFile(tmpDir, 'src/index.ts', 'export {};\n');
      writeFile(tmpDir, 'src/main.py', 'if __name__ == "":\n  pass\n');

      const arch = mapArchitecture(tmpDir);
      assert.ok(arch.entryPoints.some((e) => e.includes('index.ts')), 'Should find index.ts');
      assert.ok(arch.entryPoints.some((e) => e.includes('main.py')), 'Should find main.py');
    });

    it('should identify config files', () => {
      writeFile(tmpDir, 'tsconfig.json', '{}');
      writeFile(tmpDir, 'package.json', '{}');
      writeFile(tmpDir, '.gitignore', 'node_modules\n');

      const arch = mapArchitecture(tmpDir);
      assert.ok(arch.configFiles.some((c) => c.includes('tsconfig.json')), 'Should find tsconfig.json');
      assert.ok(arch.configFiles.some((c) => c.includes('package.json')), 'Should find package.json');
    });

    it('should identify test directories', () => {
      writeFile(tmpDir, 'test/unit.ts', ';\n');
      writeFile(tmpDir, 'tests/integration.ts', ';\n');
      writeFile(tmpDir, 'e2e/smoke.ts', ';\n');

      const arch = mapArchitecture(tmpDir);
      assert.ok(arch.testDirectories.length >= 2, `Expected >= 2 test dirs, got ${arch.testDirectories.length}`);
    });

    it('should identify documentation files', () => {
      writeFile(tmpDir, 'README.md', '# Test\n');
      writeFile(tmpDir, 'CHANGELOG.md', '# Changes\n');
      writeFile(tmpDir, 'docs/guide.md', '# Guide\n');

      const arch = mapArchitecture(tmpDir);
      assert.ok(arch.docFiles.some((d) => d.includes('README.md')), 'Should find README.md');
    });

    it('should identify CI files', () => {
      writeFile(tmpDir, '.github/workflows/ci.yml', 'name: CI\n');

      const arch = mapArchitecture(tmpDir);
      assert.ok(arch.ciFiles.length >= 1, 'Should detect CI workflow');
    });

    it('should identify script directories', () => {
      writeFile(tmpDir, 'scripts/deploy.sh', '#!/bin/bash\n');

      const arch = mapArchitecture(tmpDir);
      assert.ok(arch.scripts.some((s) => s.includes('scripts')), 'Should find scripts/');
    });

    it('should return empty arrays for bare directory', () => {
      const arch = mapArchitecture(tmpDir);
      assert.deepEqual(arch.entryPoints, []);
      assert.deepEqual(arch.configFiles, []);
      assert.deepEqual(arch.testDirectories, []);
    });
  });
});
