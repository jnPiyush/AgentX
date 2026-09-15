import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const packageScript = fileURLToPath(new URL('../scripts/package-teams.ps1', import.meta.url));

test('Teams ZIP contains a valid bot manifest and required icon dimensions', { skip: process.platform !== 'win32' }, async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-teams-package-'));
    const output = path.join(directory, 'teams.zip');
    try {
        await execute('pwsh', ['-NoProfile', '-File', packageScript,
            '-AppId', '00000000-0000-0000-0000-000000000002',
            '-WebsiteUrl', 'https://example.com', '-PrivacyUrl', 'https://example.com/privacy',
            '-TermsUrl', 'https://example.com/terms', '-OutputPath', output], { timeout: 15000 });
        const extracted = path.join(directory, 'extracted');
        await execute('tar', ['-xf', output, '-C', directory], { timeout: 5000 });
        const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
        assert.equal(manifest.bots[0].botId, manifest.id);
        assert.deepEqual(manifest.bots[0].scopes, ['personal', 'team', 'groupChat']);
        assert.equal(manifest.manifestVersion, '1.20');
        for (const [file, size] of [['color.png', 192], ['outline.png', 32]]) {
            const png = fs.readFileSync(path.join(directory, file));
            assert.equal(png.readUInt32BE(16), size);
            assert.equal(png.readUInt32BE(20), size);
        }
        assert.equal(fs.existsSync(extracted), false);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});