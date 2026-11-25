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
    const properties = new Map();
    this.styleWrites = 0;
    this.style = {
      setProperty: (name, value) => { this.styleWrites++; properties.set(name, value); },
      removeProperty: name => { this.styleWrites++; properties.delete(name); },
      getPropertyValue: name => properties.get(name) ?? ''
    };
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
  const document = {activeElement: null, created: 0, createElement(tag) {
    this.created++;
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
  for (const name of ['browser-alert', 'browser-view', 'browser-counter', 'gui-greeting', 'gui-lesson', 'gui-independent', 'gui-reset', 'gui-dashboard', 'gui-style-toggle']) {
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


test('0.17 style composition, removal, validation and native identity', () => {
  const {host,root,errors}=setup();
  const decorate=(view,styles)=>({type:'styled',view,styles});
  host.render(decorate({type:'state',initial:0,view:n=>({
    type:'column',children:[
      decorate(decorate({type:'text',text:n},[{padding:6,color:'#000'}]),
        n===0?[{padding:12,background:'#fff',shadow:'hard'}]:[{padding:8}]),
      {type:'button',label:'next',update:old=>old+1}
    ]
  })},[{margin:10}]));
  const label=findAll(root,'p')[0];
  const slot=findAll(root,'section')[0];
  assert.equal(label.style.getPropertyValue('padding'),'12px');
  assert.equal(label.style.getPropertyValue('color'),'#000');
  assert.equal(label.style.getPropertyValue('background-color'),'#fff');
  findButtons(root)[0].click();
  assert.equal(findAll(root,'p')[0],label);
  assert.equal(label.style.getPropertyValue('padding'),'8px');
  assert.equal(label.style.getPropertyValue('background-color'),'');
  assert.equal(label.style.getPropertyValue('box-shadow'),'');
  assert.equal(slot.style.getPropertyValue('margin'),'10px');
  assert.equal(label.textContent,'1');
  const writes=label.styleWrites;
  findButtons(root)[0].click();
  assert.equal(label.styleWrites,writes,'identical style is not written again');
  for (const style of [{background:'url(https://example.com)'},{position:'fixed'},{padding:-1},{shadow:'toString'}]) {
    assert.throws(()=>host.render(decorate({type:'text',text:'bad'},[style])),/Invalid style value|Unsupported style property/);
  }
  assert.equal(findAll(root,'p')[0],label);
  assert.deepEqual(errors,[]);
});

test('0.17 invalid reactive style does not commit the view or state',()=>{
  const {host,root,errors}=setup();
  host.render({type:'state',initial:0,view:n=>({type:'column',children:[
    {type:'text',text:n},
    {type:'styled',view:{type:'text',text:'styled'},styles:[{padding:n===1?-1:5}]},
    {type:'button',label:'next',update:old=>old+1},
    {type:'button',label:'skip',update:old=>old+2}
  ]})});
  const value=findAll(root,'p')[0];
  findButtons(root)[0].click();
  assert.equal(value.textContent,'0');
  assert.match(errors[0],/Invalid style value/);
  findButtons(root)[1].click();
  assert.equal(value.textContent,'2');
});

test('0.17 grid and dashboard execute compiled Mira and preserve native identity',()=>{
  const {host,root,errors}=setup();
  compileAndRun(demo('gui-dashboard'),host);
  const grid=findAll(root,'div').find(n=>n.className==='mira-ui-grid');
  assert.equal(grid.style.getPropertyValue('grid-template-columns'),'repeat(2, minmax(0, 1fr))');
  const titles=findAll(root,'h2');
  assert.deepEqual(titles.map(n=>n.textContent),['Studio musicale','2','60']);
  findButtons(root)[0].click();
  assert.deepEqual(titles.map(n=>n.textContent),['Studio musicale','3','90']);
  assert.equal(findAll(root,'h2')[1],titles[1]);
  assert.deepEqual(errors,[]);
});

test('0.17 dynamic theme uses the same native view and removes unused style',()=>{
  const {host,root,errors}=setup();
  compileAndRun(demo('gui-style-toggle'),host);
  const panel=findAll(root,'div').find(n=>n.className==='mira-ui-column');
  const button=findButtons(root)[0];
  assert.equal(panel.style.getPropertyValue('background-color'),'#c1f1dc');
  button.click();
  assert.equal(panel.style.getPropertyValue('background-color'),'#202629');
  assert.notEqual(panel.style.getPropertyValue('box-shadow'),'');
  assert.equal(findButtons(root)[0],button);
  button.click();
  assert.equal(panel.style.getPropertyValue('background-color'),'#c1f1dc');
  assert.equal(panel.style.getPropertyValue('box-shadow'),'');
  assert.deepEqual(errors,[]);
});

test('0.17 styled grid constructors return identical records on JS and PHP',()=>{
  const source=readFileSync(resolve(root,'lib/gui.mira'),'utf8')+
    '\nresult = styled: (grid: 2, children: [title: "Mira"]), with: [{padding: 12}];';
  const js=compiler.compile(source,'js');
  const php=compiler.compile(source,'php');
  assert.equal(js.ok,true,js.message);
  assert.equal(php.ok,true,php.message);
  const value=JSON.parse(runInNewContext(js.output+'\nJSON.stringify(result)',{}));
  const executed=spawnSync('php',['-r',php.output.replace(/^<\?php/,'')+'\necho json_encode($result);'],{encoding:'utf8'});
  assert.equal(executed.status,0,executed.stderr);
  assert.deepEqual(JSON.parse(executed.stdout),value);
  assert.deepEqual(value,{type:'styled',view:{type:'grid',columns:2,children:[{type:'title',text:'Mira'}]},styles:[{padding:12}]});
});

test('0.17 synthetic GUI benchmark counts actual element allocations and style writes', t=>{
  const {host,root,document,errors}=setup();
  const decorate=(view,styles)=>({type:'styled',view,styles});
  const view=n=>({type:'column',children:[
    ...Array.from({length:100},(_,i)=>decorate({type:'text',text:i===0?n:i},[{padding:4}])),
    {type:'button',label:'next',update:old=>old+1}
  ]});
  host.render({type:'state',initial:0,view});
  const initial=document.created;
  const labels=findAll(root,'p');
  const beforeWrites=labels.reduce((n,x)=>n+x.styleWrites,0);
  const button=findButtons(root)[0];
  const start=performance.now();
  for(let i=0;i<100;i++)button.click();
  const incrementalMs=performance.now()-start;
  const incremental=document.created-initial;
  const incrementalStyleWrites=labels.reduce((n,x)=>n+x.styleWrites,0)-beforeWrites;
  assert.equal(labels[0].textContent,'100');
  const before=document.created;
  const fullStart=performance.now();
  let fullStyleWrites=0;
  for(let i=1;i<=100;i++){
    host.render({type:'state',initial:i,view});
    fullStyleWrites+=findAll(root,'p').reduce((n,x)=>n+x.styleWrites,0);
  }
  const fullMs=performance.now()-fullStart;
  const full=document.created-before;
  assert.equal(incremental,0);
  assert.equal(full,10300);
  assert.equal(incrementalStyleWrites,0);
  assert.equal(fullStyleWrites,10000);
  assert.deepEqual(errors,[]);
  t.diagnostic(JSON.stringify({updates:100,viewNodes:103,incremental,full,incrementalStyleWrites,fullStyleWrites,incrementalMs,fullMs,environment:'simulated DOM'}));
});


test('0.20 specialized styles preserve native nodes and reject invalid changes atomically',()=>{
  const {host,root,errors,document}=setup();
  const sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);
  runInNewContext(read('gui-specialize.js'),sandbox);
  const source='advance: model = {count: (model ~ count + 1)}; view: model = {type: "column", children: [{type: "text", text: (model ~ count)}, {type: "styled", view: {type: "styled", view: {type: "title", text: "Color"}, styles: [{padding: (if (model ~ count == 2) then 0 - 1 else 4)}]}, styles: [{padding: 8, background: (if (model ~ count == 0) then "#fff" else "#000")}]}, {type: "button", label: "Next", update: (advance: _)}]};';
  const compiled=sandbox.MiraGuiSpecialize.compile(compiler,source,'view:');
  const app=sandbox.MiraGuiSpecialize.mount(compiled,root,{count:0},message=>errors.push(message));
  const text=findAll(root,'p')[0], title=findAll(root,'h2')[0],button=findButtons(root)[0];
  assert.equal(title.style.getPropertyValue('padding'),'8px');
  assert.equal(title.style.getPropertyValue('background-color'),'#fff');
  const initial=document.created;
  button.click();
  assert.equal(text.textContent,'1');
  assert.equal(title.style.getPropertyValue('background-color'),'#000');
  assert.equal(title.style.getPropertyValue('padding'),'8px');
  assert.equal(findAll(root,'h2')[0],title);
  assert.equal(document.created,initial);
  const writes=title.styleWrites;
  button.click();
  assert.equal(app.getState().count,1);
  assert.equal(text.textContent,'1');
  assert.equal(title.styleWrites,writes);
  assert.match(errors[0],/Invalid style value/);
  host.render({type:'state',initial:{count:0},view:compiled.program.view});
  const normalButton=findButtons(root)[0];
  normalButton.click();normalButton.click();
  assert.equal(findAll(root,'p')[0].textContent,'1');
  assert.match(errors[1],/Invalid style value/);
});


test('0.21 specialized form keeps controls, current state, focus and IME',()=>{
  const {root,document,errors}=setup();
  const sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);
  runInNewContext(read('gui-specialize.js'),sandbox);
  runInNewContext(read('gui-benchmark.js'),sandbox);
  const compiled=sandbox.MiraGuiSpecialize.compile(compiler,sandbox.MiraGuiBench.formSource(1),'form view:');
  const app=sandbox.MiraGuiSpecialize.mount(compiled,root,{student:'Ada',paid:false,mode:'In presenza'},msg=>errors.push(msg));
  const [input,check]=findAll(root,'input'), select=findAll(root,'select')[0];
  const labels=findAll(root,'p'), reset=findButtons(root)[0], created=document.created;
  input.focus();
  let writes=0, value=input.value;
  Object.defineProperty(input,'value',{get:()=>value,set:v=>{writes++;value=v;}});
  input.value='Ada Lovelace';input.setSelectionRange(3,3);input.dispatch('input');
  assert.equal(writes,1);assert.equal(labels[0].textContent,'Ada Lovelace');
  assert.equal(document.activeElement,input);assert.equal(input.selectionStart,3);
  input.dispatch('compositionstart');input.value='新';input.dispatch('input',{isComposing:true});
  check.checked=true;check.dispatch('change');
  assert.equal(input.value,'新');assert.equal(app.getState().student,'Ada Lovelace');
  assert.equal(labels[1].textContent,'Saldato');
  input.dispatch('compositionend');input.dispatch('input');
  assert.equal(app.getState().student,'新');assert.equal(labels[0].textContent,'新');
  select.value='Online';select.dispatch('change');
  assert.equal(app.getState().paid,true);assert.equal(labels[2].textContent,'Online');
  reset.click();
  assert.equal(input.value,'Ada');assert.equal(check.checked,false);assert.equal(select.value,'In presenza');
  assert.equal(findAll(root,'input')[0],input);assert.equal(document.created,created);
  assert.deepEqual(errors,[]);
});

test('0.21 invalid controlled transition rolls back input and other slots',()=>{
  const {root,errors}=setup();
  const sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);
  runInNewContext(read('gui-specialize.js'),sandbox);
  const source='view: model = {type: "column", children: [{type: "text", text: (model ~ name)}, {type: "input", label: "Nome", value: (model ~ name), update: {old, entered | {name: (if (entered == "bad") then 42 else entered)}}}]};';
  const compiled=sandbox.MiraGuiSpecialize.compile(compiler,source,'view:');
  const app=sandbox.MiraGuiSpecialize.mount(compiled,root,{name:'Ada'},msg=>errors.push(msg));
  const input=findAll(root,'input')[0],label=findAll(root,'p')[0];
  input.value='bad';input.dispatch('input');
  assert.equal(app.getState().name,'Ada');assert.equal(label.textContent,'Ada');assert.equal(input.value,'Ada');
  assert.match(errors[0],/input.value must be a string/);
  input.value='OK';input.dispatch('input');assert.equal(label.textContent,'OK');
  // Detached controls cannot trigger a previous specialized application.
  sandbox.MiraGuiSpecialize.mount(compiled,root,{name:'New'},msg=>errors.push(msg));
  input.value='stale';input.dispatch('input');
  assert.equal(app.getState().name,'OK');assert.equal(findAll(root,'p')[0].textContent,'New');
});


