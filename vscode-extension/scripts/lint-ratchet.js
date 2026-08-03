#!/usr/bin/env node
/**
 * ESLint ratchet gate.
 *
 * The extension carries pre-existing lint debt (mostly
 * `@typescript-eslint/no-explicit-any`). Making `npm run lint` blocking today
 * would fail every build; leaving it advisory -- as `quality-gates.yml` did
 * with `npm run lint || echo` -- means lint errors never fail anything.
 *
 * This gate takes the middle path used for the PowerShell analyser: compare
 * per-rule counts against a committed baseline and fail only on an INCREASE.
 * Existing debt stays visible and can be paid down deliberately.
 *
 * LIMITATION, stated plainly: this compares COUNTS, not locations. A commit
 * that fixes one `no-explicit-any` in file A and adds one in file B nets to
 * zero and passes. The gate stops debt from growing; it does not pin debt to
 * the file that owns it.
 *
 * Usage:
 *   node scripts/lint-ratchet.js              # enforce
 *   node scripts/lint-ratchet.js --update     # rewrite the baseline
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

const BASELINE = path.join(__dirname, '..', '.eslint-baseline.json');
const update = process.argv.includes('--update');

async function collectCounts() {
  // Use the Node API rather than spawning a binary: `npx.cmd` fails with
  // EINVAL on Windows under newer Node, and ESLint 8 does not export
  // ./bin/eslint.js for direct resolution.
  const eslint = new ESLint({ cwd: path.join(__dirname, '..'), extensions: ['.ts'] });
  const results = await eslint.lintFiles(['src']);

  // Fail closed: an empty result set means the glob matched nothing (renamed
  // directory, bad cwd). Reporting "0 findings, all clear" in that case would
  // make the gate decorative.
  if (results.length === 0) {
    throw new Error('ESLint matched no files under src/. Refusing to report success.');
  }

  const counts = {};
  let errors = 0;
  let warnings = 0;
  for (const file of results) {
    for (const msg of file.messages) {
      const rule = msg.ruleId || '(parse-error)';
      counts[rule] = (counts[rule] || 0) + 1;
      if (msg.severity === 2) { errors += 1; } else { warnings += 1; }
    }
  }
  return { counts, errors, warnings, fileCount: results.length };
}

async function main() {
  const { counts, errors, warnings, fileCount } = await collectCounts();
  const total = errors + warnings;

  console.log(`[INFO] ESLint: ${errors} error(s), ${warnings} warning(s) across ${fileCount} file(s)`);

  if (update) {
    const payload = {
      updatedAt: new Date().toISOString(),
      note: 'Ratchet baseline. Regenerate with: node scripts/lint-ratchet.js --update',
      total,
      errors,
      warnings,
      rules: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
    };
    fs.writeFileSync(BASELINE, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`[PASS] Baseline written to ${path.basename(BASELINE)} (total: ${total})`);
    return 0;
  }

  if (!fs.existsSync(BASELINE)) {
    // Fail closed. Warn-and-pass meant a fresh CI checkout without the
    // committed baseline would silently green-light everything.
    console.log(`[FAIL] Baseline not found: ${path.basename(BASELINE)}`);
    console.log('  The gate cannot enforce anything without it, so this is an error, not a warning.');
    console.log('  Create and COMMIT it with: node scripts/lint-ratchet.js --update');
    return 1;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const regressions = [];
  for (const [rule, now] of Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))) {
    const was = baseline.rules[rule] || 0;
    if (now > was) { regressions.push(`  ${rule} : ${was} -> ${now} (+${now - was})`); }
  }

  if (regressions.length > 0) {
    console.log('[FAIL] ESLint findings increased against the baseline:');
    regressions.forEach((r) => console.log(r));
    console.log('  Fix the new findings, or update the baseline deliberately with --update.');
    return 1;
  }

  if (total < baseline.total) {
    console.log(`[PASS] Findings decreased: ${baseline.total} -> ${total}. Refresh the baseline with --update.`);
  } else {
    console.log(`[PASS] No regression against baseline (total: ${total}).`);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[FAIL] Lint ratchet failed: ${err.message}`);
    process.exit(1);
  });
