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
  assert.equal(bridge.version, JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version);
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
  assert.equal(bridge.version,JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version);
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
  assert.match(notebook,/Stato: nucleo modulare, contratti indipendenti e impronte pubbliche implementati/);
  assert.match(notebook,/Direzione dopo la 0\.77/);
  assert.match(notebook,/0\.78 — impatto potenziale delle modifiche pubbliche/);
  assert.match(notebook,/Consolidamento Mira 0\.83–0\.89\.3/);
  assert.match(notebook,/Questioni numeriche ancora aperte/);
  assert.match(notebook,/Option e Result: direzione proposta, non ancora implementata/);
  assert.match(notebook,/Registro delle questioni aperte/);
  assert.match(notebook,/SYN-01/);
  assert.match(notebook,/QA-06/);
  assert.match(notebook,/Questioni storiche risolte o superate/);
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
      const phases=['collect','scopes','expressions','checking','emission'];
      for(const [sample,expected] of [[a,phases],[b,[...phases.slice(0,-1),'pruning','emission']]]){
        assert.deepEqual(Array.from(sample.profile.phases,p=>p.phase),expected);
        assert.ok(sample.profile.phases.every(p=>Number.isFinite(p.ms)&&p.ms>=0));
        assert.ok(Math.abs(sample.profile.phases.reduce((sum,p)=>sum+p.ms,0)-sample.profile.totalMs)<1e-6);
        const ordinary=bridge.compile(fixture.source,target,null,false,fixture.modules,true,sample===b);
        assert.equal(ordinary.ok,true,ordinary.message);
        assert.equal(sample.output,ordinary.output);
        assert.equal(ordinary.profile,undefined);
      }
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
      t.diagnostic(JSON.stringify({modules:count+2,target,checkedMs:a.ms,optimizedMs:b.ms,bytesBefore:a.bytes,bytesAfter:b.bytes,removed:b.optimization.removed.length,checkedProfile:a.profile,optimizedProfile:b.profile}));
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

test('0.78 impact follows real module dependencies and distinguishes public and private changes',()=>{
  const env={};runInNewContext(read('interface-impact.js'),env);
  const compare=(a,b)=>JSON.parse(JSON.stringify(env.MiraInterfaceImpact.compare(a,b)));
  const src='module App; interface result (Number); import Left {left: ;}; import Right {right: ;}; implementation result = (left: 1) + (right: 2);';
  const snapshot=core=>{
    const modules=JSON.stringify({
      Core:core,
      Left:'module Left; interface left: :: (Number) -> Number; import Core {rate;}; implementation left: x = x + rate;',
      Right:'module Right; interface right: :: (Number) -> Number; import Core {rate;}; implementation right: x = x + rate;'
    });
    const r=bridge.interfaces(src,null,modules);assert.equal(r.ok,true,r.message);return JSON.parse(r.output);
  };
  const first=snapshot('module Core; interface rate (Number); Unused :: {x: Number}; implementation rate = 1; secret = 2;');
  const privateEdit=snapshot('module Core; interface rate (Number); Unused :: {x: Number}; implementation rate = 5; secret = 8;');
  const publicEdit=snapshot('module Core; interface rate (Number); Unused :: {x: Text}; implementation rate = 5; secret = 8;');
  assert.equal(compare(null,first).initial,true);
  assert.deepEqual(compare(first,privateEdit).changed,[]);
  assert.deepEqual(compare(first,privateEdit).affected,[]);
  const impact=compare(first,publicEdit);
  assert.deepEqual(impact.changed,['Core']);
  assert.deepEqual(impact.affected,['App','Left','Right']);
  assert.equal(impact.incomplete,false);
  const removed=JSON.parse(JSON.stringify(publicEdit));
  removed.interfaces=removed.interfaces.filter(m=>m.module!=='Core');
  removed.dependencies=removed.dependencies.filter(d=>d.to!=='Core');
  assert.deepEqual(compare(publicEdit,removed).removed,['Core']);
  assert.deepEqual(compare(publicEdit,removed).affected,['App','Left','Right']);
  const legacy={...first,dependencies:[...first.dependencies,{kind:'file',from:'App',to:'old.mira'}]};
  assert.equal(compare(first,legacy).incomplete,true);
  assert.match(read('module-explorer.html'),/interface-impact\.js/);
});

test('0.78 provider swap changes linking metadata without changing the contract surface',()=>{
  const env={};runInNewContext(read('interface-impact.js'),env);
  const files=JSON.stringify({
    'Services / Storage':'module Services / Storage; interface read: :: (Number) -> Number;',
    'Providers / Memory':'module Providers / Memory; implements Services / Storage; implementation read: x = x + 1;',
    'Providers / Native':'module Providers / Native; implements Services / Storage; implementation read: x = x + 2;'
  });
  const source='module App; interface result; import Services / Storage {read: ;}; implementation result = read: 1;';
  const snapshot=provider=>{
    const binding=provider?JSON.stringify({'Services / Storage':{provider}}):null;
    const r=bridge.interfaces(source,null,files,binding);assert.equal(r.ok,true,r.message);return JSON.parse(r.output);
  };
  const a=snapshot('Providers / Memory'), b=snapshot('Providers / Native');
  const impact=JSON.parse(JSON.stringify(env.MiraInterfaceImpact.compare(a,b)));
  assert.deepEqual(impact.changed,[]);
  assert.deepEqual(impact.providers,['Services / Storage']);
  assert.deepEqual(impact.affected,[]);
  assert.equal(impact.incomplete,false);
});

test('0.79 separates source changes, public interfaces and selected links',()=>{
  const env={};runInNewContext(read('interface-impact.js'),env);
  const compare=(a,b,ac,bc)=>JSON.parse(JSON.stringify(env.MiraInterfaceImpact.compare(a,b,ac,bc)));
  const contract='module Services / Storage; interface read: :: (Number) -> Number;';
  const files={
    'Services / Storage':contract,
    'Providers / Memory':'module Providers / Memory; implements Services / Storage; implementation read: x = x + 1;',
    'Providers / Native':'module Providers / Native; implements Services / Storage; implementation read: x = x + 2;',
    'Unused':'module Unused; unused = 1;'
  };
  const source='module App; interface result; import Services / Storage {read: ;}; implementation result = read: 1;';
  const binding=provider=>JSON.stringify({'Services / Storage':{provider}});
  const snapshot=(src,modules,provider)=>{
    const r=bridge.interfaces(src,null,JSON.stringify(modules),binding(provider));assert.equal(r.ok,true,r.message);
    return JSON.parse(r.output);
  };
  const a=snapshot(source,files,'Providers / Memory');
  assert.deepEqual(a.sourceInputs.reads.map(x=>x.path).sort(),['Providers / Memory','Services / Storage']);
  assert.match(a.sourceInputs.entry,/^[a-f0-9]{64}$/);
  const unused=snapshot(source,{...files,Unused:'module Unused; unused = 2;'},'Providers / Memory');
  assert.deepEqual(compare(a,unused).sources,{entryChanged:false,changed:[],added:[],removed:[]});
  const b=snapshot(source,{...files,'Providers / Memory':files['Providers / Memory'].replace('x + 1','x + 9')},'Providers / Memory');
  assert.deepEqual(compare(a,b).changed,[]);
  assert.deepEqual(compare(a,b).sources.changed,['Providers / Memory']);
  assert.deepEqual(compare(a,b).linking,[]);
  const entry=snapshot(source.replace('read: 1','read: 4'),files,'Providers / Memory');
  assert.equal(compare(a,entry).sources.entryChanged,true);
  assert.deepEqual(compare(a,entry).changed,[]);
  const c=snapshot(source,files,'Providers / Native');
  const delta=compare(a,c,{host:null,bindings:binding('Providers / Memory')},{host:'{}',bindings:binding('Providers / Native')});
  assert.deepEqual(delta.changed,[]);
  assert.deepEqual(delta.linking,['Services / Storage']);
  assert.deepEqual(delta.sources.added,['Providers / Native']);
  assert.deepEqual(delta.sources.removed,['Providers / Memory']);
  assert.equal(delta.hostChanged,true);
  assert.equal(delta.bindingsChanged,true);
  assert.equal(compare(null,a).sources,null);
});