test('0.22 canonical dashboard and lesson specialize without rewriting their views',()=>{
  const sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);
  runInNewContext(read('gui-specialize.js'),sandbox);
  const source=id=>{
    const full=demo(id).source;
    const end=full.lastIndexOf('\nrender ');
    assert.ok(end>0,'expected final render statement');
    return full.slice(0,end);
  };
  {
    const {root,errors,document}=setup();
    const compiled=sandbox.MiraGuiSpecialize.compile(compiler,source('gui-dashboard'),'dashboard:');
    const app=sandbox.MiraGuiSpecialize.mount(compiled,root,2,msg=>errors.push(msg));
    const titles=findAll(root,'h2'),created=document.created;
    assert.deepEqual(titles.map(n=>n.textContent),['Studio musicale','2','60']);
    findButtons(root)[0].click();
    assert.equal(app.getState(),3);
    assert.deepEqual(titles.map(n=>n.textContent),['Studio musicale','3','90']);
    assert.equal(findAll(root,'h2')[1],titles[1]);
    assert.equal(document.created,created);
    assert.deepEqual(errors,[]);
  }
  {
    const {root,errors,document}=setup();
    const compiled=sandbox.MiraGuiSpecialize.compile(compiler,source('gui-lesson'),'lesson view:');
    const app=sandbox.MiraGuiSpecialize.mount(compiled,root,{student:'Ada',hours:2,paid:false,mode:'In presenza'},msg=>errors.push(msg));
    const [input,check]=findAll(root,'input'),select=findAll(root,'select')[0];
    const created=document.created;
    input.value='Mira';input.dispatch('input');
    findButtons(root).find(n=>n.textContent==='+1 ora').click();
    check.checked=true;check.dispatch('change');
    select.value='Online';select.dispatch('change');
    assert.equal(app.getState().student,'Mira');
    assert.equal(app.getState().hours,3);
    assert.equal(app.getState().paid,true);
    assert.equal(app.getState().mode,'Online');
    assert.deepEqual(findAll(root,'p').map(p=>p.textContent),['3','Mira','Online','Compenso in euro (30 / ora)','90','Saldato']);
    assert.equal(document.created,created);
    assert.deepEqual(errors,[]);
  }
});


