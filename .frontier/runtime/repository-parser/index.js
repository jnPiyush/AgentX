const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_RECORDS = 8192;
const TYPESCRIPT_VERSION = '5.9.3';
const WASM_VERSION = '0.3.1';
const grammarNames = {
  '.py': 'python', '.pyi': 'python', '.go': 'go', '.rs': 'rust',
  '.cs': 'c-sharp', '.csx': 'c-sharp', '.java': 'java', '.rb': 'ruby',
  '.c': 'cpp', '.h': 'cpp', '.cpp': 'cpp', '.hpp': 'cpp',
  '.sh': 'bash', '.bash': 'bash', '.css': 'css', '.php': 'php',
};
const tsExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const wasmRoot = path.join(__dirname, 'node_modules', '@vscode', 'tree-sitter-wasm', 'wasm');
let typescript;
let treeSitter;
let initialized;
const languages = new Map();

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function managedPackage(name, expectedVersion) {
  const directory = path.join(__dirname, 'node_modules', ...name.split('/'));
  const realDirectory = fs.realpathSync(directory);
  const managedRoot = fs.realpathSync(path.join(__dirname, 'node_modules'));
  if (!realDirectory.startsWith(managedRoot + path.sep)) {
    throw new Error(`Managed parser ${name} resolves outside the installed dependency directory.`);
  }
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  if (metadata.version !== expectedVersion) {
    throw new Error(`Managed parser ${name} requires ${expectedVersion}; found ${metadata.version}.`);
  }
  return directory;
}