test('0.80 profiling is opt-in, checked-only and keeps diagnostics and locations',()=>{
  const src='result = 2 + 3;';
  const profiled=bridge.compile(src,'js',null,true,null,true,false,null,true);
  const ordinary=bridge.compile(src,'js',null,true,null,true);
  assert.equal(profiled.ok,true,profiled.message);
  assert.equal(profiled.output,ordinary.output);
  assert.deepEqual(profiled.locations,ordinary.locations);
  assert.equal(bridge.compile(src,'js',null,false,null,false,false,null,true).ok,false);
  const bad=bridge.compile('result = 1 + "x";','js',null,false,null,true,false,null,true);
  assert.equal(bad.ok,false);
  assert.equal(bad.profile,undefined);
});

test('0.81 scoped host names are visible only in declared modules, including selector sections and values',()=>{
  const host=JSON.stringify({values:['native rate'],selectors:['native multiply:by:'],types:{
    'native rate':'Number','native multiply:by:':{parameters:['Number','Number'],result:'Number'}},
    scopes:{'native rate':['Adapters / Math'],'native multiply:by:':['Adapters / Math']}});
  const modules=JSON.stringify({'Adapters / Math':'module Adapters / Math; interface scale: :: (Number) -> Number; implementation scale: x = x >> (native multiply: _, by: native rate);'});
  const src='module App; interface result; import Adapters / Math {scale: ;}; implementation result = scale: 7;';
  const checked=bridge.check(src,host,modules);assert.equal(checked.ok,true,checked.message);
  const out=bridge.compile(src,'js',host,false,modules,true,true);assert.equal(out.ok,true,out.message);
  const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
  assert.equal(runInNewContext(out.output+'\n'+name,{__miraHost:{'native rate':3,'native multiply:by:':(x,y)=>x*y}}),21);
  for(const bad of [src+' leak = native rate;',src+' leak = native multiply: 2, by: 3;',src+' leak = (native multiply: _, by: 3);']){
    assert.equal(bridge.check(bad,host,modules).ok,false);
    assert.equal(bridge.compile(bad,'js',host,false,modules).ok,false);
    assert.equal(bridge.compile(bad,'php',host,false,modules).ok,false);
  }
  const global=JSON.stringify({values:['native rate'],types:{'native rate':'Number'}});
  assert.equal(bridge.check('result = native rate;',global).ok,true);
});

test('0.82 Host Module Lab compiles and executes both providers with real JS and PHP hosts',()=>{
  const env={};runInNewContext(read('host-module-fixtures.js'),env);
  const lab=env.MiraHostModuleLab;
  for(const id of ['magnitude','maximum']){
    const fixture=lab.fixture(id),snapshots=[];
    for(const mode of ['unbound','native','pure']){
      const project=lab.project(fixture,mode);
      const report=lab.inspect(bridge,project);assert.equal(report.ok,true,report.message);
      const contract=report.report.interfaces.find(m=>m.module===lab.service);
      assert.ok(contract);snapshots.push(contract.canonical);
      for(const target of ['js','php']){
        const out=lab.compile(bridge,project,target);
        if(mode==='unbound'){assert.equal(out.ok,false);continue;}
        assert.equal(out.ok,true,out.message);
        assert.equal(out.output.includes(fixture.capability),mode==='native');
        if(target==='js'){
          let response;
          const worker={self:{postMessage(v){response=v;}}};
          runInNewContext(read('host-module-worker.js'),worker);
          worker.self.onmessage({data:{code:out.output}});
          assert.equal(response.ok,true,response.message);assert.equal(Number(response.output),fixture.expected);
        }else{
          const host='$GLOBALS["__miraHost"]=["native magnitude"=>abs(...),"native maximum:and:"=>max(...)];';
          const php=out.output.replace(/^<\?php/,'').replace('declare(strict_types=1);','declare(strict_types=1);'+host)+'\necho $'+lab.resultName+';';
          const executed=spawnSync('php',['-r',php],{encoding:'utf8'});
          assert.equal(executed.status,0,executed.stderr);assert.equal(Number(executed.stdout),fixture.expected);
        }
      }
    }
    assert.equal(snapshots[0],snapshots[1]);assert.equal(snapshots[1],snapshots[2]);
    const invalid=lab.project({...fixture,source:fixture.source+'\nleak = '+(id==='magnitude'?'native magnitude 2':'native maximum: 1, and: 2')+';'},'native');
    assert.equal(lab.inspect(bridge,invalid).ok,false);
  }
});
test('0.82 Host Module Lab assets, offline navigation and controls are connected',()=>{
  for(const asset of ['host-module-lab.html','host-module-fixtures.js','host-module-lab.js','host-module-worker.js']){
    assert.ok(existsSync(resolve(site,asset)));assert.ok(read('sw.js').includes('./'+asset));
    if(asset.endsWith('.js'))new Function(read(asset));
  }
  assert.match(read('sw.js'),/endsWith\('\/host-module-lab.html'\)/);
  assert.match(read('index.html'),/href="\.\/host-module-lab.html"/);
  assert.match(read('module-explorer.html'),/href="\.\/host-module-lab.html"/);
  const html=read('host-module-lab.html'),controller=read('host-module-lab.js');
  for(const id of ['example','provider','source','contract','native','pure','host','reset','check','compile-js','compile-php','run','compare']){
    assert.ok(html.includes('id="'+id+'"'));assert.ok(controller.includes("'"+id+"'"));
  }
  // Exercise controller events against the real compiler, without a browser DOM.
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='example'?'magnitude':id==='provider'?'native':'',textContent:'',className:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});return nodes.get(id);};
  const ctx={document:{getElementById:node},MiraStudioCompiler:bridge,TextEncoder};
  runInNewContext(read('host-module-fixtures.js'),ctx);
  runInNewContext(controller,ctx);
  assert.match(node('status').textContent,/Type check riuscito/);
  node('compare').listeners.click();assert.match(node('output').textContent,/identica/);
  node('provider').value='unbound';node('provider').listeners.change();
  assert.match(node('status').textContent,/Type check riuscito/);
  node('compile-php').listeners.click();assert.match(node('status').textContent,/non riuscita/);
  node('provider').value='pure';node('provider').listeners.change();
  node('compile-js').listeners.click();assert.match(node('status').textContent,/riuscita/);
  node('example').value='maximum';node('example').listeners.change();
  assert.match(node('status').textContent,/Type check riuscito/);
});