test('0.23 hybrid regions share root state, preserve nested state and replace generic shape',()=>{
  const {root,errors}=setup(),sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);
  runInNewContext(read('gui-specialize.js'),sandbox);
  const library=readFileSync(resolve(fileURLToPath(new URL('../',import.meta.url)),'lib/gui.mira'),'utf8');
  const source=library+'\n'+
    'fixed: n = column: [text: n, button: "Fixed", update: {old | old + 1}];\n'+
    'variable: n = column: [button: "Generic", update: {old | old + 1}, (if (n % 2 == 0) then (title: "Even") else (text: "Odd")), state: 0, view: {child | row: [text: child, button: "Local", update: {old | old + 1}]}];';
  const compiled=sandbox.MiraGuiSpecialize.compileHybrid(compiler,source,['fixed:','variable:']);
  assert.ok(compiled.regions[0].specialized);assert.equal(compiled.regions[1].specialized,null);
  let visits=0;const view=compiled.regions[0].view;
  compiled.regions[0].view=n=>{visits++;return view(n);};
  const app=sandbox.MiraGuiSpecialize.mountHybrid(compiled,root,0,msg=>errors.push(msg));
  const label=findAll(root,'p')[0],fixed=findButtons(root)[0];
  const local=findButtons(root).find(n=>n.textContent==='Local');
  local.click();local.click();fixed.click();
  assert.equal(app.getState(),1);assert.equal(label.textContent,'1');
  assert.equal(findAll(root,'p')[0],label);
  assert.equal(findAll(root,'p').at(-1).textContent,'2');
  assert.equal(findButtons(root).find(n=>n.textContent==='Local'),local);
  assert.ok(findAll(root,'p').some(p=>p.textContent==='Odd'));
  findButtons(root).find(n=>n.textContent==='Generic').click();
  assert.equal(app.getState(),2);assert.equal(label.textContent,'2');
  assert.equal(findAll(root,'h2')[0].textContent,'Even');
  assert.equal(findAll(root,'p').at(-1).textContent,'2');
  assert.equal(visits,1,'specialized view evaluated only at mount');
  assert.deepEqual(errors,[]);
});

