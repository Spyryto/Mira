import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mira-browser-sdk-'));
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const bundle=path.resolve('dist/sdk/mira-sdk.json');
const browser=await chromium.launch();
async function freePort(){
  const server=net.createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));return port;
}
async function stop(child){
  if(child.exitCode!==null||child.signalCode!==null)return;
  const exit=new Promise(resolve=>child.once('exit',resolve));
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F']);
  else try{process.kill(-child.pid,'SIGTERM');}catch{}
  await Promise.race([exit,new Promise(resolve=>setTimeout(resolve,3000))]);
  if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
}
try{
  for(const [bin,script] of [[process.execPath,'dist/sdk/mira.js'],['php','dist/sdk/mira.php']]){
    const home=path.join(tmp,path.basename(script));const env={...process.env,MIRA_HOME:home,MIRA_VERSION:version};
    const install=spawnSync(bin,[script,'install',bundle],{env,encoding:'utf8'});
    assert.equal(install.status,0,install.stderr);
    const source=path.join(home,'versions',version,'quickstart','counter.mira');
    const port=await freePort(), url='http://127.0.0.1:'+port+'/';
    const child=spawn(bin,[script,'serve',source,String(port)],{env,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
    let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
    let page;
    try{
      let ready=false;
      for(let i=0;i<100;i++){
        if(child.exitCode!==null)throw Error(logs);
        try{ready=(await fetch(url,{signal:AbortSignal.timeout(500)})).ok;}catch{}
        if(ready)break;await new Promise(r=>setTimeout(r,100));
      }
      assert.ok(ready,logs);
      page=await browser.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);
      await page.getByText('Mira counter',{exact:true}).waitFor();
      const button=page.getByRole('button',{name:'+1',exact:true});
      await page.getByText('0',{exact:true}).waitFor();
      await button.click();
      await page.getByText('1',{exact:true}).waitFor();
      await button.click();
      await page.getByText('2',{exact:true}).waitFor();
      assert.equal(await page.locator('#error').textContent(),'');
      assert.deepEqual(errors,[]);
      assert.equal((await fetch(url+'../README.md')).status,404);
      console.log(script+': actual browser counter 0 -> 1 -> 2');
    }finally{if(page)await page.close();await stop(child);}
  }
}finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
