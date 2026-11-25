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
  assert.equal(bridge.version, '0.23.0');
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
      const manifest = ['host-log','collect-if','fold-blocks','fold-fees','block-steps','nullary-block'].includes(example.id)
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
  assert.equal(bridge.version,'0.23.0');
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
  assert.equal(body.kind,'HostCall');
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
  assert.equal((html.match(/class="lab-track"/g) ?? []).length,28);
  assert.match(html, /3,3 µs/);
  assert.match(html, /910 µs/);
  assert.match(html, /non sono stati rieseguiti/);
  assert.equal(source.schema,2);
  assert.equal(source.ci.length,6);
  assert.equal(source.devices.length,2);
  assert.equal(source.timeline.length,8);
  assert.equal(source.ci.at(-1).browser.version,'0.22.0');
  assert.equal(source.ci.reduce((n,r)=>n+(r.browser?.results.length??0)+(r.browser?.form?.length??0),0),30);
  assert.equal(source.devices[0].results[1].specialized.medianMs,1.233);
  assert.equal(source.devices[1].results[1].direct.medianMs,25.967);
  assert.match(html,/26,290 ms/);
  assert.match(html,/Rendering ibrido/);
  assert.match(html,/Componenti componibili/);
  assert.match(html,/139377247685/);
  for(const file of ['laboratory.html','lab-gui-rendering.json']) assert.ok(read('sw.js').includes('./'+file));
  assert.match(read('sw.js'), /url\.pathname\.endsWith\('\/laboratory\.html'\)/);
});
