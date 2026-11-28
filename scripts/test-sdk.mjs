import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mira-sdk-test-'));
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const bundle=path.resolve('dist/sdk/mira-sdk.json');
const call=(bin,args,env=process.env)=>{const r=spawnSync(bin,args,{encoding:'utf8',env});assert.equal(r.status,0,r.stderr+'\n'+r.stdout);return r.stdout;};
try{
  // Differential compiler output, independent of the bootstrap.
  for(const file of ['examples/arithmetic.mira','sdk/quickstart/hello.mira']){
    for(const target of ['js','php']){
      const args=[file,target,...(file.includes('hello')?['--host','sdk/console-host.json']:[])];
      assert.equal(call('php',['dist/compiler-php/index.php',...args]).replace(/\r\n/g,'\n'),call(process.execPath,['dist/mira.cjs',...args]).replace(/\r\n/g,'\n'));
    }
  }
  for(const [bin,script] of [[process.execPath,'dist/sdk/mira.js'],['php','dist/sdk/mira.php']]){
    const home=path.join(tmp,path.basename(script));const env={...process.env,MIRA_HOME:home,MIRA_VERSION:version};
    call(bin,[script,'install',bundle],env);
    const quick=path.join(home,'versions',version,'quickstart');
    for(const target of ['js','php'])assert.match(call(bin,[script,'run',path.join(quick,'hello.mira'),target],env),/150\s*$/);
    const site=path.join(home,'site');
    call(bin,[script,'web',path.join(quick,'counter.mira'),site],env);
    assert.match(fs.readFileSync(path.join(site,'app.js'),'utf8'),/Mira counter/);
    call(process.execPath,['--check',path.join(site,'app.js')],env);
    assert.ok(fs.existsSync(path.join(site,'ui-host.js')));
  }
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
