// Temporary test runner to get clean results
const fs = require('fs');
const { execSync } = require('child_process');
const outFile = require('path').join(require('os').tmpdir(), 'mocha-summary.txt');
try {
  const result = execSync('npx mocha --reporter json', {
    encoding: 'utf8',
    timeout: 120000,
    cwd: __dirname,
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  // The JSON output might be mixed with other stdout - find the JSON object
  const jsonStart = result.indexOf('{"stats"');
  if (jsonStart >= 0) {
    const data = JSON.parse(result.slice(jsonStart));
    const lines = [];
    lines.push('PASSES: ' + data.stats.passes);
    lines.push('FAILURES: ' + data.stats.failures);
    lines.push('PENDING: ' + data.stats.pending);
    if (data.failures && data.failures.length > 0) {
      lines.push('\nFAILED TESTS:');
      data.failures.forEach((f, i) => {
        lines.push(`  ${i + 1}) ${f.fullTitle}`);
        lines.push(`     Error: ${f.err.message ? f.err.message.split('\n')[0] : 'unknown'}`);
      });
    }
    fs.writeFileSync(outFile, lines.join('\n'));
    console.log('Results written to: ' + outFile);
  } else {
    fs.writeFileSync(outFile, 'Could not find JSON. First 500: ' + result.substring(0, 500));
    console.log('No JSON found, check: ' + outFile);
  }
} catch (e) {
  // execSync throws on non-zero exit code
  const stdout = e.stdout || '';
  const jsonStart = stdout.indexOf('{"stats"');
  if (jsonStart >= 0) {
    const data = JSON.parse(stdout.slice(jsonStart));
    const lines = [];
    lines.push('PASSES: ' + data.stats.passes);
    lines.push('FAILURES: ' + data.stats.failures);
    lines.push('PENDING: ' + data.stats.pending);
    if (data.failures && data.failures.length > 0) {
      lines.push('\nFAILED TESTS:');
      data.failures.forEach((f, i) => {
        lines.push(`  ${i + 1}) ${f.fullTitle}`);
        lines.push(`     Error: ${(f.err.message || 'unknown').split('\n')[0]}`);
      });
    }
    fs.writeFileSync(outFile, lines.join('\n'));
    console.log('Results written to: ' + outFile);
  } else {
    fs.writeFileSync(outFile, 'Exit:' + e.status + ' stdout-last-1000:' + stdout.slice(-1000));
    console.log('Error, check: ' + outFile);
  }
}
