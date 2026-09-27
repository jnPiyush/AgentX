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
        const sourceIcon = fileURLToPath(new URL('../../../vscode-extension/resources/frontier-ai-coding-harness.png', import.meta.url));
        const checkPixels = `
            Add-Type -AssemblyName System.Drawing
            $source = [Drawing.Image]::FromFile('${sourceIcon.replaceAll("'", "''")}')
            $expected = [Drawing.Bitmap]::new($source, 32, 32)
            $actual = [Drawing.Bitmap]::new('${path.join(directory, 'outline.png').replaceAll("'", "''")}')
            try {
                $visible = 0
                for ($y = 0; $y -lt 32; $y++) {
                    for ($x = 0; $x -lt 32; $x++) {
                        $pixel = $actual.GetPixel($x, $y)
                        if ($pixel.A -ne $expected.GetPixel($x, $y).A) {
                            throw 'Teams outline does not preserve the canonical icon silhouette.'
                        }
                        if ($pixel.A -gt 0) {
                            $visible++
                            if ($pixel.R -ne 255 -or $pixel.G -ne 255 -or $pixel.B -ne 255) {
                                throw 'Visible Teams outline pixels must be white.'
                            }
                        }
                    }
                }
                if ($visible -eq 0 -or $actual.GetPixel(0, 0).A -ne 0) {
                    throw 'Teams outline must contain visible artwork on a transparent background.'
                }
            } finally { $actual.Dispose(); $expected.Dispose(); $source.Dispose() }
        `;
        await execute('pwsh', ['-NoProfile', '-EncodedCommand',
            Buffer.from(checkPixels, 'utf16le').toString('base64')], { timeout: 10000 });
        assert.equal(fs.existsSync(extracted), false);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});