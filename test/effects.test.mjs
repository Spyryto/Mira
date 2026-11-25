import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sandbox = {AbortController, fetch};
runInNewContext(read('studio/effects.js'), sandbox);
const {createApp, jsonService} = sandbox.MiraEffects;
const flush = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
function fakeRenderer() {
  let current;
  return {renderState(view, initial) {
    let state = initial;
    view(state);
    const owner = {
      isActive: () => current === owner,
      getState: () => state,
      dispatch(transition) {
        if (!owner.isActive()) return false;
        const next = transition(state);
        view(next);
        state = next;
        return true;
      }
    };
    current = owner;
    return owner;
  }};
}
const initial = Object.freeze({id:0, count:0, status:'ready'});
function update(model, msg) {
  if (msg.type === 'load') {
    const id = model.id + 1;
    return {model:{...model,id,status:'loading'},effects:[
      {service:msg.service ?? 'remote',id,reply:'loaded',payload:{id}}
    ]};
  }
  if (msg.type === 'count') return {model:{...model,count:model.count+1},effects:[]};
  if (msg.type === 'loaded' && msg.id === model.id)
    return {model:{...model,status:msg.ok ? msg.value : msg.error},effects:[]};
  return {model,effects:[]};
}
test('effects start only after commit and replies use the latest model', async () => {
  const calls = [], errors = [];
  const renderer = fakeRenderer();
  const app = createApp(renderer,{initial,view:()=>{},update},{
    remote(payload, signal) {
      assert.equal(app.getState().status,'loading');
      return new Promise((resolve,reject)=>calls.push({payload,signal,resolve,reject}));
    }
  }, error=>errors.push(error));
  app.dispatch({type:'load'});
  assert.equal(app.getState().status,'loading');
  assert.equal(calls.length,0);
  app.dispatch({type:'count'});
  app.dispatch({type:'load'});
  await flush();
  assert.equal(calls.length,2);
  calls[1].resolve('new');
  await flush();
  calls[0].resolve('old');
  await flush();
  assert.deepEqual(plain(app.getState()),{id:2,count:1,status:'new'});
  assert.deepEqual(initial,{id:0,count:0,status:'ready'});
  app.dispatch({type:'load'});
  await flush();
  calls[2].reject(Error('offline'));
  await flush();
  assert.equal(app.getState().status,'offline');
  assert.deepEqual(errors,[]);
});
test('unknown effects and invalid views never launch; stop and remount suppress replies', async () => {
  const calls = [];
  const renderer = fakeRenderer();
  const spec = {initial,update,view:model=>{if(model.count===1)throw Error('invalid view');}};
  const services = {remote:(payload,signal)=>new Promise(resolve=>calls.push({resolve,signal}))};
  const app = createApp(renderer,spec,services);
  assert.throws(()=>app.dispatch({type:'load',service:'unknown'}),/unregistered/);
  assert.equal(app.getState(),initial);
  assert.throws(()=>app.dispatch({type:'count'}),/invalid view/);
  assert.equal(app.getState(),initial);
  app.dispatch({type:'load'});
  await flush();
  app.stop();
  assert.equal(calls[0].signal.aborted,true);
  calls[0].resolve('ignored');
  await flush();
  assert.equal(app.getState().status,'loading');
  assert.equal(app.dispatch({type:'load'}),false);
  const old = createApp(renderer,spec,services);
  old.dispatch({type:'load'});
  await flush();
  const current = createApp(renderer,spec,services);
  calls[1].resolve('late');
  await flush();
  assert.equal(current.getState(),initial);
  assert.equal(old.dispatch({type:'load'}),false);
});
test('JSON service posts only to the registered endpoint and reports HTTP errors', async () => {
  const controller = new AbortController();
  const requests=[];
  const service=jsonService('https://example.test/service',async (url, options)=>{
    requests.push({url,options});
    return {ok:true,json:async()=>({message:'hello'})};
  });
  assert.deepEqual(await service({name:'Mira'},controller.signal),{message:'hello'});
  assert.equal(requests[0].url,'https://example.test/service');
  assert.equal(requests[0].options.method,'POST');
  assert.equal(requests[0].options.body,'{"name":"Mira"}');
  assert.equal(requests[0].options.credentials,'omit');
  assert.equal(requests[0].options.signal,controller.signal);
  const failure=jsonService('https://example.test/service',async()=>({ok:false,status:503}));
  await assert.rejects(failure({},controller.signal),/HTTP 503/);
});
test('Mira transition and effect descriptions execute identically on JS and PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-effects-'));
  try {
    const source=read('studio/effects-demo.mira').split('view: model =')[0].replace('import "lib/gui.mira";','')+
      '\ninitial = {request: 0, count: 0, status: "Pronto"};\n'+
      'loading = transition: initial, message: {type: "load", fail: false};\n'+
      'counted = transition: (loading ~ model), message: {type: "increment"};\n'+
      'stale = transition: (counted ~ model), message: {type: "loaded", id: 0, ok: true, value: {message: "old"}};\n'+
      'done = transition: (stale ~ model), message: {type: "loaded", id: 1, ok: true, value: {message: "new"}};\n'+
      'result = {initial: initial, loading: loading, done: done};\n';
    const input=join(dir,'program.mira');
    writeFileSync(input,source);
    const cli=fileURLToPath(new URL('../dist/mira.cjs',import.meta.url));
    const results=[];
    for(const target of ['js','php']){
      const compiled=execFileSync('node',[cli,input,target],{encoding:'utf8'});
      const path=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(path,compiled+(target==='js'?'\nconsole.log(JSON.stringify(result));':'\necho json_encode($result);'));
      results.push(JSON.parse(execFileSync(target==='js'?'node':'php',[path],{encoding:'utf8'})));
    }
    assert.deepEqual(results[0],results[1]);
    assert.deepEqual(results[0].initial,{request:0,count:0,status:'Pronto'});
    assert.deepEqual(results[0].loading.effects,[{service:'greeting',id:1,reply:'loaded',payload:{fail:false,request:1}}]);
    assert.deepEqual(results[0].done,{model:{request:1,count:1,status:'new'},effects:[]});
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('real HTTP round trip to a Mira service compiled to PHP', {timeout:15000}, async()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-http-'));
  let php;
  try {
    const source=fileURLToPath(new URL('../examples/greeting-service.mira',import.meta.url));
    const cli=fileURLToPath(new URL('../dist/mira.cjs',import.meta.url));
    writeFileSync(join(dir,'greeting-program.php'),execFileSync('node',[cli,source,'php'],{encoding:'utf8'}));
    writeFileSync(join(dir,'greeting.php'),read('examples/php/greeting.php'));
    const {createServer}=await import('node:net');
    const probe=createServer();
    await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
    const port=probe.address().port;
    await new Promise(resolve=>probe.close(resolve));
    const {spawn}=await import('node:child_process');
    php=spawn('php',['-S','127.0.0.1:'+port,'-t',dir],{stdio:'ignore'});
    let spawnError;
    php.on('error',error=>{spawnError=error;});
    const url='http://127.0.0.1:'+port+'/greeting.php';
    let ready=false;
    for(let n=0;n<50;n++){
      if(spawnError)throw spawnError;
      if(php.exitCode!==null)throw Error('PHP server exited');
      try {const response=await fetch(url,{signal:AbortSignal.timeout(500)});ready=response.status===405;if(ready)break;}catch{}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.ok(ready,'PHP server not ready');
    const handler=jsonService(url);
    const result=await handler({id:7,name:'Mira'},AbortSignal.timeout(2000));
    assert.deepEqual(result,{id:7,message:'Mira'});
    await assert.rejects(handler({id:'bad',name:'Mira'},AbortSignal.timeout(2000)),/HTTP 400/);
    // The same HTTP capability can be driven by the app runtime.
    const renderer=fakeRenderer();
    const done=new Promise((resolve,reject)=>{
      const app=createApp(renderer,{initial:{status:'ready'},view:()=>{},update(model,msg){
        if(msg.type==='load')return {model:{status:'loading'},effects:[{
          service:'php',id:9,reply:'reply',payload:{id:9,name:'Mira via PHP'}
        }]};
        if(!msg.ok){reject(Error(msg.error));return {model,effects:[]};}
        resolve(msg.value);
        return {model:{status:msg.value.message},effects:[]};
      }},{php:handler},reject);
      app.dispatch({type:'load'});
    });
    assert.deepEqual(plain(await done),{id:9,message:'Mira via PHP'});
  } finally {
    if(php && php.exitCode===null && php.pid){
      const closed=new Promise(resolve=>php.once('close',resolve));
      php.kill(); await closed;
    }
    rmSync(dir,{recursive:true,force:true});
  }
});

test('RPC capabilities fix the method and enforce the portable wire subset',async()=>{
  const calls=[];
  const context={AbortController,TextEncoder};
  runInNewContext(read('studio/effects.js'),context);
  const {rpcService}=context.MiraEffects;
  const controller=new AbortController();
  const service=rpcService('/rpc','ledger.quote',async(url,options)=>{
    calls.push({url,options});
    return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,value:{hours:2,total:60,items:[]}})};
  });
  assert.deepEqual(plain(await service({hours:2},controller.signal)),{hours:2,total:60,items:[]});
  assert.equal(calls[0].url,'/rpc');
  assert.deepEqual(JSON.parse(calls[0].options.body),{method:'ledger.quote',params:{hours:2}});
  assert.equal(calls[0].options.signal,controller.signal);
  assert.equal(calls[0].options.credentials,'omit');
  for(const invalid of [{},{'01':2},{x:()=>0},{x:Infinity},{x:9007199254740992}]){
    await assert.rejects(service(invalid,controller.signal),/Nonportable/);
  }
  assert.equal(calls.length,1);
  const failure=rpcService('/rpc','ledger.quote',async()=>({ok:false,status:409,text:async()=>'{"ok":false,"error":{"code":"revision_conflict"}}'}));
  await assert.rejects(failure({hours:2},controller.signal),/HTTP 409: revision_conflict/);
  const broken=rpcService('/rpc','ledger.quote',async()=>({ok:true,status:200,text:async()=>'{"ok":true}'}));
  await assert.rejects(broken({hours:2},controller.signal),/Invalid RPC response/);
});
