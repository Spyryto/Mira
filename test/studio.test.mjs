import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  assert.equal(bridge.version, '0.5.0');
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
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  for (const [iconName, dimensions] of [['icon-192.png', 192], ['icon-512.png', 512]]) {
    const binary = readFileSync(resolve(site, iconName));
    assert.equal(binary.subarray(1, 4).toString(), 'PNG');
    assert.equal(binary.readUInt32BE(16), dimensions);
    assert.equal(binary.readUInt32BE(20), dimensions);
  }

  const html = read('index.html');
  for (const file of ['app.js', 'compiler.js', 'styles.css', 'manifest.webmanifest']) {
    assert.match(html, new RegExp(file.replace('.', '\\.'), 'i'));
  }
  assert.doesNotMatch(html, /https?:\/\/.*(?:\.js|\.css)/i);
  assert.match(read('sw.js'), /mira-studio-/);
  assert.doesNotMatch(read('sw.js'), /__CACHE_VERSION__/);

  for (const file of ['icon.svg', 'icon-192.png', 'icon-512.png', 'worker.js', 'examples.js']) {
    assert.ok(existsSync(resolve(site, file)), file + ' must be offline-cacheable');
  }
});

test('mobile UI JavaScript, SW and execution worker have valid syntax', () => {
  for (const file of ['app.js', 'reference-ui.js', 'atlas-ui.js', 'atlas-program.js', 'benchmark-ui.js', 'benchmark-cases.js', 'benchmark-worker.js', 'ast-inspector.js', 'inspector-host.js', 'collection-host.js', 'inspector-worker.js', 'examples.js', 'worker.js', 'ui-host.js', 'ui-preview.js', 'sw.js']) {
    execFileSync('node', ['--check', resolve(site, file)]);
  }
});


test('browser compiler supports section and pipeline with real AST nodes', () => {
  const example = [
    'add: x, and: y = x + y;',
    'increment = (add: _, and: 1);',
    'result = 5 ~ increment;'
  ].join('\n');

  const js = bridge.compile(example, 'js');
  assert.equal(js.ok, true, js.message);
  assert.equal(runInNewContext(js.output + '\nresult', {}), 6);

  const php = bridge.compile(example, 'php');
  assert.equal(php.ok, true, php.message);
  const process = spawnSync('php', ['-r',
    php.output.replace(/^<\?php/, '') + '\necho $result;'
  ], {encoding: 'utf8'});
  assert.equal(process.status, 0, process.stderr);
  assert.equal(process.stdout, '6');

  const result = bridge.ast(example);
  assert.equal(result.ok, true, result.message);
  const ast = JSON.parse(result.output);
  const increment = ast.definitions.find(item => item.name === 'increment');
  assert.equal(increment.body.kind, 'Section');
  assert.equal(increment.body.selector, 'add:and:');
  assert.equal(increment.body.arguments[0].kind, 'Placeholder');

  const final = ast.definitions.find(item => item.name === 'result');
  assert.equal(final.body.kind, 'Apply');
  assert.equal(final.body.callee.value, 'increment');
});

test('all Studio examples match the syntax currently implemented', async () => {
  const url = pathToFileURL(resolve(site, 'examples.js')).href;
  const { examples, defaultSource } = await import(url);
  assert.equal(defaultSource, examples[0].source);

  for (const example of examples) {
    const expectedSuccess = example.id !== 'errors';
    for (const target of ['js', 'php']) {
      const manifest = example.id === 'host-log' ? read('host.json') : undefined;
      const result = bridge.compile(example.source, target, manifest);
      assert.equal(result.ok, expectedSuccess,
        example.id + ' (' + target + '): ' + (result.message ?? 'unexpected success'));
    }
  }
});

