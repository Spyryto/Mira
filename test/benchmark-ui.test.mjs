import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {performance} from 'node:perf_hooks';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const site=resolve(root,'dist/studio');
const read=name=>readFileSync(resolve(site,name),'utf8');
const context={};
runInNewContext(read('compiler.js'),context);
const bridge=context.MiraStudioCompiler;
const workload=await import(pathToFileURL(resolve(site,'benchmark-cases.js')).href);

test('workloads are valid and source line count is explicit',()=>{
  assert.deepEqual(workload.benchmarks.map(x=>x.steps),[5,50,100]);
  for(const item of workload.benchmarks){
    const source=workload.benchmarkSource(item.steps);
    assert.equal(workload.sourceLines(source),item.steps+2);
    assert.equal(source.trim().split('\n').length,item.steps+2);
    const js=bridge.compile(source,'js');
    const php=bridge.compile(source,'php');
    assert.equal(js.ok,true,item.id+': '+js.message);
    assert.equal(php.ok,true,item.id+': '+php.message);
    assert.equal(runInNewContext(js.output+'\nrun(7)',{}),7+item.steps);
    const p=spawnSync('php',['-r',php.output.replace(/^<\?php\s*/, '')+
      '\necho run(7);'],{encoding:'utf8'});
    assert.equal(p.status,0,item.id+' PHP: '+p.stderr);
    assert.equal(p.stdout,String(7+item.steps));
  }
  assert.equal(workload.sourceLines('  #comment\nvalue = 1;\n\n'),1);
  assert.throws(()=>workload.benchmarkSource(101),RangeError);
});

test('compilation timing measures source lines and throughput (not program execution)',()=>{
  const source=workload.benchmarkSource(5);
  const a=performance.now();
  let compiled=null;
  for(let i=0;i<4;i++){
    compiled=bridge.compile(source,'js');
    assert.equal(compiled.ok,true,compiled.message);
  }
  assert.ok(performance.now()>=a);
  const score=workload.linesPerSecond(workload.sourceLines(source),0.2);
  assert.equal(score,35000);
  assert.equal(workload.linesPerSecond(4,0),null);
  assert.deepEqual(workload.percentiles([4,2,1,3,5]),{medianMs:3,p95Ms:5});
});

test('execution worker measures only warmed JavaScript calls and validates results',()=>{
  const source=workload.benchmarkSource(5);
  const compiled=bridge.compile(source,'js');
  assert.equal(compiled.ok,true,compiled.message);
  let reply;
  const fake={self:{postMessage(msg){reply=msg;}},performance};
  runInNewContext(read('benchmark-worker.js'),fake);
  fake.self.onmessage({data:{code:compiled.output,expected:12,id:'small'}});
  assert.equal(reply?.ok,true,reply?.message);
  assert.ok(Number.isFinite(reply.medianMs)&&reply.medianMs>=0);
  assert.ok(Number.isFinite(reply.p95Ms)&&reply.p95Ms>=reply.medianMs);
  assert.equal(reply.samples,21);
  fake.self.onmessage({data:{code:compiled.output,expected:13,id:'small'}});
  assert.equal(reply?.ok,false);
  assert.match(reply.message,/risultato errato/);
});

test('benchmark full-screen controls and Escape work without Fullscreen API',async()=>{
  const {mountBenchmark}=await import(pathToFileURL(resolve(site,'benchmark-ui.js')).href);
  function classes(){
    const items=new Set();
    return {contains:name=>items.has(name),
      toggle:(name,on)=>{const selected=on===undefined?!items.has(name):on;
        if(selected)items.add(name);else items.delete(name);return selected;}};
  }
  class Element {
    constructor(tag){this.tagName=tag;this.classList=classes();
      this.children=[];this.listeners=new Map();this.attributes=new Map();
      this.textContent='';}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=[...items];}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    addEventListener(type,handler){this.listeners.set(type,handler);}
    focus(){this.focused=true;}
  }
  const handlers=new Map();
  globalThis.document={
    body:{classList:classes()},
    createElement:tag=>new Element(tag),
    addEventListener:(name,handler)=>handlers.set(name,handler),
    removeEventListener:name=>handlers.delete(name)
  };
  const rootNode=new Element('section');
  const viewer=mountBenchmark(rootNode,bridge);
  viewer.toggleFullscreen(true);
  assert.equal(rootNode.classList.contains('bench-fullscreen'),true);
  assert.equal(document.body.classList.contains('bench-fullscreen-open'),true);
  handlers.get('keydown')({key:'Escape'});
  assert.equal(rootNode.classList.contains('bench-fullscreen'),false);
  viewer.dispose();
  assert.equal(handlers.has('keydown'),false);
});

test('benchmark assets are cached and route has a visible tab',()=>{
  for(const file of ['benchmark-ui.js','benchmark-cases.js','benchmark-worker.js']){
    assert.ok(existsSync(resolve(site,file)),file);
    assert.ok(read('sw.js').includes('./'+file),file+' must be offline-ready');
  }
  assert.match(read('index.html'),/data-view="benchmark"/);
  assert.match(read('app.js'),/mountBenchmark/);
  assert.match(read('styles.css'),/\.benchmark-area\.bench-fullscreen/);
});
