import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readBoundedUtf8 } from '../../utils/boundedFile';

describe('readBoundedUtf8', () => {
  let dir: string;

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-bounded-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('returns undefined for a missing file', () => {
    assert.equal(readBoundedUtf8(path.join(dir, 'missing.json'), 10), undefined);
  });

  it('reads a file within the limit', () => {
    const file = path.join(dir, 'ok.json');
    fs.writeFileSync(file, '{"a":1}');
    assert.equal(readBoundedUtf8(file, 7), '{"a":1}');
  });

  it('skips or rejects an oversized file depending on the caller', () => {
    const file = path.join(dir, 'big.json');
    fs.writeFileSync(file, '12345678');
    assert.equal(readBoundedUtf8(file, 7), undefined);
    assert.throws(() => readBoundedUtf8(file, 7, 'too big'), /too big/);
  });
});
