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

test('benchmark keeps only the run action and uses the current compiler version',async()=>{
  const {mountBenchmark}=await import(pathToFileURL(resolve(site,'benchmark-ui.js')).href);
  const previousDocument=globalThis.document;
  class Element {
    constructor(tag){this.tagName=tag;this.className='';
      this.children=[];this.listeners=new Map();this.attributes=new Map();
      this.textContent='';}
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.children=[...nodes];}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    addEventListener(name,listener){this.listeners.set(name,listener);}
  }
  try {
    globalThis.document={createElement:tag=>new Element(tag)};
    const rootNode=new Element('section');
    const viewer=mountBenchmark(rootNode,bridge);
    const header=rootNode.children[0];
    const [marker,,,actions]=header.children;
    assert.equal(marker.textContent,'PERFORMANCE LAB · MIRA '+bridge.version);
    assert.equal(actions.children.length,1);
    assert.equal(actions.children[0].textContent,'▶ Avvia benchmark');
    assert.equal(actions.children[0].className,'bench-run');
    assert.equal(typeof viewer.run,'function');
    assert.equal('toggleFullscreen' in viewer,false);
  } finally {
    if(previousDocument===undefined)delete globalThis.document;
    else globalThis.document=previousDocument;
  }
});

test('benchmark assets are cached and route has a visible tab',()=>{
  for(const file of ['benchmark-ui.js','benchmark-cases.js','benchmark-worker.js']){
    assert.ok(existsSync(resolve(site,file)),file);
    assert.ok(read('sw.js').includes('./'+file),file+' must be offline-ready');
  }
  assert.match(read('index.html'),/data-view="benchmark"/);
  assert.match(read('app.js'),/mountBenchmark/);
  assert.doesNotMatch(read('benchmark-ui.js'),/bench-expand|toggleFullscreen/);
  assert.doesNotMatch(read('styles.css'),/\.benchmark-area\.bench-fullscreen|\.bench-expand|body\.bench-fullscreen-open/);
});


test('GUI browser benchmark workload uses actual compiled Mira view and transition',()=>{
  const sandbox={};
  runInNewContext(read('gui-benchmark.js'),sandbox);
  for(const density of ['sparse','dense']){
    const source=sandbox.MiraGuiBench.source(density);
    for(const target of ['js','php']){
      const result=bridge.compile(source,target);
      assert.equal(result.ok,true,result.message);
    }
    const js=bridge.compile(source,'js');
    const view=runInNewContext(js.output+'\nbench_view(3)',{});
    assert.equal(view.children.length,101);
    assert.equal(view.children[0].view.text,3);
    assert.equal(view.children[99].view.text,density==='sparse'?99:102);
    assert.equal(view.children[100].update(3),4);
  }
  for(const file of ['gui-benchmark.js','gui-benchmark.html']){
    assert.ok(existsSync(resolve(site,file)),file);
    assert.ok(read('sw.js').includes('./'+file));
  }
  assert.match(read('benchmark-ui.js'),/gui-benchmark\.html/);
  assert.match(read('sw.js'),/cache\.put\(page, copy\)/);
});

test('GUI benchmark runs in a real Chromium DOM and checks all strategies',t=>{
  const candidates=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean);
  const executable=candidates.find(cmd=>spawnSync(cmd,['--version'],{encoding:'utf8'}).status===0);
  if(!executable){
    if(process.env.GITHUB_ACTIONS==='true')assert.fail('Chrome/Chromium is required on GitHub Actions');
    return t.skip('Chrome/Chromium not installed; set CHROME_BIN');
  }
  const url=pathToFileURL(resolve(site,'gui-benchmark.html'));
  url.searchParams.set('auto','1');
  const output=spawnSync(executable,['--headless','--no-sandbox','--disable-dev-shm-usage',
    '--no-first-run','--disable-gpu','--dump-dom',url.href],{encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024});
  assert.equal(output.status,0,output.error?.message??output.stderr);
  const match=output.stdout.match(/<pre id="machine"[^>]*>([\s\S]*?)<\/pre>/);
  assert.ok(match,'benchmark machine result missing');
  const result=JSON.parse(match[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
  assert.equal(result.ok,true,result.message);
  assert.equal(result.version,bridge.version);
  assert.equal(result.rows,100);
  assert.equal(result.results.length,4);
  for(const row of result.results){
    for(const strategy of ['view','incremental','rebuild','direct']){
      assert.ok(Number.isFinite(row[strategy].medianMs)&&row[strategy].medianMs>=0);
      assert.ok(row[strategy].p95Ms>=row[strategy].medianMs);
    }
  }
  t.diagnostic('GUI_BROWSER_BENCHMARK '+JSON.stringify(result));
});
