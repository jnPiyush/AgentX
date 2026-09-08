const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { checkDesignLanguage } = require('../scripts/check-design-language');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx design gate '));
const source = path.resolve(__dirname, '..');
let passed = 0;
function test(label, run) {
    const root = fs.mkdtempSync(path.join(temp, 'app-'));
    const put = (name, content) => {
        const file = path.join(root, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    };
    put('.impeccable/bin/engine', 'fixture-native-engine');
    put('.impeccable/agentx.json', {
        enginePath: '.impeccable/bin/engine', engineVersion: '0.1.3',
        sha256: crypto.createHash('sha256').update('fixture-native-engine').digest('hex'),
    });
    put('PRODUCT.md', '# Product\nA small fixture.');
    put('DESIGN.md', '---\ncolors:\n  primary: "#112233"\ntypography:\n  body:\n    fontFamily: Arial\n    fontSize: 16px\nrounded:\n  sm: 4px\n---\n# Design\n');
    put('src/styles.css', 'body { color: #112233; }\n');
    const calls = [];
    const execute = (output = { status: 0, stdout: '[]', stderr: '' }, options = {}) => checkDesignLanguage(
        { workspaceRoot: root, target: 'src', ...options },
        (binary, args, settings) => {
            calls.push({ binary, args, settings });
            assert.equal(settings.cwd, fs.realpathSync(root));
            assert.equal(settings.shell, false);
            assert.equal(settings.maxBuffer, 4 * 1024 * 1024);
            assert.ok(settings.timeout > 0 && settings.timeout <= (options.timeoutSeconds ?? 60) * 1000);
            if (binary === process.execPath) return spawnSync(binary, args, settings);
            if (args[0] === 'engine-probe') return options.probeOutput ?? { status: 0, stdout: 'impeccable-engine 0.1.3\n', stderr: '' };
            return typeof output === 'function' ? output(settings) : output;
        });
    run({ root, put, calls, execute });
    passed++;
    console.log(`[PASS] ${label}`);
}
const primary = { antipattern: 'fixture-rule', name: 'Fixture', description: 'Fixture finding', severity: 'warning', category: null, file: 'src/styles.css', line: 0, snippet: 'body', extra: 'preserved' };
const advisory = { ...primary, severity: 'advisory' };
const nestedBoundaries = [
    { name: '.impeccable', directory: true },
    { name: '.git', directory: true },
    { name: '.git' },
    { name: 'package.json' },
    ...['DESIGN.md', 'Design.md', 'design.md'].flatMap((name) =>
        [name, path.join('docs', name), path.join('.agents', 'context', name)].map((name) => ({ name }))),
];
function addBoundary({ root, put }, { name, directory }) {
    if (directory) fs.mkdirSync(path.join(root, 'src', name), { recursive: true });
    else put(path.join('src', name), name === 'package.json' ? '{}' : '# Nested boundary without tokens\n');
}
try {
    test('clean gate, provenance, explicit argv and no claimed scanned count', ({ execute, calls }) => {
        const result = execute();
        assert.equal(result.status, 'PASS');
        assert.equal(result.coverage.eligibleFileCount, 1);
        assert.equal(result.coverage.scannedFileCount, null);
        assert.equal(result.coverage.manualReviewRequired, true);
        assert.ok(result.inputs.every((input) => /^[a-f0-9]{64}$/.test(input.sha256)));
        assert.deepEqual(calls.at(-1).args.slice(0, 3), ['detect', '--json', '--no-inline-ignores']);
    });
    test('advisory severity stays visible without blocking', ({ execute }) => {
        const result = execute({ status: 0, stdout: JSON.stringify([advisory]), stderr: '' });
        assert.equal(result.status, 'PASS');
        assert.equal(result.advisoryCount, 1);
        assert.equal(result.findings[0].extra, 'preserved');
    });
    test('advisory flag also recognized', ({ execute }) => {
        assert.equal(execute({ status: 0, stdout: JSON.stringify([{ ...primary, advisory: true }]), stderr: '' }).advisoryCount, 1);
    });
    test('primary findings block', ({ execute }) => {
        const result = execute({ status: 2, stdout: JSON.stringify([primary, advisory]), stderr: '' });
        assert.equal(result.status, 'BLOCKED');
        assert.equal(result.primaryCount, 1);
        assert.equal(result.advisoryCount, 1);
    });
    for (const status of [1, 127, 3]) test(`operational exit ${status} overrides findings`, ({ execute }) => {
        const result = execute({ status, stdout: JSON.stringify([primary]), stderr: 'failure' });
        assert.equal(result.status, 'DEGRADED');
        assert.equal(result.findings.length, 1);
        assert.equal(result.exitCode, status);
    });
    for (const stdout of ['', '{}', '[{}]', 'null', '[', JSON.stringify([{ ...primary, line: -1 }]), JSON.stringify([{ ...primary, advisory: 'true' }])]) {
        test(`invalid detector output ${stdout.slice(0, 20)}`, ({ execute }) => assert.equal(execute({ status: 0, stdout, stderr: '' }).status, 'DEGRADED'));
    }
    for (const status of [0, 2]) test(`contradictory exit ${status} is degraded`, ({ execute }) => {
        assert.equal(execute({ status, stdout: JSON.stringify(status ? [] : [primary]), stderr: '' }).status, 'DEGRADED');
    });
    test('stderr diagnostics prevent incomplete linked-CSS pass', ({ execute }) => {
        assert.equal(execute({ status: 0, stdout: '[]', stderr: 'color and custom-property rules will be incomplete' }).status, 'DEGRADED');
    });
    for (const code of ['ETIMEDOUT', 'ENOBUFS', 'ENOENT']) test(`bounded process failure ${code}`, ({ execute }) => {
        assert.match(execute({ error: { code, message: 'fixture failure' } }).reason, new RegExp(code));
    });
    test('signal termination is degraded', ({ execute }) => assert.equal(execute({ signal: 'SIGTERM', status: null }).status, 'DEGRADED'));
    test('real child timeout is bounded and reported', ({ execute }) => {
        const start = Date.now();
        const result = execute((settings) => spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], settings), { timeoutSeconds: 1 });
        assert.equal(result.status, 'DEGRADED');
        assert.match(result.reason, /ETIMEDOUT/);
        assert.ok(Date.now() - start < 5000);
    });
    test('real capture overflow is bounded and reported', ({ execute }) => {
        const result = execute((settings) => spawnSync(process.execPath, ['-e', 'process.stdout.write("x".repeat(8 * 1024 * 1024))'], settings));
        assert.equal(result.status, 'DEGRADED');
        assert.match(result.reason, /ENOBUFS/);
    });
    test('retired engine handshake cannot run detector', ({ execute, calls }) => {
        const result = execute(undefined, { probeOutput: { status: 1, stdout: 'Unknown command', stderr: '' } });
        assert.equal(result.status, 'DEGRADED');
        assert.equal(calls.length, 1);
    });
    for (const target of ['../outside.css', 'https://example.test', 'missing', 'PRODUCT.md']) {
        test(`invalid scan target ${target}`, ({ execute, calls }) => {
            assert.equal(execute(undefined, { target }).status, 'DEGRADED');
            assert.ok(!calls.some((call) => call.args[0] === 'detect'));
        });
    }
    test('empty directories cannot pass', ({ root, execute }) => {
        fs.unlinkSync(path.join(root, 'src/styles.css'));
        assert.equal(execute().status, 'DEGRADED');
    });
    test('unsupported and skipped files do not create coverage', ({ root, put, execute }) => {
        fs.unlinkSync(path.join(root, 'src/styles.css'));
        put('src/dist/styles.css', 'body{}');
        put('src/.hidden/styles.css', 'body{}');
        put('src/readme.txt', 'not UI');
        assert.equal(execute().status, 'DEGRADED');
    });
    test('missing pin never falls back to npm or a global engine', ({ root, execute, calls }) => {
        fs.unlinkSync(path.join(root, '.impeccable/agentx.json'));
        assert.equal(execute().status, 'DEGRADED');
        assert.equal(calls.length, 0);
    });
    test('tampered engine never executes', ({ put, execute, calls }) => {
        put('.impeccable/bin/engine', 'tampered');
        assert.match(execute().reason, /SHA256/);
        assert.equal(calls.length, 0);
    });
    test('unsupported pinned engine version rejected', ({ put, execute, calls }) => {
        put('.impeccable/agentx.json', { enginePath: '.impeccable/bin/engine', engineVersion: '999', sha256: 'a'.repeat(64) });
        assert.equal(execute().status, 'DEGRADED');
        assert.equal(calls.length, 0);
    });
    test('missing design document retains scan findings but degrades', ({ root, execute }) => {
        fs.unlinkSync(path.join(root, 'DESIGN.md'));
        const result = execute({ status: 2, stdout: JSON.stringify([primary]), stderr: '' });
        assert.equal(result.status, 'DEGRADED');
        assert.equal(result.primaryCount, 1);
    });
    for (const content of ['# Prose only', '---\ncolors: [\n---\n', '---\ncolors: {}\n---\n']) {
        test('missing or malformed token mappings degrade', ({ put, execute }) => {
            put('DESIGN.md', content);
            assert.equal(execute().status, 'DEGRADED');
        });
    }
    test('suppression configuration requires manual evidence', ({ put, execute }) => {
        put('.impeccable/config.local.json', { detector: { ignoreFiles: ['**/*'] } });
        assert.equal(execute().status, 'DEGRADED');
    });
    test('unrelated installer configuration is accepted', ({ put, execute }) => {
        put('.impeccable/config.json', { providers: ['github'] });
        assert.equal(execute().status, 'PASS');
    });
    for (const boundary of nestedBoundaries) {
        for (const target of ['src', 'src/styles.css']) {
            test(`nested ${boundary.name} (${boundary.directory ? 'directory' : 'file'}) degrades ${target}`, (fixture) => {
                addBoundary(fixture, boundary);
                const result = fixture.execute(undefined, { target });
                assert.equal(result.status, 'DEGRADED');
                assert.ok(result.coverage.limitations.some((message) => message.includes('Nested design/project boundary')));
            });
        }
    }
    test('boundary above the explicit scan directory cannot disappear', (fixture) => {
        addBoundary(fixture, { name: '.impeccable', directory: true });
        fixture.put('src/component/styles.css', 'body {}');
        assert.equal(fixture.execute(undefined, { target: 'src/component' }).status, 'DEGRADED');
    });
    test('malformed optional sidecar cannot disappear silently', ({ put, execute }) => {
        put('.impeccable/design.json', '{');
        assert.equal(execute().status, 'DEGRADED');
    });
    test('symlink/junction escapes cannot execute', ({ root, execute, calls }) => {
        const outside = path.join(temp, 'external');
        fs.mkdirSync(outside);
        fs.rmSync(path.join(root, '.impeccable'), { recursive: true });
        fs.symlinkSync(outside, path.join(root, '.impeccable'), process.platform === 'win32' ? 'junction' : 'dir');
        fs.writeFileSync(path.join(outside, 'agentx.json'), '{}');
        assert.match(execute().reason, /escapes/);
        assert.equal(calls.length, 0);
    });
    test('repo CLI preserves structured degraded exit and does not initialize target state', ({ root }) => {
        fs.unlinkSync(path.join(root, '.impeccable/agentx.json'));
        const output = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', path.join(source, '.agentx/agentx-cli.ps1'), 'design-language', 'check', '-Json'], {
            env: { ...process.env, AGENTX_WORKSPACE_ROOT: root }, encoding: 'utf8', timeout: 20000,
        });
        assert.equal(output.status, 1, output.stderr);
        assert.equal(JSON.parse(output.stdout).status, 'DEGRADED');
        assert.equal(fs.existsSync(path.join(root, '.agentx/state')), false);
    });
    const nativeEngine = process.env.AGENTX_TEST_IMPECCABLE_ENGINE;
    if (nativeEngine) {
        const digest = crypto.createHash('sha256').update(fs.readFileSync(nativeEngine)).digest('hex');
        assert.equal(digest, process.env.AGENTX_TEST_IMPECCABLE_SHA256?.toLowerCase(), 'Native regressions require the official release SHA256');
        for (const boundary of nestedBoundaries) {
            test(`official native regression: nested ${boundary.name} (${boundary.directory ? 'directory' : 'file'}) cannot falsely pass`, (fixture) => {
                const enginePath = path.join('.impeccable', 'bin', path.basename(nativeEngine));
                fs.copyFileSync(nativeEngine, path.join(fixture.root, enginePath));
                fixture.put('.impeccable/agentx.json', { enginePath, engineVersion: '0.1.3', sha256: digest });
                fixture.put('src/styles.css', '.copy { font-family: "Atkinson Hyperlegible"; }\n');
                const options = { workspaceRoot: fixture.root, target: 'src' };
                const control = checkDesignLanguage(options);
                assert.equal(control.status, 'BLOCKED', control.reason);
                assert.ok(control.findings.some((finding) => finding.antipattern === 'design-system-font'));
                addBoundary(fixture, boundary);
                const result = checkDesignLanguage(options);
                assert.equal(result.exitCode, 0, result.reason);
                assert.equal(result.primaryCount, 0);
                assert.equal(result.status, 'DEGRADED', result.reason);
                assert.ok(result.coverage.limitations.some((message) => message.includes('Nested design/project boundary')));
            });
        }
    } else {
        console.log('[SKIP] Official-native boundary regressions: set AGENTX_TEST_IMPECCABLE_ENGINE and AGENTX_TEST_IMPECCABLE_SHA256 to a verified local release.');
    }
    console.log(`Results: ${passed} passed`);
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
