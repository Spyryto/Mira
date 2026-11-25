import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {resolve} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
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
  for(const file of ['gui-benchmark.js','gui-benchmark.html','gui-specialize.js']){
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
  assert.equal(result.results.length,6);
  for(const row of result.results){
    assert.equal(row.dynamicSlots,row.density==='styled'?2:row.density==='sparse'?1:100);
    for(const strategy of ['view','incremental','rebuild','specialized','direct']){
      assert.ok(Number.isFinite(row[strategy].medianMs)&&row[strategy].medianMs>=0);
      assert.ok(row[strategy].p95Ms>=row[strategy].medianMs);
    }
  }
  assert.equal(result.form.length,2);
  for(const row of result.form)for(const strategy of ['incremental','specialized']){
    assert.ok(Number.isFinite(row[strategy].medianMs)&&row[strategy].medianMs>=0);
    assert.ok(row[strategy].p95Ms>=row[strategy].medianMs);
  }
  assert.equal(result.hybrid.length,2);
  for(const row of result.hybrid)for(const strategy of ['incremental','hybrid']){
    assert.ok(Number.isFinite(row[strategy].medianMs)&&row[strategy].medianMs>=0);
    assert.ok(row[strategy].p95Ms>=row[strategy].medianMs);
  }
  assert.equal(result.textExperiment.samples,9);
  assert.equal(result.textExperiment.steps,120);
  assert.equal(result.textExperiment.results.length,4);
  for(const row of result.textExperiment.results)for(const key of ['content','data']){
    assert.ok(Number.isFinite(row[key].medianMs)&&row[key].medianMs>=0);
    assert.ok(row[key].p95Ms>=row[key].medianMs);
  }
  t.diagnostic('GUI_BROWSER_BENCHMARK '+JSON.stringify(result));
});


test('specialization uses resolved AST and recompiles only dynamic slot expressions',()=>{
  const sandbox={};
  runInNewContext(read('gui-specialize.js'),sandbox);
  runInNewContext(read('gui-benchmark.js'),sandbox);
  for(const density of ['sparse','dense']){
    const source=sandbox.MiraGuiBench.source(density);
    const result=sandbox.MiraGuiSpecialize.compile(bridge,source,'bench view:');
    assert.equal(result.plan.slots.length,density==='sparse'?1:100);
    for(const n of [0,1,42,-7]){
      const view=result.program.view(n);
      const values=result.program.values(n);
      assert.equal(values.length,result.plan.slots.length);
      for(let i=0;i<values.length;i++)assert.equal(values[i],view.children[i].view.text);
    }
  }
  const nested='advance: n = n + 1; example: n = {type: "row", children: [{type: "title", text: "Fixed"}, {type: "column", children: [{type: "text", text: (n * 2 + 3)}, {type: "button", label: "Next", update: (advance: _)}]}]};';
  const result=sandbox.MiraGuiSpecialize.compile(bridge,nested,'example:');
  assert.equal(JSON.stringify(result.plan.slots[0].path),'[1,0]');
  assert.equal(result.program.values(5)[0],result.program.view(5).children[1].children[0].text);
  const unsupported=[
    'example: n = if (n > 0) then {type: "text", text: n} else {type: "title", text: n};',
    'example: n = {type: "button", label: "Next", update: {old | old + n}};',
  ];
  for(const source of unsupported)assert.throws(()=>sandbox.MiraGuiSpecialize.compile(bridge,source,'example:'),/Unsupported specialized view/);
});