test('0.83 Text library compiles in Studio and runs with the actual JS/PHP adapters',()=>{
  const env={};runInNewContext(read('text-module-data.js'),env);const data=env.MiraTextModuleData;
  assert.equal(data.source,readFileSync(resolve(root,'lib/text/App.mira'),'utf8'));
  const expected={points:7,contains:true,starts:true,ends:true};
  const name='__miraModule_v_417070202F20726573756C74';
  const adapter=resolve(root,'lib/text/text-host.php');
  for(const target of ['js','php']){
    const out=bridge.compile(data.source,target,data.host,false,data.modules,true,true,data.bindings);
    assert.equal(out.ok,true,out.message);
    if(target==='js'){
      let response;
      const ctx={self:{postMessage(v){response=v;}}};
      ctx.importScripts=()=>runInNewContext(read('text-host.js'),ctx);
      runInNewContext(read('host-module-worker.js'),ctx);
      ctx.self.onmessage({data:{code:out.output,service:'text'}});
      assert.equal(response.ok,true,response.message);assert.deepEqual(JSON.parse(response.output),expected);
    }else{
      const code=out.output.replace(/^<\?php/,'').replace('declare(strict_types=1);','declare(strict_types=1);$GLOBALS["__miraHost"]=require $argv[1];')+'\necho json_encode($'+name+');';
      const run=spawnSync('php',['-r',code,adapter],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),expected);
    }
  }
  for(const bad of [data.source+'\nleak = native code points "abc";',data.source.replace('code points: sample','code points: 42')]){
    assert.equal(bridge.check(bad,data.host,data.modules,data.bindings).ok,false);
  }
  for(const asset of ['text-module-data.js','text-module-lab.js','text-host.js']){
    assert.ok(read('sw.js').includes('./'+asset));new Function(read(asset));
  }
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',className:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});return nodes.get(id);};
  const ctx={document:{getElementById:node},MiraStudioCompiler:bridge,TextEncoder};
  runInNewContext(read('text-module-data.js'),ctx);runInNewContext(read('text-module-lab.js'),ctx);
  assert.match(node('text-status').textContent,/Type check riuscito/);
  node('text-php').listeners.click();assert.match(node('text-status').textContent,/riuscita/);
});
test('0.83 Text adapters agree on Unicode scalar values, empty needles and exact matching',()=>{
  const ctx={};runInNewContext(read('text-host.js'),ctx);const h=ctx.MiraTextHost;
  const cases=['','abc','è','🎸','é','👨‍👩‍👧‍👦','a\n\u0000','你好'];
  const queries=['','a','è','🎸','é','é','👩','\u0000','好'];
  const matrix=cases.map(s=>[h['native code points'](s),...queries.map(q=>[h['native contains:in:'](q,s),h['native starts with:in:'](q,s),h['native ends with:in:'](q,s)])]);
  assert.deepEqual(matrix.map(x=>x[0]),[0,3,1,1,2,7,3,2]);
  assert.equal(h['native contains:in:']('é','é'),false);
  for(const bad of ['\uD800','\uDC00',42,null])assert.throws(()=>h['native code points'](bad),/valid Unicode Text/);
  assert.throws(()=>h['native contains:in:']('\uD800','a'),/valid Unicode Text/);
  const code='$h=require $argv[1];[$cases,$queries]=json_decode($argv[2],true,512,JSON_THROW_ON_ERROR);$out=[];foreach($cases as $s){$row=[$h["native code points"]($s)];foreach($queries as $q)$row[]=[$h["native contains:in:"]($q,$s),$h["native starts with:in:"]($q,$s),$h["native ends with:in:"]($q,$s)];$out[]=$row;}echo json_encode($out,JSON_THROW_ON_ERROR);';
  const adapter=resolve(root,'lib/text/text-host.php');
  const run=spawnSync('php',['-r',code,adapter,JSON.stringify([cases,queries])],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),matrix);
  const invalid=spawnSync('php',['-r','$h=require $argv[1];try{$h["native code points"](hex2bin("eda080"));exit(1);}catch(InvalidArgumentException $e){echo $e->getMessage();}',adapter],{encoding:'utf8'});
  assert.equal(invalid.status,0,invalid.stderr);assert.match(invalid.stdout,/valid Unicode Text/);
});

test('0.84 generated JSON decoder uses the real contract and validates JS/PHP inputs',async()=>{
  const ctx={TextEncoder};runInNewContext(read('json-module-data.js'),ctx);
  const d=ctx.MiraJsonModuleData;
  const {generateJsonDecoder}=await import('../scripts/json-contract.mjs');
  const report=bridge.interfaces(d.source,null,d.modules);
  assert.equal(report.ok,true,report.message);
  const config=JSON.parse(readFileSync(resolve(root,'lib/json/decoder.json'),'utf8'));
  const generated=generateJsonDecoder(JSON.parse(report.output),config);
  assert.deepEqual(JSON.parse(d.host),generated.host);
  assert.deepEqual(JSON.parse(JSON.stringify(d.decoder)),generated.decoder);
  const changed=bridge.interfaces(d.source,null,d.modules.replace('hours: Number','hours: Text'));
  // App uses hours in arithmetic: the real checker must reject this change.
  assert.equal(changed.ok,false);
  const valid={name:'Ada',hours:2,paid:false,tags:['chitarra']};
  const cases=[JSON.stringify(valid),JSON.stringify({...valid,hours:'2'}),JSON.stringify({...valid,extra:true}),JSON.stringify({...valid,tags:[1]}),JSON.stringify({...valid,tags:{}}),JSON.stringify({...valid,tags:[]}),JSON.stringify({...valid,hours:9007199254740992}),JSON.stringify({...valid,name:'\uD800'}),'not json','null','[]','{}',' '.repeat(16385)];
  runInNewContext(read('typed-data.js'),ctx);runInNewContext(read('json-host.js'),ctx);
  const decode=ctx.MiraJsonDecoder.host(d.decoder)[d.decoder.capability];
  const js=cases.map(raw=>{try{return {ok:true,value:decode(raw)}}catch(e){return {ok:false,error:e.message}}});
  assert.deepEqual(js.map(x=>x.ok),[true,false,false,false,false,true,false,false,false,false,false,false,false]);
  const adapter=resolve(root,'lib/json/json-host.php');
  const code='require $argv[1];$binding=json_decode($argv[2],true,512,JSON_THROW_ON_ERROR);$decode=\\Mira\\Json\\host($binding)[$binding["capability"]];$out=[];foreach(json_decode($argv[3],true,512,JSON_THROW_ON_ERROR) as $raw){try{$out[]=["ok"=>true,"value"=>$decode($raw)];}catch(InvalidArgumentException $e){$out[]=["ok"=>false,"error"=>$e->getMessage()];}}echo json_encode($out,JSON_THROW_ON_ERROR);';
  const php=spawnSync('php',['-r',code,adapter,JSON.stringify(d.decoder),JSON.stringify(cases)],{encoding:'utf8'});
  assert.equal(php.status,0,php.stderr);assert.deepEqual(JSON.parse(php.stdout),JSON.parse(JSON.stringify(js)));
  for(const target of ['js','php']){
    const out=bridge.compile(d.source,target,d.host,false,d.modules,true,true,d.bindings);assert.equal(out.ok,true,out.message);
    const name='__miraModule_v_417070202F20726573756C74';
    const expected={name:'Ada',total:60,paid:false,tags:['chitarra']};
    if(target==='js'){
      let response;
      const worker={TextEncoder,self:{postMessage(v){response=v;}}};
      worker.importScripts=(...files)=>files.forEach(file=>runInNewContext(read(file.replace('./','')),worker));
      runInNewContext(read('host-module-worker.js'),worker);worker.self.onmessage({data:{code:out.output,service:'json'}});
      assert.equal(response.ok,true,response.message);assert.deepEqual(JSON.parse(response.output),expected);
    }else{
      const program=out.output.replace(/^<\?php/,'').replace('declare(strict_types=1);','declare(strict_types=1);require $argv[1];$GLOBALS["__miraHost"]=\\Mira\\Json\\host(json_decode($argv[2],true));')+'\necho json_encode($'+name+');';
      const run=spawnSync('php',['-r',program,adapter,JSON.stringify(d.decoder)],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),expected);
    }
  }
  const bad=d.source+'\nleak = native decode lesson "x";';assert.equal(bridge.check(bad,d.host,d.modules,d.bindings).ok,false);
  for(const asset of ['json-module-data.js','json-host.js','typed-data.js'])assert.ok(read('sw.js').includes('./'+asset));
});