test('0.23 invalid generic or specialized region rolls back all regions and model',()=>{
  const {root,errors}=setup(),sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);runInNewContext(read('gui-specialize.js'),sandbox);
  const source='fixed: n = {type: "styled", view: {type: "text", text: n}, styles: [{padding: (if (n == 2) then (0 - 1) else 4)}]};\n'+
    'other: n = {type: "column", children: [{type: "button", label: "Bad generic", update: {old | 1}}, {type: "button", label: "Bad fixed", update: {old | 2}}, {type: "button", label: "Good", update: {old | 3}}, (if (n == 1) then {type: "unknown"} else {type: "text", text: n})]};';
  const compiled=sandbox.MiraGuiSpecialize.compileHybrid(compiler,source,['fixed:','other:']);
  const app=sandbox.MiraGuiSpecialize.mountHybrid(compiled,root,0,msg=>errors.push(msg));
  const [fixed,other]=findAll(root,'p');
  findButtons(root)[0].click();findButtons(root)[1].click();
  assert.equal(app.getState(),0);assert.equal(fixed.textContent,'0');assert.equal(other.textContent,'0');
  assert.match(errors[0],/Unsupported view type/);assert.match(errors[1],/Invalid style value/);
  findButtons(root)[2].click();
  assert.equal(app.getState(),3);assert.equal(fixed.textContent,'3');assert.equal(other.textContent,'3');
});

