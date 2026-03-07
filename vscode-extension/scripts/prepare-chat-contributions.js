// prepare-chat-contributions.js
// Build-time discovery of agents, instructions, prompts, and skills.
// Auto-populates contributes.chatAgents, chatInstructions, chatPromptFiles,
// and chatSkills in package.json so they never need manual maintenance.
//
// Run: node scripts/prepare-chat-contributions.js
// Wired into vscode:prepublish automatically.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const githubDir = path.resolve(repoRoot, '.github');

// All paths use ./.github/agentx/ prefix because copy-assets.js
// copies .github/ content there for VSIX bundling.
const PREFIX = './.github/agentx';

// --- Discover chatAgents (visible only, not internal/) ---
function discoverAgents() {
    const agentsDir = path.join(githubDir, 'agents');
    if (!fs.existsSync(agentsDir)) { return []; }
    return fs.readdirSync(agentsDir)
        .filter(f => f.endsWith('.agent.md') && fs.statSync(path.join(agentsDir, f)).isFile())
        .sort()
        .map(f => ({ path: PREFIX + '/agents/' + f }));
}

// --- Discover chatInstructions ---
function discoverInstructions() {
    const dir = path.join(githubDir, 'instructions');
    if (!fs.existsSync(dir)) { return []; }
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.instructions.md'))
        .sort()
        .map(f => ({ path: PREFIX + '/instructions/' + f }));
}

// --- Discover chatPromptFiles ---
function discoverPrompts() {
    const dir = path.join(githubDir, 'prompts');
    if (!fs.existsSync(dir)) { return []; }
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.prompt.md'))
        .sort()
        .map(f => ({ path: PREFIX + '/prompts/' + f }));
}

// --- Discover chatSkills (recursive) ---
function discoverSkills() {
    const skillsDir = path.join(githubDir, 'skills');
    if (!fs.existsSync(skillsDir)) { return []; }
    const results = [];
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                walk(path.join(dir, entry.name));
            } else if (entry.name === 'SKILL.md') {
                const rel = path.relative(githubDir, path.join(dir, entry.name)).replace(/\\/g, '/');
                results.push({ path: PREFIX + '/' + rel });
            }
        }
    }
    walk(skillsDir);
    results.sort((a, b) => a.path.localeCompare(b.path));
    return results;
}

// --- Main ---
const chatAgents = discoverAgents();
const chatInstructions = discoverInstructions();
const chatPromptFiles = discoverPrompts();
const chatSkills = discoverSkills();

console.log('Discovered chat contributions:');
console.log('  chatAgents:       ' + chatAgents.length);
console.log('  chatInstructions: ' + chatInstructions.length);
console.log('  chatPromptFiles:  ' + chatPromptFiles.length);
console.log('  chatSkills:       ' + chatSkills.length);

// Read, update, and write package.json
const raw = fs.readFileSync(packageJsonPath, 'utf-8');
const pkg = JSON.parse(raw);

pkg.contributes.chatAgents = chatAgents;
pkg.contributes.chatInstructions = chatInstructions;
pkg.contributes.chatPromptFiles = chatPromptFiles;
pkg.contributes.chatSkills = chatSkills;

fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log('Updated ' + path.relative(repoRoot, packageJsonPath));
