import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { createPinnedLookup, downloadFile } from '../../commands/initializeInternals';
import { addAllowedHost, removeAllowedHost } from '../../utils/ssrfValidator';

describe('downloadFile SSRF boundary', function () {
  this.timeout(10_000);

  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-download-security-'));
  });

  afterEach(() => {
    removeAllowedHost('127.0.0.1');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects a private address before opening a request', async () => {
    const dest = path.join(tempDir, 'private.bin');
    await assert.rejects(
      () => downloadFile('http://127.0.0.1:9/private', dest),
      /private\/loopback/i,
    );
    assert.equal(fs.existsSync(dest), false, 'blocked download must not leave a file');
  });

  it('validates every redirect before following it', async () => {
    addAllowedHost('127.0.0.1');
    const server = http.createServer((_request, response) => {
      response.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
      response.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/redirect`;
    const dest = path.join(tempDir, 'redirect.bin');

    try {
      await assert.rejects(
        () => downloadFile(url, dest),
        /private\/loopback|metadata/i,
      );
      assert.equal(fs.existsSync(dest), false, 'blocked redirect must not leave a file');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('pins HTTP lookup to an address returned by validation', async () => {
    const lookup = createPinnedLookup([
      { address: '203.0.113.10', family: 4 },
      { address: '2001:db8::10', family: 6 },
    ]);
    assert.ok(lookup);

    const resolved = await new Promise<{ address: string; family: number }>((resolve, reject) => {
      lookup('download.example', {}, (error, address, family) => {
        if (error) {
          reject(error);
          return;
        }
        if (typeof address !== 'string' || typeof family !== 'number') {
          reject(new Error('expected a single pinned lookup address'));
          return;
        }
        resolve({ address, family });
      });
    });
    assert.deepEqual(resolved, { address: '203.0.113.10', family: 4 });
  });
});
