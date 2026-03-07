// copy-assets.js - Copies AgentX .github assets into the extension for packaging.
// This ensures agents, instructions, prompts, and skills are bundled in the VSIX
// and available across all workspaces.
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const srcRoot = path.resolve(repoRoot, '.github');
const destRoot = path.resolve(__dirname, '..', '.github', 'agentx');

// Directories from .github/ to bundle
const githubDirs = ['agents', 'instructions', 'prompts', 'skills', 'templates', 'schemas', 'security', 'ISSUE_TEMPLATE'];

// Directories from repo root to bundle
const rootDirs = [
    { src: path.join(repoRoot, 'packs'), dest: 'packs' },
];

// Standalone files from .github/ to bundle
const standaloneFiles = ['agent-delegation.md', 'agentx-security.yml', 'CODEOWNERS', 'PULL_REQUEST_TEMPLATE.md'];

// Clean destination
if (fs.existsSync(destRoot)) {
    fs.rmSync(destRoot, { recursive: true });
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