test('0.23 hybrid controlled input uses the same state and survives generic updates',()=>{
  const {root,errors,document}=setup(),sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);runInNewContext(read('gui-specialize.js'),sandbox);
  const source='fixed: model = {type: "input", label: "Name", value: (model ~ name), update: {old, entered | {name: entered, count: (old ~ count)}}};\n'+
    'other: model = {type: "column", children: [{type: "button", label: "Next", update: {old | {name: (old ~ name), count: (old ~ count + 1)}}}, (if (model ~ count == 0) then {type: "title", text: (model ~ name)} else {type: "text", text: (model ~ name)})]};';
  const compiled=sandbox.MiraGuiSpecialize.compileHybrid(compiler,source,['fixed:','other:']);
  const app=sandbox.MiraGuiSpecialize.mountHybrid(compiled,root,{name:'Ada',count:0},msg=>errors.push(msg));
  const input=findAll(root,'input')[0];input.focus();input.value='Mira';input.setSelectionRange(2,2);input.dispatch('input');
  assert.equal(findAll(root,'h2')[0].textContent,'Mira');
  findButtons(root)[0].click();
  assert.equal(app.getState().count,1);assert.equal(findAll(root,'p')[0].textContent,'Mira');
  assert.equal(findAll(root,'input')[0],input);assert.equal(document.activeElement,input);assert.equal(input.selectionStart,2);
  assert.deepEqual(errors,[]);
});


