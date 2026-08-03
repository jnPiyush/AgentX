import * as fs from 'fs';
import * as path from 'path';
import Mocha from 'mocha';

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 30_000 });
  const testsRoot = path.resolve(__dirname);
  const files = fs.readdirSync(testsRoot).filter((file) => file.endsWith('.test.js'));
  files.forEach((file) => mocha.addFile(path.join(testsRoot, file)));

  await new Promise<void>((resolve, reject) => {
    const runner = mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} Extension Host test(s) failed`));
        return;
      }

      const resultPath = process.env.AGENTX_E2E_RESULT_PATH;
      if (!resultPath) {
        reject(new Error('AGENTX_E2E_RESULT_PATH is not configured'));
        return;
      }
      fs.writeFileSync(resultPath, JSON.stringify({ status: 'pass', tests: runner.stats?.passes ?? 0 }));
      resolve();
    });
  });
}