test('0.85 fallible JSON returns typed Result and handles invalid inputs on both targets',()=>{
  const ctx={TextEncoder};runInNewContext(read('json-module-data.js'),ctx);const d=ctx.MiraJsonModuleData;
  const checked=bridge.check(d.fallibleSource,d.host,d.modules,d.bindings);
  assert.equal(checked.ok,true,checked.message);
  const rows=JSON.parse(checked.output),decode=rows.find(x=>x.name.endsWith(' / try decode lesson:'));
  assert.equal(decode.schema.result.kind,'Sum');
  assert.equal(decode.schema.result.name,'Data / Outcome / Result');
  assert.equal(decode.schema.result.alternatives.find(x=>x.tag==='Err').payload.kind,'Text');
  const expected=[{accepted:true,total:60,error:''},{accepted:false,total:0,error:'invalid_json_data'},{accepted:false,total:0,error:'invalid_json_data'}];
  for(const target of ['js','php']){
    const out=bridge.compile(d.fallibleSource,target,d.host,false,d.modules,true,true,d.bindings);
    assert.equal(out.ok,true,out.message);
    if(target==='js'){
      let response;
      const worker={TextEncoder,self:{postMessage(v){response=v;}}};
      worker.importScripts=(...files)=>files.forEach(file=>runInNewContext(read(file.replace('./','')),worker));
      runInNewContext(read('host-module-worker.js'),worker);worker.self.onmessage({data:{code:out.output,service:'json'}});
      assert.equal(response.ok,true,response.message);assert.deepEqual(JSON.parse(response.output),expected);
    }else{
      const code=out.output.replace(/^<\?php/,'').replace('declare(strict_types=1);','declare(strict_types=1);require $argv[1];$GLOBALS["__miraHost"]=\\Mira\\Json\\host(json_decode($argv[2],true));')+'\necho json_encode($__miraModule_v_417070202F20726573756C74);';
      const run=spawnSync('php',['-r',code,resolve(root,'lib/json/json-host.php'),JSON.stringify(d.decoder)],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),expected);
    }
  }
  const noErr=d.fallibleSource.replace(',\n    err: {message | {accepted: false, total: 0, error: message}}','');
  assert.equal(bridge.check(noErr,d.host,d.modules,d.bindings).ok,false);
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',className:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});return nodes.get(id);};
  const ui={document:{getElementById:node},MiraStudioCompiler:bridge,TextEncoder};
  runInNewContext(read('text-module-data.js'),ui);runInNewContext(read('json-module-data.js'),ui);runInNewContext(read('text-module-lab.js'),ui);
  node('json-fallible').listeners.click();assert.equal(node('json-source').value,d.fallibleSource);
  assert.match(node('json-status').textContent,/Type check riuscito/);
});

test('0.86 Date opaque service runs on both targets and prevents forged dates',()=>{
  const ctx={};runInNewContext(read('date-module-data.js'),ctx);const d=ctx.MiraDateModuleData;
  const report=bridge.check(d.source,d.host,d.modules,d.bindings);assert.equal(report.ok,true,report.message);
  const expected={start:'2028-02-28',finish:'2028-03-01',elapsed:2,weekday:3,leap:true,invalid:false};
  for(const target of ['js','php']){
    const out=bridge.compile(d.source,target,d.host,false,d.modules,true,true,d.bindings);
    assert.equal(out.ok,true,out.message);
    if(target==='js'){
      let response;const worker={self:{postMessage(v){response=v;}}};
      worker.importScripts=(...files)=>files.forEach(file=>runInNewContext(read(file.replace('./','')),worker));
      runInNewContext(read('host-module-worker.js'),worker);worker.self.onmessage({data:{code:out.output,service:'date'}});
      assert.equal(response.ok,true,response.message);assert.deepEqual(JSON.parse(response.output),expected);
    }else{
      const code=out.output.replace(/^<\?php/,'').replace('declare(strict_types=1);','declare(strict_types=1);$GLOBALS["__miraHost"]=require $argv[1];')+'\necho json_encode($__miraModule_v_417070202F20726573756C74);';
      const run=spawnSync('php',['-r',code,resolve(root,'lib/date/date-host.php')],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),expected);
    }
  }
  for(const bad of ['fake (Date) = {iso: "2027-02-29"};','fake = iso of: "2027-02-29";','fake = start ~ iso;','fake = native checked date "2027-02-29";']){
    assert.equal(bridge.check(d.source+'\n'+bad,d.host,d.modules,d.bindings).ok,false,bad);
  }
  for(const asset of ['date-module-data.js','date-host.js'])assert.ok(read('sw.js').includes('./'+asset));
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',className:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});return nodes.get(id);};
  const ui={document:{getElementById:node},MiraStudioCompiler:bridge,TextEncoder};
  for(const asset of ['text-module-data.js','json-module-data.js','date-module-data.js','text-module-lab.js'])runInNewContext(read(asset),ui);
  assert.match(node('date-status').textContent,/Type check riuscito/);
  node('date-php').listeners.click();assert.match(node('date-status').textContent,/riuscita/);
});
test('0.86 native Date adapters agree independent of local timezone',()=>{
  const ctx={};runInNewContext(read('date-host.js'),ctx);const h=ctx.MiraDateHost;
  const dates=['0001-01-01','0099-12-31','1582-10-10','1900-02-29','2000-02-29','2027-02-29','2028-02-29','9999-12-31','0000-01-01','2026-11-31','2026-1-01','2026-01-01\n','2026-01-01T00:00:00Z',''];
  const additions=[[1,'0099-12-31'],[2,'2028-02-28'],[-1,'2028-03-01'],[0,'0001-01-01'],[-1,'0001-01-01'],[1,'9999-12-31'],[1.5,'2026-01-01'],[3652058,'0001-01-01'],[3652059,'0001-01-01'],[-3652058,'9999-12-31'],[1,'1900-02-29']];
  const pairs=[['0001-01-01','9999-12-31'],['2028-03-01','2028-02-28'],['2026-03-29','2026-03-30'],['2026-10-25','2026-10-26']];
  const run=(name,...args)=>{try{return {ok:true,value:h[name](...args)}}catch(e){return {ok:false,error:e.message}}};
  const requests=[...dates.flatMap(d=>[['native valid date',d],['native weekday',d]]),...additions.map(a=>['native add days:to:',...a]),...pairs.map(a=>['native days between:and:',...a])];
  const js=requests.map(([name,...args])=>run(name,...args));
  assert.equal(run('native weekday','0001-01-01').value,1);
  assert.equal(run('native add days:to:',3652058,'0001-01-01').value,'9999-12-31');
  assert.equal(run('native days between:and:','2028-03-01','2028-02-28').value,-2);
  assert.equal(run('native valid date','1900-02-29').value,false);
  assert.equal(run('native valid date','2000-02-29').value,true);
  const code='date_default_timezone_set("America/New_York");$h=require $argv[1];$out=[];foreach(json_decode($argv[2],true,512,JSON_THROW_ON_ERROR) as $req){$name=array_shift($req);try{$out[]=["ok"=>true,"value"=>$h[$name](...$req)];}catch(InvalidArgumentException $e){$out[]=["ok"=>false,"error"=>$e->getMessage()];}}echo json_encode($out,JSON_THROW_ON_ERROR);';
  const php=spawnSync('php',['-r',code,resolve(root,'lib/date/date-host.php'),JSON.stringify(requests)],{encoding:'utf8'});
  assert.equal(php.status,0,php.stderr);assert.deepEqual(JSON.parse(php.stdout),js);
});