test('0.20 record state and style slots agree with regular compiled view',()=>{
  const sandbox={};
  runInNewContext(read('gui-specialize.js'),sandbox);
  runInNewContext(read('gui-benchmark.js'),sandbox);
  const source=sandbox.MiraGuiBench.source('styled');
  for(const target of ['js','php'])assert.equal(bridge.compile(source,target).ok,true);
  const result=sandbox.MiraGuiSpecialize.compile(bridge,source,'bench view:');
  assert.equal(result.plan.slots.length,2);
  for(const count of [0,1,42,7]){
    const state={count};
    const view=result.program.view(state);
    const values=result.program.values(state);
    assert.equal(values[0][0][0].padding,view.children[0].styles[0].padding);
    assert.equal(values[1],view.children[0].view.text);
  }
  const php=bridge.compile(source,'php');
  const p=spawnSync('php',['-r',php.output.replace(/^<\?php\s*/,'')+'\n$v=bench_view(["count"=>7]); echo json_encode([$v["children"][0]["view"]["text"],$v["children"][0]["styles"][0]["padding"]]);'],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  assert.deepEqual(JSON.parse(p.stdout),[7,8]);
});


test('0.21 form source compiles JS/PHP and rejects captured or dynamic control structure',()=>{
  const sandbox={};
  runInNewContext(read('gui-specialize.js'),sandbox);
  runInNewContext(read('gui-benchmark.js'),sandbox);
  const source=sandbox.MiraGuiBench.formSource(1);
  for(const target of ['js','php']){
    const result=bridge.compile(source,target);
    assert.equal(result.ok,true,result.message);
  }
  const compiled=sandbox.MiraGuiSpecialize.compile(bridge,source,'form view:');
  assert.equal(compiled.plan.slots.filter(s=>s.kind==='control').length,3);
  assert.equal(compiled.plan.slots.length,6);
  for(const source of [
    'view: n = {type: "input", label: "Nome", value: n, update: {old, entered | n}};',
    'view: n = {type: "select", label: "Nome", value: n, options: [n], update: {old, entered | entered}};'
  ])assert.throws(()=>sandbox.MiraGuiSpecialize.compile(bridge,source,'view:'),/Unsupported specialized view/);
});


test('0.22 component specialization uses actual GUI library and lexical selector expansion',()=>{
  const sandbox={};
  runInNewContext(read('gui-specialize.js'),sandbox);
  runInNewContext(read('gui-benchmark.js'),sandbox);
  const library=readFileSync(resolve(root,'lib/gui.mira'),'utf8');
  const form=sandbox.MiraGuiBench.formSource(1);
  assert.ok(form.startsWith(library+'\n'));
  assert.match(form,/student field: model = text input:/);
  const compiled=sandbox.MiraGuiSpecialize.compile(bridge,form,'form view:');
  assert.ok(compiled.plan.expandedCalls>=10);
  assert.equal(compiled.plan.slots.length,6);
  const model={student:'Ada',paid:true,mode:'Online'};
  assert.deepEqual(Array.from(compiled.program.values(model)),['Ada',true,'Online','Ada','Saldato','Online']);
  for(const target of ['js','php'])assert.equal(bridge.compile(form,target).ok,true);

  // Same helper, distinct arguments and nested lexical parameter shadowing.
  const source=library+'\n'+
    'panel style = {padding: 12, background: "#abc"};\n'+
    'metric: caption, amount: n = styled: (column: [title: caption, text: n, text: (n * 2)]), with: [panel style];\n'+
    'view: n = column: [metric: "A", amount: n, metric: "B", amount: (n + 1)];';
  const result=sandbox.MiraGuiSpecialize.compile(bridge,source,'view:');
  assert.deepEqual(Array.from(result.program.values(4)),[4,8,5,10]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.plan.slots.map(s=>s.path))),[[0,1],[0,2],[1,1],[1,2]]);
  assert.equal(result.program.view(4).children[1].view.children[2].text,10);
});

test('0.22 rejects recursion, eager discarded reads and unsafe component captures',()=>{
  const sandbox={};
  runInNewContext(read('gui-specialize.js'),sandbox);
  const bad=[
    'loop: n = loop: n; view: n = loop: n;',
    'ignore: n = {type: "text", text: "fixed"}; view: n = ignore: (n ~ missing);',
    'maybe: x, when: ok = {type: "text", text: (if (ok) then x else 0)}; view: n = maybe: (n ~ missing), when: false;',
    'helper: n = {type: "button", label: "Next", update: {old | old + n}}; view: n = helper: n;',
    'value = 1 + 2; view: n = {type: "text", text: n};',
    'view: n = {type: "text", text: n}; render view: 0;'
  ];
  for(const source of bad)assert.throws(()=>sandbox.MiraGuiSpecialize.compile(bridge,source,'view:'));
});