function safeText(value, maximum = 400) {
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/(["'`])(?:\\.|(?!\1).)*?\1/g, '$1...$1')
    .replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function capabilities() {
  const available = [];
  const diagnostics = [];
  const identities = [`node:${process.versions.node}`];
  if (Number(process.versions.node.split('.')[0]) < 20) {
    return {
      version: 1, identity: digest(identities.join('|')), available: [],
      diagnostics: ['Managed graph parsers require Node.js 20 or later.'],
      versions: { node: process.versions.node },
    };
  }
  try {
    const directory = managedPackage('typescript', TYPESCRIPT_VERSION);
    identities.push(digest(fs.readFileSync(path.join(directory, 'lib', 'typescript.js'))));
    available.push(...tsExtensions);
  } catch (error) {
    diagnostics.push(`TypeScript parser unavailable: ${error.message}`);
  }
  try {
    managedPackage('@vscode/tree-sitter-wasm', WASM_VERSION);
    for (const filename of ['tree-sitter.js', 'tree-sitter.wasm']) {
      identities.push(digest(fs.readFileSync(path.join(wasmRoot, filename))));
    }
    for (const grammar of [...new Set(Object.values(grammarNames))].sort()) {
      const filename = path.join(wasmRoot, `tree-sitter-${grammar}.wasm`);
      if (fs.existsSync(filename)) {
        identities.push(`${grammar}:${digest(fs.readFileSync(filename))}`);
        available.push(...Object.keys(grammarNames).filter(extension => grammarNames[extension] === grammar));
      } else diagnostics.push(`Missing managed grammar: ${grammar}`);
    }
  } catch (error) {
    diagnostics.push(`Tree-sitter parser unavailable: ${error.message}`);
  }
  identities.push(digest(fs.readFileSync(__filename)));
  return {
    version: 1,
    identity: digest(identities.sort().join('|')),
    available: [...new Set(available)].sort(),
    versions: { typescript: TYPESCRIPT_VERSION, treeSitter: WASM_VERSION },
    diagnostics,
  };
}

function resultFor(file, parser) {
  return {
    path: file.path, parser, symbols: [], calls: [], references: [],
    parseErrors: 0, metadataTruncated: false, diagnostics: [],
  };
}

function addRecord(result, collection, record) {
  if (result[collection].length < MAX_RECORDS) result[collection].push(record);
  else result.metadataTruncated = true;
}

function lineIndexer(text) {
  const starts = [0];
  for (const match of text.matchAll(/\r\n|\r|\n/g)) starts.push(match.index + match[0].length);
  return (offset) => {
    let low = 0;
    let high = starts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (starts[middle] <= offset) low = middle;
      else high = middle;
    }
    return low + 1;
  };
}

function parseTypeScript(file) {
  if (!typescript) {
    const directory = managedPackage('typescript', TYPESCRIPT_VERSION);
    typescript = require(path.join(directory, 'lib', 'typescript.js'));
  }
  const ts = typescript;
  const extension = path.extname(file.path).toLowerCase();
  const kind = extension === '.tsx' ? ts.ScriptKind.TSX
    : extension === '.jsx' ? ts.ScriptKind.JSX
      : ['.js', '.mjs', '.cjs'].includes(extension) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
  const result = resultFor(file, `typescript@${TYPESCRIPT_VERSION}`);
  result.parseErrors = source.parseDiagnostics.length;
  const lineAt = lineIndexer(file.text);
  const nameOf = node => node && (ts.isIdentifier(node) || ts.isPrivateIdentifier(node))
    ? node.text : node && ts.isStringLiteral(node) ? safeText(node.text, 120) : '';
  const stack = [{ node: source, scope: '' }];
  let visited = 0;
  while (stack.length) {
    if (++visited > 200000) { result.metadataTruncated = true; break; }
    const { node, scope } = stack.pop();
    let symbolKind = '';
    let name = '';
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)
      || ts.isMethodSignature(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
      name = nameOf(node.name);
      symbolKind = ts.isFunctionDeclaration(node) ? 'function' : 'method';
    } else if (ts.isConstructorDeclaration(node)) {
      name = 'constructor'; symbolKind = 'method';
    } else if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
      || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)
      || ts.isModuleDeclaration(node)) {
      name = nameOf(node.name);
      symbolKind = ts.isClassDeclaration(node) ? 'class' : ts.isInterfaceDeclaration(node)
        ? 'interface' : ts.isEnumDeclaration(node) ? 'enum' : 'type';
    } else if (ts.isVariableDeclaration(node) && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      name = nameOf(node.name); symbolKind = 'function';
    }
    let nextScope = scope;
    if (name) {
      const declaration = ts.isVariableDeclaration(node) ? node.initializer : node;
      const parameters = declaration.parameters
        ? declaration.parameters.map(parameter => {
          const parameterName = nameOf(parameter.name) || 'destructured';
          return (parameter.dotDotDotToken ? '...' : '') + parameterName
            + (parameter.questionToken || parameter.initializer ? '?' : '')
            + (parameter.type ? `: ${safeText(parameter.type.getText(source), 100)}` : '');
        }).join(', ') : '';
      const qualifiedName = scope ? `${scope}.${name}` : name;
      const returnType = declaration.type ? `: ${safeText(declaration.type.getText(source), 150)}` : '';
      const signature = `${symbolKind} ${name}${declaration.parameters ? `(${parameters})${returnType}` : ''}`;
      addRecord(result, 'symbols', {
        Name: name, Kind: symbolKind, QualifiedName: qualifiedName, ParentName: scope,
        Line: lineAt(node.getStart(source)), EndLine: lineAt(node.end - 1),
        Signature: safeText(signature), Confidence: 'observed',
      });
      nextScope = qualifiedName;
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const expression = node.expression;
      const calledName = ts.isIdentifier(expression) ? expression.text
        : ts.isPropertyAccessExpression(expression) ? nameOf(expression.name) : '';
      if (calledName) {
        addRecord(result, 'calls', {
          Name: calledName, Scope: scope, Line: lineAt(node.getStart(source)),
          Receiver: ts.isPropertyAccessExpression(expression)
            ? safeText(expression.expression.getText(source), 120) : '',
        });
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(expression) && expression.text === 'require'
        && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
        addRecord(result, 'references', {
          Target: node.arguments[0].text, Kind: 'literal', Line: lineAt(node.getStart(source)),
        });
      }
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      addRecord(result, 'references', {
        Target: node.moduleSpecifier.text, Kind: 'literal', Line: lineAt(node.getStart(source)),
      });
    }
    const children = [];
    ts.forEachChild(node, child => { children.push(child); });
    for (let index = children.length - 1; index >= 0; index--) {
      stack.push({ node: children[index], scope: nextScope });
    }
  }
  return result;
}

const definitionKinds = new Map([
  ['function_definition', 'function'], ['function_declaration', 'function'],
  ['function_item', 'function'], ['method_definition', 'method'],
  ['method_declaration', 'method'], ['constructor_declaration', 'method'],
  ['class_definition', 'class'], ['class_declaration', 'class'],
  ['struct_item', 'struct'], ['struct_specifier', 'struct'],
  ['enum_item', 'enum'], ['enum_declaration', 'enum'],
  ['interface_declaration', 'interface'], ['trait_item', 'trait'],
  ['type_spec', 'type'], ['module', 'module'],
  ['method', 'method'], ['singleton_method', 'method'], ['class', 'class'],
]);

