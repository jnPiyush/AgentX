// copy-assets.js - Copies AgentX .github assets into the extension for packaging.
// This ensures agents, instructions, prompts, and skills are bundled in the VSIX
// and available across all workspaces.
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const srcRoot = path.resolve(repoRoot, '.github');
const destRoot = path.resolve(__dirname, '..', '.github', 'agentx');
const compatibilityRoot = path.resolve(destRoot, '..');

// Directories from .github/ to bundle
const githubDirs = ['agents', 'instructions', 'prompts', 'skills', 'templates', 'schemas', 'security', 'ISSUE_TEMPLATE', 'workflows'];

// Directories from repo root to bundle
const rootDirs = [
    { src: path.join(repoRoot, '.agentx', 'templates'), dest: path.join('.agentx', 'templates') },
    { src: path.join(repoRoot, 'packs'), dest: 'packs' },
];

// Standalone files from .github/ to bundle
const standaloneFiles = ['agent-delegation.md', 'agentx-security.yml', 'CODEOWNERS', 'PULL_REQUEST_TEMPLATE.md', 'copilot-instructions.md'];

// Root-level reference documents to bundle alongside .github/ assets
const rootDocs = ['AGENTS.md', 'Skills.md', 'CONTRIBUTING.md', 'LICENSE'];

// Root-level compatibility docs referenced by bundled markdown via relative paths
const compatibilityDocs = ['AGENTS.md', 'Skills.md', 'CONTRIBUTING.md', 'LICENSE'];

// Root-level runtime files that extension-installed workspaces rely on
const rootRuntimeFiles = [
    { src: path.join(repoRoot, '.agentx', 'agentx.ps1'), dest: path.join('.agentx', 'agentx.ps1') },
    { src: path.join(repoRoot, '.agentx', 'agentx-cli.ps1'), dest: path.join('.agentx', 'agentx-cli.ps1') },
    { src: path.join(repoRoot, '.agentx', 'agentic-runner.ps1'), dest: path.join('.agentx', 'agentic-runner.ps1') },
    { src: path.join(repoRoot, '.agentx', 'agentx.sh'), dest: path.join('.agentx', 'agentx.sh') },
    { src: path.join(repoRoot, '.agentx', 'local-issue-manager.ps1'), dest: path.join('.agentx', 'local-issue-manager.ps1') },
    { src: path.join(repoRoot, '.agentx', 'local-issue-manager.sh'), dest: path.join('.agentx', 'local-issue-manager.sh') },
];

// docs/ reference files referenced by agents (bundled to docs/ subdirectory)
const docFiles = ['WORKFLOW.md', 'GUIDE.md', 'GOLDEN_PRINCIPLES.md', 'QUALITY_SCORE.md', 'tech-debt-tracker.md'];

const artifactDocFiles = [
    {
        src: path.join(repoRoot, 'docs', 'artifacts', 'adr', 'ADR-Harness-Engineering.md'),
        dest: path.join('docs', 'artifacts', 'adr', 'ADR-Harness-Engineering.md'),
    },
    {
        src: path.join(repoRoot, 'docs', 'artifacts', 'specs', 'SPEC-Harness-Engineering.md'),
        dest: path.join('docs', 'artifacts', 'specs', 'SPEC-Harness-Engineering.md'),
    },
];

const bundledMarkdownRewrites = [
    {
        relativePath: 'Skills.md',
        replacements: [
            ['(.github/skills/', '(skills/'],
            ['|.github/skills/', '|skills/'],
        ],
    },
    {
        relativePath: path.join('docs', 'WORKFLOW.md'),
        replacements: [
            ['(../.github/templates/', '(../templates/'],
            ['(../.github/agents/', '(../agents/'],
            ['(../.github/skills/', '(../skills/'],
        ],
    },
    {
        relativePath: 'CONTRIBUTING.md',
        replacements: [
            ['(.github/skills/', '(skills/'],
            ['(.github/ISSUE_TEMPLATE/', '(ISSUE_TEMPLATE/'],
            ['(.github/copilot-instructions.md)', '(copilot-instructions.md)'],
        ],
    },
    {
        relativePath: path.join('skills', 'ai-systems', 'prompt-engineering', 'SKILL.md'),
        replacements: [
            ['(../../../../.github/agents/', '(../../../agents/'],
            ['(../../../../.github/instructions/', '(../../../instructions/'],
        ],
    },
    {
        relativePath: path.join('docs', 'artifacts', 'adr', 'ADR-Harness-Engineering.md'),
        replacements: [
            ['(../../../.github/templates/', '(../../../templates/'],
            ['(../../../.github/workflows/', '(../../../workflows/'],
            ['(../../../vscode-extension/src/', '(../../../../../src/'],
        ],
    },
    {
        relativePath: path.join('docs', 'artifacts', 'specs', 'SPEC-Harness-Engineering.md'),
        replacements: [
            ['(../../../.github/templates/', '(../../../templates/'],
            ['(../../../.github/workflows/', '(../../../workflows/'],
            ['(../../../vscode-extension/src/', '(../../../../../src/'],
        ],
    },
    {
        relativePath: path.join('templates', 'EXEC-PLAN-TEMPLATE.md'),
        replacements: [
            ['(../../.github/templates/EXEC-PLAN-TEMPLATE.md)', '(EXEC-PLAN-TEMPLATE.md)'],
        ],
    },
];

