import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>readFileSync(resolve(root,'dist/studio',file),'utf8');

function runWorker(code, times=[100,100.125], invoke=undefined) {
  let reply;
  let index=0;
  const context={
    performance:{now:()=>times[Math.min(index++,times.length-1)]},
    self:{postMessage:message=>{reply=message;}}
  };
  runInNewContext(read('worker.js'),context);
  context.self.onmessage({data:{code,invoke}});
  return reply;
}

test('worker reports execution time separate from JavaScript function construction',()=>{
  const result=runWorker('const result = 2 + 3;', [100,100.125]);
  assert.equal(result.ok,true);
  assert.equal(result.output,'5');
  assert.equal(result.executionMs,0.125);
});

test('worker measures invoked Mira function body and preserves result',()=>{
  const result=runWorker('const twice = x=>x*2;', [9,9.25],
    {name:'twice',args:[4]});
  assert.equal(result.ok,true);
  assert.equal(result.output,'8');
  assert.equal(result.executionMs,0.25);
});

test('worker reports failed execution duration, but not a parse-time duration',()=>{
  const failure=runWorker('throw new Error("boom");',[50,50.5]);
  assert.equal(failure.ok,false);
  assert.match(failure.message,/boom/);
  assert.equal(failure.executionMs,0.5);
  const invalid=runWorker('const = ;');
  assert.equal(invalid.ok,false);
  assert.equal(invalid.executionMs,undefined);
});

test('UI status switches from compilation to execution time after Esegui',()=>{
  const app=read('app.js');
  assert.match(app,/setStatus\('ready', 'Compilazione riuscita'/);
  assert.match(app,/setStatus\('busy', 'Esecuzione JavaScript…'\)/);
  assert.match(app,/event\.data\?\.ok \? 'Esecuzione riuscita'/);
  assert.match(app,/formatExecutionTime\(event\.data\?\.executionMs\)/);
  assert.match(app,/Esec\. < 0\.001 ms/);
  assert.match(app,/Limite 2 s/);
});
