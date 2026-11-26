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
  assert.equal(bridge.version, '0.77.0');
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
  assert.match(html, /id="workbench"/);
  assert.match(html, /id="workbenchFullscreen"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(read('app.js'), /mountWorkbenchFullscreen/);
  assert.match(read('styles.css'), /\.workspace\.workbench-fullscreen/);
  assert.match(read('styles.css'), /#view-code \.editor-frame/);
  assert.ok(existsSync(resolve(site, 'workbench-fullscreen.js')));
  assert.match(read('sw.js'), /\.\/workbench-fullscreen\.js/);
  assert.match(html, /id="languageVersion"/);
  assert.match(html, /id="sourceHighlight"/);
  assert.match(html, /class="source-layer"/);
  assert.match(read('app.js'), /mountMiraHighlight/);
  assert.match(read('styles.css'), /mira-highlight-ready/);
  assert.ok(existsSync(resolve(site,'syntax-highlight.js')));
  assert.match(read('sw.js'), /\.\/syntax-highlight\.js/);
  assert.doesNotMatch(html, /V 0\.4/);
  assert.match(read('app.js'), /compiler\.version/);
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
  for (const file of ['app.js', 'workbench-fullscreen.js', 'syntax-highlight.js', 'reference-ui.js', 'atlas-ui.js', 'atlas-program.js', 'benchmark-ui.js', 'benchmark-cases.js', 'benchmark-worker.js', 'ast-inspector.js', 'inspector-host.js', 'collection-host.js', 'inspector-worker.js', 'examples.js', 'worker.js', 'ui-host.js', 'ui-preview.js', 'sw.js']) {
    execFileSync('node', ['--check', resolve(site, file)]);
  }
});


