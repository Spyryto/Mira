import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = resolve(root, 'dist/studio');
const read = path => readFileSync(resolve(site, path), 'utf8');

const compilerContext = {};
runInNewContext(read('compiler.js'), compilerContext);
const compiler = compilerContext.MiraStudioCompiler;
const reference = JSON.parse(read('reference.json'));
const manifest = read('host.json');
const demo = name => {
  const example = reference.examples.find(item => item.id === name);
  assert.ok(example, 'missing canonical example ' + name);
  return example;
};

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this._text = '';
    this.children = [];
    this.listeners = new Map();
    this.parentNode = null;
    this.className = '';
    this.open = false;
  }
  set textContent(value) {
    this._text = String(value);
    this.replaceChildren();
  }
  get textContent() {
    return this._text + this.children.map(child => child.textContent).join('');
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this._text = '';
    this.append(...nodes);
  }
  addEventListener(event, fn) { this.listeners.set(event, fn); }
  click() { this.listeners.get('click')?.(); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(c => c !== this);
      this.parentNode = null;
    }
  }
}

function findAll(node, tag) {
  const matches = [];
  if (node.tagName === tag) matches.push(node);
  for (const child of node.children) matches.push(...findAll(child, tag));
  return matches;
}
function findButtons(root) {
  return findAll(root, 'button');
}
function setup() {
  const context = {};
  runInNewContext(read('ui-host.js'), context);
  const root = new FakeElement('root');
  const document = {createElement(tag) { return new FakeElement(tag); }};
  const errors = [];
  const host = context.MiraUiHost.createUiHost(document, root, msg => errors.push(msg));
  return {host, root, errors};
}
function compileAndRun(example, host) {
  const compiled = compiler.compile(example.source, 'js', manifest);
  assert.equal(compiled.ok, true, example.id + ': ' + compiled.message);
  runInNewContext(compiled.output, {__miraHost: host});
  return compiled.output;
}

test('all UI examples are advertised in the canonical documentation and compile on JS and PHP', () => {
  for (const name of ['browser-alert', 'browser-view', 'browser-counter']) {
    const sample = demo(name);
    assert.equal(sample.expect.kind, 'ui');
    assert.equal(sample.host, 'studio/host.json');
    for (const target of ['js', 'php']) {
      const compiled = compiler.compile(sample.source, target, manifest);
      assert.equal(compiled.ok, true, name + ' ' + target + ': ' + compiled.message);
    }
  }
});

test('alert uses an explicit host capability and opens a dialog', () => {
  const {host, root, errors} = setup();
  const js = compileAndRun(demo('browser-alert'), host);
  assert.match(js, /__miraHost\["alert"\]/);
  const dialog = findAll(root, 'dialog');
  assert.equal(dialog.length, 1);
  assert.equal(dialog[0].open, true);
  assert.match(dialog[0].textContent, /Ciao!/);
  assert.equal(findAll(root, 'p').length >= 2, true);
  findButtons(root)[0].click();
  assert.equal(findAll(root, 'dialog').length, 0);
  assert.deepEqual(errors, []);
});

test('Mira record produces a declarative view with an active button callback', () => {
  const {host, root, errors} = setup();
  compileAndRun(demo('browser-view'), host);
  assert.match(root.textContent, /Una view scritta in Mira/);
  assert.match(root.textContent, /Nessun accesso diretto al DOM/);
  const actions = findButtons(root);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].textContent, 'Salutami');
  actions[0].click();
  assert.equal(findAll(root, 'dialog').length, 1);
  assert.match(root.textContent, /Ciao dal pulsante Mira/);
  assert.deepEqual(errors, []);
});

test('stateful Mira view computes +1, +1, -1 and updates DOM each time', () => {
  const {host, root, errors} = setup();
  const code = compileAndRun(demo('browser-counter'), host);
  assert.match(code, /increment/);
  assert.match(code, /decrement/);
  const readValue = () => {
    const paragraphs = findAll(root, 'p');
    assert.equal(paragraphs.length, 1);
    return paragraphs[0].textContent;
  };
  assert.equal(readValue(), '0');
  findButtons(root).find(button => button.textContent === '+1').click();
  assert.equal(readValue(), '1');
  findButtons(root).find(button => button.textContent === '+1').click();
  assert.equal(readValue(), '2');
  findButtons(root).find(button => button.textContent === '-1').click();
  assert.equal(readValue(), '1');
  assert.deepEqual(errors, []);
});

test('host rejects unrecognized view types and never inserts HTML markup', () => {
  const {host, root} = setup();
  assert.throws(() => host.render({type: 'script', text: 'bad'}),
    /Unsupported view type/);
  host.render({type: 'text', text: '<img src=x onerror=alert(1)>'});
  assert.equal(findAll(root, 'img').length, 0);
  assert.equal(root.textContent, '<img src=x onerror=alert(1)>');
});

test('a button with update outside a state component reports a useful error', () => {
  const {host, root, errors} = setup();
  host.render({type: 'button', label: 'Bad', update: n => n + 1});
  findButtons(root)[0].click();
  assert.deepEqual(errors, ['button.update requires a state parent']);
});

test('UI preview is a script-enabled, opaque-origin iframe without direct Studio access', () => {
  const app = read('app.js');
  const index = read('index.html');
  const preview = read('ui-preview.html');
  const sw = read('sw.js');
  assert.match(app, /setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.doesNotMatch(app, /setAttribute\('sandbox', 'allow-scripts allow-same-origin'\)/);
  assert.match(index, /id="previewUI"/);
  assert.match(preview, /ui-host\.js/);
  assert.match(preview, /ui-preview\.js/);
  for (const filename of ['ui-preview.html', 'ui-host.js', 'ui-preview.js']) {
    assert.ok(sw.includes('./' + filename), filename);
  }
});
