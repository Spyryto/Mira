import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';

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
    this.attributes = new Map();
    this.value = '';
    this.selectionStart = null;
    this.selectionEnd = null;
  }
  set textContent(value) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this._text = String(value);
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
  replaceChild(next, previous) {
    const index = this.children.indexOf(previous);
    assert.ok(index >= 0);
    previous.parentNode = null;
    next.parentNode = this;
    this.children[index] = next;
    return previous;
  }
  addEventListener(event, fn) { this.listeners.set(event, fn); }
  click() { this.dispatch('click'); }
  dispatch(event, data = {}) { this.listeners.get(event)?.(data); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end, direction) {
    this.selectionStart = start;
    this.selectionEnd = end;
    this.selectionDirection = direction;
  }
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
  const document = {activeElement: null, createElement(tag) {
    const node = new FakeElement(tag);
    node.ownerDocument = this;
    return node;
  }};
  root.ownerDocument = document;
  const errors = [];
  const host = context.MiraUiHost.createUiHost(document, root, msg => errors.push(msg));
  return {host, root, errors, document};
}
function compileAndRun(example, host) {
  const compiled = compiler.compile(example.source, 'js', manifest);
  assert.equal(compiled.ok, true, example.id + ': ' + compiled.message);
  runInNewContext(compiled.output, {__miraHost: host});
  return compiled.output;
}