test('0.23 hybrid classification uses ordinary library and compiles on both targets',()=>{
  const sandbox={};
  runInNewContext(read('gui-specialize.js'),sandbox);runInNewContext(read('gui-benchmark.js'),sandbox);
  const source=sandbox.MiraGuiBench.hybridSource(2);
  for(const target of ['js','php'])assert.equal(bridge.compile(source,target).ok,true);
  const compiled=sandbox.MiraGuiSpecialize.compileHybrid(bridge,source,['fixed panel:','changing panel:']);
  assert.equal(compiled.regions[0].specialized.slots.length,1);
  assert.equal(compiled.regions[1].specialized,null);
  assert.match(compiled.regions[1].reason,/Unsupported specialized view/);
  assert.throws(()=>sandbox.MiraGuiSpecialize.compileHybrid(bridge,source,['missing:']),/unary region selector/);
});


test('0.24 automatic partition is conservative and has no privileged constructor names',()=>{
  const sandbox={};
  runInNewContext(read('gui-specialize.js'),sandbox);runInNewContext(read('gui-benchmark.js'),sandbox);
  const auto=source=>sandbox.MiraGuiSpecialize.compileAuto(bridge,source,'view:');
  const parts='fixed: n = {type: "text", text: n};\n'+
    'changing: n = if (n == 0) then {type: "title", text: n} else {type: "text", text: n};\n';
  for(const source of [
    parts+'view: n = {type: "column", children: [fixed: n, changing: n]};',
    parts+'custom: items = {type: "column", children: items}; view: n = custom: [fixed: n, changing: n];'
  ]){
    assert.equal(auto(source).mode,'hybrid');
    for(const target of ['js','php'])assert.equal(bridge.compile(source,target).ok,true);
  }
  for(const source of [
    parts+'view: n = {type: "column", children: [fixed: (n + 1), changing: n]};',
    parts+'view: n = {type: "column", children: [changing: n, changing: n]};',
    parts+'view: n = {type: "styled", view: {type: "column", children: [fixed: n, changing: n]}, styles: [{padding: 8}]};',
    parts+'view: n = {type: "column", children: [fixed: n, (if (n == 0) then {type: "text", text: n} else {type: "title", text: n})]};'
  ])assert.equal(auto(source).mode,'generic');
  assert.throws(()=>auto('view: n = missing: n;'));
});


test('0.27 batching workload remains ordinary Mira on JS and PHP',()=>{
  const sandbox={};runInNewContext(read('gui-specialize.js'),sandbox);runInNewContext(read('gui-benchmark.js'),sandbox);
  for(const density of ['sparse','dense']){
    const source=sandbox.MiraGuiBench.source(density);
    for(const target of ['js','php'])assert.equal(bridge.compile(source,target).ok,true);
    assert.ok(sandbox.MiraGuiSpecialize.compile(bridge,source,'bench view:').plan.slots.every(s=>s.kind==='text'));
  }
  assert.match(read('gui-benchmark.html'),/id="batch-run"/);
});

