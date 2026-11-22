import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = resolve(root, 'dist/mira.cjs');
const studio = resolve(root, 'dist/studio');
const browser = {};
runInNewContext(readFileSync(resolve(studio, 'compiler.js'), 'utf8'), browser);
const bridge = browser.MiraStudioCompiler;
const inspectorSource = readFileSync(resolve(studio, 'inspector.mira'), 'utf8');
const hostJson = readFileSync(resolve(studio, 'inspector-host.json'), 'utf8');
const consoleHostJson = readFileSync(resolve(studio, 'host.json'), 'utf8');
const {createInspectorHost, executeInspector, childrenOf} = await import(
  pathToFileURL(resolve(studio, 'inspector-host.js')).href
);
const fixture = 'add: x, and: y = x + y;\n' +
  'increment = (add: _, and: 1);\nresult = 5 ~ increment;';

function transpile(source, target, manifest) {
  const directory = mkdtempSync(join(tmpdir(), 'mira-host-'));
  try {
    const path = join(directory, 'program.mira');
    writeFileSync(path, source);
    const args = [cli, path, target];
    if (manifest !== undefined) {
      const hostPath = join(directory, 'host.json');
      writeFileSync(hostPath, manifest);
      args.push('--host', hostPath);
    }
    return spawnSync('node', args, {encoding: 'utf8'});
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

function fixtureAst(source) {
  const response = bridge.ast(source);
  assert.equal(response.ok, true, response.message);
  return JSON.parse(response.output);
}

function inspect(source, program = inspectorSource) {
  const ast = fixtureAst(source);
  const compiled = bridge.compile(program, 'js', hostJson);
  assert.equal(compiled.ok, true, compiled.message);
  return {ast, stats: executeInspector(compiled.output, ast)};
}

function totalNodes(node) {
  return 1 + childrenOf(node).reduce((sum, child) => sum + totalNodes(child), 0);
}

test('log is ordinary unary application to an explicitly registered host callable', () => {
  const source = 'log "hey there"; result = 9;';
  const without = transpile(source, 'js');
  assert.notEqual(without.status, 0);
  assert.match(without.stderr, /Unknown identifier/);

  for (const target of ['js', 'php']) {
    const withHost = transpile(source, target, consoleHostJson);
    assert.equal(withHost.status, 0, withHost.stderr);
    assert.doesNotMatch(withHost.stdout, /MiraHost::call|__miraHost\.call/);
  }

  const result = bridge.compile(source, 'js', consoleHostJson);
  assert.equal(result.ok, true, result.message);
  assert.match(result.output, /__miraHost\["log"\]/);
  const messages = [];
  const value = new Function('__miraHost', result.output + '\nreturn result;')({
    log: message => messages.push(message)
  });
  assert.equal(value, 9);
  assert.deepEqual(messages, ['hey there']);
});

test('the same host log is a PHP callable, not the native logarithm', () => {
  const source = 'log "hey there"; result = 9;';
  const compiled = transpile(source, 'php', consoleHostJson);
  assert.equal(compiled.status, 0, compiled.stderr);
  assert.match(compiled.stdout, /\$GLOBALS\["__miraHost"\]/);

  const phpHeader = '<?php\ndeclare(strict_types=1);\n' +
    '$GLOBALS["__miraHost"] = ["log" => static function($msg) { echo $msg, "\\n"; }];\n';
  const program = phpHeader +
    compiled.stdout.replace(/^<\?php\s*declare\(strict_types=1\);\s*/, '') +
    '\necho $result;\n';
  const dir = mkdtempSync(join(tmpdir(), 'mira-host-php-'));
  try {
    const file = join(dir, 'program.php');
    writeFileSync(file, program);
    const result = spawnSync('php', [file], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'hey there\n9');
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('expression statements and unary juxtaposition appear in the real browser AST', () => {
  const source = 'add: x, and: y = x + y;\n' +
    'increment = (add: _, and: 1);\nresult = increment 5;\nlog "done";';
  const result = bridge.ast(source, consoleHostJson);
  assert.equal(result.ok, true, result.message);
  const ast = JSON.parse(result.output);
  assert.equal(ast.definitions.at(-1).kind, 'ExpressionStatement');
  assert.equal(ast.definitions.at(-1).body.kind, 'Apply');
  assert.equal(ast.definitions.at(-1).body.callee.kind, 'HostRef');
  assert.equal(ast.definitions.find(d => d.name === 'result').body.kind, 'Apply');
  assert.equal(bridge.compile(source, 'js', consoleHostJson).ok, true);
});

test('unknown host names, malformed manifests and collisions are rejected', () => {
  for (const invalid of [
    '{"callables":[123]}',
    '{"selectors":["broken:selector"]}',
    '{"values":["x"],"callables":["x"]}'
  ]) {
    assert.equal(bridge.compile('result = 1;', 'js', invalid).ok, false);
  }
  const collision = bridge.compile('log = 1; result = log;', 'js', consoleHostJson);
  assert.equal(collision.ok, false);
  assert.match(collision.message, /conflicting/);
});

test('Mira inspector uses the same registered selectors on both targets', () => {
  for (const target of ['js', 'php']) {
    const output = transpile(inspectorSource, target, hostJson);
    assert.equal(output.status, 0, output.stderr);
    assert.match(output.stdout, /fold:with:from:/);
    assert.match(output.stdout, /node:is:/);
    assert.doesNotMatch(output.stdout, /MiraHost::call|__miraHost\.call/);
  }
  assert.equal(bridge.compile(inspectorSource, 'js').ok, false);
});

test('Mira calculates genuine AST node metrics', () => {
  const {ast, stats} = inspect(fixture);
  assert.equal(stats.total, totalNodes(ast));
  assert.equal(stats.functions, 1);
  assert.equal(stats.values, 2);
  assert.equal(stats.calls, 0);
  assert.equal(stats.sections, 1);
  assert.equal(stats.applies, 1);
  assert.equal(stats.binary, 1);
});

test('Mira itself constructs per-definition records with subtree metrics', () => {
  const {ast, stats} = inspect(fixture);
  assert.equal(stats.definitions.length, ast.definitions.length);
  assert.deepEqual(stats.definitions.map(item => item.name),
    ['add:and:', 'increment', 'result']);
  for (const entry of stats.definitions) {
    assert.ok(entry.nodes >= 2, entry.name);
    assert.ok(Number.isInteger(entry.calls));
    assert.ok(['Function', 'Value'].includes(entry.kind));
  }
  assert.equal(stats.definitions[0].calls, 0);
  assert.equal(stats.definitions[1].calls, 0);
});

test('changing a Mira reducer changes the result without changing the host', () => {
  const baseline = inspect(fixture);
  const modified = inspectorSource.replace(
    'count: total, node: item = total + 1;',
    'count: total, node: item = total + 2;'
  );
  assert.notEqual(modified, inspectorSource);
  const changed = inspect(fixture, modified);
  assert.equal(changed.stats.total, baseline.stats.total * 2);
  assert.equal(changed.stats.sections, baseline.stats.sections);
});

test('the host object exposes only declared names and direct callables', () => {
  const host = createInspectorHost(fixtureAst(fixture));
  assert.equal(Object.getPrototypeOf(host), null);
  assert.equal(host['missing'], undefined);
  assert.equal(typeof host['node:is:'], 'function');
  assert.throws(() => host['fold:with:from:']([], 'bad', 0), /requires a root/);
});

test('the PHP host array and JS host object run identical Mira reducers', () => {
  const {ast, stats} = inspect(fixture);
  const php = transpile(inspectorSource, 'php', hostJson);
  assert.equal(php.status, 0, php.stderr);
  const adapter = resolve(root, 'test/fixtures/InspectorHost.php');
  const encoded = Buffer.from(JSON.stringify(ast)).toString('base64');
  const script = '<?php\ndeclare(strict_types=1);\nrequire_once ' +
    JSON.stringify(adapter) + ';\n' +
    '$GLOBALS["__miraHost"] = makeInspectorHost(json_decode(base64_decode("' + encoded + '"), true));\n' +
    php.stdout.replace(/^<\?php\s*declare\(strict_types=1\);\s*/, '') +
    '\necho json_encode(["total"=>$totalNodes, "functions"=>$functionNodes,' +
    '"values"=>$valueNodes, "calls"=>$callNodes, "binary"=>$binaryNodes,' +
    '"sections"=>$sectionNodes, "applies"=>$applyNodes,' +
    '"definitions"=>$definitionSummaries]);\n';
  const dir = mkdtempSync(join(tmpdir(), 'mira-inspector-php-'));
  try {
    const file = join(dir, 'inspector.php');
    writeFileSync(file, script);
    const result = spawnSync('php', [file], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), stats);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('both host manifests and inspector remain offline-cacheable', () => {
  const sw = readFileSync(resolve(studio, 'sw.js'), 'utf8');
  for (const name of ['host.json', 'inspector-host.json', 'inspector.mira',
    'ast-inspector.js', 'inspector-host.js', 'inspector-worker.js']) {
    assert.ok(sw.includes('./' + name), name);
    assert.ok(readFileSync(resolve(studio, name)).length > 0, name);
  }
});
