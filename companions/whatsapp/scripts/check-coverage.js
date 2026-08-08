const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const testFiles = fs.readdirSync(path.join(root, 'test'))
  .filter((name) => name.endsWith('.test.js'))
  .map((name) => path.join('test', name));
const result = spawnSync(process.execPath, ['--experimental-test-coverage', '--test', ...testFiles], {
  cwd: root,
  encoding: 'utf8',
});

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
const output = `${result.stdout || ''}\n${result.stderr || ''}`;
const total = /all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/.exec(output);
if (result.status !== 0 || !total) {
  console.error('[FAIL] Coverage run failed or total line coverage was not found.');
  process.exit(1);
}
const lineCoverage = Number(total[1]);
const branchCoverage = Number(total[2]);
const functionCoverage = Number(total[3]);
if (lineCoverage < 80) {
  console.error(`[FAIL] Line coverage ${lineCoverage}% is below 80%.`);
  process.exit(1);
}
if (branchCoverage < 65) {
  console.error(`[FAIL] Branch coverage ${branchCoverage}% is below 65%.`);
  process.exit(1);
}
if (functionCoverage < 75) {
  console.error(`[FAIL] Function coverage ${functionCoverage}% is below 75%.`);
  process.exit(1);
}
console.log(`[PASS] Coverage meets gates: lines ${lineCoverage}%, branches ${branchCoverage}%, functions ${functionCoverage}%.`);