async function chromiumEvaluate(t,filename,expression,width=800){
  const executable=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean)
    .find(cmd=>spawnSync(cmd,['--version'],{encoding:'utf8'}).status===0);
  if(!executable){
    if(process.env.GITHUB_ACTIONS==='true')assert.fail('Chromium required');
    t.skip('Chromium not installed');return null;
  }
  const profile=mkdtempSync(resolve(tmpdir(),'mira-browser-'));
  const url=pathToFileURL(resolve(site,filename)).href;
  const child=spawn(executable,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--no-first-run','--window-size='+width+',800','--remote-debugging-port=0','--user-data-dir='+profile,url],{stdio:'ignore'});
  let ws;
  try{
    const portFile=resolve(profile,'DevToolsActivePort');
    for(let i=0;i<100&&!existsSync(portFile);i++)await delay(100);
    assert.ok(existsSync(portFile),'Chromium debugging port missing');
    const port=readFileSync(portFile,'utf8').split('\n')[0];
    let page;
    for(let i=0;i<100&&!page;i++){
      const list=await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(2000)}).then(r=>r.json());
      page=list.find(p=>p.type==='page'&&p.url===url);
      if(!page)await delay(100);
    }
    assert.ok(page,'benchmark page missing');
    ws=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((ok,fail)=>{
      const timeout=setTimeout(()=>fail(new Error('CDP socket timeout')),5000);
      ws.addEventListener('open',()=>{clearTimeout(timeout);ok();},{once:true});
      ws.addEventListener('error',()=>{clearTimeout(timeout);fail(new Error('CDP socket error'));},{once:true});
    });
    let nextId=10;
    function rpc(method,params={},ms=5000){
      const id=nextId++;
      return new Promise((ok,fail)=>{
        const cleanup=()=>{clearTimeout(timer);ws.removeEventListener('message',receive);};
        const receive=event=>{
          const message=JSON.parse(event.data);
          if(message.id!==id)return;
          cleanup();
          if(message.error||message.result?.exceptionDetails)fail(new Error(JSON.stringify(message.error??message.result.exceptionDetails)));
          else ok(message.result);
        };
        const timer=setTimeout(()=>{cleanup();fail(new Error('CDP timeout: '+method));},ms);
        ws.addEventListener('message',receive);
        ws.send(JSON.stringify({id,method,params}));
      });
    }
    await rpc('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:false});
    const selector=filename==='laboratory.html'?'main.lab-page':'#mount';
    let ready=false;
    for(let i=0;i<50&&!ready;i++){
      try{
        const r=await rpc('Runtime.evaluate',{expression:'document.readyState==="complete" && document.URL==='+JSON.stringify(url)+' && !!document.querySelector('+JSON.stringify(selector)+')',returnByValue:true},2000);
        ready=r.result.value===true;
      }catch(error){if(i===49)throw error;}
      if(!ready)await delay(100);
    }
    assert.ok(ready,'Expected report document did not load: '+filename);
    const response=await rpc('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},60000);
    const experiment=response.result.value;
    return experiment;
  }finally{
    // Ask Chrome to close its own profile cleanly before deleting it.
    if(child.exitCode===null&&child.signalCode===null){
      const exited=new Promise(resolve=>child.once('exit',resolve));
      if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({id:2,method:'Browser.close'}));
      else child.kill();
      await Promise.race([exited,delay(3000)]);
      if(child.exitCode===null&&child.signalCode===null){child.kill();await Promise.race([exited,delay(3000)]);}
    }
    if(ws)ws.close();
    try{rmSync(profile,{recursive:true,force:true,maxRetries:12,retryDelay:200});}
    catch(error){
      if(!['ENOTEMPTY','EBUSY','EPERM'].includes(error.code))throw error;
      t.diagnostic('Temporary Chromium profile cleanup deferred by OS: '+error.code);
    }
  }
}

