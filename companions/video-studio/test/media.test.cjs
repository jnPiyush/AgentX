const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const remotion = require('remotion');
const root = path.resolve(__dirname, '..');

function renderFrame(frame) {
  const load = file => {
    const source = fs.readFileSync(file, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
    const module = { exports: {} };
    const requireLocal = name => {
      if (name === 'remotion') return {
        ...remotion, AbsoluteFill: 'div', useCurrentFrame: () => frame,
        useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 1800 }),
      };
      if (!name.startsWith('.')) return require(name);
      const resolved = path.resolve(path.dirname(file), name);
      return load(fs.existsSync(`${resolved}.tsx`) ? `${resolved}.tsx` : `${resolved}.ts`);
    };
    vm.runInNewContext(`(function(require, module, exports) { ${compiled.outputText}\n})`)(requireLocal, module, module.exports);
    return module.exports;
  };
  const { UXDemo } = load(path.join(root, 'src/compositions/UXDemo.tsx'));
  return renderToStaticMarkup(React.createElement(UXDemo));
}

test('UX media discloses scripted illustration throughout all scenes without invented proof', () => {
  for (const frame of [0, 180, 400, 900, 1500, 1750]) {
    const html = renderFrame(frame);
    assert.match(html, /Scripted illustration - not a recorded run or verified audit/);
    assert.doesNotMatch(html, /0 violations|58s|7\.2:1|WCAG 2\.1 AA: pass|axe-report\.json|9s elapsed/);
    if (frame >= 900) assert.match(html, /Not measured/);
  }
});

test('captions describe illustrations, not measured timing or accessibility certification', () => {
  const captions = fs.readFileSync(path.join(root, 'public/ux.vtt'), 'utf8');
  assert.match(captions, /^WEBVTT/);
  assert.match(captions, /Scripted illustration, not a recorded run/);
  assert.match(captions, /No audit was run/);
  assert.doesNotMatch(captions, /Zero accessibility violations|fifty eight seconds|A A pass|Audit report committed/);
  const manifest = require('../package.json');
  assert.equal(manifest.scripts.captions, undefined);
});