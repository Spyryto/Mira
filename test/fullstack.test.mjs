import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {performance} from 'node:perf_hooks';

const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn, label) {
  let last;
  for(let i=0;i<150;i++){
    try {const v=await fn(); if(v)return v;}catch(e){last=e;}
    await pause(50);
  }
  throw Error('Timeout: '+label+(last?' ('+last.message+')':''));
}
async function port(){
  const s=createServer();
  await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r);});
  const p=s.address().port;
  await new Promise(r=>s.close(r));return p;
}
function startProcess(command,args){
  const child=spawn(command,args,{stdio:'ignore'});
  child.on('error',()=>{});
  return child;
}
async function stop(child){
  if(!child?.pid||child.exitCode!==null||child.signalCode!==null)return;
  const done=new Promise(r=>child.once('close',r));
  child.kill(); await done;
}
async function connect(url){
  const ws=new WebSocket(url);
  await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  let next=0;const waiting=new Map();
  ws.addEventListener('message',event=>{
    const msg=JSON.parse(event.data);
    if(!waiting.has(msg.id))return;
    const {resolve,reject}=waiting.get(msg.id);waiting.delete(msg.id);
    if(msg.error)reject(Error(msg.error.message));else resolve(msg.result);
  });
  ws.addEventListener('close',()=>{for(const {reject} of waiting.values())reject(Error('CDP closed'));waiting.clear();});
  return {close:()=>ws.close(), call(method,params={}){
    return new Promise((resolve,reject)=>{
      const id=++next;waiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
    });
  }};
}
test('full-stack ledger: actual Chromium, compiled Mira JS/PHP and SQLite', {timeout:120000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-fullstack-'));
  const report=resolve('dist/fullstack-report');
  mkdirSync(report,{recursive:true});
  let php,chrome,cdp,profile;
  try {
    execFileSync('node',['scripts/build-fullstack.mjs',dir],{stdio:'inherit'});
    const serverPort=await port();
    const origin='http://127.0.0.1:'+serverPort;
    const endpoint=origin+'/ledger.php';
    async function server(){
      php=startProcess('php',['-S','127.0.0.1:'+serverPort,'-t',join(dir,'public')]);
      await until(async()=> (await fetch(endpoint,{signal:AbortSignal.timeout(500)})).status===405,'PHP ready');
    }
    async function post(body){
      const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
      return {status:r.status,body:await r.json()};
    }
    await server();
    const exe=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(cmd=>spawnSync(cmd,['--version'],{encoding:'utf8'}).status===0);
    assert.ok(exe,'Chromium required');
    // Only browser startup is retried, never application assertions.
    for(let attempt=0;attempt<3;attempt++){
      profile=mkdtempSync(join(tmpdir(),'mira-browser-'));
      let diagnostics='';
      chrome=spawn(exe,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=440,900',origin+'/'],{stdio:['ignore','ignore','pipe']});
      chrome.on('error',error=>{diagnostics+=error.message;});
      chrome.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk).slice(-8000);});
      try{
        const portFile=join(profile,'DevToolsActivePort');
        const deadline=Date.now()+15000;
        while(!existsSync(portFile)&&Date.now()<deadline&&chrome.exitCode===null)await pause(100);
        assert.ok(existsSync(portFile),'Chromium debugging port missing');
        const chromePort=readFileSync(portFile,'utf8').split('\n')[0];
        const target=await until(async()=>{
          const r=await fetch('http://127.0.0.1:'+chromePort+'/json/list',{signal:AbortSignal.timeout(500)});
          return (await r.json()).find(x=>x.type==='page');
        },'Chromium CDP');
        cdp=await connect(target.webSocketDebuggerUrl);
        break;
      }catch(error){
        console.log('Chromium startup attempt '+(attempt+1)+': '+error.message+'\n'+diagnostics);
        await stop(chrome);
        rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});
        profile=null;
        if(attempt===2)throw error;
      }
    }
    async function js(expression){
      const r=await cdp.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
      return r.result.value;
    }
    const text=()=>js('document.querySelector("#mount")?.innerText ?? ""');
    const waitText=value=>until(async()=> (await text()).includes(value),value);
    const button=label=>js('(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent==='+JSON.stringify(label)+');if(!b)return false;b.click();return true})()');
    async function click(label){assert.equal(await button(label),true,'missing '+label);}
    const fill=name=>js('(()=>{const el=document.querySelector("input");el.value='+JSON.stringify(name)+';el.dispatchEvent(new Event("input",{bubbles:true}));return el.value})()');
    await cdp.call('Page.enable');
    await cdp.call('Page.navigate',{url:origin+'/'});
    await waitText('Sincronizzato');
    assert.equal(await fill('Ada'), 'Ada');
    await click('Aggiungi lezione');await waitText('Ada');await waitText('Sincronizzato');
    assert.equal((await post({action:'load'})).body.lessons[0].hours,1);
    await click('+1 ora');await waitText('Sincronizzato');
    await click('Saldato / non saldato');await waitText('Sincronizzato');
    let saved=(await post({action:'load'})).body;
    assert.deepEqual(saved,{revision:3,'next id':2,lessons:[{id:1,student:'Ada',hours:2,paid:true}]});
    assert.match(await text(),/60/);
    const screenshot=await cdp.call('Page.captureScreenshot',{format:'png'});
    writeFileSync(join(report,'ledger.png'),Buffer.from(screenshot.data,'base64'));
    assert.ok(existsSync(join(dir,'private','ledger.sqlite')));
    assert.equal((await fetch(origin+'/../private/ledger.sqlite')).status,404);
    await stop(php);php=null;
    await click('Ricarica dal server');
    await until(async()=>!(await text()).includes('Attesa server')&&!(await text()).includes('Sincronizzato'),'network error');
    assert.equal(await button('Aggiungi lezione'),false);
    await server();
    await click('Ricarica dal server');await waitText('Sincronizzato');
    assert.deepEqual((await post({action:'load'})).body,saved);
    // Two clients using one revision: exactly one write is accepted.
    const concurrent=await Promise.all([post({action:'hours',id:1,revision:3}),post({action:'hours',id:1,revision:3})]);
    assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
    await click('Rimuovi');await waitText('HTTP 409');
    assert.equal(await button('Rimuovi'),false);
    await click('Ricarica dal server');await waitText('Sincronizzato');
    await click('Rimuovi');await waitText('Sincronizzato');
    saved=(await post({action:'load'})).body;
    assert.deepEqual(saved,{revision:5,'next id':2,lessons:[]});
    assert.equal((await post({action:'add',student:'',revision:5})).status,400);
    assert.equal((await post({action:'remove',id:999,revision:5})).status,404);
    assert.deepEqual((await post({action:'load'})).body,saved);
    await cdp.call('Page.reload');await waitText('Sincronizzato');
    assert.ok(!(await text()).includes('Ada'));
    // Observational read latency only: includes HTTP, PHP and SQLite.
    for(let i=0;i<5;i++)await post({action:'load'});
    const samples=[];
    for(let i=0;i<30;i++){const t=performance.now();assert.equal((await post({action:'load'})).status,200);samples.push(performance.now()-t);}
    samples.sort((a,b)=>a-b);
    const metrics={kind:'localhost sequential read latency',samples:30,medianMs:(samples[14]+samples[15])/2,p95Ms:samples[28],samplesMs:samples};
    writeFileSync(join(report,'latency.json'),JSON.stringify(metrics,null,2));
    console.log('FULLSTACK_LEDGER '+JSON.stringify(metrics));
  } finally {
    if(cdp){try{await cdp.call('Browser.close');}catch{} cdp.close();}
    await stop(chrome);await stop(php);
    if(profile)rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});
    rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:150});
  }
});
