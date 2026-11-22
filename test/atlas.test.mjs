import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';

const root=fileURLToPath(new URL('../',import.meta.url));
const site=resolve(root,'dist/studio');
const read=filename=>readFileSync(resolve(site,filename),'utf8');
const compiler={};
runInNewContext(read('compiler.js'),compiler);
const bridge=compiler.MiraStudioCompiler;
const data=JSON.parse(read('atlas-data.json'));
const mira=await import(pathToFileURL(resolve(site,'atlas-program.js')).href);

test('Atlas exports real Haxe lexer, declaration and symbol stages',()=>{
  const source='add: first, and: second = first + second;\nresult = add: 2, and: 5;';
  const trace=bridge.trace(source);
  assert.equal(trace.ok,true,trace.message);
  const parsed=JSON.parse(trace.output);
  assert.equal(parsed.declarations.length,2);
  assert.equal(parsed.declarations[0].name,'add:and:');
  assert.deepEqual(Array.from(parsed.declarations[0].parameters),['first','second']);
  assert.equal(parsed.declarations[1].bodyTokens[0].value,'add');
  assert.ok(parsed.declarations[0].bodyTokens.some(x=>x.value==='+'));
  assert.ok(parsed.symbols.some(item=>item.kind==='selector' && item.name==='add:and:'));
  assert.ok(parsed.symbols.some(item=>item.kind==='value' && item.name==='result'));

  const tokens=bridge.tokens(source);
  assert.equal(tokens.ok,true);
  assert.equal(JSON.parse(tokens.output)[0].value,'add');
  const ast=bridge.ast(source);
  assert.equal(ast.ok,true);
  const tree=JSON.parse(ast.output);
  assert.equal(tree.definitions[1].body.kind,'Call');
  assert.equal(tree.definitions[1].body.selector,'add:and:');
  const js=bridge.compile(source,'js');
  const php=bridge.compile(source,'php');
  assert.equal(js.ok,true,js.message);
  assert.equal(php.ok,true,php.message);
});

test('Atlas correctly exposes host signatures without pretending to typecheck',()=>{
  const host=JSON.stringify({values:[],callables:['alert'],selectors:['get:from:']});
  const trace=bridge.trace('alert "ciao"; result = 5;',host);
  assert.equal(trace.ok,true,trace.message);
  const symbols=JSON.parse(trace.output).symbols;
  assert.ok(symbols.some(row=>row.kind==='host callable' && row.name==='alert'));
  assert.ok(symbols.some(row=>row.kind==='host selector' && row.name==='get:from:'));
  assert.ok(!symbols.some(row=>row.kind==='inferred type'));
});

test('Architecture data describes checked-in files and only verified import edges',()=>{
  assert.equal(data.version,1);
  assert.equal(data.phases.length,7);
  assert.ok(data.modules.length>=20);
  const modules=new Map(data.modules.map(item=>[item.id,item]));
  const edges=new Set(data.edges.map(item=>item.from+' -> '+item.to));
  assert.equal(edges.size,data.edges.length);
  for(const item of data.modules){
    assert.ok(existsSync(resolve(root,item.path)),item.path);
    for(const dep of item.imports){
      assert.ok(modules.has(dep),dep);
      assert.ok(edges.has(item.id+' -> '+dep));
    }
  }
  for(const phase of data.phases){
    assert.ok(phase.purpose && phase.produces);
    for(const file of phase.sourceFiles)assert.ok(existsSync(resolve(root,file)),file);
  }
  assert.equal(data.phases[1].id,'tokens');
  assert.match(data.phases[1].purpose,/Non esiste un tokenizer separato/);
});