test('all UI examples are advertised in the canonical documentation and compile on JS and PHP', () => {
  for (const name of ['browser-alert', 'browser-view', 'browser-counter', 'gui-greeting', 'gui-lesson', 'gui-independent', 'gui-reset']) {
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


test('0.15 greeting uses actual Mira constructors, input binding and nullary closure', () => {
  const {host, root, errors, document} = setup();
  const example = demo('gui-greeting');
  assert.equal(example.library,'lib/gui.mira');
  const library = readFileSync(resolve(fileURLToPath(new URL('../',import.meta.url)), example.library), 'utf8');
  assert.ok(example.source.startsWith(library));
  compileAndRun(example,host);
  let input = findAll(root,'input')[0];
  assert.equal(input.value,'Mira');
  const originalInput = input;
  input.focus();
  input.value = 'Ada';
  input.setSelectionRange(2,2,'none');
  input.dispatch('input',{isComposing:true});
  assert.equal(findAll(root,'p')[0].textContent,'Mira');
  input.dispatch('compositionend');
  input = findAll(root,'input')[0];
  assert.equal(input,originalInput);
  assert.equal(input.value,'Ada');
  assert.equal(findAll(root,'p')[0].textContent,'Ada');
  assert.equal(document.activeElement,input);
  assert.equal(input.selectionStart,2);
  input.value = 'Ada Lovelace';
  input.dispatch('input');
  assert.equal(findAll(root,'input')[0],originalInput);
  assert.equal(findAll(root,'p')[0].textContent,'Ada Lovelace');
  findButtons(root)[0].click();
  assert.match(findAll(root,'dialog')[0].textContent,/Ada Lovelace/);
  assert.deepEqual(errors,[]);
});

test('0.15 lesson form preserves all model fields across text, button, select and checkbox transitions', () => {
  const {host,root,errors} = setup();
  compileAndRun(demo('gui-lesson'),host);
  const textValues = () => findAll(root,'p').map(node=>node.textContent);
  assert.ok(textValues().includes('60'));
  let name = findAll(root,'input').find(node=>node.type==='text');
  name.value='Lia';
  name.dispatch('input');
  findButtons(root).find(node=>node.textContent==='+1 ora').click();
  const select = findAll(root,'select')[0];
  select.value='Online';
  select.dispatch('change');
  const checkbox = findAll(root,'input').find(node=>node.type==='checkbox');
  checkbox.checked=true;
  checkbox.dispatch('change');
  assert.ok(textValues().includes('Lia'));
  assert.ok(textValues().includes('Online'));
  assert.ok(textValues().includes('90'));
  assert.ok(textValues().includes('Saldato'));
  assert.equal(findAll(root,'input').find(node=>node.type==='text').value,'Lia');
  assert.equal(findAll(root,'input').find(node=>node.type==='checkbox').checked,true);
  assert.equal(findAll(root,'select')[0].value,'Online');
  assert.ok(findAll(root,'div').some(node=>node.className==='mira-ui-row'));
  for(let i=0;i<5;i++)findButtons(root).find(node=>node.textContent==='-1 ora').click();
  assert.ok(textValues().includes('30'));
  assert.deepEqual(errors,[]);
});

test('0.15 control validation and unsuccessful state refresh preserve prior state', () => {
  const {host,root,errors} = setup();
  assert.throws(()=>host.render({type:'input',label:'x',value:'a',update:()=>0}),/state parent/);
  assert.throws(()=>host.render({type:'state',initial:0,view:()=>({
    type:'select',value:'a',options:['a','a'],update:()=>0
  })}),/unique string options/);
  host.render({type:'state',initial:0,view:n=>n<0?{type:'unknown'}:{
    type:'column',children:[
      {type:'text',text:n},
      {type:'button',label:'bad',update:()=>-1},
      {type:'button',label:'good',update:old=>old+1}
    ]
  }});
  findButtons(root)[0].click();
  assert.match(errors[0],/Unsupported view type/);
  findButtons(root)[1].click();
  assert.equal(findAll(root,'p')[0].textContent,'1');
});

test('0.15 GUI constructors have equivalent native JS and PHP output as ordinary Mira functions', () => {
  const library = readFileSync(resolve(root,'lib/gui.mira'),'utf8');
  const source = library + '\nresult = row: [title: "Mira", text: 42];';
  const js = compiler.compile(source,'js');
  assert.equal(js.ok,true,js.message);
  const actual = runInNewContext(js.output+'\nJSON.stringify(result)',{});
  const php = compiler.compile(source,'php');
  assert.equal(php.ok,true,php.message);
  const result = spawnSync('php',['-r',php.output.replace(/^<\?php/,'')+'\necho json_encode($result);'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),JSON.parse(actual));
  assert.deepEqual(JSON.parse(actual),{type:'row',children:[{type:'title',text:'Mira'},{type:'text',text:42}]});
});


test('0.16 stable input and button identity, no redundant writes, current callback after refresh', () => {
  const {host, root, errors} = setup();
  compileAndRun(demo('gui-greeting'),host);
  const input = findAll(root,'input')[0];
  const button = findButtons(root)[0];
  const text = findAll(root,'p')[0];
  let writes = 0;
  let value = input.value;
  Object.defineProperty(input,'value',{get:()=>value,set:v=>{writes++;value=v;}});
  input.value='new';
  input.dispatch('input');
  assert.equal(writes,1,'only user write, no redundant DOM assignment');
  assert.equal(findAll(root,'input')[0],input);
  assert.equal(findButtons(root)[0],button);
  assert.equal(findAll(root,'p')[0],text);
  button.click();
  assert.match(findAll(root,'dialog')[0].textContent,/new/);
  assert.deepEqual(errors,[]);
});

test('0.16 independent child states survive parent refresh, with fresh outer closures', () => {
  const {host,root,errors}=setup();
  compileAndRun(demo('gui-independent'),host);
  const buttons=()=>findButtons(root);
  const press=label=>buttons().find(n=>n.textContent===label).click();
  const values=()=>findAll(root,'p').map(n=>n.textContent);
  const child=buttons().find(n=>n.textContent==='A +1');
  press('A +1'); press('A +1'); press('B +1');
  assert.deepEqual(values(),['1','2','1']);
  press('Cambia passo');
  assert.deepEqual(values(),['2','2','1']);
  assert.equal(buttons().find(n=>n.textContent==='A +1'),child);
  press('A +1');
  assert.deepEqual(values(),['2','4','1']);
  assert.deepEqual(errors,[]);
});

test('0.16 changing a state key resets just that subtree and deactivates removed callbacks', () => {
  const {host,root,errors}=setup();
  compileAndRun(demo('gui-reset'),host);
  const buttons=()=>findButtons(root);
  const press=label=>buttons().find(n=>n.textContent===label).click();
  const values=()=>findAll(root,'p').map(n=>n.textContent);
  const child=buttons().find(n=>n.textContent==='Incrementa');
  press('Incrementa'); press('Incrementa');
  assert.deepEqual(values(),['A','2']);
  press('Nuova sessione');
  assert.deepEqual(values(),['B','0']);
  assert.notEqual(buttons().find(n=>n.textContent==='Incrementa'),child);
  child.click();
  assert.deepEqual(values(),['B','0']);
  press('Incrementa');
  assert.deepEqual(values(),['B','1']);
  assert.deepEqual(errors,[]);
});

test('0.16 validation of nested updates is atomic and structural replacement works', () => {
  const {host,root,errors}=setup();
  host.render({type:'state',initial:0,view:n=>({type:'column',children:[
    {type:'text',text:n},
    {type:'button',label:'next',update:old=>old+1},
    n===1?{type:'title',text:'changed'}:n===2?{type:'unknown'}:{type:'text',text:'start'}
  ]})});
  const button=findButtons(root)[0];
  const stable=findAll(root,'p')[0];
  button.click();
  assert.equal(findAll(root,'p')[0],stable);
  assert.equal(stable.textContent,'1');
  assert.equal(findAll(root,'h2')[0].textContent,'changed');
  button.click();
  assert.equal(stable.textContent,'1');
  assert.match(errors[0],/Unsupported view type/);
  button.click();
  assert.equal(errors.length,2,'failed transition did not commit state');
});

test('0.16 select options and IME composition keep native controls and dispatch once', () => {
  const {host,root,errors}=setup();
  let transitions=0;
  host.render({type:'state',initial:{text:'',extra:false,choice:'A'},view:s=>({type:'column',children:[
    {type:'input',label:'Input',value:s.text,update:(old,text)=>{transitions++;return {...old,text};}},
    {type:'select',label:'Choose',value:s.choice,options:s.extra?['A','B']:['A'],update:(old,choice)=>({...old,choice})},
    {type:'button',label:'more',update:old=>({...old,extra:true})}
  ]})});
  const input=findAll(root,'input')[0];
  const select=findAll(root,'select')[0];
  input.dispatch('compositionstart');
  input.value='é';
  input.dispatch('input',{isComposing:true});
  findButtons(root)[0].click();
  assert.equal(input.value,'é');
  assert.equal(findAll(root,'select')[0],select);
  assert.equal(findAll(select,'option').length,2);
  input.dispatch('compositionend');
  input.dispatch('input');
  assert.equal(transitions,1);
  select.value='B';select.dispatch('change');
  assert.equal(select.value,'B');
  assert.equal(findAll(root,'input')[0],input);
  assert.deepEqual(errors,[]);
});