test('0.24 automatic partition matches original view through root updates and preserves identity',()=>{
  const {root,errors}=setup(), normal=setup(),sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);runInNewContext(read('gui-specialize.js'),sandbox);
  runInNewContext(read('gui-benchmark.js'),sandbox);
  const source=sandbox.MiraGuiBench.hybridSource(5);
  const compiled=sandbox.MiraGuiSpecialize.compileAuto(compiler,source,'hybrid view:');
  assert.equal(compiled.mode,'hybrid');
  assert.deepEqual(Array.from(compiled.regions,r=>r.selector),['fixed panel:','changing panel:']);
  const app=sandbox.MiraGuiSpecialize.mountAuto(compiled,root,0,msg=>errors.push(msg));
  normal.host.render({type:'state',initial:0,view:compiled.view});
  const snapshot=node=>({tag:node.tagName,cls:node.className,text:node.textContent,children:node.children.map(snapshot)});
  const label=findAll(root,'p')[0],button=findButtons(root)[0];
  for(let n=0;n<6;n++){
    assert.deepEqual(snapshot(root),snapshot(normal.root));
    assert.equal(app.getState(),n);
    assert.equal(findAll(root,'p')[0],label);
    assert.equal(findButtons(root)[0],button);
    button.click();findButtons(normal.root)[0].click();
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(normal.errors,[]);
});

test('0.24 automatic generic fallback preserves actual constructor semantics and state',()=>{
  const {root,errors}=setup(),sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);runInNewContext(read('gui-specialize.js'),sandbox);
  const source='column: items = {type: "row", children: items};\n'+
    'fixed: n = {type: "text", text: n};\n'+
    'changing: n = {type: "column", children: [{type: "button", label: "Next", update: {old | old + 1}}, (if (n == 0) then {type: "title", text: n} else {type: "text", text: n})]};\n'+
    'view: n = column: [fixed: n, changing: n];';
  const compiled=sandbox.MiraGuiSpecialize.compileAuto(compiler,source,'view:');
  assert.equal(compiled.mode,'generic');
  const app=sandbox.MiraGuiSpecialize.mountAuto(compiled,root,0,msg=>errors.push(msg));
  assert.equal(root.children[0].children[0].className,'mira-ui-row');
  findButtons(root)[0].click();assert.equal(app.getState(),1);
  assert.equal(findAll(root,'p')[0].textContent,'1');
  assert.deepEqual(errors,[]);
});

test('0.24 automatic fully specialized mode preserves root shape',()=>{
  const {root,errors}=setup(),sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);runInNewContext(read('gui-specialize.js'),sandbox);
  const source='view: n = {type: "row", children: [{type: "text", text: n}, {type: "button", label: "Next", update: {old | old + 1}}]};';
  const compiled=sandbox.MiraGuiSpecialize.compileAuto(compiler,source,'view:');
  assert.equal(compiled.mode,'specialized');
  const app=sandbox.MiraGuiSpecialize.mountAuto(compiled,root,0,msg=>errors.push(msg));
  assert.equal(root.children[0].children[0].className,'mira-ui-row');
  findButtons(root)[0].click();
  assert.equal(app.getState(),1);assert.equal(findAll(root,'p')[0].textContent,'1');
  assert.deepEqual(errors,[]);
});


