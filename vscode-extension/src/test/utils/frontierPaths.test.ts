import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  hasFrontierState,
  resolveFrontierStateDirectory,
  resolveFrontierStatePath,
} from '../../utils/frontierPaths';

describe('Frontier state paths', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-paths-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('always resolves state under .frontier', () => {
    assert.equal(resolveFrontierStateDirectory(root), path.join(root, '.frontier'));
    assert.equal(resolveFrontierStatePath(root, 'state', 'loop-state.json'), path.join(root, '.frontier', 'state', 'loop-state.json'));
  });

  it('ignores legacy .agentx and .hve state instead of reading or migrating it', () => {
    for (const legacy of ['.agentx', '.hve']) {
      fs.mkdirSync(path.join(root, legacy, 'state'), { recursive: true });
      fs.writeFileSync(path.join(root, legacy, 'config.json'), '{"provider":"local"}');
    }

    assert.equal(resolveFrontierStateDirectory(root), path.join(root, '.frontier'));
    assert.equal(hasFrontierState(root), false);
    assert.equal(fs.existsSync(path.join(root, '.frontier')), false);
  });

  it('detects initialized state from .frontier/config.json', () => {
    fs.mkdirSync(path.join(root, '.frontier'), { recursive: true });
    fs.writeFileSync(path.join(root, '.frontier', 'config.json'), '{"provider":"local"}');

    assert.equal(hasFrontierState(root), true);
  });
});