test('Atlas view models are executed from compiled Mira, not JS copies',()=>{
  assert.match(read('atlas-program.js'),/Generated from studio\/atlas\/atlas\.mira/);
  assert.match(read('atlas-program.js'),/function atlas_modules\(/);
  const overview=mira.atlas_overview(data);
  assert.equal(overview.modules,data.modules.length);
  assert.equal(overview.dependencies,data.edges.length);
  assert.equal(overview.stages,data.phases.length);
  const stages=mira.atlas_stages(data.phases);
  assert.equal(stages.length,data.phases.length);
  assert.equal(stages[0].title,data.phases[0].title);
  const modules=mira.atlas_modules(data.modules);
  assert.equal(modules[0].path,data.modules[0].path);
  assert.equal(modules[0].dependencies,data.modules[0].imports.length);
  const program=JSON.parse(bridge.ast('value = 4;').output);
  const cards=mira.atlas_ast(program.definitions);
  assert.deepEqual(cards,[{name:'value',kind:'Value',line:1}]);
  const declarations=JSON.parse(bridge.trace('result = 7;').output).declarations;
  const rawCards=mira.atlas_declarations(declarations);
  assert.equal(rawCards[0].tokens,1);
  assert.equal(rawCards[0].kind,'Value');
});

test('Atlas modules and JSON are cached for offline PWA use',()=>{
  for(const name of ['atlas-ui.js','atlas-program.js','atlas-data.json']){
    assert.ok(existsSync(resolve(site,name)),name);
    assert.ok(read('sw.js').includes('./'+name));
  }
  assert.match(read('index.html'),/data-view="atlas"/);
  assert.match(read('app.js'),/mountAtlas/);
});


test('Atlas browser controller renders real compiler results, caches steps and navigates SVG',async()=>{
  const {mountAtlas}=await import(pathToFileURL(resolve(site,'atlas-ui.js')).href);
  class FakeElement {
    constructor(tag){this.tagName=tag;this.children=[];this.attributes=new Map();
      this.listeners=new Map();this._text='';this.value='';this.hidden=false;}
    set textContent(value){this._text=String(value);this.children=[];}
    get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=[...items];this._text='';}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    addEventListener(event,fn){this.listeners.set(event,fn);}
    click(){this.listeners.get('click')?.({});}
  }
  const find=(root,tag)=>[
    ...(root.tagName===tag?[root]:[]),
    ...root.children.flatMap(child=>find(child,tag))
  ];
  globalThis.document={
    createElement:tag=>new FakeElement(tag),
    createElementNS:(ns,tag)=>new FakeElement(tag)
  };
  globalThis.fetch=async()=>({ok:true,json:async()=>data});
  const count={tokens:0,trace:0,ast:0,compile:0};
  const mocked={
    tokens:src=>{count.tokens++;return bridge.tokens(src);},
    trace:(src,host)=>{count.trace++;return bridge.trace(src,host);},
    ast:(src,host)=>{count.ast++;return bridge.ast(src,host);},
    compile:(src,target,host)=>{count.compile++;return bridge.compile(src,target,host);}
  };
  const rootNode=new FakeElement('root');
  let source='result = 2 + 3;';
  const atlas=mountAtlas(rootNode,mocked,()=>source,()=>undefined);
  await atlas.ready;
  assert.match(rootNode.textContent,/Mira Atlas/);
  assert.match(rootNode.textContent,/Lexer/);
  assert.ok(find(rootNode,'button').some(b=>b.textContent==='Aggiorna dal sorgente'));
  assert.equal(count.tokens,1);
  assert.equal(count.trace,1);
  assert.equal(count.ast,1);
  assert.equal(count.compile,2);

  find(rootNode,'button').find(b=>b.textContent==='AST risolto').click();
  assert.match(rootNode.textContent,/AST canonico/);
  assert.equal(count.trace,1,'Switching stages must reuse the compiler snapshot');

  source='result = 9;';
  atlas.refresh();
  assert.equal(count.tokens,2);
  assert.equal(count.trace,2);

  find(rootNode,'button').find(b=>b.textContent==='Mappa architetturale').click();
  assert.ok(find(rootNode,'svg').length===1,'The architecture graph must be SVG');
  assert.ok(find(rootNode,'g').length>=data.modules.length);
  assert.match(rootNode.textContent,/import espliciti/);
});