test('browser compiler supports section and pipeline with real AST nodes', () => {
  const example = [
    'add: x, and: y = x + y;',
    'increment = (add: _, and: 1);',
    'result = 5 >> increment;'
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
      const manifest = ['host-log','collect-if','fold-blocks','fold-fees','block-steps','nullary-block','import-gui'].includes(example.id)
        ? read('host.json') : undefined;
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
    'result = if: ((student >> score) >= 6), then: (true), else: (false);'
  ].join('\n');
  assert.equal(bridge.version,'0.77.0');
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
  const source='result = 7 >> (_ > 5);';
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

test('0.6 browser AST separates FieldGet, FieldSection and Apply', () => {
  const src=[
    'lesson = {hours: 2};',
    'direct = lesson ~ hours;',
    'from section = lesson >> (_ ~ hours);',
    'result = 5 >> (_ + 1);'
  ].join('\n');
  for (const target of ['js','php']) {
    const compiled=bridge.compile(src,target);
    assert.equal(compiled.ok,true,compiled.message);
  }
  const inspection=bridge.ast(src);
  assert.equal(inspection.ok,true,inspection.message);
  const defs=JSON.parse(inspection.output).definitions;
  assert.equal(defs[1].body.kind,'FieldGet');
  assert.equal(defs[1].body.key,'hours');
  assert.equal(defs[1].body.record.value,'lesson');
  assert.equal(defs[2].body.kind,'Apply');
  assert.equal(defs[2].body.callee.kind,'FieldSection');
  assert.equal(defs[2].body.callee.key,'hours');
  assert.equal(defs[3].body.kind,'Apply');
});

test('browser compiler and AST preserve multiword field keys', () => {
  const source = 'lesson = {"total hours": 3}; result = lesson ~ total hours;';
  const js = bridge.compile(source, 'js');
  const php = bridge.compile(source, 'php');
  assert.equal(js.ok, true, js.message);
  assert.equal(php.ok, true, php.message);
  assert.equal(runInNewContext(js.output + '\nresult', {}), 3);
  const ast = bridge.ast(source);
  assert.equal(ast.ok, true, ast.message);
  const field = JSON.parse(ast.output).definitions[1].body;
  assert.equal(field.kind, 'FieldGet');
  assert.equal(field.key, 'total hours');
  assert.equal(field.record.kind, 'Name');
});

test('browser parser supports unquoted multiword record keys', () => {
  const source = 'lesson = {total hours: 3}; result = lesson ~ total hours;';
  for (const target of ['js', 'php']) {
    const compilation = bridge.compile(source, target);
    assert.equal(compilation.ok, true, compilation.message);
    if (target === 'js') assert.equal(runInNewContext(compilation.output + '\nresult', {}), 3);
  }
  const inspected = bridge.ast(source);
  assert.equal(inspected.ok, true, inspected.message);
  const definitions = JSON.parse(inspected.output).definitions;
  assert.equal(definitions[0].body.kind, 'Record');
  assert.equal(definitions[0].body.fields[0].key, 'total hours');
  assert.equal(definitions[1].body.kind, 'FieldGet');
  assert.equal(definitions[1].body.key, 'total hours');
});

test('0.7 natural conditional and if:then:else: have the same canonical AST', () => {
  const concise = 'result = if (1 < 2) then "valid" else "invalid";';
  const verbose = 'result = if: (1 < 2), then: ("valid"), else: ("invalid");';
  const a = bridge.ast(concise);
  const b = bridge.ast(verbose);
  assert.equal(a.ok, true, a.message);
  assert.equal(b.ok, true, b.message);
  const left = JSON.parse(a.output).definitions[0].body;
  const right = JSON.parse(b.output).definitions[0].body;
  assert.deepEqual(left, right);
  assert.equal(left.kind, 'Conditional');
  assert.equal(left.condition.kind, 'Binary');
  for (const target of ['js', 'php']) {
    const output = bridge.compile(concise, target);
    assert.equal(output.ok, true, output.message);
    assert.equal(typeof output.output, 'string');
  }
});

test('Studio natural conditional preset compiles with no host declarations', async () => {
  const url = pathToFileURL(resolve(site, 'examples.js')).href;
  const {examples} = await import(url);
  const example = examples.find(x => x.id === 'natural-if');
  assert.ok(example);
  for (const target of ['js', 'php']) {
    const built = bridge.compile(example.source, target);
    assert.equal(built.ok, true, built.message);
  }
});

test('0.7.1 optional conditional punctuation has the same browser AST', () => {
  const variants = [
    'result = if (1 < 2), then: ("valid"), else: ("invalid");',
    'result = if (1 < 2) then "valid" else "invalid";',
    'result = if: (1 < 2), then: ("valid"), else: ("invalid");'
  ];
  const first = bridge.ast(variants[0]);
  assert.equal(first.ok, true, first.message);
  const expected = JSON.parse(first.output).definitions[0].body;
  assert.equal(expected.kind,'Conditional');
  for (const source of variants) {
    const ast = bridge.ast(source);
    assert.equal(ast.ok,true,ast.message);
    assert.deepEqual(JSON.parse(ast.output).definitions[0].body,expected);
    for (const target of ['js','php']) {
      const build = bridge.compile(source,target);
      assert.equal(build.ok,true,build.message);
    }
  }
});

test('0.8 Studio AST exposes Block and resolves repeated _ as one lexical name', () => {
  const source = [
    'lesson = {hours: 2, rate: 30};',
    'fee = {_ | (_ ~ hours) * (_ ~ rate)};',
    'result = lesson >> fee;'
  ].join('\n');
  const ast = bridge.ast(source);
  assert.equal(ast.ok,true,ast.message);
  const parsed = JSON.parse(ast.output).definitions;
  const block = parsed[1].body;
  assert.equal(block.kind,'Block');
  assert.deepEqual(block.parameters,['_']);
  assert.equal(block.body.kind,'Binary');
  assert.equal(block.body.left.kind,'FieldGet');
  assert.equal(block.body.left.record.kind,'Name');
  assert.equal(block.body.left.record.value,'_');
  assert.equal(block.body.right.kind,'FieldGet');
  assert.equal(block.body.right.record.value,'_');
  const js=bridge.compile(source,'js');
  const php=bridge.compile(source,'php');
  assert.equal(js.ok,true,js.message);
  assert.equal(php.ok,true,php.message);
  assert.equal(runInNewContext(js.output+'\nresult',{}),60);
});

test('0.9 AST exposes multiple block parameters and preserves prior unary blocks', () => {
  const source='numbers = [1,2,3]; reducer = {total, item | total + item}; result = 0;';
  const ast=bridge.ast(source);
  assert.equal(ast.ok,true,ast.message);
  const block=JSON.parse(ast.output).definitions[1].body;
  assert.equal(block.kind,'Block');
  assert.deepEqual(block.parameters,['total','item']);
  assert.equal(block.body.kind,'Binary');
  assert.equal(block.body.left.kind,'Name');
  assert.equal(block.body.right.kind,'Name');
  for (const target of ['js','php']) {
    const compiled=bridge.compile(source,target);
    assert.equal(compiled.ok,true,compiled.message);
  }
});

test('0.10 precedence and bare block selector arguments preserve canonical AST', () => {
  const source = [
    'lessons = [{hours: 2, rate: 30}, {hours: 1.5, rate: 40}];',
    'result = fold: lessons,',
    '  with: {total, lesson | total + (lesson ~ hours * lesson ~ rate)},',
    '  from: 0;'
  ].join('\n');
  const manifest=read('host.json');
  const ast=bridge.ast(source,manifest);
  assert.equal(ast.ok,true,ast.message);
  const body=JSON.parse(ast.output).definitions[1].body;
  assert.equal(body.kind,'Call');
  assert.equal(body.selector,'fold:with:from:');
  const reducer=body.arguments[1];
  assert.equal(reducer.kind,'Block');
  assert.deepEqual(reducer.parameters,['total','lesson']);
  const expression=reducer.body;
  assert.equal(expression.kind,'Binary');
  assert.equal(expression.symbol,'+');
  const multiply=expression.right;
  assert.equal(multiply.kind,'Binary');
  assert.equal(multiply.symbol,'*');
  assert.equal(multiply.left.kind,'FieldGet');
  assert.equal(multiply.left.key,'hours');
  assert.equal(multiply.right.kind,'FieldGet');
  assert.equal(multiply.right.key,'rate');
  for (const target of ['js','php']) {
    const compiled=bridge.compile(source,target,manifest);
    assert.equal(compiled.ok,true,compiled.message);
  }
});

test('0.11 Steps appears only in multi-expression blocks in the Studio AST', () => {
  const source=[
    'rate = 3;',
    'fee = {hours | hours + 1; hours * rate};',
    'result = 4 >> fee;'
  ].join('\n');
  const ast=bridge.ast(source);
  assert.equal(ast.ok,true,ast.message);
  const body=JSON.parse(ast.output).definitions[1].body;
  assert.equal(body.kind,'Block');
  assert.deepEqual(body.parameters,['hours']);
  assert.equal(body.body.kind,'Steps');
  assert.equal(body.body.expressions.length,2);
  assert.equal(body.body.expressions[0].kind,'Binary');
  assert.equal(body.body.expressions[1].kind,'Binary');
  const js=bridge.compile(source,'js');
  const php=bridge.compile(source,'php');
  assert.equal(js.ok,true,js.message);
  assert.equal(php.ok,true,php.message);
  assert.equal(runInNewContext(js.output+'\nresult',{}),12);
  assert.match(php.output,/function\(\$hours\) use \(\$rate\)/);
});

test('0.11 single-expression blocks keep the previous AST shape', () => {
  const ast=bridge.ast('result = 3 >> {n | n * 2};');
  assert.equal(ast.ok,true,ast.message);
  const block=JSON.parse(ast.output).definitions[0].body.callee;
  assert.equal(block.kind,'Block');
  assert.equal(block.body.kind,'Binary');
});

test('0.12 Inspector exposes ordered Local bindings and nested lexical closures', () => {
  const source='result = 4 >> {value | doubled = value * 2; doubled >> {inner | inner + doubled}};';
  const tree=bridge.ast(source);
  assert.equal(tree.ok,true,tree.message);
  const root=JSON.parse(tree.output).definitions[0].body;
  assert.equal(root.kind,'Apply');
  const outer=root.callee;
  assert.equal(outer.kind,'Block');
  assert.equal(outer.body.kind,'Steps');
  assert.equal(outer.body.expressions[0].kind,'Local');
  assert.equal(outer.body.expressions[0].name,'doubled');
  assert.equal(outer.body.expressions[0].value.kind,'Binary');
  const inner=outer.body.expressions[1].callee;
  assert.equal(inner.kind,'Block');
  assert.equal(inner.body.kind,'Binary');
  assert.equal(inner.body.right.value,'doubled');
  for (const target of ['js','php']) {
    const compiled=bridge.compile(source,target);
    assert.equal(compiled.ok,true,compiled.message);
  }
  const js=bridge.compile(source,'js');
  assert.equal(runInNewContext(js.output+'\nresult',{}),16);
});

test('0.12.2 Studio diagnostics report local forward reference and mangled shadowing with locations',()=>{
  for (const [source,pattern] of [
    ['result = 4 >> {x | first = later + x; later = 1; first};', /Local value 'later' used before its declaration at 1:\d+/],
    ['a b = 3; result = 4 >> {aB | a b + aB};', /Generated-name collision.*block parameter.*at 1:\d+/]
  ]) {
    for (const target of ['js','php']) {
      const compiled=bridge.compile(source,target);
      assert.equal(compiled.ok,false,source);
      assert.match(compiled.message,pattern,source);
    }
  }
  const good=bridge.compile('result = 4 >> {x | doubled = x * 2; doubled >> {y | y + doubled}};','js');
  assert.equal(good.ok,true,good.message);
  assert.equal(runInNewContext(good.output+'\nresult',{}),16);
});


test('0.12.2 Studio validates named-function parameter hygiene for JS/PHP', () => {
  for (const source of [
    'sum: a b, and: aB = a b + aB; result = sum: 2, and: 3;',
    'identity: aB = aB; a b = 5; result = identity: 2;',
    'identity: __miraHost = __miraHost; result = identity: 2;'
  ]) {
    for (const target of ['js', 'php']) {
      const compiled = bridge.compile(source, target);
      assert.equal(compiled.ok, false, source + ' / ' + target);
      assert.match(compiled.message, /(Generated-name collision|Reserved function parameter).*at 1:\d+/);
    }
  }
  const valid = 'x = 100; increment: x = x + 1; result = increment: 5;';
  const js = bridge.compile(valid, 'js');
  const php = bridge.compile(valid, 'php');
  assert.equal(js.ok, true, js.message);
  assert.equal(php.ok, true, php.message);
  assert.equal(runInNewContext(js.output + '\nresult', {}), 6);
  const executed = spawnSync('php', ['-r',
    php.output.replace(/^<\?php/, '') + '\necho $result;'], { encoding: 'utf8' });
  assert.equal(executed.status, 0, executed.stderr);
  assert.equal(executed.stdout, '6');
});

test('0.13 browser compiler returns optional locations without modifying code', () => {
  const source = '# comment\n  read: item = item ~ missing;\nresult = read: {present: 1};';
  for (const target of ['js','php']) {
    const plain = bridge.compile(source, target);
    const mapped = bridge.compile(source, target, undefined, true);
    assert.equal(mapped.ok, true, mapped.message);
    assert.equal(mapped.output, plain.output);
    assert.equal(plain.locations, undefined);
    assert.equal(mapped.locations[0].line, 2);
    assert.equal(mapped.locations[0].column, 3);
    assert.equal(mapped.locations[0].name, 'read:');
    assert.match(mapped.output.split('\n')[mapped.locations[0].generatedStartLine - 1], /function read/);
  }
});

test('0.13 Studio worker reports Mira definition on runtime failure and retains native message', () => {
  function execute(source, includeLocations = true, host) {
    const compiled = bridge.compile(source, 'js', host, includeLocations);
    assert.equal(compiled.ok, true, compiled.message);
    let reply;
    const context = {self: {postMessage(message) { reply = message; }}};
    runInNewContext(read('worker.js'), context);
    context.self.onmessage({data: {code: compiled.output, locations: compiled.locations}});
    return reply;
  }
  const missing = '# comment\n  read: item = item ~ missing;\nresult = read: {present: 1};';
  const failure = execute(missing);
  assert.equal(failure.ok, false);
  assert.match(failure.message, /Missing record field: missing/);
  assert.equal(failure.location.line, 2);
  assert.equal(failure.location.column, 3);
  assert.equal(failure.location.name, 'read:');
  assert.ok(Number.isInteger(failure.location.generatedLine));
  assert.equal(execute(missing, false).location, undefined);

  const host = JSON.stringify({selectors: ['filter:with:']});
  const hostFailure = execute('# comment\nresult = filter: 1, with: {_ | true};', true, host);
  assert.equal(hostFailure.ok, false);
  assert.match(hostFailure.message, /expects a bounded list/);
  assert.equal(hostFailure.location.line, 2);
  assert.equal(hostFailure.location.name, 'result');

  const success = execute('result = 42;');
  assert.equal(success.ok, true);
  assert.equal(success.output, '42');
  assert.equal(success.location, undefined);
  assert.match(read('app.js'), /Mira: riga/);
});


test('0.14 Studio executes nullary blocks, preserves closure capture and exposes AST', async () => {
  const source = 'result = 20 >> {x | y = x + 1; action = {| y * 2}; () >> action};';
  const js = bridge.compile(source, 'js');
  assert.equal(js.ok,true,js.message);
  assert.equal(runInNewContext(js.output + '\nresult', {}),42);
  const php = bridge.compile(source,'php');
  assert.equal(php.ok,true,php.message);
  const executed = spawnSync('php', ['-r', php.output.replace(/^<\?php/, '') + '\necho $result;'],
    {encoding:'utf8'});
  assert.equal(executed.status,0,executed.stderr);
  assert.equal(executed.stdout,'42');

  const ast = JSON.parse(bridge.ast('action = {| 42}; result = () >> action;').output);
  assert.equal(ast.definitions[0].body.kind,'Block');
  assert.deepEqual(ast.definitions[0].body.parameters,[]);
  assert.equal(ast.definitions[1].body.kind,'Apply');
  assert.equal(ast.definitions[1].body.argument,null);
  const {childrenOf} = await import(pathToFileURL(resolve(site,'inspector-host.js')).href);
  assert.deepEqual(childrenOf(ast.definitions[1].body),[ast.definitions[1].body.callee]);
  assert.match(read('ast-inspector.js'), /Apply · 0 argomenti/);

  const logSource = '() >> {| log "hey"}; result = () >> {| 42};';
  const compiled = bridge.compile(logSource,'js',read('host.json'));
  assert.equal(compiled.ok,true,compiled.message);
  let response;
  const worker = {self:{postMessage(message){response=message;}}};
  runInNewContext(read('worker.js'),worker);
  worker.self.onmessage({data:{code:compiled.output}});
  assert.equal(response.ok,true,response.message);
  assert.equal(response.output,'hey\n42');
  assert.match(bridge.compile('result = ();','js').message,/Empty \(\) is only allowed before >>/);
});

test('Laboratory publishes historical data and precomputed accessible charts offline', () => {
  const source = JSON.parse(readFileSync(resolve(root,'catalog/laboratory/gui-rendering.json'),'utf8'));
  assert.deepEqual(JSON.parse(read('lab-gui-rendering.json')),source);
  const html = read('laboratory.html');
  assert.match(read('index.html'), /href="\.\/laboratory\.html"/);
  assert.match(html, /href="\.\/gui-benchmark\.html"/);
  assert.doesNotMatch(html, /<script\b/);
  assert.equal((html.match(/class="lab-track"/g) ?? []).length,64);
  assert.match(html, /3,3 µs/);
  assert.match(html, /910 µs/);
  assert.match(html, /non sono stati rieseguiti/);
  assert.equal(source.schema,2);
  assert.equal(source.ci.length,18);
  assert.equal(source.devices.length,2);
  assert.equal(source.timeline.length,20);
  assert.equal(source.ci.at(-1).browser.version,'0.34.0');
  assert.equal(source.ci.reduce((n,r)=>n+(r.browser?.results.length??0)+(r.browser?.form?.length??0)+(r.browser?.hybrid?.length??0)+(r.browser?.textExperiment?.results.length??0)+(r.batch?.results.length??0)+(r.containment?.results.length??0)+(r.laboratory?.reports.length??0),0),244);
  assert.equal(source.devices[0].results[1].specialized.medianMs,1.233);
  assert.equal(source.devices[1].results[1].direct.medianMs,25.967);
  assert.match(html,/26,290 ms/);
  assert.match(html,/Rendering ibrido/);
  assert.match(html,/Componenti componibili/);
  assert.match(html,/139377247685/);
  assert.match(html,/139404483141/);
  assert.match(html,/139425561403/);
  assert.match(html,/139433834245/);
  assert.match(html,/139440393387/);
  assert.match(html,/139498951983/);
  assert.match(html,/Laboratory reale · 0.29.0/);
  assert.match(html,/2,170/);
  assert.match(html,/Dopo nuova visita/);
  assert.match(html,/riapertura del documento e rimozione salvata/);
  assert.equal(source.ci.at(-1).correctness.persistenceReload,true);
  assert.deepEqual(source.ci.at(-1).correctness.keyed.modes,['native','fallback']);
  assert.match(html,/id="lab-render-normal"/);
  assert.match(html,/class="lab-card lab-always"><h2 id="architecture"/);
  assert.match(read('styles.css'),/contain-intrinsic-block-size:auto 240px/);
  assert.match(html,/CSS containment · 0.28.0/);
  assert.match(html,/Raggruppamento · 0.27.0/);
  assert.match(html,/Anteprima e ispettore/);
  for(const file of ['laboratory.html','lab-gui-rendering.json']) assert.ok(read('sw.js').includes('./'+file));
  assert.match(read('sw.js'), /url\.pathname\.endsWith\('\/laboratory\.html'\)/);
});


test('0.25 preview renderer selection and inspector are bundled and sandboxed',()=>{
  assert.match(read('index.html'),/id="previewRenderer"/);
  assert.match(read('app.js'),/mode: \$\('previewRenderer'\)\.value/);
  assert.match(read('app.js'),/source: ui\.source\.value/);
  assert.match(read('ui-preview.html'),/id="renderer-inspector"/);
  assert.match(read('ui-preview.html'),/src="\.\/compiler\.js"/);
  assert.match(read('ui-preview.html'),/src="\.\/gui-specialize\.js"/);
  assert.match(read('ui-preview.js'),/event\.source !== window\.parent/);
  assert.match(read('app.js'),/sandbox', 'allow-scripts'/);
});


test('0.30 browser imports the bundled canonical GUI without network access',()=>{
  const library=readFileSync(resolve(root,'lib/gui.mira'),'utf8');
  const entry='result = column: [title: "Mira", text: 42];';
  for(const target of ['js','php']){
    const direct=bridge.compile(library+'\n'+entry,target);
    const imported=bridge.compile('import "lib/gui.mira";\n'+entry,target,undefined,true);
    assert.equal(imported.ok,true,imported.message);
    assert.equal(imported.output,direct.output);
    assert.ok(imported.locations.some(l=>l.file==='lib/gui.mira'));
  }
  const ast=JSON.parse(bridge.ast('import "lib/gui.mira";\n'+entry).output);
  assert.ok(ast.definitions.some(d=>d.file==='lib/gui.mira'&&d.selector==='column:'));
  assert.equal(ast.definitions.at(-1).line,2);
});

test('0.30 virtual project graph is shared by compile, AST and trace',()=>{
  const files=JSON.stringify({
    'fees.mira':'import "shared/rate.mira"; fee: hours = hours * rate;',
    'summary.mira':'import "shared/rate.mira"; doubled: n = n * 2;',
    'shared/rate.mira':'rate = 30;'
  });
  const source='import "fees.mira"; import "summary.mira"; import "fees.mira"; result = doubled: (fee: 2);';
  const js=bridge.compile(source,'js',undefined,true,files);
  assert.equal(js.ok,true,js.message);
  assert.equal(runInNewContext(js.output+'\nresult',{}),120);
  const php=bridge.compile(source,'php',undefined,false,files);
  assert.equal(php.ok,true,php.message);
  const run=spawnSync('php',['-r',php.output.replace(/^<\?php/,'')+'\necho $result;'],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);assert.equal(run.stdout,'120');
  const ast=JSON.parse(bridge.ast(source,undefined,files).output);
  assert.equal(ast.definitions.filter(d=>d.name==='rate').length,1);
  assert.equal(ast.definitions[0].file,'shared/rate.mira');
  const trace=JSON.parse(bridge.trace(source,undefined,files).output);
  assert.equal(trace.declarations.filter(d=>d.name==='rate').length,1);
});

test('0.30 import diagnostics preserve dependency coordinates and reject invalid graphs',()=>{
  const check=(source,files,pattern)=>{
    const result=bridge.compile(source,'js',undefined,false,JSON.stringify(files));
    assert.equal(result.ok,false,source);
    assert.match(result.message,pattern);
  };
  check('import "a.mira";',{'a.mira':'import "b.mira";','b.mira':'import "a.mira";'},/Import cycle: a\.mira -> b\.mira -> a\.mira.*b\.mira:1:1/);
  check('import "a.mira";',{'a.mira':'\nresult = @;'},/a\.mira:2:10/);
  check('import "a.mira";',{'a.mira':'\nresult = missing;'},/a\.mira:2:/);
  check('import "a.mira";',{'a.mira':'42;'},/declarations only.*a\.mira:1:1/);
  check('import "a.mira";',{},/Module not found: a\.mira/);
  check('import "../a.mira";',{},/Invalid module path/);
  check('import "https://example.org/a.mira";',{},/Invalid module path/);
  check('import "a.mira"',{},/Expected ; after import/);
  check('value = 1; import "a.mira";',{},/Imports must precede definitions/);
  check('import "a.mira"; x = 2;',{'a.mira':'x = 1;'},/Duplicate or conflicting value x/);
});


test('0.31 native update has a normal selector AST and no host dependency',()=>{
  const source='original = {name: "Ada", hours: 2}; result = original >> (update: _, with: {hours: 3});';
  const ast=JSON.parse(bridge.ast(source).output);
  assert.equal(ast.definitions.at(-1).body.callee.kind,'Section');
  assert.equal(ast.definitions.at(-1).body.callee.selector,'update:with:');
  const built=bridge.compile(source,'js');
  assert.equal(built.ok,true,built.message);
  assert.equal(JSON.stringify(runInNewContext(built.output+'\nresult',{})),'{"name":"Ada","hours":3}');
  const trace=JSON.parse(bridge.trace(source).output);
  assert.ok(trace.symbols.some(s=>s.name==='update:with:'&&s.kind==='native selector'));
});


test('0.32 native collection resolution and explicit legacy host override',()=>{
  const source='result = fold: [1, 2], with: {sum, n | sum + n}, from: 0;';
  const host=JSON.stringify({selectors:['fold:with:from:']});
  const native=bridge.compile(source,'js');
  const external=bridge.compile(source,'js',host);
  assert.equal(native.ok,true,native.message);assert.equal(external.ok,true,external.message);
  assert.equal(runInNewContext(native.output+'\nresult',{}),3);
  assert.equal(runInNewContext(external.output+'\nresult',{__miraHost:{'fold:with:from:':()=>42}}),42);
  assert.equal(JSON.parse(bridge.ast(source).output).definitions.at(-1).body.kind,'Call');
  assert.equal(JSON.parse(bridge.ast(source,host).output).definitions.at(-1).body.kind,'HostCall');
  const conflict=bridge.compile('result = append: 1, to: [];','js',JSON.stringify({selectors:['append:to:']}));
  assert.equal(conflict.ok,false);assert.match(conflict.message,/Reserved native selector/);
});


test('0.34 persistence adapter restores JSON, preserves corrupt data and reports write errors',()=>{
  const sandbox={};runInNewContext(read('persistent-state.js'),sandbox);
  const open=sandbox.MiraPersistentState.open;
  const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const valid=v=>v&&Number.isSafeInteger(v.count)&&v.count>=0;
  const a=open(storage,'test',1,{count:0},valid);
  assert.equal(a.save({count:2}),true);
  assert.equal(open(storage,'test',1,{count:0},valid).initial.count,2);
  assert.equal(a.save({count:-1}),false);
  assert.equal(open(storage,'test',1,{count:0},valid).initial.count,2);
  memory.set('test','broken JSON');
  const b=open(storage,'test',1,{count:0},valid);
  assert.equal(b.status().blocked,true);assert.equal(b.save({count:4}),false);
  assert.equal(memory.get('test'),'broken JSON');
  assert.equal(b.reset(),true);assert.equal(b.save({count:4}),true);
  const wrongVersion=open(storage,'test',2,{count:0},valid);
  assert.equal(wrongVersion.status().blocked,true);
  const denied=open({...storage,setItem(){throw Error('quota');}},'test',1,{count:0},valid);
  assert.equal(denied.save({count:5}),false);assert.match(denied.status().message,/quota/);
});
test('0.34 ledger compiles on both targets and is bundled offline',()=>{
  const source=read('persistent-ledger.mira'),host=JSON.stringify({callables:['render']});
  for(const target of ['js','php'])assert.equal(bridge.compile(source,target,host).ok,true,bridge.compile(source,target,host).message);
  const sandbox={};runInNewContext(read('persistent-ledger-program.js'),sandbox);
  let spec;sandbox.MiraLessonLedgerProgram({render:v=>{spec=v;}});
  assert.equal(spec.type,'state');assert.equal(spec.initial['next id'],1);
  assert.ok(spec.view(spec.initial).children.length>0);
  for(const asset of ['persistent-ledger.html','persistent-ledger.css','persistent-state.js','persistent-ledger.js','persistent-ledger-program.js','persistent-ledger.mira']){
    assert.ok(existsSync(resolve(site,asset)));assert.ok(read('sw.js').includes('./'+asset));
  }
  assert.match(read('index.html'),/href="\.\/persistent-ledger.html"/);
  assert.equal(bridge.compile('result = collect: [1], if: (_ > 0);','js').ok,false);
});

test('effects pilot is built and offline-cacheable',()=>{
  for(const asset of ['effects.js','effects-demo.mira','effects-demo.js','effects-demo.html','effects-demo-program.js']){
    assert.ok(existsSync(resolve(site,asset)));
    assert.ok(read('sw.js').includes("'./"+asset+"'"));
  }
  assert.match(read('index.html'),/href="\.\/effects-demo\.html"/);
});

test('type laboratory is available offline and uses the real compiler',()=>{
  const result=bridge.check('identity: x = x; a = identity: 1; b = identity: "ok";');
  assert.equal(result.ok,true,result.message);
  assert.deepEqual(JSON.parse(result.output).map(x=>x.type),["('a) -> 'a","Number","Text"]);
  const bad=bridge.check('a = 1 + "oops";');
  assert.equal(bad.ok,false);
  assert.match(bad.message,/expected Number, got Text/);
  for(const asset of ['type-lab.html','type-lab.js']){
    assert.ok(read(asset).length>0);
    assert.ok(read('sw.js').includes(asset));
  }
  assert.ok(read('index.html').includes('type-lab.html'));
});

test('browser checker infers mutually recursive functions',()=>{
  const checked=bridge.check('even: n = if (n <= 0) then true else (odd: (n - 1)); odd: n = if (n <= 0) then false else (even: (n - 1));');
  assert.equal(checked.ok,true,checked.message);
  assert.deepEqual(JSON.parse(checked.output).map(x=>x.type),['(Number) -> Boolean','(Number) -> Boolean']);
});

test('browser checker supports local polymorphism and open record updates',()=>{
  const result=bridge.check('rename: r = update: r, with: {name: "Ada"}; result = () >> {| id = {x | x}; {n: (1 >> id), s: ("x" >> id), r: (rename: {name: true, age: 20})}};');
  assert.equal(result.ok,true,result.message);
  assert.equal(JSON.parse(result.output).at(-1).type,'{n: Number, r: {age: Number, name: Text}, s: Text}');
});

test('browser checker exposes inferred scalar predicates',()=>{
  const checked=bridge.check('same: a, as: b = a == b; n = same: 1, as: 2; t = same: "a", as: "a";');
  assert.equal(checked.ok,true,checked.message);
  assert.deepEqual(JSON.parse(checked.output).map(x=>x.type),["('a, 'a) -> Boolean where 'a: ScalarEq",'Boolean','Boolean']);
  const bad=bridge.check('same: a, as: b = a == b; n = same: [1], as: [2];');
  assert.equal(bad.ok,false);
  assert.match(bad.message,/ScalarEq requires/);
});

test('browser checker reports structured expression locations and imported files',()=>{
  const bad=bridge.check('x = 1;\ny = x + "a";');
  assert.equal(bad.ok,false);
  assert.deepEqual(JSON.parse(JSON.stringify(bad.diagnostic)),{
    code:'type_error',message:'Type check: expected Number, got Text',file:null,line:2,column:7,endLine:2,endColumn:8
  });
  const missing=bridge.check('import "broken.mira";\na = 1;',null,JSON.stringify({'broken.mira':'f: x = x + "a";'}));
  assert.equal(missing.ok,false);
  assert.equal(missing.diagnostic.file,'broken.mira');
  assert.equal(missing.diagnostic.column,10);
  const syntax=bridge.check('x = @;');
  assert.equal(syntax.ok,false);
  assert.equal(syntax.diagnostic.code,'source_error');
});

test('typed host signatures are available in Studio and keep diagnostics',()=>{
  const manifest=JSON.stringify({values:['rate'],callables:['format'],types:{rate:'Number',format:{parameters:['Number'],result:'Text'}}});
  const good=bridge.check('quote: hours = format (hours * rate); result = quote: 2;',manifest);
  assert.equal(good.ok,true,good.message);
  assert.deepEqual(JSON.parse(good.output).map(x=>x.type),['(Number) -> Text','Text']);
  const bad=bridge.check('result = format true;',manifest);
  assert.equal(bad.ok,false);assert.equal(bad.diagnostic.code,'type_error');
  const invalid=bridge.check('x = 1;',JSON.stringify({types:{fake:'Number'}}));
  assert.equal(invalid.ok,false);assert.equal(invalid.diagnostic.code,'host_type_error');
});

test('Studio exports deterministic schemas and specializes functions without executing them',()=>{
  const source='quote: p = {hours: (p ~ hours), total: (p ~ hours * 30)};';
  const report=bridge.check(source);
  assert.equal(report.ok,true,report.message);
  const open=JSON.parse(report.output)[0].schema;
  assert.equal(open.parameters[0].tail.row,true);
  assert.deepEqual(open.parameters[0].tail.lacks,['hours']);
  const args=JSON.stringify([{record:{hours:'Number'}}]);
  const specialized=bridge.specialize(source,'quote:',args);
  assert.equal(specialized.ok,true,specialized.message);
  const sig=JSON.parse(specialized.output).schema;
  assert.equal(sig.parameters[0].tail,null);
  assert.deepEqual(sig.result,{kind:'Record',fields:[{name:'hours',type:{kind:'Number'}},{name:'total',type:{kind:'Number'}}],tail:null});
  assert.equal(bridge.specialize(source,'quote:',JSON.stringify([{record:{hours:'Text'}}])).ok,false);
  assert.equal(bridge.specialize(source,'missing:',args).ok,false);
});

test('Studio infers with annotations and specializes closed annotated signatures',()=>{
  const source='quote: p ({hours: Number}) -> {total: Number} = {total: (p ~ hours * 30)};';
  const report=bridge.check(source);
  assert.equal(report.ok,true,report.message);
  assert.equal(JSON.parse(report.output)[0].type,'({hours: Number}) -> {total: Number}');
  const specialized=bridge.specialize(source,'quote:',JSON.stringify([{record:{hours:'Number'}}]));
  assert.equal(specialized.ok,true,specialized.message);
  const bad=bridge.check('x (Text) = 1;');
  assert.equal(bad.ok,false);assert.equal(bad.diagnostic.column,4);
  for(const target of ['js','php'])assert.equal(bridge.compile(source,target).ok,true);
});

test('Studio checks annotated block parameters and anchors errors at local type tokens',()=>{
  const source='result = 2 >> {hours (Number) | rate (Number) = 30; hours * rate};';
  const checked=bridge.check(source);
  assert.equal(checked.ok,true,checked.message);assert.equal(JSON.parse(checked.output)[0].type,'Number');
  const bad=bridge.check('r = () >> {|\n  a (Text) = 1;\n  a\n};');
  assert.equal(bad.ok,false);assert.equal(bad.diagnostic.line,2);assert.equal(bad.diagnostic.column,6);
  for(const target of ['js','php'])assert.equal(bridge.compile(source,target).ok,true);
});

test('Studio checks nominal declarations and preserves their identity in schemas',()=>{
  const source='Student Id :: Number; Request Id :: Number; student (Student Id) = 42; request (Request Id) = 7; read student: id (Student Id) = id; result = read student: student;';
  const checked=bridge.check(source);
  assert.equal(checked.ok,true,checked.message);
  const entries=JSON.parse(checked.output);
  assert.deepEqual(JSON.parse(JSON.stringify(entries.find(x=>x.name==='student').schema)),{kind:'Named',name:'Student Id',base:{kind:'Number'}});
  assert.equal(entries.find(x=>x.name==='result').type,'Student Id');
  assert.equal(bridge.check(source+'bad = read student: request;').ok,false);
  const imported=bridge.check('import "types.mira"; id (Student Id) = 42;',null,JSON.stringify({'types.mira':'Student Id :: Number;'}));
  assert.equal(imported.ok,true,imported.message);
  assert.equal(JSON.parse(imported.output)[0].type,'Student Id');
});

test('Studio checks projected nominal record shapes and exports open structural schemas',()=>{
  const source='Size :: {width: Number}; Window :: {width: Number, title: Text}; w (Window) = {width: 12, title: "Mira"}; width of: s (~ Size) = s ~ width; result = width of: w;';
  const checked=bridge.check(source);
  assert.equal(checked.ok,true,checked.message);
  const entries=JSON.parse(checked.output);
  assert.deepEqual(entries.find(x=>x.name==='width of:').schema.parameters[0],{kind:'Structural',name:'Size',fields:[{name:'width',type:{kind:'Number'}}],open:true});
  assert.equal(entries.find(x=>x.name==='result').type,'Number');
  assert.equal(bridge.check(source+'bad = width of: {title: "x"};').ok,false);
  for(const target of ['js','php'])assert.equal(bridge.compile(source,target).ok,true);
});

test('Studio exports bounded refinement schemas and rejects unknown or invalid proofs',()=>{
  const source='Percentage :: Number where _ >= 0 AND _ <= 100; p (Percentage) = 42; valid = p > 0 AND p <= 100;';
  const checked=bridge.check(source);assert.equal(checked.ok,true,checked.message);
  const schema=JSON.parse(checked.output).find(x=>x.name==='p').schema;
  assert.deepEqual(schema,{kind:'Named',name:'Percentage',base:{kind:'Refined',base:{kind:'Number'},range:{lower:0,upper:100,lowerInclusive:true,upperInclusive:true}}});
  assert.equal(bridge.check(source+'bad (Percentage) = 101;').ok,false);
  assert.equal(bridge.check(source+'good (Percentage) = 20 + 30;').ok,true);
  for(const target of ['js','php'])assert.equal(bridge.compile(source,target).ok,true);
});

test('Studio compiles logical words and first-class operators through its real compiler',()=>{
  const source='sum = fold: [1, 2, 3], with: (+), from: 0; valid = NOT false AND true OR false;';
  const checked=bridge.check(source);assert.equal(checked.ok,true,checked.message);
  assert.deepEqual(JSON.parse(checked.output).map(x=>x.type),['Number','Boolean']);
  for(const target of ['js','php'])assert.equal(bridge.compile(source,target).ok,true);
});

test('Studio proves bounded arithmetic without introducing code generation overhead',()=>{
  const src='Percentage :: Number where _ >= 0 AND _ <= 100; half of: p (Percentage) -> Percentage = p / 2; volume (Percentage) = 50 + 30; result = half of: volume;';
  const report=bridge.check(src);assert.equal(report.ok,true,report.message);
  assert.equal(JSON.parse(report.output).find(x=>x.name==='result').type,'Percentage');
  assert.equal(bridge.check(src+'bad: p (Percentage) -> Percentage = p * 2;').ok,false);
  for(const target of ['js','php']){
    const checked=bridge.compile(src,target);
    const bare=bridge.compile('half of: p = p / 2; volume = 50 + 30; result = half of: volume;',target);
    assert.equal(checked.ok,true);assert.equal(bare.ok,true);assert.equal(checked.output,bare.output);
  }
});

test('design notebook is generated from project documentation and available offline',()=>{
  const notebook=read('design-notes.html');
  assert.match(read('index.html'),/href="\.\/design-notes\.html"/);
  assert.match(read('type-lab.html'),/href="\.\/design-notes\.html"/);
  assert.ok(read('sw.js').includes("'./design-notes.html'"));
  assert.match(notebook,/Quaderno di progettazione/);
  assert.match(notebook,/Moduli Mira — progetto concordato/);
  assert.match(notebook,/Stato: progettazione delle interfacce/);
  assert.match(notebook,/module Music \/ Jazz Harmony;/);
  assert.match(notebook,/import Math \/ Floating Point =&gt; Float Num;/);
  assert.match(notebook,/transpose: by: =&gt; trasponi: di:/);
  assert.match(notebook,/Grammar Lab/);
  assert.match(notebook,/a \+ b ha tipo Number e intervallo \[0,200\]/);
  assert.ok(notebook.includes('Percentage :: Number where _ &gt;= 0 AND _ &lt;= 100;'));
  assert.ok(notebook.includes('non implementata'));
});

test('Studio supports portable Integer and its bounded arithmetic proofs',()=>{
  const src='Retry Count :: Integer where _ >= 0 AND _ <= 3; r (Retry Count) = 2; result (Integer) = r + 1;';
  const report=bridge.check(src);assert.equal(report.ok,true,report.message);
  const entries=JSON.parse(report.output);
  assert.equal(entries.find(x=>x.name==='result').type,'Integer');
  assert.equal(entries.find(x=>x.name==='result').schema.kind,'Integer');
  assert.equal(bridge.check(src+'bad (Integer) = 1 / 2;').ok,false);
  for(const target of ['js','php'])assert.equal(bridge.compile(src,target).ok,true);
});

test('Studio proves conditional refinement results using branch-local facts',()=>{
  const src='Percentage :: Number where _ >= 0 AND _ <= 100; normalize percentage: x (Number) -> Percentage = if (x >= 0 AND x <= 100) then x else 0; result = normalize percentage: 120;';
  const report=bridge.check(src);assert.equal(report.ok,true,report.message);
  assert.equal(JSON.parse(report.output).find(x=>x.name==='result').type,'Percentage');
  assert.equal(bridge.check(src+'bad: x (Number) -> Percentage = if (x >= 0 OR x <= 100) then x else 0;').ok,false);
  for(const target of ['js','php'])assert.equal(bridge.compile(src,target).ok,true);
});

test('Studio exports structured numeric proof failure reasons',()=>{
  for(const [src,proof,reason] of [
    ['x (Integer) = 9007199254740991 + 1;','violated','integer_overflow'],
    ['x (Integer) = 3 / 2;','violated','integer_fractional'],
    ['increment: x (Integer) -> Integer = x + 1;','unknown','integer_unproven'],
    ['Percentage :: Number where _ >= 0 AND _ <= 100; x (Percentage) = 101;','violated','refinement_disjoint'],
    ['Percentage :: Number where _ >= 0 AND _ <= 100; f: x (Number) -> Percentage = x;','unknown','refinement_unproven']
  ]){
    const report=bridge.check(src);
    assert.equal(report.ok,false,src);
    assert.equal(report.diagnostic.code,'type_error');
    assert.equal(report.diagnostic.proof,proof,src);
    assert.equal(report.diagnostic.reason,reason,src);
  }
  const typed='x (Integer) = 9007199254740990 + 1;';
  for(const target of ['js','php']){
    const compiled=bridge.compile(typed,target);
    assert.equal(compiled.ok,true);
    assert.equal(compiled.output,bridge.compile('x = 9007199254740990 + 1;',target).output);
  }
});

test('Studio checked compiler emits guards without changing strict checking or unchecked compilation',()=>{
  const src='Percentage :: Number where _ >= 0 AND _ <= 100; bounded value: x (Number) -> Percentage = x;';
  assert.equal(bridge.check(src).ok,false);
  for(const target of ['js','php']){
    const ordinary=bridge.compile(src,target);
    const checked=bridge.compile(src,target,null,true,null,true);
    assert.equal(ordinary.ok,true,ordinary.message);assert.equal(checked.ok,true,checked.message);
    assert.ok(!ordinary.output.includes('__miraNumericValue'));
    assert.match(checked.output,/__miraNumericValue/);
    assert.ok(checked.locations.length>0);
    const proven='x (Integer) = 42;';
    assert.equal(bridge.compile(proven,target,null,false,null,true).output,bridge.compile(proven,target).output);
    assert.equal(bridge.compile('bad (Integer) = 9007199254740991 + 1;',target,null,false,null,true).diagnostic.reason,'integer_overflow');
  }
  assert.match(read('type-lab.html'),/checked-js/);
  assert.match(read('type-lab.html'),/checked-php/);
});

test('Studio checks typed fallible validation and exposes its AST',()=>{
  const src='Percentage :: Number where _ >= 0 AND _ <= 100; use percent: p (Percentage) = p + 0; result = validate: (120), as: (Percentage), then: {p | use percent: p}, else: {error | 0};';
  const report=bridge.check(src);
  assert.equal(report.ok,true,report.message);
  assert.equal(JSON.parse(report.output).find(x=>x.name==='result').type,'Number');
  const ast=bridge.ast(src);assert.equal(ast.ok,true,ast.message);
  assert.equal(JSON.parse(ast.output).definitions.find(x=>x.name==='result').body.kind,'Validate');
  for(const target of ['js','php']){
    const compiled=bridge.compile(src,target,null,false,null,true);assert.equal(compiled.ok,true,compiled.message);
  }
  assert.equal(runInNewContext(bridge.compile(src,'js').output+'\nresult',{}),0);
  assert.match(read('type-lab.html'),/validation-example/);
});

test('Studio exposes nominal sum schemas and constructor ASTs',()=>{
  const src='Connection :: Disconnected | Connected (Text); result = Connected: "Ada";';
  const report=bridge.check(src);assert.equal(report.ok,true,report.message);
  const entries=JSON.parse(report.output);
  const result=entries.find(x=>x.name==='result');
  assert.equal(result.type,'Connection');
  assert.deepEqual(result.schema,{kind:'Sum',name:'Connection',alternatives:[{tag:'Connected',payload:{kind:'Text'}},{tag:'Disconnected',payload:null}]});
  const ast=bridge.ast(src);assert.equal(ast.ok,true,ast.message);
  assert.equal(JSON.parse(ast.output).definitions.find(x=>x.name==='Connected:').body.kind,'Variant');
  for(const target of ['js','php'])assert.equal(bridge.compile(src,target,null,false,null,true).ok,true);
  assert.equal(bridge.check(src+'bad (Connection) = {tag: "Connected", value: "Ada"};').ok,false);
  assert.match(read('type-lab.html'),/sum-example/);
});

test('Studio exposes Match and verifies exhaustive typed alternatives',()=>{
  const src='Connection :: Disconnected | Connected (Text); connection = Connected: "Ada"; result = match: connection {disconnected: {| "offline"}, connected: {s | s}};';
  const report=bridge.check(src);assert.equal(report.ok,true,report.message);
  assert.equal(JSON.parse(report.output).find(x=>x.name==='result').type,'Text');
  const ast=bridge.ast(src);assert.equal(ast.ok,true,ast.message);
  assert.equal(JSON.parse(ast.output).definitions.find(x=>x.name==='result').body.kind,'Match');
  assert.equal(runInNewContext(bridge.compile(src,'js',null,false,null,true).output+'\nresult',{}),'Ada');
  assert.equal(bridge.check(src+'bad = match: connection {disconnected: {| 0}};').ok,false);
  assert.match(read('type-lab.html'),/match-example/);
});

test('Studio exposes parametric sum schemas with concrete payload types',()=>{
  const src='Result (Success Type, Failure Type) :: Ok (Success Type) | Err (Failure Type); a (Result (Number, Text)) = Ok: 42; result = match: a {ok: {n | n}, err: {e | 0}};';
  const report=bridge.check(src);assert.equal(report.ok,true,report.message);
  const entries=JSON.parse(report.output);
  const a=entries.find(x=>x.name==='a');
  assert.equal(a.type,'Result (Number, Text)');
  assert.deepEqual(a.schema.arguments,[{kind:'Number'},{kind:'Text'}]);
  assert.deepEqual(a.schema.alternatives,[{tag:'Err',payload:{kind:'Text'}},{tag:'Ok',payload:{kind:'Number'}}]);
  assert.equal(runInNewContext(bridge.compile(src,'js',null,false,null,true).output+'\nresult',{}),42);
  assert.equal(bridge.check(src+'bad (Result (Text, Number)) = a;').ok,false);
  assert.match(read('type-lab.html'),/generic-sum-example/);
});

test('Studio compiles a user Error constructor without masking native Error',()=>{
  const src='Result (T, E) :: Ok (T) | Error (E); failure (Result (Number, Text)) = Error: "timeout"; result = match: failure {ok: {n | n}, error: {e | 0}};';
  assert.equal(bridge.check(src).ok,true);
  const js=bridge.compile(src,'js');
  assert.equal(js.ok,true);
  assert.match(js.code??js.output??JSON.stringify(js),/__miraEsc_Error/);
});

test('Studio checks explicit generic functions and preserves ordinary selector names',()=>{
  const src='identity (Value Type): x (Value Type) -> Value Type = x; a = identity: 42; b = identity: "Ada"; result = {a: a, b: b};';
  const report=bridge.check(src);assert.equal(report.ok,true,report.message);
  assert.equal(JSON.parse(report.output).find(x=>x.name==='identity:').type,"('a) -> 'a");
  assert.equal(bridge.check('bad (T): x (T) -> T = 1;').ok,false);
  const compiled=bridge.compile(src,'js',null,false,null,true);
  assert.equal(compiled.ok,true,compiled.message);
  assert.match(compiled.output,/function identity\(x\)/);
  assert.equal(runInNewContext(compiled.output+'\nresult.a',{}),42);
});

test('Studio exposes first-class validation result and its nominal type',()=>{
  const src='Result (T, E) :: Ok (T) | Err (E); Percentage :: Number where _ >= 0 AND _ <= 100; validation = validate: (42), as: (Percentage); result = match: validation {ok: {p | p + 0}, err: {e | 0}};';
  const report=bridge.check(src);assert.equal(report.ok,true,report.message);
  assert.equal(JSON.parse(report.output).find(x=>x.name==='validation').type,'Result (Percentage, Text)');
  const ast=bridge.ast(src);assert.equal(ast.ok,true,ast.message);
  assert.equal(JSON.parse(ast.output).definitions.find(x=>x.name==='validation').body.kind,'ValidateResult');
  const compiled=bridge.compile(src,'js',null,false,null,true);
  assert.equal(compiled.ok,true,compiled.message);
  assert.equal(runInNewContext(compiled.output+'\nresult',{}),42);
  assert.match(read('type-lab.html'),/validation-result-example/);
});

test('Studio exposes nominal parametric record schemas and executes the compiled program',()=>{
  const src='Pair (First Type, Second Type) :: {first: First Type, second: Second Type}; a (Pair (Number, Text)) = {first: 42, second: "Ada"}; result = a ~ first;';
  const report=bridge.check(src);assert.equal(report.ok,true,report.message);
  const a=JSON.parse(report.output).find(x=>x.name==='a');
  assert.equal(a.type,'Pair (Number, Text)');
  assert.equal(a.schema.kind,'Named');
  assert.deepEqual(a.schema.arguments,[{kind:'Number'},{kind:'Text'}]);
  assert.equal(a.schema.base.kind,'Record');
  const compiled=bridge.compile(src,'js',null,false,null,true);
  assert.equal(compiled.ok,true,compiled.message);
  assert.equal(runInNewContext(compiled.output+'\nresult',{}),42);
  assert.match(read('type-lab.html'),/parametric-data-example/);
});

test('Studio exposes finite recursive sum schemas and checks nested alternatives',()=>{
  const src='Tree (Element Type) :: Leaf (Element Type) | Branch ([Tree (Element Type)]); a = Branch: [(Leaf: 42)]; result = match: a {leaf: {n | n}, branch: {children | fold: children, with: {acc, child (Tree (Number)) | acc + (match: child {leaf: {n | n}, branch: {rest | 0}})}, from: 0}};';
  const report=bridge.check(src);assert.equal(report.ok,true,report.message);
  const a=JSON.parse(report.output).find(x=>x.name==='a');
  assert.equal(a.type,'Tree (Number)');
  const branch=a.schema.alternatives.find(x=>x.tag==='Branch');
  assert.equal(branch.payload.kind,'List');
  assert.deepEqual(branch.payload.item,{kind:'SumReference',name:'Tree',arguments:[{kind:'Number'}]});
  const compiled=bridge.compile(src,'js',null,false,null,true);
  assert.equal(compiled.ok,true,compiled.message);
  assert.equal(runInNewContext(compiled.output+'\nresult',{}),42);
  assert.match(read('type-lab.html'),/recursive-sum-example/);
});


test('0.65 Studio uses the same isolated logical module identities in compile, check, AST and trace',()=>{
  const modules=JSON.stringify({'parent.mira':'module Music; rate = 2;','sibling.mira':'module Music / Rhythm; rate = 3;'});
  const src='module Music / Jazz Harmony; import "parent.mira"; import "sibling.mira"; rate = 5; scale: x = x * rate; result = scale: 4;';
  const report=bridge.check(src,null,modules);assert.equal(report.ok,true,report.message);
  const types=JSON.parse(report.output);
  assert.equal(types.find(d=>d.name==='Music / Jazz Harmony / result').type,'Number');
  const compiled=bridge.compile(src,'js',null,false,modules,true);
  assert.equal(compiled.ok,true,compiled.message);
  const name='__miraModule_v_'+Buffer.from('Music / Jazz Harmony / result').toString('hex').toUpperCase();
  assert.equal(runInNewContext(compiled.output+'\n'+name,{}),20);
  const ast=JSON.parse(bridge.ast(src,null,modules).output);
  assert.equal(ast.definitions.find(d=>d.name==='Music / Rhythm / rate').module,'Music / Rhythm');
  const trace=JSON.parse(bridge.trace(src,null,modules).output);
  assert.equal(trace.declarations.filter(d=>d.name.endsWith(' / rate')).length,3);
  const invalid=bridge.check('module Music / Jazz Harmony; import "parent.mira"; result = rate;',null,modules);
  assert.equal(invalid.ok,false);
  assert.match(invalid.message,/Unknown identifier/);
  assert.match(read('type-lab.html'),/isolated-module-example/);
});


test('0.66 Studio exposes module export metadata without making private symbols public',()=>{
  const src='module Math / Integer Math; interface Point :: {x: Number}; Option (T) :: Some (T) | None; rate; square:; add: by: ; implementation rate = 2; square: x = x * x; add: x, by: y = x + y; private constant = 42; result = square: rate;';
  const result=bridge.check(src);
  assert.equal(result.ok,true,result.message);
  const rows=JSON.parse(result.output), p='Math / Integer Math / ';
  assert.equal(rows.find(x=>x.name===p+'square:').type,'(Number) -> Number');
  assert.equal(rows.find(x=>x.name===p+'square:').exported,true);
  assert.equal(rows.find(x=>x.name===p+'private constant').exported,false);
  assert.equal(rows.find(x=>x.name===p+'Some:').exported,true);
  const ast=JSON.parse(bridge.ast(src).output);
  assert.equal(ast.definitions.find(d=>d.name===p+'rate').exported,true);
  assert.equal(ast.definitions.find(d=>d.name===p+'result').exported,false);
  const trace=JSON.parse(bridge.trace(src).output);
  assert.deepEqual(trace.interfaces,[{module:'Math / Integer Math',types:['Option','Point'],typeIdentities:[{name:'Option',identity:'Math / Integer Math / Option',arity:1,opaque:false},{name:'Point',identity:'Math / Integer Math / Point',arity:0,opaque:false}],opaqueTypes:[],exports:[
    {name:p+'Some:',kind:'selector'},{name:p+'None',kind:'value'},{name:p+'rate',kind:'value'},{name:p+'square:',kind:'selector'},{name:p+'add:by:',kind:'selector'}
  ]}]);
  const files=JSON.stringify({'library.mira':src,'helper.mira':'module Private / Helper; data = 1;'});
  const loaded='module Consumer; interface result; import "library.mira"; implementation import "helper.mira"; result = 7;';
  const graph=bridge.trace(loaded,null,files);assert.equal(graph.ok,true,graph.message);
  assert.equal(JSON.parse(graph.output).interfaces.length,3);
  const denied=bridge.check('module Consumer; import "library.mira"; result = square: 2;',null,files);
  assert.equal(denied.ok,false);assert.match(denied.message,/Unknown identifier/);
  assert.match(read('type-lab.html'),/flat-interface-example/);
});


test('0.67 Studio virtual logical imports resolve direct aliases, public types and visibility',()=>{
  const files=JSON.stringify({
    'Math / Integer Math':'module Math / Integer Math; interface Amount :: Number; square: ; add: by: ; rate; implementation square: x = x * x; add: x, by: y = x + y; rate = 2; secret = 42;',
    'Middle':'module Middle; interface result; import Math / Integer Math {rate;}; implementation result = rate;'
  });
  const src='module App;\ninterface\nresult;\nimport Math / Integer Math {\n  square: ;\n  add: by: => somma: a: ;\n  Amount => Quantity;\n  rate;\n};\nimplementation\namount (Quantity) = 3;\nresult = somma: (square: 3), a: rate;';
  const checked=bridge.check(src,null,files);assert.equal(checked.ok,true,checked.message);
  const report=JSON.parse(checked.output);
  assert.equal(report.find(x=>x.name==='App / amount').type,'Math / Integer Math / Amount');
  const js=bridge.compile(src,'js',null,false,files,true);assert.equal(js.ok,true,js.message);
  const result='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
  assert.equal(runInNewContext(js.output+'\n'+result,{}),11);
  const ast=JSON.parse(bridge.ast(src,null,files).output);
  assert.equal(ast.definitions.find(d=>d.name==='App / result').body.selector,'Math / Integer Math / add:by:');
  for(const [source,pattern] of [
    ['module App; import Math / Integer Math {secret;}; result = secret;',/Symbol not exported/],
    ['module App; import Middle {rate;}; result = rate;',/Symbol not exported/],
    ['module App; import Math / Integer Math {square: ;}; result = add: 2, by: 3;',/Unknown identifier/],
    ['module App; import Math / Integer Math {rate;}; rate = 2;',/Imported name conflicts/]
  ]){const x=bridge.check(source,null,files);assert.equal(x.ok,false,source);assert.match(x.message,pattern);}
  assert.match(read('type-lab.html'),/selective-import-example/);
});


test('0.68 public signatures in virtual projects use public imports and constrain consumers',()=>{
  const modules=JSON.stringify({
    'Data / Types':'module Data / Types; interface Amount :: Number; implementation',
    'Math / Fees':'module Math / Fees; interface rate (Number); identity (Value Type): :: (Value Type) -> Value Type; fee: :: (Amount) -> Number; double: ; import Data / Types {Amount;}; implementation rate = 2; identity: x = x; fee: amount = amount * rate; double: n = n * 2;'
  });
  const src='module App; import Data / Types {Amount;}; import Math / Fees {fee: => costo: ; identity: ; rate; double: ;}; amount (Amount) = 3; result = costo: (identity: amount);';
  const checked=bridge.check(src,null,modules);assert.equal(checked.ok,true,checked.message);
  const rows=JSON.parse(checked.output);
  assert.equal(rows.find(r=>r.name==='Math / Fees / fee:').type,'(Data / Types / Amount) -> Number');
  assert.equal(rows.find(r=>r.name==='Math / Fees / fee:').explicitSignature,true);
  assert.equal(rows.find(r=>r.name==='Math / Fees / double:').explicitSignature,false);
  assert.equal(rows.find(r=>r.name==='App / result').type,'Number');
  const js=bridge.compile(src,'js',null,false,modules,true);assert.equal(js.ok,true,js.message);
  const result='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
  assert.equal(runInNewContext(js.output+'\n'+result,{}),6);
  const bad=bridge.check('module App; import Math / Fees {fee: ;}; result = fee: "bad";',null,modules);
  assert.equal(bad.ok,false);assert.match(bad.message,/Type check/);
  assert.match(read('type-lab.html'),/public-signature-example/);
});


test('0.69 Studio reports opaque public types without representation and rejects external projection',()=>{
  const files=JSON.stringify({'Music / Theory':'module Music / Theory; interface Note; note: :: (Number) -> Note; pitch of: :: (Note) -> Number; implementation Note :: {pitch: Number}; note: n = {pitch: n}; pitch of: n = n ~ pitch;'});
  const source='module App; import Music / Theory {Note; note: ; pitch of: ;}; n (Note) = note: 7; result = pitch of: n;';
  const checked=bridge.check(source,null,files);assert.equal(checked.ok,true,checked.message);
  const rows=JSON.parse(checked.output);
  assert.deepEqual(rows.find(x=>x.name==='App / n').schema,{kind:'Opaque',name:'Music / Theory / Note'});
  const trace=JSON.parse(bridge.trace(source,null,files).output);
  assert.deepEqual(trace.interfaces.find(x=>x.module==='Music / Theory').opaqueTypes,['Note']);
  const js=bridge.compile(source,'js',null,false,files,true);assert.equal(js.ok,true,js.message);
  const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
  assert.equal(runInNewContext(js.output+'\n'+name,{}),7);
  const bad=bridge.check(source+' leaked = n ~ pitch;',null,files);
  assert.equal(bad.ok,false);assert.match(bad.message,/Type check/);
  assert.match(read('type-lab.html'),/opaque-type-example/);
});


test('0.69.1 Studio preserves opaque generic arguments across aliases and public records',()=>{
  const modules=JSON.stringify({'Data / Box':'module Data / Box; interface Box (T); Envelope (T) :: {box: Box (T)}; box (T): :: (T) -> Box (T); item (T): :: (Box (T)) -> T; implementation Box (U) :: {item: U}; box: x = {item: x}; item: b = b ~ item;'});
  const source='module App; import Data / Box {Box => Container; Envelope; box: ; item: ;}; n (Container (Number)) = box: 7; e (Envelope (Number)) = {box: n}; result = item: (e ~ box);';
  const checked=bridge.check(source,null,modules);assert.equal(checked.ok,true,checked.message);
  const rows=JSON.parse(checked.output);
  assert.deepEqual(rows.find(x=>x.name==='App / n').schema,{kind:'Opaque',name:'Data / Box / Box',arguments:[{kind:'Number'}]});
  const js=bridge.compile(source,'js',null,false,modules,true);assert.equal(js.ok,true,js.message);
  const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
  assert.equal(runInNewContext(js.output+'\n'+name,{}),7);
  const denied=bridge.check(source+' bad = (e ~ box) ~ item;',null,modules);
  assert.equal(denied.ok,false);assert.match(denied.message,/Type check/);
  assert.match(read('type-lab.html'),/parametric-opaque-example/);
});


test('0.70 Studio traces re-exports without generating intermediate declarations',()=>{
  const files=JSON.stringify({
    'Core':'module Core; interface Box (T); box (T): :: (T) -> Box (T); item (T): :: (Box (T)) -> T; implementation Box (T) :: {item: T}; box: x = {item: x}; item: b = b ~ item;',
    'Facade':'module Facade; interface export Core {Box => Container; box: ; item: => value of: ;}; implementation',
    'API':'module API; interface export Facade { * }; implementation'
  });
  const src='module App; import API {Container; box: ; value of: ;}; n (Container (Number)) = box: 7; result = value of: n;';
  const report=bridge.check(src,null,files);assert.equal(report.ok,true,report.message);
  assert.equal(JSON.parse(report.output).find(x=>x.name==='App / result').type,'Number');
  const trace=bridge.trace(src,null,files);assert.equal(trace.ok,true,trace.message);
  const info=JSON.parse(trace.output);
  const api=info.interfaces.find(x=>x.module==='API');
  assert.deepEqual(api.opaqueTypes,['Container']);
  assert.deepEqual(api.reexports.find(x=>x.name==='Container'),{name:'Container',kind:'type',target:'Core / Box',opaque:true});
  assert.deepEqual(api.reexports.find(x=>x.name==='value of:'),{name:'value of:',kind:'selector',target:'Core / item:'});
  assert.equal(info.declarations.some(x=>x.name==='API / value of:'),false);
  const js=bridge.compile(src,'js',null,false,files,true);assert.equal(js.ok,true,js.message);
  const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
  assert.equal(runInNewContext(js.output+'\n'+name,{}),7);
  const bad=bridge.check('module App; import API {item: ;}; result = item: 7;',null,files);
  assert.equal(bad.ok,false);assert.match(bad.message,/Symbol not exported/);
  assert.match(read('type-lab.html'),/reexport-example/);
});


test('0.70.1 Studio compiles optimized virtual modules and reports actual removed declarations',()=>{
  const modules=JSON.stringify({'Core':'module Core; interface square: ; unused: ; implementation factor = 2; dead = [1,2,3]; square: x = x * factor; unused: x = x + 42;'});
  const src='module App; import Core {square: ; unused: ;}; result = square: 4;';
  for(const target of ['js','php']){
    const a=bridge.compile(src,target,null,false,modules,true);
    const b=bridge.compile(src,target,null,true,modules,true,true);
    assert.equal(a.ok,true,a.message);assert.equal(b.ok,true,b.message);
    assert.equal(b.optimization.before,5);assert.equal(b.optimization.after,3);
    assert.deepEqual(Array.from(b.optimization.removed),['Core / dead','Core / unused:']);
    assert.ok(b.optimization.optimizationMs>=0);
    assert.ok(b.output.length<a.output.length);
    if(target==='js'){
      const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
      assert.equal(runInNewContext(b.output+'\n'+name,{}),8);
    }
  }
  const denied=bridge.compile(src,'js',null,false,modules,false,true);
  assert.equal(denied.ok,false);
  assert.match(read('type-lab.html'),/tree-shake-example/);
});


test('0.71 Module Explorer exposes real logical dependencies, typed contracts and forwarded identity',()=>{
  const modules=JSON.stringify({
    'Core':'module Core; interface Box (T); box (T): :: (T) -> Box (T); item (T): :: (Box (T)) -> T; implementation Box (T) :: {item: T}; box: x = {item: x}; item: b = b ~ item; secret = 42;',
    'API':'module API; interface export Core {Box => Container; box: ; item: => value of: ;}; implementation'
  });
  const src='module App; interface result; import API {Container; box: ; value of: ;}; implementation n (Container (Number)) = box: 7; result = value of: n;';
  const response=bridge.exploreModules(src,null,modules);assert.equal(response.ok,true,response.message);
  const data=JSON.parse(response.output);
  assert.equal(data.interfaces.length,3);
  assert.deepEqual(data.dependencies.map(x=>[x.from,x.to,x.kind,x.phase]),[['App','API','import','interface'],['API','Core','export','interface']]);
  const api=data.interfaces.find(x=>x.module==='API');
  assert.deepEqual(api.typeIdentities,[{name:'Container',identity:'Core / Box',arity:1,opaque:true}]);
  const forwarded=api.reexports.find(x=>x.name==='value of:');
  assert.equal(forwarded.target,'Core / item:');assert.equal(forwarded.signature.explicitSignature,true);
  assert.equal(data.interfaces.find(x=>x.module==='App').exports[0].signature.type,'Number');
  assert.equal(data.interfaces.find(x=>x.module==='Core').privateDeclarations[0].name,'Core / secret');
  const bad=bridge.exploreModules(src+' bad = n ~ item;',null,modules);assert.equal(bad.ok,false);
  for(const asset of ['module-explorer.html','module-explorer.js']){
    assert.ok(existsSync(resolve(site,asset)));assert.ok(read('sw.js').includes('./'+asset));
  }
  assert.match(read('index.html'),/module-explorer.html/);
  assert.match(read('sw.js'),/endsWith\('\/module-explorer.html'\)/);
  assert.match(read('module-explorer.js'),/MiraStudioCompiler\.exploreModules/);
  new Function(read('module-explorer.js'));
});


test('0.71 scalability: shared dependency graph, checked execution and pruning at increasing module counts',t=>{
  const env={TextEncoder,performance};
  runInNewContext(read('module-benchmark.js'),env);
  const bench=env.MiraModuleBenchmark;
  for(const count of [4,16,64]){
    const fixture=bench.project(count);
    const report=bridge.exploreModules(fixture.source,null,fixture.modules);
    assert.equal(report.ok,true,report.message);
    const data=JSON.parse(report.output);
    assert.equal(data.interfaces.length,count+2);
    assert.equal(data.dependencies.length,2*count);
    assert.equal(data.interfaces.filter(m=>m.module==='Core').length,1);
    for(const target of ['js','php']){
      const a=bench.measure(bridge,fixture,target,false),b=bench.measure(bridge,fixture,target,true);
      assert.equal(b.optimization.before,7*count+2);
      assert.equal(b.optimization.after,count+2);
      assert.equal(b.optimization.removed.length,6*count);
      assert.ok(b.bytes<a.bytes);
      const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
      for(const emitted of [a.output,b.output]){
        if(target==='js')assert.equal(runInNewContext(emitted+'\n'+name,{}),fixture.expected);
        else {
          const run=spawnSync('php',['-r',emitted.replace(/^<\?php/,'')+'\necho $'+name+';'],{encoding:'utf8'});
          assert.equal(run.status,0,run.stderr);assert.equal(Number(run.stdout),fixture.expected);
        }
      }
      t.diagnostic(JSON.stringify({modules:count+2,target,checkedMs:a.ms,optimizedMs:b.ms,bytesBefore:a.bytes,bytesAfter:b.bytes,removed:b.optimization.removed.length}));
    }
  }
  assert.ok(read('sw.js').includes('./module-benchmark.js'));
  assert.match(read('module-explorer.html'),/id="benchmark"/);
});
test('0.71 module boundary consolidation: diamond and cycle diagnostics',()=>{
  const files=JSON.stringify({
    'Core':'module Core; interface Token; make: :: (Number) -> Token; implementation Token :: {value: Number}; make: x = {value: x};',
    'Left':'module Left; interface export Core {Token => Left Token; make: ;}; implementation',
    'Right':'module Right; interface export Core {Token => Right Token; make: ;}; implementation'
  });
  const src='module App; import Left {Left Token; make: ;}; import Right {Right Token;}; token (Left Token) = make: 7; copy (Right Token) = token;';
  const valid=bridge.exploreModules(src,null,files);assert.equal(valid.ok,true,valid.message);
  const data=JSON.parse(valid.output);
  assert.equal(data.interfaces.find(m=>m.module==='Left').typeIdentities[0].identity,data.interfaces.find(m=>m.module==='Right').typeIdentities[0].identity);
  const bad=bridge.exploreModules(src+' leaked = copy ~ value;',null,files);assert.equal(bad.ok,false);assert.match(bad.message,/Type check/);
  const cycle=bridge.exploreModules('module App; import A { * };',null,JSON.stringify({'A':'module A; interface export B { * }; implementation','B':'module B; interface export A { * }; implementation'}));
  assert.equal(cycle.ok,false);assert.match(cycle.message,/Import cycle/);
});


test('0.72 independent signatures check multiple concrete providers without changing their source',()=>{
  const contract='initial (Number); read: :: (Number) -> Number; combine: with: :: (Number, Number) -> Number; identity (T): :: (T) -> T;';
  const source=(name,expression)=>'module '+name+'; interface initial; read: ; combine: with: ; identity: ; implementation initial = 2; read: x = '+expression+'; combine: x, with: y = x + y; identity: x = x; private value = 42;';
  for(const [name,expression] of [['Memory','x + initial'],['Native','x * initial']]){
    const src=source(name,expression);
    const before=bridge.compile(src,'js',null,false,null,true);
    assert.equal(before.ok,true,before.message);
    const r=bridge.verifyContract(src,name,contract);
    assert.equal(r.ok,true,r.message);
    const data=JSON.parse(r.output);
    assert.equal(data.provider,name);
    assert.deepEqual(data.verified.map(s=>s.name),['initial','read:','combine:with:','identity:']);
    assert.equal(data.verified[1].signature.type,'(Number) -> Number');
    assert.equal(data.verified[3].signature.type,"('a) -> 'a");
    const after=bridge.compile(src,'js',null,false,null,true);
    assert.equal(after.ok,true,after.message);assert.equal(after.output,before.output);
  }
  const src=source('Memory','x + initial');
  for(const [provider,signature,pattern] of [
    ['Memory','private value (Number);',/not publicly defined/],
    ['Memory','missing: :: (Number) -> Number;',/not publicly defined/],
    ['Memory','read: :: (Text) -> Text;',/Type check/],
    ['Memory','read: ;',/explicit value and selector signatures only/],
    ['Memory','read: :: (Number) -> Number; read: :: (Number) -> Number;',/Duplicate contract symbol/],
    ['Memory','Hidden :: Number;',/explicit value and selector signatures only/],
    ['Memory','implementation',/cannot contain implementation/],
    ['Missing',contract,/not publicly defined/],
    ['Memory','',/Empty independent contract/]
  ]){
    const result=bridge.verifyContract(src,provider,signature);
    assert.equal(result.ok,false,signature);assert.match(result.message,pattern);
  }
  const invalid=bridge.verifyContract('module Bad; interface identity: ; implementation identity: x = 42;','Bad','identity (T): :: (T) -> T;');
  assert.equal(invalid.ok,false);assert.match(invalid.message,/Type check/);
  assert.match(read('module-explorer.html'),/id="verify-contract"/);
});


test('0.73 Studio selects providers at build time and displays actual dependency identity',()=>{
  const files=JSON.stringify({
    'Providers / Memory':'module Providers / Memory; interface read: ; extra; implementation read: x = x + 2; extra = 99;',
    'Providers / Native':'module Providers / Native; interface read: ; implementation read: x = x * 2;'
  });
  const src='module App; import Services / Storage {read: ;}; result = read: 5;';
  for(const [provider,value] of [['Providers / Memory',7],['Providers / Native',10]]){
    const bindings=JSON.stringify({'Services / Storage':{provider,contract:'read: :: (Number) -> Number;'}});
    const a=bridge.exploreModules(src,null,files,bindings);assert.equal(a.ok,true,a.message);
    const data=JSON.parse(a.output);
    assert.equal(data.dependencies[0].to,provider);
    assert.equal(data.dependencies[0].contract,'Services / Storage');
    assert.equal(data.interfaces.length,2);
    const compiled=bridge.compile(src,'js',null,false,files,true,true,bindings);
    assert.equal(compiled.ok,true,compiled.message);
    const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
    assert.equal(runInNewContext(compiled.output+'\n'+name,{}),value);
    assert.equal(bridge.compile(src,'js',null,false,files,false,false,bindings).ok,false);
  }
  assert.match(read('module-explorer.html'),/id="provider-example"/);
  assert.match(read('module-explorer.html'),/id="bindings"/);
});


test('0.74 Studio inherits generic abstract types and traces implements without duplicating signatures',()=>{
  const files=JSON.stringify({
    'Services / Box':'module Services / Box; interface Box (Element Type); Envelope (T) :: {box: Box (T)}; box (T): :: (T) -> Box (T); item (T): :: (Box (T)) -> T;',
    'Providers / Record Box':'module Providers / Record Box; implements Services / Box; implementation Box (U) :: {item: U}; box: x = {item: x}; item: b = b ~ item;'
  });
  // Record provider exercises generic inheritance and the forward opaque type
  // inside a transparent public record without requiring a new list primitive.
  const src='module App; import Services / Box {Box; Envelope; box: ; item: ;}; n (Box (Number)) = box: 7; e (Envelope (Number)) = {box: n}; result = item: (e ~ box);';
  const bindings=JSON.stringify({'Services / Box':{provider:'Providers / Record Box'}});
  const report=bridge.exploreModules(src,null,files,bindings);
  assert.equal(report.ok,true,report.message);
  const data=JSON.parse(report.output);
  assert.ok(data.dependencies.some(x=>x.kind==='implements'&&x.to==='Services / Box'));
  assert.ok(data.dependencies.some(x=>x.contract==='Services / Box'&&x.to==='Providers / Record Box'));
  const types=data.interfaces.find(x=>x.module==='Providers / Record Box').typeIdentities;
  assert.ok(types.some(x=>x.name==='Box'&&x.opaque&&x.arity===1));
  const js=bridge.compile(src,'js',null,false,files,true,true,bindings);assert.equal(js.ok,true,js.message);
  const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
  assert.equal(runInNewContext(js.output+'\n'+name,{}),7);
  const bad=bridge.check(src+' leaked = n ~ item;',null,files,bindings);
  assert.equal(bad.ok,false);assert.match(bad.message,/Type check/);
  assert.match(read('module-explorer.html'),/id="contract-module-example"/);
});


test('0.75 Module Explorer checks the same consumer before and after selecting a provider',()=>{
  const contract='module Services / Storage; interface Storage; open: :: (Text) -> Storage; read: key: :: (Storage, Text) -> Text;';
  const source='module App; import Services / Storage {Storage; open: ; read: key: ;}; store (Storage) = open: "db"; result = read: store, key: "x";';
  const noProvider=JSON.stringify({'Services / Storage':contract});
  const checked=bridge.exploreModules(source,null,noProvider);
  assert.equal(checked.ok,true,checked.message);
  const data=JSON.parse(checked.output);
  const info=data.interfaces.find(x=>x.module==='Services / Storage');
  assert.equal(info.abstractContract,true);
  assert.equal(info.typeIdentities[0].identity,'Services / Storage / Storage');
  assert.equal(info.exports.find(x=>x.name==='Services / Storage / open:').signature.abstractContract,true);
  assert.equal(bridge.compile(source,'js',null,false,noProvider,true).ok,false);
  assert.equal(bridge.check(source+' leaked = store ~ name;',null,noProvider).ok,false);
  const files=JSON.stringify({'Services / Storage':contract,'Providers / Memory':'module Providers / Memory; implements Services / Storage; implementation Storage :: {name: Text}; open: name = {name: name}; read: store, key: k = store ~ name;'});
  const selected=JSON.stringify({'Services / Storage':{provider:'Providers / Memory'}});
  const linked=bridge.compile(source,'js',null,false,files,true,true,selected);
  assert.equal(linked.ok,true,linked.message);
  const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
  assert.equal(runInNewContext(linked.output+'\n'+name,{}),'db');
  assert.match(read('module-explorer.html'),/id="contract-unbind"/);
});


test('0.76 Studio reports stable generic contract identities across linking and direct selected imports',()=>{
  const contract='module Services / Box; interface Box (T); Envelope (T) :: {box: Box (T)}; box (T): :: (T) -> Box (T); identity (T): :: (Box (T)) -> Box (T);';
  const files=JSON.stringify({
    'Services / Box':contract,
    'Providers / Record Box':'module Providers / Record Box; implements Services / Box; implementation Box (T) :: {item: T}; box: x = {item: x}; identity: b = b;',
    'Providers / List Box':'module Providers / List Box; implements Services / Box; implementation Box (T) :: [T]; box: x = [x]; identity: b = b;'
  });
  const source='module App; import Services / Box {Box; Envelope; box: ; identity: ;}; n (Box (Number)) = box: 7; e (Envelope (Number)) = {box: n}; result = identity: (e ~ box);';
  const report=bindings=>{
    const r=bridge.check(source,null,files,bindings);assert.equal(r.ok,true,r.message);
    return JSON.parse(r.output).filter(x=>x.module==='App').map(x=>({name:x.name,type:x.type,schema:x.schema}));
  };
  const before=report();
  for(const provider of ['Providers / Record Box','Providers / List Box']){
    const bindings=JSON.stringify({'Services / Box':{provider}});
    assert.deepEqual(report(bindings),before);
    const explored=bridge.exploreModules(source,null,files,bindings);assert.equal(explored.ok,true,explored.message);
    const info=JSON.parse(explored.output).interfaces.find(x=>x.module===provider);
    assert.ok(info.typeIdentities.some(x=>x.identity==='Services / Box / Box'&&x.opaque&&x.arity===1));
    assert.ok(info.opaqueTypes.includes('Box'));
    const direct=bridge.check(source.replace('import Services / Box','import '+provider),null,files,bindings);
    assert.equal(direct.ok,true,direct.message);
    assert.equal(JSON.parse(direct.output).find(x=>x.name==='App / n').schema.name,'Services / Box / Box');
    assert.equal(bridge.check(source+' invalid (Box (Text)) = n;',null,files,bindings).ok,false);
    const linked=bridge.compile(source,'js',null,false,files,true,true,bindings);assert.equal(linked.ok,true,linked.message);
    const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
    assert.equal(JSON.stringify(runInNewContext(linked.output+'\n'+name,{})),provider.endsWith('Record Box')?'{"item":7}':'[7]');
  }
});


test('0.77 interface fingerprints are stable across unbound and linked contracts',()=>{
  const contract='module Services / Box; interface Box (T); Envelope (T) :: {box: Box (T)}; box (T): :: (T) -> Box (T);';
  const files=JSON.stringify({
    'Services / Box':contract,
    'Providers / Record Box':'module Providers / Record Box; implements Services / Box; implementation Box (T) :: {item: T}; box: x = {item: x};',
    'Providers / List Box':'module Providers / List Box; implements Services / Box; implementation Box (T) :: [T]; box: x = [x];'
  });
  const source='module App; interface result; import Services / Box {Box; Envelope; box: ;}; implementation result (Box (Number)) = box: 7;';
  const snapshot=bindings=>{
    const r=bridge.interfaces(source,null,files,bindings);
    assert.equal(r.ok,true,r.message);return JSON.parse(r.output).interfaces;
  };
  const a=snapshot();
  for(const provider of ['Providers / Record Box','Providers / List Box']){
    const b=snapshot(JSON.stringify({'Services / Box':{provider}}));
    assert.deepEqual(b.map(x=>[x.module,x.fingerprint,x.canonical]),a.map(x=>[x.module,x.fingerprint,x.canonical]));
    assert.equal(b.find(x=>x.module==='Services / Box').resolvedModule,provider);
  }
  assert.equal(bridge.interfaces(source+' bad = result ~ item;',null,files).ok,false);
  assert.match(read('module-explorer.html'),/id="interface-snapshot"/);
  assert.match(read('module-explorer.js'),/MiraStudioCompiler\.interfaces/);
});
