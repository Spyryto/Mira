import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = resolve(root, 'dist/studio');
const bundle = readFileSync(resolve(site, 'compiler.js'), 'utf8');
const context = {};
runInNewContext(bundle, context);
const bridge = context.MiraStudioCompiler;

function read(name) {
  return readFileSync(resolve(site, name), 'utf8');
}

const source = [
  'add: a number, and: another number = a number + another number;',
  'two = add 1 and 1;',
  'five = add: 2, and: 3;',
  'result = add (two) and (five);'
].join('\n');

test('the browser bundle exposes the real Haxe compiler', () => {
  assert.equal(typeof bridge?.compile, 'function');
  assert.equal(typeof bridge?.tokens, 'function');
  assert.equal(typeof bridge?.ast, 'function');
  assert.equal(bridge.version, '0.1.0');
});

test('browser bundle compiles JavaScript that executes correctly', () => {
  const compiled = bridge.compile(source, 'js');
  assert.equal(compiled.ok, true, compiled.message);
  assert.match(compiled.output, /add__and/);
  assert.equal(runInNewContext(compiled.output + '\nresult', {}), 7);
});

test('browser bundle emits executable PHP with the same result', () => {
  const compiled = bridge.compile(source, 'php');
  assert.equal(compiled.ok, true, compiled.message);
  const process = spawnSync('php', ['-r', compiled.output
    .replace(/^<\?php/, '') + '\necho $result;'], { encoding: 'utf8' });
  assert.equal(process.status, 0, process.stderr);
  assert.equal(process.stdout, '7');
});

test('AST inspection returns actual normalized selector calls', () => {
  const result = bridge.ast(source);
  assert.equal(result.ok, true, result.message);
  const ast = JSON.parse(result.output);
  assert.equal(ast.kind, 'Program');
  const resultNode = ast.definitions.find(node => node.name === 'result');
  assert.equal(resultNode.body.kind, 'Call');
  assert.equal(resultNode.body.selector, 'add:and:');
  assert.equal(resultNode.body.arguments.length, 2);
});

test('token inspection contains line and column information', () => {
  const result = bridge.tokens('result = 5;');
  assert.equal(result.ok, true);
  const tokens = JSON.parse(result.output);
  assert.equal(tokens[0].value, 'result');
  assert.equal(tokens[0].line, 1);
  assert.equal(tokens[0].column, 1);
});

test('errors are returned to the UI without crashing the browser bundle', () => {
  const wrong = bridge.compile('result = @;', 'js');
  assert.equal(wrong.ok, false);
  assert.match(wrong.message, /1:10/);
  const invalidTarget = bridge.compile('result = 2;', 'python');
  assert.equal(invalidTarget.ok, false);
  assert.match(invalidTarget.message, /Unknown target/);
});

test('PWA assets are self-hosted and have a relative GitHub Pages scope', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'portrait');

  const html = read('index.html');
  for (const file of ['app.js', 'compiler.js', 'styles.css', 'manifest.webmanifest']) {
    assert.match(html, new RegExp(file.replace('.', '\\.'), 'i'));
  }
  assert.doesNotMatch(html, /https?:\/\/.*(?:\.js|\.css)/i);
  assert.match(read('sw.js'), /mira-studio-/);
  assert.doesNotMatch(read('sw.js'), /__CACHE_VERSION__/);

  for (const file of ['icon.svg', 'worker.js', 'examples.js']) {
    assert.ok(existsSync(resolve(site, file)), file + ' must be offline-cacheable');
  }
});

test('mobile UI JavaScript, SW and execution worker have valid syntax', () => {
  for (const file of ['app.js', 'examples.js', 'worker.js', 'sw.js']) {
    execFileSync('node', ['--check', resolve(site, file)]);
  }
});