test('real Chromium event loop measures batch commits and containment',{timeout:90000},async t=>{
  const experiment=await chromiumEvaluate(t,'gui-benchmark.html','(async()=>{if(document.readyState!=="complete")await new Promise(r=>window.addEventListener("load",r,{once:true}));const mount=document.getElementById("mount");return {batch:await MiraGuiBench.runBatchExperiment(MiraStudioCompiler,mount),containment:await MiraGuiBench.runContainmentExperiment(MiraStudioCompiler,mount)};})()');
  if(!experiment)return;
    const result=experiment.batch;
    assert.equal(result.ok,true);
    assert.equal(result.version,bridge.version);
    assert.equal(result.bursts,7);
    assert.equal(result.results.length,4);
    for(const row of result.results)for(const mode of ['immediate','microtask','frame']){
      const m=row.modes[mode],commits=result.bursts*(mode==='immediate'?row.events:1);
      assert.equal(m.commits,commits);
      assert.equal(m.writes,commits*(row.density==='dense'?100:1));
      for(const key of ['submit','first','last','total']){
        assert.ok(Number.isFinite(m[key].medianMs)&&m[key].medianMs>=0);
        assert.ok(m[key].p95Ms>=m[key].medianMs);
      }
    }
    t.diagnostic('GUI_BATCH_BENCHMARK '+JSON.stringify(result));
    const c=experiment.containment;
    assert.equal(c.ok,true);assert.equal(c.version,bridge.version);
    assert.equal(c.panels,16);assert.equal(c.rows,16);assert.equal(c.results.length,2);
    assert.equal(c.supported.contain,true);assert.equal(c.supported.auto,true);
    for(const row of c.results){
      assert.deepEqual(Object.keys(row.modes),['normal','contain','auto']);
      for(const m of Object.values(row.modes)){
        assert.equal(m.scrollHeight,row.modes.normal.scrollHeight);
        for(const key of ['update','reveal']){
          assert.ok(Number.isFinite(m[key].medianMs)&&m[key].medianMs>=0);
          assert.ok(m[key].p95Ms>=m[key].medianMs);
        }
      }
      // A real browser may change its relevance threshold; report skip counts,
      // but do not fail on a performance heuristic.
      assert.ok(row.modes.auto.skippedSamples===null||
        row.modes.auto.skippedSamples>=0&&row.modes.auto.skippedSamples<=c.samples);
    }
    t.diagnostic('GUI_CONTAINMENT_BENCHMARK '+JSON.stringify(c));
});


test('0.28 containment workload compiles on both targets with expected dynamic slots',()=>{
  const sandbox={};runInNewContext(read('gui-specialize.js'),sandbox);runInNewContext(read('gui-benchmark.js'),sandbox);
  for(const workload of ['all','far']){
    const source=sandbox.MiraGuiBench.containmentSource(workload);
    for(const target of ['js','php'])assert.equal(bridge.compile(source,target).ok,true);
    const compiled=sandbox.MiraGuiSpecialize.compile(bridge,source,'long view:');
    assert.equal(compiled.plan.slots.length,workload==='all'?256:16);
  }
  assert.match(read('gui-benchmark.html'),/id="contain-run"/);
});