test('0.87 Storage static providers and compiled browser program persist across instances',()=>{
  const ctx={TextEncoder};for(const asset of ['storage-host.js','storage-module-data.js','storage-module-program.js'])runInNewContext(read(asset),ctx);
  const d=ctx.MiraStorageModuleData;
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const a=ctx.MiraStorageProgram(ctx.MiraStorageHost.browser(storage,'test'));
  assert.deepEqual(Array.from(a.read('note')),[]);
  assert.equal(a.save('', 'note'),true);assert.deepEqual(Array.from(a.read('note')),['']);
  assert.equal(a.save('Caffè 🎸','note'),true);
  const b=ctx.MiraStorageProgram(ctx.MiraStorageHost.browser(storage,'test'));
  assert.deepEqual(Array.from(b.read('note')),['Caffè 🎸']);
  const other=ctx.MiraStorageProgram(ctx.MiraStorageHost.browser(storage,'other'));
  assert.deepEqual(Array.from(other.read('note')),[]);
  assert.equal(b.remove('note'),true);assert.equal(b.remove('note'),true);assert.deepEqual(Array.from(a.read('note')),[]);
  for(const key of ['../x','A','a/b','a\n',''])assert.throws(()=>a.read(key),/invalid_key/);
  assert.throws(()=>a.save('🎸'.repeat(16385),'note'),/value_too_large/);
  assert.throws(()=>a.save('\uD800','note'),/invalid_text/);
  const broken=ctx.MiraStorageProgram(ctx.MiraStorageHost.browser({setItem(){throw Error('quota');}},'test'));
  assert.throws(()=>broken.save('x','note'),/storage_failure/);
  for(const [target,binding,expected,absent] of [['js',d.browser,'browser read text','files read text'],['php',d.files,'files read text','browser read text']]){
    const out=bridge.compile(d.source,target,d.host,false,d.modules,true,true,binding);assert.equal(out.ok,true,out.message);
    assert.ok(out.output.includes(expected));assert.ok(!out.output.includes(absent));
  }
  const reportA=bridge.interfaces(d.source,d.host,d.modules,d.browser),reportB=bridge.interfaces(d.source,d.host,d.modules,d.files);
  assert.ok(reportA.ok,reportA.message);assert.ok(reportB.ok,reportB.message);
  const surface=r=>JSON.parse(r.output).interfaces.find(m=>m.module==='Services / Storage').fingerprint;
  assert.equal(surface(reportA),surface(reportB));
  assert.equal(bridge.check(d.source+'\nleak = browser read text "note";',d.host,d.modules,d.browser).ok,false);
  for(const asset of ['storage-host.js','storage-module-data.js','storage-module-program.js','storage-module-lab.js'])assert.ok(read('sw.js').includes('./'+asset));
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',className:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});return nodes.get(id);};
  ctx.document={getElementById:node};ctx.window={localStorage:storage};
  runInNewContext(read('storage-module-lab.js'),ctx);
  node('storage-key').value='note';node('storage-value').value='prova';node('storage-save').listeners.click();
  node('storage-value').value='';node('storage-read').listeners.click();
  assert.equal(node('storage-value').value,'prova');node('storage-remove').listeners.click();node('storage-read').listeners.click();
  assert.match(node('storage-status').textContent,/assente/);
});

test('0.88 HTTP lab builds checked pure Mira program and uses real adapter with injected fetch',async()=>{
  const requests=[];
  const ctx={URL,AbortController,TextDecoder,setTimeout,clearTimeout,fetch:async(url,options)=>{requests.push({url,options});return new Response('Caffè 🎸',{status:200});}};
  for(const asset of ['http-host.js','http-module-data.js','http-module-program.js'])runInNewContext(read(asset),ctx);
  const d=ctx.MiraHttpModuleData,p=ctx.MiraHttpProgram();
  assert.deepEqual(JSON.parse(JSON.stringify(p.request(7))),{service:'http text',id:7,reply:'http loaded',payload:true});
  assert.equal(p.successful({status:200,body:'x'}),true);assert.equal(p.successful({status:503,body:'x'}),false);
  for(const target of ['js','php']){const out=bridge.compile(d.source,target,null,false,d.modules,true,true);assert.equal(out.ok,true,out.message);}
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});return nodes.get(id);};
  ctx.document={getElementById:node};ctx.window={location:{href:'https://example.test/studio/host-module-lab.html'},addEventListener(){}};
  runInNewContext(read('http-module-lab.js'),ctx);
  await node('http-load').listeners.click();
  assert.equal(requests[0].url,'https://example.test/studio/http-example.txt');
  assert.equal(requests[0].options.credentials,'omit');assert.equal(node('http-output').textContent,'Caffè 🎸');
  assert.match(node('http-status').textContent,/HTTP 200/);
  for(const asset of ['http-host.js','http-module-data.js','http-module-program.js','http-module-lab.js','http-example.txt'])assert.ok(read('sw.js').includes('./'+asset));
});

test('0.89 integrated lesson import composes checked modules and preserves the valid saved lesson',async()=>{
  const {mkdtempSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const ctx={TextEncoder,TextDecoder,URL,AbortController,setTimeout,clearTimeout,Intl};
  for(const asset of ['typed-data.js','text-host.js','date-host.js','storage-host.js','json-host.js','http-host.js','lesson-import-data.js','lesson-import-program.js'])runInNewContext(read(asset),ctx);
  const d=ctx.MiraLessonImportData,raw=read('lesson-import-sample.json');
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const h={...ctx.MiraTextHost,...ctx.MiraDateHost,...ctx.MiraJsonDecoder.host(d.decoder),...ctx.MiraStorageHost.browser(storage,'test')};
  const p=ctx.MiraLessonImportProgram(h),plain=v=>JSON.parse(JSON.stringify(v));
  const expected={accepted:true,student:'Ada',day:'2026-11-27',hours:1.5,weekday:5,paid:false,total:45,error:''};
  assert.deepEqual(plain(p.inspect(raw)),expected);
  assert.deepEqual(plain(p.accept({status:200,body:raw})),expected);
  assert.equal(p.accept({status:404,body:raw}).error,'http_status');
  assert.deepEqual(plain(p.save(raw)),expected);
  const cases=[['bad','invalid_json_data'],[raw.replace('2026-11-27','2026-02-29'),'invalid_date'],[raw.replace('1.5','0'),'invalid_hours'],[raw.replace('Ada',''),'invalid_name']];
  for(const [bad,error] of cases){assert.equal(p.save(bad).error,error);assert.deepEqual(plain(p.restore()),{tag:'Ok',value:{tag:'Some',value:raw}});}
  assert.deepEqual(plain(p.request(3)),{service:'http text',id:3,reply:'http loaded',payload:true});
  const dir=mkdtempSync(resolve(tmpdir(),'mira-import-'));
  try{
    const code=d.php.replace(/^<\?php/,'').replace('declare(strict_types=1);','declare(strict_types=1);require $argv[1];require $argv[2];$GLOBALS["__miraHost"]=array_merge(require $argv[3],require $argv[4],\\Mira\\Json\\host(json_decode($argv[5],true)),\\Mira\\Storage\\files($argv[6]));')+'\n$p=$__miraModule_v_417070202F20726573756C74;$raw=$argv[7];echo json_encode([$p["inspect"]($raw),$p["save"]($raw),$p["save"]("bad"),$p["restore"](),$p["accept"](["status"=>404,"body"=>$raw])],JSON_THROW_ON_ERROR);';
    const args=['-r',code,resolve(root,'lib/json/json-host.php'),resolve(root,'lib/storage/storage-host.php'),resolve(root,'lib/text/text-host.php'),resolve(root,'lib/date/date-host.php'),JSON.stringify(d.decoder),dir,raw];
    const php=spawnSync('php',args,{encoding:'utf8'});
    assert.equal(php.status,0,php.stderr);
    const actual=JSON.parse(php.stdout);
    assert.deepEqual(actual,[expected,expected,plain(p.inspect('bad')),{tag:'Ok',value:{tag:'Some',value:raw}},plain(p.accept({status:404,body:raw}))]);
  }finally{rmSync(dir,{recursive:true,force:true});}
  assert.deepEqual(plain(p.remove()),{tag:'Ok',value:true});assert.deepEqual(plain(p.restore()),{tag:'Ok',value:{tag:'None'}});
  assert.ok(d.js.includes('browser try save text:for:'));assert.ok(!d.js.includes('files try save text:for:'));
  assert.ok(d.php.includes('files try save text:for:'));assert.ok(!d.php.includes('browser try save text:for:'));
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:false,disabled:false,listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});return nodes.get(id);};
  ctx.document={getElementById:node};ctx.window={localStorage:storage,location:{href:'https://example.test/studio/lesson-import.html'},confirm:()=>true,addEventListener(){}};
  let response={body:raw,status:200};
  ctx.fetch=async()=>new Response(response.body,{status:response.status});
  runInNewContext(read('lesson-import.js'),ctx);
  await node('load').listeners.click();assert.equal(node('student').textContent,'Ada');assert.equal(node('save').disabled,false);
  const setItem=storage.setItem;
  storage.setItem=()=>{throw Error('quota');};
  node('save').listeners.click();assert.match(node('status').textContent,/storage_failure/);
  assert.equal(node('save').disabled,false);assert.equal(node('summary').hidden,false);
  storage.setItem=setItem;
  node('save').listeners.click();assert.match(node('status').textContent,/Salvata/);
  const getItem=storage.getItem;
  storage.getItem=()=>{throw Error('denied');};
  node('restore').listeners.click();assert.match(node('status').textContent,/storage_failure/);
  assert.equal(node('raw').value,raw);assert.equal(node('summary').hidden,false);
  storage.getItem=getItem;
  const removeItem=storage.removeItem;
  storage.removeItem=()=>{throw Error('denied');};
  node('remove').listeners.click();assert.match(node('status').textContent,/storage_failure/);
  storage.removeItem=removeItem;
  response={body:'not a lesson',status:404};
  await node('load').listeners.click();assert.equal(node('raw').value,raw);assert.match(node('status').textContent,/http_status/);
  response={body:'bad',status:200};
  await node('load').listeners.click();assert.equal(node('raw').value,raw);assert.match(node('status').textContent,/invalid_json_data/);
  node('raw').value='bad';node('raw').listeners.input();assert.equal(node('save').disabled,true);
  node('restore').listeners.click();assert.equal(node('raw').value,raw);assert.match(node('status').textContent,/Recuperata/);
  node('remove').listeners.click();node('restore').listeners.click();assert.match(node('status').textContent,/Nessuna/);
  for(const asset of ['lesson-import.html','lesson-import.css','lesson-import.js','lesson-import-data.js','lesson-import-program.js','lesson-import-sample.json'])assert.ok(read('sw.js').includes('./'+asset));
});