// Clean destination
if (fs.existsSync(destRoot)) {
    fs.rmSync(destRoot, { recursive: true });
}

for (const file of compatibilityDocs) {
    const compatibilityPath = path.join(compatibilityRoot, file);
    if (fs.existsSync(compatibilityPath)) {
        fs.rmSync(compatibilityPath, { force: true });
    }
}

const compatibilityDocsRoot = path.join(compatibilityRoot, 'docs');
if (fs.existsSync(compatibilityDocsRoot)) {
    fs.rmSync(compatibilityDocsRoot, { recursive: true, force: true });
}

let totalFiles = 0;

// Copy .github subdirectories
for (const dir of githubDirs) {
    const src = path.join(srcRoot, dir);
    const dest = path.join(destRoot, dir);
    if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
        const count = countFiles(dest);
        totalFiles += count;
        console.log('  Copied ' + dir + '/ (' + count + ' files)');
    } else {
        console.log('  [WARN] Source not found: ' + dir + '/');
    }
}

// Copy root-level directories
for (const entry of rootDirs) {
    if (fs.existsSync(entry.src)) {
        const dest = path.join(destRoot, entry.dest);
        fs.cpSync(entry.src, dest, { recursive: true });
        const count = countFiles(dest);
        totalFiles += count;
        console.log('  Copied ' + entry.dest + '/ (' + count + ' files)');
    } else {
        console.log('  [WARN] Source not found: ' + entry.dest + '/');
    }
}

// Copy standalone files
for (const file of standaloneFiles) {
    const src = path.join(srcRoot, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(destRoot, file));
        totalFiles++;
    }
}
if (standaloneFiles.length > 0) {
    console.log('  Copied ' + standaloneFiles.length + ' standalone files');
}

// Copy root-level reference documents
let rootDocCount = 0;
for (const file of rootDocs) {
    const src = path.join(repoRoot, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(destRoot, file));
        totalFiles++;
        rootDocCount++;
    }
}
if (rootDocCount > 0) {
    console.log('  Copied ' + rootDocCount + ' root docs');
}

// Copy compatibility docs one level above the bundle root so existing relative links remain valid.
let compatibilityDocCount = 0;
for (const file of compatibilityDocs) {
    const src = path.join(repoRoot, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(compatibilityRoot, file));
        compatibilityDocCount++;
    }
}
if (compatibilityDocCount > 0) {
    console.log('  Copied ' + compatibilityDocCount + ' compatibility docs');
}

// Copy root runtime files
let runtimeFileCount = 0;
for (const file of rootRuntimeFiles) {
    if (fs.existsSync(file.src)) {
        const destFile = path.join(destRoot, file.dest);
        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.copyFileSync(file.src, destFile);
        totalFiles++;
        runtimeFileCount++;
    }
}
if (runtimeFileCount > 0) {
    console.log('  Copied ' + runtimeFileCount + ' runtime files');
}

