import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');

describe('managed graph parser provisioning', () => {
  it('installs the locked parser on extension npm ci so clean checkouts can build', () => {
    // copy-assets fails closed without the gitignored parser modules (CodeQL and release preflight builds).
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vscode-extension', 'package.json'), 'utf8'));
    assert.equal(
      pkg.scripts.postinstall,
      'npm ci --prefix ../.frontier/runtime/repository-parser --ignore-scripts --no-audit --no-fund',
    );
    const parser = JSON.parse(fs.readFileSync(path.join(repoRoot, '.frontier', 'runtime', 'repository-parser', 'package.json'), 'utf8'));
    const copyAssets = fs.readFileSync(path.join(repoRoot, 'vscode-extension', 'scripts', 'copy-assets.js'), 'utf8');
    for (const dependency of Object.keys(parser.dependencies)) {
      assert.ok(copyAssets.includes(`'${dependency}'`), `copy-assets checks ${dependency}`);
    }
  });
});