test('0.29 real Laboratory keeps navigation, details and remembered variable heights',{timeout:120000},async t=>{
  const reports=[];
  for(const width of [390,800]){
    const result=await chromiumEvaluate(t,'laboratory.html', '('+async function(){
      if(document.readyState!=='complete')await new Promise(r=>window.addEventListener('load',r,{once:true}));
      const frame=()=>new Promise(r=>requestAnimationFrame(r));
      const settle=async()=>{await frame();await frame();};
      const toggle=document.getElementById('lab-render-normal'),main=document.querySelector('main');
      const cards=[...main.querySelectorAll(':scope > section.lab-card:not(.lab-always)')];
      const details=[...main.querySelectorAll(':scope > details.lab-card')];
      const supported=CSS.supports('content-visibility','auto')&&CSS.supports('contain-intrinsic-block-size','auto 240px');
      const check=(ok,message)=>{if(!ok)throw Error(message);};
      check(supported,'Chromium CSS support');check(cards.length>20,'Real report cards');
      const height=()=>document.scrollingElement.scrollHeight;
      window.scrollTo(0,0);await settle();
      const initialHeight=height();
      check(getComputedStyle(cards.at(-1)).contentVisibility==='auto','Default optimized');
      check(details.every(d=>getComputedStyle(d).contentVisibility==='visible'),'Disclosures eager');
      const farChild=cards.at(-1).querySelector('p');
      const farSkipped=typeof farChild.checkVisibility==='function'?!farChild.checkVisibility({contentVisibilityAuto:true}):null;
      // Exercise actual fragment navigation using native links.
      for(const link of main.querySelectorAll('nav a[href^="#"]')){
        link.click();await settle();
        const target=document.getElementById(link.hash.slice(1)),rect=target.getBoundingClientRect();
        check(location.hash===link.hash&&rect.bottom>0&&rect.top<innerHeight,'Fragment '+link.hash);
      }
      const detail=details.at(-1),summary=detail.querySelector('summary');
      summary.scrollIntoView();summary.click();await settle();
      check(detail.open&&detail.querySelector('table').getBoundingClientRect().height>0,'Open details');
      summary.click();await settle();check(!detail.open,'Close details');
      // Visit every card so the browser can learn its natural block size.
      const learned=[];
      for(const card of cards){
        card.scrollIntoView({block:'start'});await settle();
        const rect=card.getBoundingClientRect();
        check(rect.bottom>0&&rect.top<innerHeight,'Card visible');
        learned.push(rect.height);
      }
      window.scrollTo(0,0);await settle();
      const learnedHeight=height();
      toggle.checked=true;await settle();
      const normalHeight=height();
      check(getComputedStyle(cards.at(-1)).contentVisibility==='visible','Normal mode');
      const normalSizes=cards.map(c=>c.getBoundingClientRect().height);
      check(normalSizes.every((h,i)=>Math.abs(h-learned[i])<=1),'Card geometry changed');
      // The warmed height should converge, with minor subpixel rounding allowed.
      check(Math.abs(learnedHeight-normalHeight)<=cards.length+4,'Remembered scroll extent');
      toggle.checked=false;await settle();
      const warmedHeight=height();
      // Re-enabling can invalidate remembered sizes. Record the immediate estimate,
      // then revisit each card and require convergence again, not a permanent cache.
      for(const card of cards){card.scrollIntoView({block:'start'});await settle();}
      window.scrollTo(0,0);await settle();
      const relearnedHeight=height();
      check(Math.abs(relearnedHeight-normalHeight)<=cards.length+4,'Relearned scroll extent');
      // Resize-style invalidation of the real document, not a synthetic view.
      // Alternate modes, force top geometry, and record final reveal separately.
      const times={normal:[],auto:[]},reveals={normal:[],auto:[]};
      const original=main.style.width;
      for(let round=0;round<7;round++){
        for(const mode of round%2?['auto','normal']:['normal','auto']){
          toggle.checked=mode==='normal';window.scrollTo(0,0);
          main.style.width=original;await settle();
          const start=performance.now();
          for(let i=0;i<10;i++){
            main.style.width=i%2?'94%':'96%';
            main.querySelector('h1').getBoundingClientRect();
          }
          times[mode].push((performance.now()-start)/10);
          const reveal=performance.now();
          cards.at(-1).scrollIntoView({block:'start'});
          farChild.getBoundingClientRect();
          reveals[mode].push(performance.now()-reveal);
          await settle();
          check(farChild.getBoundingClientRect().height>0,'Reveal text geometry');
        }
      }
      main.style.width=original;toggle.checked=false;window.scrollTo(0,0);await settle();
      const stats=a=>{const s=[...a].sort((a,b)=>a-b);return {medianMs:s[3],p95Ms:s[6]};};
      return {width:innerWidth,cards:cards.length,details:details.length,farSkipped,initialHeight,learnedHeight,normalHeight,warmedHeight,relearnedHeight,
        normal:{resize:stats(times.normal),reveal:stats(reveals.normal)},
        auto:{resize:stats(times.auto),reveal:stats(reveals.auto)}};
    }.toString()+')()',width);
    if(!result)return;
    assert.equal(result.width,width);
    assert.ok(result.cards>20);assert.ok(result.details>0);
    for(const mode of ['normal','auto'])for(const k of ['resize','reveal']){
      assert.ok(Number.isFinite(result[mode][k].medianMs)&&result[mode][k].medianMs>=0);
      assert.ok(result[mode][k].p95Ms>=result[mode][k].medianMs);
    }
    reports.push(result);
  }
  t.diagnostic('GUI_LABORATORY_BENCHMARK '+JSON.stringify({version:bridge.version,samples:7,steps:10,reports}));
});