// Copy docs/ reference files to docs/ subdirectory
const docsDestDir = path.join(destRoot, 'docs');
if (!fs.existsSync(docsDestDir)) {
    fs.mkdirSync(docsDestDir, { recursive: true });
}
const compatibilityDocsDir = path.join(compatibilityRoot, 'docs');
if (!fs.existsSync(compatibilityDocsDir)) {
    fs.mkdirSync(compatibilityDocsDir, { recursive: true });
}
let docFileCount = 0;
for (const file of docFiles) {
    const src = path.join(repoRoot, 'docs', file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(docsDestDir, file));
        fs.copyFileSync(src, path.join(compatibilityDocsDir, file));
        totalFiles++;
        docFileCount++;
    }
}
if (docFileCount > 0) {
    console.log('  Copied ' + docFileCount + ' docs/ reference files');
}

let artifactDocFileCount = 0;
for (const file of artifactDocFiles) {
    if (fs.existsSync(file.src)) {
        const bundledDest = path.join(destRoot, file.dest);
        fs.mkdirSync(path.dirname(bundledDest), { recursive: true });
        fs.copyFileSync(file.src, bundledDest);
        totalFiles++;
        artifactDocFileCount++;
    }
}
if (artifactDocFileCount > 0) {
    console.log('  Copied ' + artifactDocFileCount + ' artifact docs');
}

applyBundledMarkdownRewrites();
syncCompatibilityRootDocs();
rewriteCompatibilityDocs();

console.log('Done: ' + totalFiles + ' files copied to .github/agentx/');

function countFiles(dir) {
    let count = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            count += countFiles(path.join(dir, entry.name));
        } else {
            count++;
        }
    }
    return count;
}

function applyBundledMarkdownRewrites() {
    let rewrittenFileCount = 0;

    for (const entry of bundledMarkdownRewrites) {
        const targetPath = path.join(destRoot, entry.relativePath);
        if (!fs.existsSync(targetPath)) {
            continue;
        }

        const original = fs.readFileSync(targetPath, 'utf8');
        let updated = original;

        for (const [from, to] of entry.replacements) {
            updated = updated.split(from).join(to);
        }

        if (updated !== original) {
            fs.writeFileSync(targetPath, updated, 'utf8');
            rewrittenFileCount++;
        }
    }

    if (rewrittenFileCount > 0) {
        console.log('  Rewrote bundled markdown links in ' + rewrittenFileCount + ' files');
    }
}

function syncCompatibilityRootDocs() {
    for (const file of rootDocs) {
        const bundledPath = path.join(destRoot, file);
        if (fs.existsSync(bundledPath)) {
            const compatibilityPath = path.join(compatibilityRoot, file);
            fs.copyFileSync(bundledPath, compatibilityPath);

            if (file === 'Skills.md') {
                const original = fs.readFileSync(compatibilityPath, 'utf8');
                const updated = original
                    .split('(skills/').join('(agentx/skills/')
                    .split('|skills/').join('|agentx/skills/');

                if (updated !== original) {
                    fs.writeFileSync(compatibilityPath, updated, 'utf8');
                }
            } else if (file === 'CONTRIBUTING.md') {
                const original = fs.readFileSync(compatibilityPath, 'utf8');
                const updated = original
                    .split('(skills/').join('(agentx/skills/')
                    .split('(ISSUE_TEMPLATE/').join('(agentx/ISSUE_TEMPLATE/')
                    .split('(copilot-instructions.md)').join('(agentx/copilot-instructions.md)');

                if (updated !== original) {
                    fs.writeFileSync(compatibilityPath, updated, 'utf8');
                }
            }
        }
    }
}

function rewriteCompatibilityDocs() {
    const workflowPath = path.join(compatibilityRoot, 'docs', 'WORKFLOW.md');
    if (fs.existsSync(workflowPath)) {
        const original = fs.readFileSync(workflowPath, 'utf8');
        const updated = original
            .split('(../.github/templates/').join('(../agentx/templates/')
            .split('(../.github/agents/').join('(../agentx/agents/')
            .split('(../.github/skills/').join('(../agentx/skills/');

        if (updated !== original) {
            fs.writeFileSync(workflowPath, updated, 'utf8');
        }
    }

    const techDebtPath = path.join(compatibilityRoot, 'docs', 'tech-debt-tracker.md');
    if (fs.existsSync(techDebtPath)) {
        const original = fs.readFileSync(techDebtPath, 'utf8');
        const updated = original
            .split('(artifacts/adr/').join('(../agentx/docs/artifacts/adr/')
            .split('(artifacts/specs/').join('(../agentx/docs/artifacts/specs/');

        if (updated !== original) {
            fs.writeFileSync(techDebtPath, updated, 'utf8');
        }
    }
}