async function parseTreeSitter(file, grammar) {
  if (!treeSitter) {
    const directory = managedPackage('@vscode/tree-sitter-wasm', WASM_VERSION);
    treeSitter = require(path.join(directory, 'wasm', 'tree-sitter.js'));
    initialized = treeSitter.Parser.init({
      locateFile: filename => path.join(wasmRoot, path.basename(filename)),
    });
  }
  await initialized;
  if (!languages.has(grammar)) {
    languages.set(grammar, await treeSitter.Language.load(
      path.join(wasmRoot, `tree-sitter-${grammar}.wasm`)));
  }
  const parser = new treeSitter.Parser();
  parser.setLanguage(languages.get(grammar));
  const tree = parser.parse(file.text);
  const result = resultFor(file, `tree-sitter/${grammar}@${WASM_VERSION}`);
  const lineAt = lineIndexer(file.text);
  if (!tree) { parser.delete(); throw new Error('Parser returned no syntax tree.'); }
  try {
    result.parseErrors = tree.rootNode.hasError ? 1 : 0;
    const stack = [{ node: tree.rootNode, scope: '' }];
    let visited = 0;
    while (stack.length) {
      if (++visited > 200000) { result.metadataTruncated = true; break; }
      const { node, scope } = stack.pop();
      const symbolKind = definitionKinds.get(node.type);
      let nextScope = scope;
      if (symbolKind) {
        let nameNode = node.childForFieldName('name');
        if (!nameNode && node.type === 'function_definition') {
          let declarator = node.childForFieldName('declarator');
          while (declarator && declarator.childForFieldName('declarator')) {
            declarator = declarator.childForFieldName('declarator');
          }
          nameNode = declarator;
        }
        if (nameNode && /^[\p{L}_$][\p{L}\p{N}_$:.<>-]{0,119}$/u.test(nameNode.text)) {
          const name = nameNode.text;
          const qualifiedName = scope ? `${scope}.${name}` : name;
          const parameters = node.childForFieldName('parameters');
          const parameterNames = parameters
            ? parameters.namedChildren.map(parameter =>
              parameter.childForFieldName('name')?.text
                || parameter.childForFieldName('pattern')?.text
                || (/identifier/.test(parameter.type) ? parameter.text : 'parameter')).join(', ')
            : '';
          addRecord(result, 'symbols', {
            Name: name, Kind: symbolKind, QualifiedName: qualifiedName, ParentName: scope,
            Line: lineAt(node.startIndex),
            EndLine: lineAt(Math.max(node.startIndex, node.endIndex - 1)),
            Signature: safeText(`${symbolKind} ${name}${parameters ? `(${parameterNames})` : ''}`),
            Confidence: 'observed',
          });
          nextScope = qualifiedName;
        }
      }
      if (['call', 'call_expression', 'method_invocation', 'invocation_expression', 'command'].includes(node.type)) {
        const target = node.childForFieldName('function') || node.childForFieldName('name');
        const name = target?.childForFieldName('attribute')?.text
          || target?.childForFieldName('field')?.text || target?.text || '';
        if (/^[\p{L}_$][\p{L}\p{N}_$-]{0,119}$/u.test(name)) {
          addRecord(result, 'calls', { Name: name, Scope: scope, Line: lineAt(node.startIndex), Receiver: '' });
        }
      }
      const children = node.namedChildren;
      for (let index = children.length - 1; index >= 0; index--) {
        stack.push({ node: children[index], scope: nextScope });
      }
    }
    return result;
  } finally {
    tree.delete();
    parser.delete();
  }
}

async function parseFiles(request) {
  if (!request || request.version !== 1 || !Array.isArray(request.files)
    || request.files.length > 32 || Object.keys(request).some(key => !['version', 'files'].includes(key))) {
    throw new Error('Expected a version-1 parser batch with at most 32 files.');
  }
  const results = [];
  for (const file of request.files) {
    if (!file || typeof file.path !== 'string' || file.path.length > 1024
      || typeof file.text !== 'string' || Buffer.byteLength(file.text, 'utf8') > 1048576
      || Object.keys(file).some(key => !['path', 'text'].includes(key))) {
      throw new Error('Invalid bounded parser input.');
    }
    const extension = path.extname(file.path).toLowerCase();
    try {
      results.push(tsExtensions.has(extension) ? parseTypeScript(file)
        : grammarNames[extension] ? await parseTreeSitter(file, grammarNames[extension])
          : { ...resultFor(file, 'unsupported'), diagnostics: [`No managed parser for ${extension}`] });
    } catch (error) {
      results.push({ ...resultFor(file, 'unavailable'), diagnostics: [String(error.message).slice(0, 500)] });
    }
  }
  return { version: 1, results };
}

async function main() {
  if (process.argv[2] === '--capabilities' && process.argv.length === 3) {
    process.stdout.write(`${JSON.stringify(capabilities())}\n`);
    return;
  }
  if (process.argv.length !== 2) throw new Error('Unsupported parser argument.');
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > MAX_INPUT_BYTES) throw new Error('Parser input exceeds 16 MiB.');
    chunks.push(chunk);
  }
  const response = await parseFiles(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  const output = JSON.stringify(response);
  if (Buffer.byteLength(output, 'utf8') > MAX_OUTPUT_BYTES) throw new Error('Parser output exceeds 16 MiB.');
  process.stdout.write(`${output}\n`);
}

if (require.main === module) main().catch(error => {
  process.stderr.write(`[frontier-parser] ${error.message}\n`);
  process.exitCode = 1;
});
module.exports = { capabilities, parseFiles };
