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
