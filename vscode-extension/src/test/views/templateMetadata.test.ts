import { strict as assert } from 'assert';
import fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { createTemplateTreeItem, parseTemplate } from '../../views/templateTreeProviderInternals';

interface MetadataCase {
  name: string;
  content: string;
  inputs?: Array<{ name: string; description: string; required: boolean; defaultValue: string }>;
  error?: boolean;
}

const repoRoot = path.resolve(__dirname, '../../../..');
const cases: MetadataCase[] = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'template-metadata.json'), 'utf8'),
);

describe('Template metadata contracts', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-template-metadata-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  for (const fixture of cases) {
    it(fixture.name, () => {
      const file = path.join(root, 'TEST-TEMPLATE.md');
      fs.writeFileSync(file, fixture.content);
      const result = parseTemplate(file, 'TEST-TEMPLATE.md');
      if (fixture.error) {
        assert.ok('error' in result && result.error, 'Invalid input must expose a diagnostic');
        assert.equal(createTemplateTreeItem(file, 'TEST-TEMPLATE.md').description, 'Invalid metadata');
      } else {
        assert.deepEqual(result.inputs, fixture.inputs);
        assert.ok(!('error' in result) || !result.error);
      }
    });
  }

  it('surfaces an unreadable file instead of reporting a valid zero-input template', () => {
    const item = createTemplateTreeItem(path.join(root, 'MISSING.md'), 'MISSING.md');
    assert.equal(item.description, 'Invalid metadata');
  });

  it('propagates unexpected ReferenceErrors outside YAML parsing', () => {
    const error = new ReferenceError('Unexpected reader failure');
    const stub = sinon.stub(fs, 'readFileSync').throws(error);
    try {
      assert.throws(() => parseTemplate('TEST.md', 'TEST.md'), candidate => candidate === error);
    } finally {
      stub.restore();
    }
  });

  it('reads input names from all canonical template formats', () => {
    const directory = path.join(repoRoot, '.github', 'templates');
    const files = fs.readdirSync(directory).filter(file => file.endsWith('-TEMPLATE.md'));
    const contracts: Array<{ file: string; inputs: string[] }> = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'canonical-template-inputs.json'), 'utf8'),
    );
    assert.deepEqual(files.sort(), contracts.map(contract => contract.file).sort());
    for (const contract of contracts) {
      const fullPath = path.join(directory, contract.file);
      assert.ok(contract.inputs.length > 0);
      assert.deepEqual(
        parseTemplate(fullPath, contract.file).inputs.map(input => input.name),
        contract.inputs,
        contract.file,
      );
    }
  });
});