test('0.89.2 Studio checked PHP specializes known equality without a runtime wrapper',()=>{
  const source='n: x (Number) -> Boolean = x == 1.0; s: x (Text) -> Boolean = x == "01"; result = [(n: 1), (s: "1")];';
  const php=bridge.compile(source,'php',null,false,null,true);assert.equal(php.ok,true,php.message);
  assert.ok(!php.output.includes('__miraEqA'));
  assert.match(php.output,/\$x == 1\.0/);assert.match(php.output,/\$x === '01'/);
  const js=bridge.compile(source,'js',null,false,null,true);assert.equal(js.ok,true,js.message);
  assert.deepEqual(Array.from(runInNewContext(js.output+'\nresult',{})),[true,false]);
  const generic=bridge.compile('same: x, as: y = x == y; result = same: 1, as: 1.0;','php',null,false,null,true);
  assert.equal(generic.ok,true,generic.message);assert.match(generic.output,/__miraEqA/);
  const run=spawnSync('php',['-r',generic.output.replace(/^<\?php/,'')+'echo json_encode($result);'],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);assert.equal(run.stdout,'true');
});

test('0.89.3 Studio uses the same fractional remainder lowering for sections and expressions',()=>{
  const source='remainder = (_ % 0.5); result = [(0.75 % 0.5), (0.75 >> remainder), ((0 - 5.5) % 2)];';
  for(const checked of [false,true]){
    const js=bridge.compile(source,'js',null,false,null,checked);
    const php=bridge.compile(source,'php',null,false,null,checked);
    assert.equal(js.ok,true,js.message);assert.equal(php.ok,true,php.message);
    assert.match(php.output,/\\fmod\(/);
    const expected=[0.25,0.25,-1.5];
    assert.deepEqual(Array.from(runInNewContext(js.output+'\nresult',{})),expected);
    const run=spawnSync('php',['-r',php.output.replace(/^<\?php/,'')+'echo json_encode($result);'],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),expected);
  }
});

test('0.89.4 lesson import shares nominal outcomes across services',()=>{
  const ctx={};runInNewContext(read('lesson-import-data.js'),ctx);
  const d=ctx.MiraLessonImportData;
  for(const bindings of [null,d.jsBindings,d.phpBindings]){
    const report=bridge.interfaces(d.source,bindings?d.host:null,d.modules,bindings);
    assert.equal(report.ok,true,report.message);
    const rows=JSON.parse(report.output).interfaces;
    const schema=(module,name)=>rows.find(m=>m.module===module).surface.symbols.find(s=>s.name===name).schema;
    assert.equal(schema('Services / Lesson Import','try decode imported lesson:').result.name,'Data / Outcome / Result');
    const date=schema('Services / Date Safe','try date from:').result;
    assert.equal(date.name,'Data / Outcome / Result');
    assert.equal(date.arguments[0].name,'Services / Date / Date');
    assert.equal(date.arguments[1].name,'Data / Date Outcome / Date Error');
    const restore=schema('Services / Storage Safe','try read text:').result;
    assert.equal(restore.name,'Data / Outcome / Result');
    assert.equal(restore.arguments[0].name,'Data / Outcome / Option');
    assert.equal(restore.arguments[1].name,'Data / Storage Outcome / Storage Error');
    assert.equal(schema('App','result').fields.find(x=>x.name==='restore').type.result.name,'Data / Outcome / Result');
  }
});

