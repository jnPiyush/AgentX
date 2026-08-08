#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

let yaml;
const candidates = [
  path.resolve(__dirname, '..', 'vscode-extension', 'node_modules', 'yaml'),
  path.resolve(__dirname, 'node_modules', 'yaml'),
];
for (const candidate of candidates) {
  try { yaml = require(candidate); break; } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
}
function parseScalar(value, lineNumber) {
  if (value.startsWith('[')) {
    if (!value.endsWith(']')) throw new Error(`Unterminated inline sequence at line ${lineNumber}.`);
    const body = value.slice(1, -1).trim();
    return body ? body.split(',').map((item) => parseScalar(item.trim(), lineNumber)) : [];
  }
  if (value.startsWith('{')) {
    if (!value.endsWith('}')) throw new Error(`Unterminated inline mapping at line ${lineNumber}.`);
    throw new Error(`Inline mappings are not supported by the standalone parser at line ${lineNumber}.`);
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length === 1) throw new Error(`Unterminated single quote at line ${lineNumber}.`);
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith('"')) {
    try { return JSON.parse(value); } catch (_) { throw new Error(`Invalid double-quoted scalar at line ${lineNumber}.`); }
  }
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^(null|~)$/i.test(value)) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (/['"]/.test(value)) throw new Error(`Unexpected quote in plain scalar at line ${lineNumber}.`);
  return value.replace(/\s+#.*$/, '').trim();
}

function parseAgentxFrontmatter(input) {
  const lines = input.replace(/\r/g, '').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (/\t/.test(lines[index])) throw new Error(`Tabs are not allowed at line ${index + 1}.`);
  }

  const indentation = (line) => line.match(/^ */)[0].length;
  const nextContent = (start) => {
    for (let index = start; index < lines.length; index += 1) {
      if (lines[index].trim() && !lines[index].trimStart().startsWith('#')) return index;
    }
    return -1;
  };

  function parseBlock(start, indent) {
    const first = nextContent(start);
    if (first < 0) return { value: {}, next: lines.length };
    const sequence = lines[first].slice(indent).startsWith('- ');
    const value = sequence ? [] : {};
    let index = first;
    while (index < lines.length) {
      if (!lines[index].trim() || lines[index].trimStart().startsWith('#')) { index += 1; continue; }
      const currentIndent = indentation(lines[index]);
      if (currentIndent < indent) break;
      if (currentIndent > indent) throw new Error(`Unexpected indentation at line ${index + 1}.`);
      const text = lines[index].slice(indent);

      if (sequence) {
        const item = /^-\s+(.*)$/.exec(text);
        if (!item) throw new Error(`Expected a sequence item at line ${index + 1}.`);
        if (!item[1]) throw new Error(`Sequence item requires a value at line ${index + 1}.`);
        value.push(parseScalar(item[1], index + 1));
        index += 1;
        continue;
      }

      const match = /^([A-Za-z][A-Za-z0-9-]*):(?:\s*(.*))?$/.exec(text);
      if (!match) throw new Error(`Invalid mapping entry at line ${index + 1}.`);
      const [, key, raw = ''] = match;
      if (Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`Duplicate key '${key}'.`);
      if (/^[>|][-+]?\s*$/.test(raw)) {
        const parts = [];
        const child = nextContent(index + 1);
        if (child < 0 || indentation(lines[child]) <= indent) throw new Error(`Block scalar '${key}' requires indented content at line ${index + 1}.`);
        const childIndent = indentation(lines[child]);
        index = child;
        while (index < lines.length && (!lines[index].trim() || indentation(lines[index]) >= childIndent)) {
          parts.push(lines[index].trim());
          index += 1;
        }
        value[key] = parts.join(raw.startsWith('>') ? ' ' : '\n').trim();
      } else if (!raw) {
        const child = nextContent(index + 1);
        if (child < 0 || indentation(lines[child]) <= indent) throw new Error(`Mapping '${key}' requires indented content at line ${index + 1}.`);
        const parsed = parseBlock(child, indentation(lines[child]));
        value[key] = parsed.value;
        index = parsed.next;
      } else {
        value[key] = parseScalar(raw, index + 1);
        index += 1;
      }
    }
    return { value, next: index };
  }

  const first = nextContent(0);
  if (first < 0) return {};
  if (indentation(lines[first]) !== 0) throw new Error(`Top-level mapping must not be indented at line ${first + 1}.`);
  return parseBlock(first, 0).value;
}

try {
  const input = fs.readFileSync(0, 'utf8');
  const parsed = yaml
    ? yaml.parse(input, { prettyErrors: true, strict: true, uniqueKeys: true })
    : parseAgentxFrontmatter(input);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Frontmatter must be a YAML mapping.');
  }
  process.stdout.write(JSON.stringify(parsed));
} catch (error) {
  console.error(`[FAIL] Invalid YAML: ${error.message}`);
  process.exit(1);
}
