import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = resolve(root, 'dist/mira.cjs');
const studio = resolve(root, 'dist/studio');
const bridgeGlobal = {};
runInNewContext(readFileSync(resolve(studio, 'compiler.js'), 'utf8'), bridgeGlobal);
const bridge = bridgeGlobal.MiraStudioCompiler;
const {createInspectorHost, executeInspector, childrenOf} = await import(
  pathToFileURL(resolve(studio, 'inspector-host.js')).href
);

const inspectorSource = readFileSync(resolve(studio, 'inspector.mira'), 'utf8');
const fixture = [
  'add: x, and: y = x + y;',
  'increment = (add: _, and: 1);',
  'result = 5 ~ increment;'
].join('\n');

function transpile(source, target) {
  const directory = mkdtempSync(join(tmpdir(), 'mira-dogfood-'));
  try {
    const file = join(directory, 'program.mira');
    writeFileSync(file, source);
    return spawnSync('node', [cli, file, target], {encoding: 'utf8'});
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

function sourceAst(source) {
  const result = bridge.ast(source);
  assert.equal(result.ok, true, result.message);
  return JSON.parse(result.output);
}

function inspect(source, inspector = inspectorSource) {
  const ast = sourceAst(source);
  const compiled = bridge.compile(inspector, 'js');
  assert.equal(compiled.ok, true, compiled.message);
  return {ast, compiled: compiled.output, stats: executeInspector(compiled.output, ast)};
}

function independentTotal(node) {
  return 1 + childrenOf(node).reduce((sum, child) => sum + independentTotal(child), 0);
}

test('extern declarations have an explicit JS and PHP host boundary', () => {
  const source = [
    'extern factor;',
    'extern add: x, and: y;',
    'result = add: factor, and: 5;'
  ].join('\n');
  const js = transpile(source, 'js');
  const php = transpile(source, 'php');
  assert.equal(js.status, 0, js.stderr);
  assert.equal(php.status, 0, php.stderr);
  assert.match(js.stdout, /__miraHost\.get\("factor"\)/);
  assert.match(js.stdout, /__miraHost\.call\("add:and:"/);
  assert.match(php.stdout, /MiraHost::get\("factor"\)/);
  assert.match(php.stdout, /MiraHost::call\("add:and:"/);

  const result = new Function('__miraHost', js.stdout + '\nreturn result;')({
    get: name => name === 'factor' ? 7 : null,
    call: (selector, args) => {
      assert.equal(selector, 'add:and:');
      return args[0] + args[1];
    }
  });
  assert.equal(result, 12);
});

test('extern declarations reject bodies, missing signatures and name collisions', () => {
  for (const source of [
    'extern;',
    'extern foo = 1;',
    'extern x; x = 2;'
  ]) {
    const result = transpile(source, 'js');
    assert.notEqual(result.status, 0, source);
  }
});

test('Mira inspector compiles on both targets', () => {
  for (const target of ['js', 'php']) {
    const output = transpile(inspectorSource, target);
    assert.equal(output.status, 0, target + ': ' + output.stderr);
    assert.match(output.stdout, /fold__with__from/);
    assert.match(output.stdout, /node__is/);
  }
});

test('Mira computes real totals and node-kind counts over its own AST', () => {
  const {ast, stats} = inspect(fixture);
  assert.equal(stats.total, independentTotal(ast));
  assert.equal(stats.functions, 1);
  assert.equal(stats.values, 2);
  assert.equal(stats.calls, 0);
  assert.equal(stats.sections, 1);
  assert.equal(stats.applies, 1);
  assert.equal(stats.binary, 1);
});

test('editing a Mira reducer changes the inspector result', () => {
  const baseline = inspect(fixture);
  const modified = inspectorSource.replace(
    'count: total, node: item = total + 1;',
    'count: total, node: item = total + 2;'
  );
  assert.notEqual(modified, inspectorSource);
  const doubled = inspect(fixture, modified);
  assert.equal(doubled.stats.total, baseline.stats.total * 2);
  assert.equal(doubled.stats.functions, baseline.stats.functions);
  assert.equal(doubled.stats.sections, baseline.stats.sections);
});

test('host exposes only the declared inspection capabilities', () => {
  const host = createInspectorHost(sourceAst(fixture));
  assert.throws(() => host.get('filesystem'), /Unknown host value/);
  assert.throws(() => host.call('fetch:from:', []), /Unknown host selector/);
  assert.throws(() => host.call('fold:with:from:', [1, 'not a function', 0]),
    /requires a root, reducer and seed/);
});

test('dogfooding assets are self-hosted and offline-cacheable', () => {
  const sw = readFileSync(resolve(studio, 'sw.js'), 'utf8');
  const index = readFileSync(resolve(studio, 'index.html'), 'utf8');
  for (const filename of [
    'ast-inspector.js', 'inspector-host.js', 'inspector-worker.js', 'inspector.mira'
  ]) {
    assert.ok(sw.includes('./' + filename));
    assert.ok(readFileSync(resolve(studio, filename)).length > 0);
  }
  assert.match(index, /id="astInspector"/);
  assert.match(index, /id="inspectorProgram"/);
});