test('0.89.5 checked fallible storage distinguishes absence, empty value and I/O errors in JS/PHP',async()=>{
  const {mkdtempSync,rmSync,symlinkSync,writeFileSync,renameSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const ctx={TextEncoder};for(const asset of ['storage-host.js','lesson-import-data.js'])runInNewContext(read(asset),ctx);
  const d=ctx.MiraLessonImportData;
  const source='module App; interface result; import Services / Storage Safe {try read text: ; try save text: for: ; try remove text: ;}; implementation result = {read: {key | try read text: key}, save: {value,key | try save text: value, for: key}, remove: {key | try remove text: key}};';
  const name='__miraModule_v_417070202F20726573756C74',plain=x=>JSON.parse(JSON.stringify(x));
  const ok=value=>({tag:'Ok',value}),err=tag=>({tag:'Err',value:{tag}});
  const expected=[ok({tag:'None'}),ok(true),ok({tag:'Some',value:''}),ok(true),ok({tag:'Some',value:'Caffè 🎸'}),err('InvalidKey'),err('ValueTooLarge'),err('InvalidText'),err('StorageFailure'),ok(true),ok({tag:'None'})];
  const out=bridge.compile(source,'js',d.host,false,d.modules,true,true,d.jsBindings);assert.equal(out.ok,true,out.message);
  const map=new Map(),storage={getItem:k=>{if(k.endsWith(':broken'))throw Error('denied');return map.get(k)??null;},setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const program=runInNewContext('(function(__miraHost){'+out.output+'\nreturn '+name+';})',{})(ctx.MiraStorageHost.browser(storage,'test'));
  assert.deepEqual(plain([program.read('note'),program.save('','note'),program.read('note'),program.save('Caffè 🎸','note'),program.read('note'),program.read('../x'),program.save('x'.repeat(65537),'note'),program.save('\uD800','note'),program.read('broken'),program.remove('note'),program.read('note')]),expected);
  const dir=mkdtempSync(resolve(tmpdir(),'mira-safe-storage-'));
  try{
    const outside=dir+'-outside';writeFileSync(outside,'untouched');
    try{
      symlinkSync(outside,resolve(dir,'broken.txt'));
      const php=bridge.compile(source,'php',d.host,false,d.modules,true,true,d.phpBindings);assert.equal(php.ok,true,php.message);
      const code=php.output.replace(/^<\?php/,'').replace('declare(strict_types=1);','declare(strict_types=1);require $argv[1];$GLOBALS["__miraHost"]=\\Mira\\Storage\\files($argv[2]);')+'\n$p=$'+name+';$r=[$p["read"]("note"),$p["save"]("","note"),$p["read"]("note"),$p["save"]("Caffè 🎸","note"),$p["read"]("note"),$p["read"]("../x"),$p["save"](str_repeat("x",65537),"note"),$p["save"]("\\xFF","note"),$p["read"]("broken"),$p["remove"]("note"),$p["read"]("note")];rename($argv[2],$argv[2]."-moved");try{$r[]=$p["read"]("note");}finally{rename($argv[2]."-moved",$argv[2]);}echo json_encode($r,JSON_THROW_ON_ERROR);';
      const run=spawnSync('php',['-r',code,resolve(root,'lib/storage/storage-host.php'),dir],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),[...expected,err('StorageFailure')]);
      assert.equal(readFileSync(outside,'utf8'),'untouched');
    }finally{rmSync(outside,{force:true});}
  }finally{rmSync(dir,{recursive:true,force:true});rmSync(dir+'-moved',{recursive:true,force:true});}
});

test('0.89.6 civil Date operations return shared Result and nominal errors in JS/PHP',()=>{
  const ctx={};for(const asset of ['date-host.js','lesson-import-data.js'])runInNewContext(read(asset),ctx);
  const d=ctx.MiraLessonImportData;
  const source='module App; interface result; import Services / Date {Date; date from: ; iso of: ;}; import Services / Date Safe {try date from: ; try add days: to: ;}; import Data / Outcome {Result; Ok: ; Err: ;}; import Data / Date Outcome {Date Error;}; implementation expose: value (Result (Date, Date Error)) -> Result (Text, Date Error) = match: value {ok: {day | Ok: (iso of: day)}, err: {error | Err: error}}; result = {parse: {raw | expose: (try date from: raw)}, shift: {count, raw | expose: (try add days: count, to: (date from: raw))}};';
  const name='__miraModule_v_417070202F20726573756C74',plain=x=>JSON.parse(JSON.stringify(x));
  const ok=value=>({tag:'Ok',value}),err=tag=>({tag:'Err',value:{tag}});
  const expected=[ok('0001-01-01'),ok('0099-12-31'),ok('2028-02-29'),err('InvalidDate'),err('InvalidDate'),err('InvalidDate'),err('InvalidDate'),ok('2028-02-29'),ok('2028-02-29'),ok('9999-12-31'),ok('0001-01-01'),err('DateOutOfRange'),err('DateOutOfRange'),err('InvalidDayCount'),err('InvalidDayCount'),err('InvalidDayCount'),err('InvalidDayCount')];
  const js=bridge.compile(source,'js',d.host,false,d.modules,true,true,d.jsBindings);assert.equal(js.ok,true,js.message);
  const p=runInNewContext('(function(__miraHost){'+js.output+'\nreturn '+name+';})',{})(ctx.MiraDateHost);
  const actual=[p.parse('0001-01-01'),p.parse('0099-12-31'),p.parse('2028-02-29'),p.parse('2027-02-29'),p.parse('0000-01-01'),p.parse('2028-2-29'),p.parse('2028-02-29T00:00:00Z'),p.shift(1,'2028-02-28'),p.shift(-1,'2028-03-01'),p.shift(3652058,'0001-01-01'),p.shift(-3652058,'9999-12-31'),p.shift(1,'9999-12-31'),p.shift(-1,'0001-01-01'),p.shift(0.5,'2028-02-28'),p.shift(3652059,'0001-01-01'),p.shift(NaN,'2028-02-28'),p.shift(Infinity,'2028-02-28')];
  assert.deepEqual(plain(actual),expected);
  const php=bridge.compile(source,'php',d.host,false,d.modules,true,true,d.phpBindings);assert.equal(php.ok,true,php.message);
  const code=php.output.replace(/^<\?php/,'').replace('declare(strict_types=1);','declare(strict_types=1);$GLOBALS["__miraHost"]=require $argv[1];')+'\n$p=$'+name+';$r=[$p["parse"]("0001-01-01"),$p["parse"]("0099-12-31"),$p["parse"]("2028-02-29"),$p["parse"]("2027-02-29"),$p["parse"]("0000-01-01"),$p["parse"]("2028-2-29"),$p["parse"]("2028-02-29T00:00:00Z"),$p["shift"](1,"2028-02-28"),$p["shift"](-1,"2028-03-01"),$p["shift"](3652058,"0001-01-01"),$p["shift"](-3652058,"9999-12-31"),$p["shift"](1,"9999-12-31"),$p["shift"](-1,"0001-01-01"),$p["shift"](0.5,"2028-02-28"),$p["shift"](3652059,"0001-01-01"),$p["shift"](NAN,"2028-02-28"),$p["shift"](INF,"2028-02-28")];echo json_encode($r,JSON_THROW_ON_ERROR);';
  const run=spawnSync('php',['-r',code,resolve(root,'lib/date/date-host.php')],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),expected);
  for(const bindings of [null,d.jsBindings,d.phpBindings]){
    const report=bridge.interfaces(source,bindings?d.host:null,d.modules,bindings);assert.equal(report.ok,true,report.message);
    const rows=JSON.parse(report.output).interfaces;
    const signature=rows.find(x=>x.module==='Services / Date Safe').surface.symbols.find(x=>x.name==='try add days:to:').schema;
    assert.equal(signature.parameters[1].name,'Services / Date / Date');
    assert.equal(signature.result.arguments[0].name,'Services / Date / Date');
  }
  const bad=source+' forged (Date) = {iso: "2028-02-29"};';
  assert.equal(bridge.check(bad,d.host,d.modules,d.jsBindings).ok,false);
  assert.equal(bridge.check(source+' leak = native try checked date "2028-02-29";',d.host,d.modules,d.jsBindings).ok,false);
});

test('0.89.7 both JSON decoders share a generic checked outcome converter',()=>{
  const ctx={};for(const asset of ['json-module-data.js','lesson-import-data.js'])runInNewContext(read(asset),ctx);
  const json=ctx.MiraJsonModuleData,lesson=ctx.MiraLessonImportData;
  const jm=JSON.parse(json.modules),lm=JSON.parse(lesson.modules);
  assert.equal(jm['Data / Outcome'],lm['Data / Outcome']);
  assert.equal(jm['Data / Decoder Outcome'],lm['Data / Decoder Outcome']);
  const source='module App; interface result; import Data / Decoder Outcome {decoded result: ;}; import Data / Outcome {Result;}; implementation summarize: r (Result (Text, Text)) -> Text = match: r {ok: {v | v}, err: {e | e}}; number: r (Result (Number, Text)) -> Number = match: r {ok: {v | v}, err: {e | 0}}; result = {text: (summarize: (decoded result: {values: ["Ada"], error: ""})), failed: (summarize: (decoded result: {values: [], error: "invalid_json_data"})), number: (number: (decoded result: {values: [42], error: ""}))};';
  const expected={text:'Ada',failed:'invalid_json_data',number:42},name='__miraModule_v_417070202F20726573756C74';
  for(const target of ['js','php']){
    const out=bridge.compile(source,target,null,false,json.modules,true,true);assert.equal(out.ok,true,out.message);
    if(target==='js')assert.deepEqual(JSON.parse(JSON.stringify(runInNewContext(out.output+'\n'+name,{}))),expected);
    else{
      const run=spawnSync('php',['-r',out.output.replace(/^<\?php/,'')+'\necho json_encode($'+name+');'],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),expected);
    }
  }
});

