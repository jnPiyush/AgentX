export function parseConfigurationJson(text: string): unknown {
  const raw = text.replace(/^\uFEFF/, '');
  try { return JSON.parse(raw); } catch (error) {
    if (!(error instanceof SyntaxError)) { throw error; }
  }
  let stripped = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index++) {
    const character = raw[index];
    if (escaped) { stripped += character; escaped = false; continue; }
    if (inString) {
      if (character === '\\') { escaped = true; }
      else if (character === '"') { inString = false; }
      stripped += character;
      continue;
    }
    if (character === '"') { inString = true; stripped += character; continue; }
    if (character === '/' && raw[index + 1] === '/') {
      while (index < raw.length && raw[index] !== '\n') { index++; }
      stripped += '\n';
      continue;
    }
    if (character === '/' && raw[index + 1] === '*') {
      index += 2;
      while (index < raw.length && !(raw[index] === '*' && raw[index + 1] === '/')) { index++; }
      if (index >= raw.length) { throw new SyntaxError('Unterminated configuration comment.'); }
      index++;
      stripped += ' ';
      continue;
    }
    stripped += character;
  }
  return JSON.parse(stripped);
}