test('0.25 preview automatically specializes canonical examples and preserves ordinary fallback',()=>{
  const sandbox={};
  runInNewContext(read('gui-specialize.js'),sandbox);
  for(const [id,mode] of [['gui-dashboard','specialized'],['gui-lesson','specialized'],['gui-independent','generic'],['gui-style-toggle','generic'],['browser-alert','generic']]){
    const plan=sandbox.MiraGuiSpecialize.previewPlan(compiler,demo(id).source,manifest);
    assert.equal(plan.mode,mode,id+': '+plan.reason);
    const description=sandbox.MiraGuiSpecialize.describe(plan);
    assert.equal(description.mode,mode);
    if(mode==='specialized')assert.ok(description.regions[0].slots.length>0);
  }
  const library=readFileSync(resolve(root,'lib/gui.mira'),'utf8');
  const source=library+'\nfixed: n = text: n; changing: n = if (n == 0) then (title: n) else (text: n); view: n = column: [fixed: n, changing: n]; render (state: 0, view: (view: _));';
  const plan=sandbox.MiraGuiSpecialize.previewPlan(compiler,source,manifest);
  assert.equal(plan.mode,'hybrid',plan.reason);
  const description=sandbox.MiraGuiSpecialize.describe(plan);
  assert.equal(description.regions[0].mode,'specialized');
  assert.equal(description.regions[1].mode,'generic');
  assert.ok(description.regions[1].reason);
});

test('0.25 preview plans reject effects, multiple renders, keyed state and disguised constructors',()=>{
  const sandbox={};runInNewContext(read('gui-specialize.js'),sandbox);
  const library=readFileSync(resolve(root,'lib/gui.mira'),'utf8');
  const tail='view: n = text: n; render (state: 0, view: (view: _));';
  for(const source of [
    library+'\nlog "hello"; '+tail,
    library+'\nvalue = 1 + 2; '+tail,
    library+'\nview: n = text: n; render (state: 0, key: "x", view: (view: _));',
    library+'\nview: n = text: n; render (state: 0, view: (view: _)); render (state: 1, view: (view: _));',
    'state: initial, view: factory = {type: "state", initial: 10, view: factory}; view: n = {type: "text", text: n}; render (state: 0, view: (view: _));',
    library+'\nview: n = text: n; render (state: (1 + 2), view: (view: _));'
  ])assert.equal(sandbox.MiraGuiSpecialize.previewPlan(compiler,source,manifest).mode,'generic',source);
});

test('0.25 iframe protocol executes actual generated program and reports strategy and slots',()=>{
  const {root:mount,document}=setup();
  const nodes={ 'mira-root':mount, errors:document.createElement('div'),
    'renderer-status':document.createElement('summary'),'renderer-plan':document.createElement('pre')};
  document.getElementById=id=>nodes[id];
  let handler;const messages=[];
  const parent={postMessage(message){messages.push(message);}};
  const sandbox={document,window:{parent,addEventListener(type,fn){if(type==='message')handler=fn;}},
    performance:{now:()=>0}};
  for(const file of ['compiler.js','ui-host.js','gui-specialize.js','ui-preview.js'])runInNewContext(read(file),sandbox);
  const example=demo('gui-dashboard');
  const compiled=compiler.compile(example.source,'js',manifest);
  const send=mode=>handler({source:parent,data:{type:'mira-ui:run',source:example.source,code:compiled.output,hostJson:manifest,mode}});
  send('auto');
  assert.equal(nodes['renderer-status'].textContent,'Renderer: Specializzato');
  assert.match(nodes['renderer-plan'].textContent,/Slot dinamici/);
  assert.match(nodes['renderer-plan'].textContent,/Montaggio/);
  findButtons(mount)[0].click();
  assert.deepEqual(findAll(mount,'h2').map(n=>n.textContent),['Studio musicale','3','90']);
  send('generic');
  assert.equal(nodes['renderer-status'].textContent,'Renderer: Generico');
  findButtons(mount)[0].click();
  assert.deepEqual(findAll(mount,'h2').map(n=>n.textContent),['Studio musicale','3','90']);
  assert.ok(messages.some(m=>m.type==='mira-ui:ready'));
  assert.equal(messages.filter(m=>m.type==='mira-ui:error').length,0);
});