test('0.90 standalone project and Studio build the same checked application',async()=>{
  const {loadProject,buildProject}=await import('../scripts/project.mjs');
  const {mkdtempSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const filename=resolve(root,'examples/lesson-import/mira.project.json');
  const project=loadProject(filename),built=buildProject(bridge,project);
  const ctx={};runInNewContext(read('lesson-import-data.js'),ctx);const data=ctx.MiraLessonImportData;
  assert.equal(built.js,data.js);assert.equal(built.php,data.php);
  assert.equal(built.host,data.host);assert.equal(built.modules,data.modules);
  assert.deepEqual(JSON.parse(JSON.stringify(data.decoder)),built.decoder);
  const collision={...project,shared:[...project.shared,{'Services / Lesson Import':{provider:'Providers / Lesson Import Native'}}]};
  assert.throws(()=>buildProject(bridge,collision),/Duplicate provider binding/);
  const dir=mkdtempSync(resolve(tmpdir(),'mira-project-build-'));
  try{
    const run=spawnSync('node',[resolve(root,'scripts/build-project.mjs'),filename,dir],{cwd:root,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    for(const target of ['js','php']){
      assert.equal(readFileSync(resolve(dir,'program.'+target),'utf8'),built[target]);
      assert.deepEqual(JSON.parse(readFileSync(resolve(dir,'bindings-'+target+'.json'),'utf8')),JSON.parse(built[target+'Bindings']));
    }
    assert.deepEqual(JSON.parse(readFileSync(resolve(dir,'host.json'),'utf8')),JSON.parse(built.host));
    assert.deepEqual(JSON.parse(readFileSync(resolve(dir,'decoder.json'),'utf8')),built.decoder);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.96 data-only evaluator uses real Mira AST and checked algebraic constructors',()=>{
  const actual=readFileSync(resolve(root,'lib/gui-style-contract.mira'),'utf8');
  assert.equal(bridge.styleContractSource(),actual);
  const schema=bridge.constantData(actual,'style rules');
  assert.equal(schema.ok,true,schema.message);
  const rules=JSON.parse(schema.output);
  assert.deepEqual(rules.padding,{tag:'Range',value:{min:0,max:4096}});
  assert.equal(rules.width.tag,'Either');
  assert.equal(rules.fontWeight.tag,'Whole');
  assert.equal(Object.keys(rules).length,20);
  const generic='Rule :: Choices ([Text]) | Either ([Rule]); mode = Choices: ["manual", "auto"]; config = {mode: mode, fallback: (Either: [mode])};';
  const result=bridge.constantData(generic,'config');
  assert.equal(result.ok,true,result.message);
  assert.deepEqual(JSON.parse(result.output),{mode:{tag:'Choices',value:['manual','auto']},fallback:{tag:'Either',value:[{tag:'Choices',value:['manual','auto']}]}});
  for(const source of [
    'Rule :: Choices ([Text]) | None; config = Choices: [42];',
    'twice: x = x + x; config = twice: 2;',
    'config = 1 + 2;',
    'config = missing;',
    'config = 1; config;'
  ]) assert.equal(bridge.constantData(source,'config').ok,false,source);
});


test('0.97 Studio checks and compiles scalar variants to native values',()=>{
  const source='Alignment :: Start = "start" | Center = "center" | End = "end"; label: x (Alignment) = match: x {start: {| "S"}, center: {| "C"}, end: {| "E"}}; result = {value: Center, label: (label: Center)};';
  const checked=bridge.check(source);
  assert.equal(checked.ok,true,checked.message);
  assert.equal(JSON.parse(checked.output).find(x=>x.name==='Center').type,'Alignment');
  const ast=JSON.parse(bridge.ast(source).output);
  assert.equal(ast.definitions.find(x=>x.name==='Center').scalarEncoding.value,'center');
  for(const target of ['js','php']){
    const compiled=bridge.compile(source,target,null,false,null,true);
    assert.equal(compiled.ok,true,compiled.message);
    assert.doesNotMatch(compiled.output,/\.tag|\['tag'\]/);
    const actual=target==='js'?JSON.stringify(runInNewContext(compiled.output+'\nresult',{})):
      spawnSync('php',['-r',compiled.output.replace(/^<\?php/,'')+'\necho json_encode($result);'],{encoding:'utf8'}).stdout;
    assert.deepEqual(JSON.parse(actual),{value:'center',label:'C'});
  }
});


test('0.97.1 Studio resolves scalar encodings through module aliases',()=>{
  const modules=JSON.stringify({Layout:'module Layout; interface Alignment :: Start = 0 | Center = "0" | End = 2; implementation'});
  const source='module App; import Layout {Alignment => Position; Center => Middle;}; label: x (Position) = match: x {start: {| "S"}, center: {| "C"}, end: {| "E"}}; result = {value: Middle, label: (label: Middle)};';
  const checked=bridge.check(source,null,modules);
  assert.equal(checked.ok,true,checked.message);
  const row=JSON.parse(checked.output).find(x=>x.name==='App / result');
  assert.equal(row.schema.fields.find(x=>x.name==='value').type.representation.kind,'Scalar');
  for(const target of ['js','php']){
    const built=bridge.compile(source,target,null,false,modules,true);
    assert.equal(built.ok,true,built.message);
    const name='__miraModule_v_417070202F20726573756C74';
    const actual=target==='js'?JSON.stringify(runInNewContext(built.output+'\n'+name,{})):
      spawnSync('php',['-r',built.output.replace(/^<\?php/,'')+'\necho json_encode($'+name+');'],{encoding:'utf8'}).stdout;
    assert.deepEqual(JSON.parse(actual),{value:'0',label:'C'});
  }
});


test('0.98 Studio checks native payloads and executes the same native values on JS/PHP',()=>{
  const source='Pixels :: Number where _ >= 0 AND _ <= 4096; Size :: Fixed (Pixels) = _ | Fill = "fill" | Auto = "auto"; n (Pixels) = 12.5; resolve: s (Size) -> Number = match: s {fixed: {p | p + 0}, fill: {| 100}, auto: {| 0}}; sizes = [(Fixed: n), Fill, Auto]; result = {sizes: sizes, values: (collect: sizes, with: (resolve: _))};';
  const checked=bridge.check(source);
  assert.equal(checked.ok,true,checked.message);
  const schema=JSON.parse(checked.output).find(x=>x.name==='sizes').schema.item;
  assert.equal(schema.representation.kind,'Native');
  assert.deepEqual(schema.representation.cases,[{tag:'Auto',value:'auto'},{tag:'Fill',value:'fill'},{tag:'Fixed',domain:'number'}]);
  const ast=JSON.parse(bridge.ast(source).output);
  assert.equal(ast.definitions.find(x=>x.labels?.[0]==='Fixed'||x.name==='Fixed:')?.scalarEncoding?.value,'payload');
  for(const target of ['js','php']){
    const compiled=bridge.compile(source,target,null,false,null,true);
    assert.equal(compiled.ok,true,compiled.message);
    assert.doesNotMatch(compiled.output,/\.tag|\['tag'\]|\.value|\['value'\]/);
    const actual=target==='js'?JSON.stringify(runInNewContext(compiled.output+'\nresult',{})):
      spawnSync('php',['-r',compiled.output.replace(/^<\?php/,'')+'\necho json_encode($result);'],{encoding:'utf8'}).stdout;
    assert.deepEqual(JSON.parse(actual),{sizes:[12.5,'fill','auto'],values:[12.5,100,0]});
  }
  assert.equal(bridge.check('Bad :: A (Number) = _ | B (Number) = _;').ok,false);
  const constant=bridge.constantData('Size :: Fixed (Number) = _ | Auto = "auto"; result = Fixed: 12.5;','result');
  assert.equal(constant.ok,true,constant.message);
  assert.equal(JSON.parse(constant.output),12.5);
});
