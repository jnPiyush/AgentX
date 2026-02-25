#!/usr/bin/env node
// AgentX Plugin: convert-docs
// Convert Markdown documents to Microsoft Word (DOCX) using Pandoc.
//
// Usage:
//   node .agentx/plugins/convert-docs/convert-docs.mjs
//   node .agentx/plugins/convert-docs/convert-docs.mjs --folders "docs/prd,docs/specs"
//   node .agentx/plugins/convert-docs/convert-docs.mjs --template templates/style.docx

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[90m', n: '\x1b[0m' };

// Parse args
const args = process.argv.slice(2);
function getFlag(flags, def) {
  for (let i = 0; i < args.length; i++) {
    if (flags.includes(args[i]) && i + 1 < args.length) return args[i + 1];
  }
  return def;
}

const folders = getFlag(['--folders', '-f'], 'docs/prd,docs/adr,docs/specs,docs/ux,docs/reviews').split(',').map(s => s.trim());
const template = getFlag(['--template', '-t'], '');
const outputDir = getFlag(['--output', '-o'], '');

// Check pandoc
try {
  const ver = execSync('pandoc --version', { encoding: 'utf-8' }).split('\n')[0];
  console.log(`${C.d}[convert-docs] ${ver}${C.n}`);
} catch {
  console.log(`${C.r}[FAIL] Pandoc not found. Install: https://pandoc.org/installing.html${C.n}`);
  process.exit(1);
}

let total = 0, errors = 0;

for (const folder of folders) {
  if (!existsSync(folder)) { console.log(`${C.d}[SKIP] ${folder} (not found)${C.n}`); continue; }

  const files = readdirSync(folder).filter(f => f.endsWith('.md'));
  if (files.length === 0) { console.log(`${C.d}[SKIP] ${folder} (no .md files)${C.n}`); continue; }

  console.log(`\n  ${C.c}${folder}${C.n} (${files.length} files)`);

  for (const file of files) {
    const src = join(folder, file);
    const outFolder = outputDir || folder;
    const out = join(outFolder, basename(file, '.md') + '.docx');

    const pandocArgs = [src, '-o', out, '--toc', '--standalone'];
    if (template && existsSync(template)) pandocArgs.push('--reference-doc', template);

    try {
      execSync(`pandoc ${pandocArgs.map(a => `"${a}"`).join(' ')}`, { stdio: 'pipe' });
      const size = Math.round(statSync(out).size / 1024 * 10) / 10;
      console.log(`  ${C.g}[PASS]${C.n} ${file} -> ${basename(file, '.md')}.docx (${size} KB)`);
      total++;
    } catch {
      console.log(`  ${C.r}[FAIL]${C.n} ${file}`);
      errors++;
    }
  }
}

console.log('');
if (total > 0) console.log(`${C.g}[convert-docs] Converted ${total} files${C.n}`);
if (errors > 0) console.log(`${C.r}[convert-docs] ${errors} errors${C.n}`);
if (total === 0 && errors === 0) console.log(`${C.y}[convert-docs] No Markdown files found${C.n}`);
