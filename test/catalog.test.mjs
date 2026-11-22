import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'catalog/manifest.json'), 'utf8'));
const reference = JSON.parse(readFileSync(resolve(root, 'dist/studio/reference.json'), 'utf8'));
const compiler = resolve(root, 'dist/mira.cjs');
const featureById = new Map(reference.features.map(item => [item.id, item]));

function prepareExample(example, callback) {
  const dir = mkdtempSync(join(tmpdir(), 'mira-docs-'));
  try {
    const input = join(dir, example.id + '.mira');
    writeFileSync(input, example.source);
    return callback(input, dir);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

function invoke(example, target) {
  return prepareExample(example, (input, dir) => {
    const args = [compiler, input, target];
    if (example.host) args.push('--host', resolve(root, example.host));
    const result = spawnSync('node', args, {encoding: 'utf8'});

    if (example.expect.kind === 'error') {
      assert.notEqual(result.status, 0, example.id + ' should fail on ' + target);
      assert.ok(result.stderr.includes(example.expect.contains),
        example.id + ': ' + result.stderr);
      return;
    }

    assert.equal(result.status, 0, example.id + ': ' + result.stderr);

    // The PHP backend can compile UI host calls, but PHP has no browser DOM.
    // Interactive outcomes are tested separately against the JS DOM host.
    if (example.expect.kind === 'ui') return;

    const output = join(dir, target === 'js' ? 'example.mjs' : 'example.php');
    const functionCall = example.expect.kind === 'invoke'
      ? (target === 'php' ? '$' : '') + example.expect.name +
        '(' + example.expect.args.join(',') + ')'
      : (target === 'php' ? '$result' : 'result');

    const footer = target === 'php'
      ? '\necho json_encode(' + functionCall + '), "\\n";\n'
      : '\nconsole.log(JSON.stringify(' + functionCall + '));\n';

    let prelude = '';
    let compiled = result.stdout;
    if (example.host) {
      if (target === 'js') {
        const uri = pathToFileURL(resolve(root, 'studio/collection-host.js')).href;
        prelude = 'import {collectionHost} from ' + JSON.stringify(uri) + ';\n' +
          'const __miraHost = collectionHost();\n';
      } else {
        prelude = '<?php\ndeclare(strict_types=1);\nrequire_once ' +
          JSON.stringify(resolve(root, 'test/fixtures/CollectionHost.php')) + ';\n' +
          '$GLOBALS["__miraHost"] = makeCollectionHost();\n';
        compiled = compiled.replace(/^<\?php\s*declare\(strict_types=1\);\s*/, '');
      }
    }
    writeFileSync(output, prelude + compiled + footer);
    const process = spawnSync(target === 'js' ? 'node' : 'php', [output], {
      encoding: 'utf8'
    });
    assert.equal(process.status, 0,
      example.id + ' (' + target + ') runtime: ' + process.stderr);

    let actual;
    try {
      actual = JSON.parse(process.stdout.trim());
    } catch {
      assert.fail(example.id + ': invalid JSON output ' + process.stdout);
    }

    assert.deepEqual(actual, example.expect.value,
      example.id + ' (' + target + ') returned a different result');
  });
}

test('all language features are represented by at least two uniquely linked programs', () => {
  assert.ok(reference.features.length >= 15);
  assert.equal(reference.features.length, manifest.features.length);
  assert.equal(reference.examples.length, manifest.examples.length);
  const ids = new Set();
  for (const feature of reference.features) {
    assert.ok(feature.examples.length >= 2, feature.id);
    for (const id of feature.examples) {
      assert.ok(!ids.has(id), 'example linked twice: ' + id);
      ids.add(id);
      const sample = reference.examples.find(item => item.id === id);
      assert.ok(sample, id);
      assert.equal(sample.feature, feature.id);
      assert.ok(sample.source.includes('result = ') || ['error','ui'].includes(sample.expect.kind),
        id + ' needs an observable result');
    }
  }
  assert.equal(ids.size, reference.examples.length);
});

test('generated reference has Haxe API source links and reverse feature references', () => {
  const ids = new Set(reference.api.map(entry => entry.id));
  assert.ok(ids.size >= 45, 'public API extraction incomplete');
  for (const entry of reference.api) {
    assert.ok(entry.sourceUrl.startsWith('https://github.com/Spyryto/Mira/blob/main/src/'));
    assert.ok(entry.sourceUrl.includes('#L'));
    assert.ok(entry.signature);
    assert.ok(entry.description);
  }
  for (const feature of reference.features) {
    assert.ok(ids.has(feature.api), 'missing Haxe source link: ' + feature.api);
  }
  assert.ok(ids.has('mira.Compiler.transpile'));
  assert.ok(ids.has('mira.studio.Bridge.compile'));
  assert.ok(ids.has('mira.syntax.Expr.Section'));
  assert.ok(ids.has('mira.Target.JavaScript'));
});

test('generator writes complete crosslinked Markdown references', () => {
  const language = readFileSync(resolve(root, 'docs/reference/language.md'), 'utf8');
  const examples = readFileSync(resolve(root, 'docs/reference/examples.md'), 'utf8');
  const api = readFileSync(resolve(root, 'docs/reference/api.md'), 'utf8');
  for (const feature of reference.features) {
    assert.ok(language.includes('feature-' + feature.id), feature.id);
  }
  for (const example of reference.examples) {
    assert.ok(examples.includes('example-' + example.id), example.id);
  }
  assert.match(api, /mira\.Compiler\.transpile/);
  assert.match(api, /Sorgente Haxe/);
  assert.match(language, /api\.md#api-/);
  assert.match(examples, /language\.md#feature-/);
});

for (const example of reference.examples) {
  test(example.feature + ' / ' + example.id + ': JS and PHP agree with the fixture', () => {
    invoke(example, 'js');
    invoke(example, 'php');
  });
}

test('catalog remains extensible without changing test counts', () => {
  assert.ok(reference.features.length >= 15);
  assert.ok(reference.examples.length >= reference.features.length * 2);
});
