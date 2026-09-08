#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ENGINE_VERSION = '0.1.3';
const MAX_BYTES = 4 * 1024 * 1024;
const EXTENSIONS = /\.(?:html?|css|scss|sass|less|jsx?|tsx?|vue|svelte|astro|blade\.php)$/i;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '__pycache__']);
const HIDDEN_SOURCE = new Set(['.vitepress', '.vuepress', '.storybook']);
const NESTED_ROOT_MARKERS = [
    '.git', 'package.json', '.impeccable',
    ...['DESIGN.md', 'Design.md', 'design.md'].flatMap((name) =>
        [name, path.join('docs', name), path.join('.agents', 'context', name)]),
];
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function checkDesignLanguage({ workspaceRoot, target = 'src', timeoutSeconds = 60 }, run = spawnSync) {
    const start = Date.now();
    const result = {
        schemaVersion: 1, status: 'DEGRADED', reason: '', workspaceRoot, target,
        detector: null, exitCode: null, findings: [], primaryCount: 0, advisoryCount: 0,
        stderr: '', inputs: [], durationMs: 0,
        coverage: {
            eligibleFileCount: 0, scannedFileCount: null, inlineIgnores: 'disabled',
            designSystem: 'not-verified', limitations: [], manualReviewRequired: true,
        },
    };
    const limit = (message) => result.coverage.limitations.push(message);
    try {
        const [major, minor] = process.versions.node.split('.').map(Number);
        if (major < 22 || (major === 22 && minor < 18)) throw new Error('Node 22.18 or newer is required.');
        if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 300) {
            throw new Error('TimeoutSeconds must be an integer from 1 to 300.');
        }
        const root = fs.realpathSync(workspaceRoot);
        if (!fs.statSync(root).isDirectory()) throw new Error('WorkspaceRoot must be a directory.');
        result.workspaceRoot = root;
        function local(relative) {
            if (typeof relative !== 'string' || !relative.trim() || path.isAbsolute(relative) ||
                relative.split(/[\\/]/).includes('..') || relative.includes(':')) {
                throw new Error(`Expected a workspace-relative filesystem path: ${relative}`);
            }
            const full = fs.realpathSync(path.resolve(root, relative));
            const rel = path.relative(root, full);
            if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
                throw new Error(`Path escapes the target workspace: ${relative}`);
            }
            return full;
        }
        function read(relative) {
            const full = local(relative);
            if (!fs.statSync(full).isFile() || fs.statSync(full).size > MAX_BYTES) {
                throw new Error(`Input must be a regular file of at most ${MAX_BYTES} bytes: ${relative}`);
            }
            const content = fs.readFileSync(full);
            result.inputs.push({ path: relative, sha256: hash(content) });
            return content.toString('utf8');
        }
        function execute(binary, args, input) {
            const remaining = timeoutSeconds * 1000 - (Date.now() - start);
            if (remaining <= 0) throw new Error('Design check deadline exceeded.');
            const output = run(binary, args, {
                cwd: root, input: input ?? '', encoding: 'utf8', windowsHide: true,
                timeout: remaining, maxBuffer: MAX_BYTES, shell: false,
            });
            if (output.error) throw new Error(`Process failed (${output.error.code}): ${output.error.message}`);
            if (output.signal || output.status === null) throw new Error('Process terminated without an exit code.');
            return output;
        }

        const pin = JSON.parse(read('.impeccable/agentx.json'));
        if (!object(pin) || Object.keys(pin).sort().join(',') !== 'enginePath,engineVersion,sha256' ||
            pin.engineVersion !== ENGINE_VERSION || typeof pin.sha256 !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(pin.sha256)) {
            throw new Error(`Pin requires enginePath, engineVersion "${ENGINE_VERSION}" and a SHA256 digest.`);
        }
        const binary = local(pin.enginePath);
        const binaryStat = fs.statSync(binary);
        if (!binaryStat.isFile() || binaryStat.size > 128 * 1024 * 1024) throw new Error('Invalid native engine file.');
        const digest = hash(fs.readFileSync(binary));
        if (digest !== pin.sha256.toLowerCase()) throw new Error('Native engine SHA256 does not match the target-owned pin.');
        result.detector = { path: binary, version: pin.engineVersion, sha256: digest };
        const probe = execute(binary, ['engine-probe']);
        if (probe.status !== 0 || probe.stderr.trim() || probe.stdout.trim() !== `impeccable-engine ${ENGINE_VERSION}`) {
            throw new Error('Unsupported native engine; expected a successful engine-probe handshake.');
        }

        const scanTarget = local(target);
        const eligible = [];
        let visited = 0;
        function walk(full, explicit = false) {
            if (++visited > 10000 || Date.now() - start >= timeoutSeconds * 1000) {
                throw new Error('Input discovery limit exceeded (10000 entries or the shared deadline). Narrow Path.');
            }
            const entry = fs.lstatSync(full);
            if (entry.isSymbolicLink()) throw new Error('Scan scope contains a symbolic link; use a regular-file scope.');
            if (entry.isDirectory()) {
                for (const name of fs.readdirSync(full).sort()) {
                    const child = path.join(full, name);
                    if (SKIP_DIRS.has(name)) continue;
                    if (fs.lstatSync(child).isDirectory() && name.startsWith('.') && !HIDDEN_SOURCE.has(name)) continue;
                    walk(child);
                }
            } else if (entry.isFile() && EXTENSIONS.test(full)) {
                const rel = path.relative(root, full);
                read(rel);
                eligible.push(rel);
            } else if (explicit) {
                throw new Error('Path must target a supported web source file or directory.');
            }
        }
        walk(scanTarget, true);
        result.coverage.eligibleFileCount = eligible.length;
        if (!eligible.length) throw new Error('No eligible web source files; an empty scan cannot pass.');

        for (const name of ['config.json', 'config.local.json']) {
            const relative = path.join('.impeccable', name);
            if (!fs.existsSync(path.join(root, relative))) continue;
            const config = JSON.parse(read(relative));
            if (!object(config)) throw new Error(`Invalid configuration object: ${relative}`);
            if (config.detector !== undefined || config.hook !== undefined || config.projectRoots !== undefined) {
                limit(`${relative}: custom detector/hook/projectRoots settings need manual suppression and scope review.`);
            }
        }
        for (const doc of ['PRODUCT.md', 'DESIGN.md']) {
            if (!fs.existsSync(path.join(root, doc))) limit(`${doc} is missing.`);
            else if (!read(doc).trim()) limit(`${doc} is empty.`);
        }
        const design = path.join(root, 'DESIGN.md');
        if (fs.existsSync(design)) {
            const parsed = execute(process.execPath, [path.join(__dirname, 'parse-yaml.js'), '--frontmatter-files'], JSON.stringify([design]));
            if (parsed.status !== 0 || parsed.stderr.trim()) limit('DESIGN.md frontmatter could not be parsed.');
            else {
                const metadata = JSON.parse(parsed.stdout)[0]?.frontmatter;
                if (!object(metadata) || !['colors', 'typography', 'rounded'].every((key) => object(metadata[key]) && Object.keys(metadata[key]).length)) {
                    limit('DESIGN.md needs nonempty colors, typography and rounded token mappings.');
                } else {
                    result.coverage.designSystem = 'token-mappings-present; semantic token coverage requires review';
                }
            }
        }
        for (const relative of ['.impeccable/design.json', 'DESIGN.json']) {
            if (fs.existsSync(path.join(root, relative)) && !object(JSON.parse(read(relative)))) {
                limit(`${relative} is not an object.`);
            }
        }
        // Do not claim root-token coverage when upstream could discover a nearer design root.
        const checkedRoots = new Set();
        for (const file of eligible) {
            for (let dir = path.dirname(path.join(root, file)); dir !== root; dir = path.dirname(dir)) {
                if (checkedRoots.has(dir)) break;
                checkedRoots.add(dir);
                if (NESTED_ROOT_MARKERS.some((name) => fs.existsSync(path.join(dir, name)))) {
                    limit('Nested design/project boundary: run with that app as WorkspaceRoot.');
                    break;
                }
            }
        }
        const args = ['detect', '--json', '--no-inline-ignores', scanTarget];
        result.detector.arguments = args;
        const output = execute(binary, args);
        result.exitCode = output.status;
        result.stderr = output.stderr;
        let findings;
        try { findings = JSON.parse(output.stdout); }
        catch (error) { throw new Error(`Detector did not return JSON: ${error.message}`); }
        if (!Array.isArray(findings) || findings.some((finding) =>
            !object(finding) ||
            !['antipattern', 'name', 'description', 'severity', 'file', 'snippet'].every((key) => typeof finding[key] === 'string') ||
            !Number.isInteger(finding.line) || finding.line < 0 ||
            !(finding.category === null || typeof finding.category === 'string') ||
            (finding.advisory !== undefined && typeof finding.advisory !== 'boolean'))) {
            throw new Error('Detector returned an unsupported findings schema.');
        }
        result.findings = findings;
        result.advisoryCount = findings.filter((finding) => finding.advisory === true || finding.severity === 'advisory').length;
        result.primaryCount = findings.length - result.advisoryCount;
        if (![0, 2].includes(output.status)) throw new Error(`Detector failed with exit ${output.status}; findings do not prove complete coverage.`);
        if ((output.status === 2) !== (result.primaryCount > 0)) throw new Error('Detector exit code and primary findings disagree.');
        if (output.stderr.trim()) limit('Detector emitted diagnostics; coverage needs review (see stderr).');
        if (result.coverage.limitations.length) throw new Error('Incomplete coverage: ' + [...new Set(result.coverage.limitations)].join(' '));
        result.status = result.primaryCount ? 'BLOCKED' : 'PASS';
        result.reason = result.primaryCount ? 'Primary findings require fixes or AgentX review of waivers.' : 'Deterministic scan completed; advisory findings and manual UX checks remain separate.';
    } catch (error) {
        result.reason = error.message;
    }
    result.durationMs = Date.now() - start;
    return result;
}

module.exports = { checkDesignLanguage };
if (require.main === module) {
    const [workspaceRoot, target, timeout, format] = process.argv.slice(2);
    const result = checkDesignLanguage({ workspaceRoot, target, timeoutSeconds: Number(timeout) });
    if (format === 'json') console.log(JSON.stringify(result));
    else {
        console.log(`[${result.status}] ${result.reason}`);
        for (const finding of result.findings) console.log(`${finding.file}:${finding.line} ${finding.antipattern} (${finding.severity}): ${finding.snippet}`);
        if (result.stderr) console.error(result.stderr);
    }
    process.exitCode = result.status === 'PASS' ? 0 : result.status === 'BLOCKED' ? 2 : 1;
}