test('Studio offers all generated feature examples and real Haxe API links offline', () => {
  const reference = JSON.parse(read('reference.json'));
  assert.ok(reference.features.length >= 15);
  assert.ok(reference.examples.length >= reference.features.length * 2);
  assert.ok(reference.api.length >= 45);
  assert.match(read('sw.js'), /\.\/reference\.json/);
  assert.match(read('sw.js'), /\.\/reference-ui\.js/);
  assert.match(read('index.html'), /data-view="reference"/);
  assert.match(read('index.html'), /id="previewUI"/);
  assert.match(read('app.js'), /sandbox', 'allow-scripts'/);
  assert.doesNotMatch(read('app.js'), /sandbox', 'allow-scripts allow-same-origin'/);
  for (const file of ['ui-host.js', 'ui-preview.js', 'ui-preview.html']) {
    assert.ok(existsSync(resolve(site, file)), file);
    assert.ok(read('sw.js').includes('./' + file));
  }
  assert.match(read('app.js'), /initializeReference/);

  for (const example of reference.examples) {
    const shouldWork = example.expect.kind !== 'error';
    for (const target of ['js', 'php']) {
      const compilation = bridge.compile(example.source, target,
        example.host ? read('host.json') : undefined);
      assert.equal(compilation.ok, shouldWork,
        example.id + ' ' + target + ': ' + compilation.message);
    }
  }
});


test('Studio execution worker evaluates documented multi-hole sections', () => {
  const reference = JSON.parse(read('reference.json'));
  for (const example of reference.examples.filter(item => item.expect.kind === 'invoke')) {
    const compiled = bridge.compile(example.source, 'js');
    assert.equal(compiled.ok, true, compiled.message);

    let reply;
    const context = {
      self: { postMessage(message) { reply = message; } }
    };
    runInNewContext(read('worker.js'), context);
    context.self.onmessage({
      data: {
        code: compiled.output,
        invoke: { name: example.expect.name, args: example.expect.args }
      }
    });

    assert.equal(reply?.ok, true, reply?.message);
    assert.equal(reply.output, String(example.expect.value));
  }
});

test('Studio execution worker rejects malformed fixture invocations', () => {
  let reply;
  const context = { self: { postMessage(message) { reply = message; } } };
  runInNewContext(read('worker.js'), context);
  context.self.onmessage({ data: {
    code: 'const result = 10;',
    invoke: {name: 'bad;process.exit(1)', args: []}
  }});
  assert.equal(reply?.ok, false);
  assert.match(reply.message, /Invalid example invocation/);
});

test('Studio runs the host log example and collects its output', () => {
  const manifest = read('host.json');
  const example = 'log "hey there"; log (4 + 5); result = 9;';
  const compiled = bridge.compile(example, 'js', manifest);
  assert.equal(compiled.ok, true, compiled.message);
  let response;
  const context = {self: {postMessage(message) { response = message; }}};
  runInNewContext(read('worker.js'), context);
  context.self.onmessage({data: {code: compiled.output}});
  assert.equal(response.ok, true, response.message);
  assert.equal(response.output, 'hey there\n9\n9');
});

test('structured data literals are represented in the canonical AST', () => {
  const source = 'entries = [{name: "A", minutes: 2}, {name: "B", minutes: 3}]; result = {items: entries};';
  const parsed = bridge.ast(source);
  assert.equal(parsed.ok, true, parsed.message);
  const ast = JSON.parse(parsed.output);
  const entries = ast.definitions.find(item => item.name === 'entries');
  assert.equal(entries.body.kind, 'Sequence');
  assert.equal(entries.body.items[0].kind, 'Record');
  assert.equal(entries.body.items[0].fields[0].key, 'name');
});

test('the Studio execution worker runs the four complete structured-data case studies', () => {
  const reference = JSON.parse(read('reference.json'));
  for (const example of reference.examples.filter(item =>
    item.host && item.expect.kind === 'result')) {
    const output = bridge.compile(example.source, 'js', read('host.json'));
    assert.equal(output.ok, true, example.id + ': ' + output.message);

    let response;
    const context = {self: {postMessage(message) {response = message; }}};
    runInNewContext(read('worker.js'), context);
    context.self.onmessage({data: {code: output.output}});
    assert.equal(response?.ok, true, example.id + ': ' + response?.message);
    assert.deepEqual(JSON.parse(response.output), example.expect.value);
  }
});

test('Studio bridge exposes native Mira 0.4 accessor, comparison and lazy condition AST',()=>{
  const source = [
    'score = field "score";',
    'student = {score: 8};',
    'result = if: ((student ~ score) >= 6), then: (true), else: (false);'
  ].join('\n');
  assert.equal(bridge.version,'0.5.0');
  const parsed=bridge.ast(source);
  assert.equal(parsed.ok,true,parsed.message);
  const definitions=JSON.parse(parsed.output).definitions;
  assert.equal(definitions[0].body.kind,'FieldAccessor');
  assert.equal(definitions[0].body.key,'score');
  const conditional=definitions[2].body;
  assert.equal(conditional.kind,'Conditional');
  assert.equal(conditional.condition.kind,'Binary');
  assert.equal(conditional.condition.symbol,'>=');
  assert.equal(conditional.condition.left.kind,'Apply');
  assert.equal(conditional.whenTrue.kind,'Boolean');
  assert.equal(conditional.whenTrue.value,true);
  assert.equal(conditional.whenFalse.kind,'Boolean');
  assert.equal(conditional.whenFalse.value,false);
});


test('0.5 operator sections are visible in the Studio canonical AST', () => {
  const source='result = 7 ~ (_ > 5);';
  for (const target of ['js','php']) {
    const compiled=bridge.compile(source,target);
    assert.equal(compiled.ok,true,compiled.message);
  }
  const inspected=bridge.ast(source);
  assert.equal(inspected.ok,true,inspected.message);
  const body=JSON.parse(inspected.output).definitions[0].body;
  assert.equal(body.kind,'Apply');
  assert.equal(body.callee.kind,'OperatorSection');
  assert.equal(body.callee.symbol,'>');
  assert.equal(body.callee.left.kind,'Placeholder');
  assert.equal(body.callee.right.kind,'Number');
});
