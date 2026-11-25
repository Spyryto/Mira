import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const studio = resolve(root, 'dist/studio');
const read = filename => readFileSync(resolve(studio, filename), 'utf8');
const context = {};
runInNewContext(read('compiler.js'), context);
const compiler = context.MiraStudioCompiler;
const { executeInspector } = await import(
  pathToFileURL(resolve(studio, 'inspector-host.js')).href
);
const { createAstInspector } = await import(
  pathToFileURL(resolve(studio, 'ast-inspector.js')).href
);

class FakeNode {
  constructor(tag = 'div') {
    this.tag = tag;
    this.children = [];
    this.textContent = '';
    this.value = '';
    this.listeners = new Map();
  }
  replaceChildren(...children) {
    this.children = children;
    this.textContent = '';
  }
  append(...children) { this.children.push(...children); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}

const elements = new Map();
globalThis.document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new FakeNode());
    return elements.get(id);
  },
  createElement(tag) { return new FakeNode(tag); },
  createTextNode(text) {
    const node = new FakeNode('text');
    node.textContent = text;
    return node;
  }
};
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};
globalThis.fetch = async url => ({
  ok: true,
  async text() {
    if (url === './inspector.mira') return read('inspector.mira');
    if (url === './inspector-host.json') return read('inspector-host.json');
    throw new Error('Unexpected URL ' + url);
  }
});
globalThis.Worker = class {
  onmessage = null;
  onerror = null;
  terminate() { this.terminated = true; }
  postMessage({code, ast}) {
    // Emulate the worker's compiler boundary but execute the *real* Mira
    // reducers through the same runtime helper as production.
    queueMicrotask(() => {
      try {
        const stats = executeInspector(code, ast);
        this.onmessage?.({data: {ok: true, stats}});
      } catch (error) {
        this.onmessage?.({data: {ok: false, message: String(error.message)}});
      }
    });
  }
};

test('Inspector parses native collections and still requires explicit host signatures', async () => {
  const catalog = JSON.parse(read('reference.json'));
  const example = catalog.examples.find(example => example.id === 'teaching-ledger');
  assert.ok(example, 'A real case study with host selectors must exist');

  const mainHost = read('host.json');
  // Reproduces the user screenshot: a valid program fails AST parsing
  // without the very same host signatures passed during compilation.
  assert.equal(compiler.compile(example.source, 'js', mainHost).ok, true);
  // Collections are now native. Retain the regression check with a
  // genuine host-only selector, and verify the real case study without host.
  assert.equal(compiler.ast(example.source).ok, true);
  const hostSource = 'result = get: "hours", from: {hours: 2};';
  assert.equal(compiler.ast(hostSource, mainHost).ok, true);
  const withoutHost = compiler.ast(hostSource);
  assert.equal(withoutHost.ok, false);
  assert.match(withoutHost.message, /Unknown identifier/);

  const inspector = createAstInspector(compiler);
  await inspector.refresh(example.source, mainHost);
  assert.match(document.getElementById('inspectorStatus').textContent,
    /Statistiche calcolate da Mira/);
  assert.ok(document.getElementById('inspectorTree').children.length > 0,
    'The tree must not be empty');
  assert.ok(document.getElementById('inspectorStats').children.length > 0);
  assert.ok(document.getElementById('inspectorDefinitions').children.length > 0);
  inspector.cancel();
});

test('AST tree remains visible when editable Mira reducer fails to compile', async () => {
  const catalog = JSON.parse(read('reference.json'));
  const example = catalog.examples.find(example => example.id === 'setlist-plan');
  const inspector = createAstInspector(compiler);
  // First load ensures the default inspector program has been supplied.
  await inspector.refresh(example.source, read('host.json'));

  document.getElementById('inspectorProgram').value =
    'result = missing host capability;';
  await inspector.refresh(example.source, read('host.json'));

  assert.match(document.getElementById('inspectorStatus').textContent,
    /Programma Mira dell.inspector/);
  assert.ok(document.getElementById('inspectorTree').children.length > 0,
    'A broken stats reducer must not hide a valid canonical AST');
  assert.equal(document.getElementById('inspectorStats').children.length, 0);
  inspector.cancel();
});