test('0.27 deferred commits preserve every transition, validation, and mount ownership',async()=>{
  const {root,errors}=setup(),sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);runInNewContext(read('gui-specialize.js'),sandbox);
  const source='bad: n = {x: {| n}}; view: n = {type: "column", children: [{type: "text", text: n}, {type: "button", label: "Next", update: {old | old + 1}}, {type: "button", label: "Bad", update: (bad: _)}]};';
  const compiled=sandbox.MiraGuiSpecialize.compile(compiler,source,'view:');
  for(const mode of ['microtask','frame']){
    const scheduled=[],writes=[];
    const app=sandbox.MiraGuiSpecialize.mount(compiled,root,0,msg=>errors.push(msg),'content',
      {mode,schedule:fn=>scheduled.push(fn),onCommit:n=>writes.push(n)});
    const [button,bad]=findButtons(root),label=findAll(root,'p')[0];
    button.click();button.click();bad.click();button.click();
    assert.equal(app.getState(),3);
    assert.equal(label.textContent,'0');
    assert.equal(scheduled.length,1);
    const done=app.whenIdle();scheduled.shift()();await done;
    assert.equal(label.textContent,'3');assert.deepEqual(writes,[1]);
    button.click();
    const stale=app.whenIdle();
    sandbox.MiraGuiSpecialize.mount(compiled,root,42,msg=>errors.push(msg));
    scheduled.shift()();await stale;
    assert.equal(findAll(root,'p')[0].textContent,'42');
    assert.deepEqual(writes,[1]);
  }
  assert.equal(errors.length,2);
  assert.ok(errors.every(msg=>/data next state/.test(msg)));
});


test('0.30 imported GUI works with automatic preview and normal host',()=>{
  const {root,errors}=setup(),sandbox={};
  runInNewContext(read('ui-host.js'),sandbox);runInNewContext(read('gui-specialize.js'),sandbox);
  const source='import "lib/gui.mira";\nview: n = column: [text: n, button: "Next", update: {old | old + 1}];\nrender (state: 0, view: (view: _));';
  const built=compiler.compile(source,'js',manifest);
  assert.equal(built.ok,true,built.message);
  const plan=sandbox.MiraGuiSpecialize.previewPlan(compiler,source,manifest);
  assert.equal(plan.mode,'specialized',plan.reason);
  const app=sandbox.MiraGuiSpecialize.mountAuto(plan,root,0,msg=>errors.push(msg));
  findButtons(root)[0].click();
  assert.equal(app.getState(),1);assert.equal(findAll(root,'p')[0].textContent,'1');
  assert.deepEqual(errors,[]);
});


test('0.31 record patches preserve controlled form state and specialized rendering',()=>{
  const source=demo('record-update-form').source;
  const initial={student:'Ada',hours:2,paid:false};
  for(const mode of ['generic','specialized']){
    const {root,errors,host,document}=setup(),sandbox={};
    runInNewContext(read('ui-host.js'),sandbox);runInNewContext(read('gui-specialize.js'),sandbox);
    const head=source.slice(0,source.lastIndexOf('\nrender '));
    const compiled=compiler.compile(head,'js');
    assert.equal(compiled.ok,true,compiled.message);
    const view=runInNewContext(compiled.output+'\nview',{});
    const app=mode==='generic'?host.renderState(view,initial):
      sandbox.MiraGuiSpecialize.mountAuto(sandbox.MiraGuiSpecialize.compileAuto(compiler,head,'view:'),root,initial,msg=>errors.push(msg));
    if(mode==='specialized')assert.equal(sandbox.MiraGuiSpecialize.compileAuto(compiler,head,'view:').mode,'specialized');
    const [input,check]=findAll(root,'input');input.focus();input.value='Mira';input.setSelectionRange(2,2);input.dispatch('input');
    findButtons(root)[0].click();check.checked=true;check.dispatch('change');
    assert.equal(JSON.stringify(app.getState()),'{"student":"Mira","hours":3,"paid":true}');
    assert.equal(JSON.stringify(initial),'{"student":"Ada","hours":2,"paid":false}');
    assert.equal(findAll(root,'input')[0],input);assert.equal(document.activeElement,input);assert.equal(input.selectionStart,2);
    assert.deepEqual(errors,[]);
  }
});
