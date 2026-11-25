import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const compiler=fileURLToPath(new URL('../dist/mira.cjs',import.meta.url));

test('CLI imports transitive files once from entry directory and executes both targets',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-modules-'));
  try{
    mkdirSync(join(dir,'lib'));
    writeFileSync(join(dir,'lib/rate.mira'),'rate = 30;');
    writeFileSync(join(dir,'lib/fees.mira'),'import "lib/rate.mira"; fee: n = n * rate;');
    writeFileSync(join(dir,'app.mira'),'import "lib/fees.mira"; import "lib/rate.mira"; result = fee: 2;');
    for(const target of ['js','php']){
      const compiled=spawnSync('node',[compiler,join(dir,'app.mira'),target,'--locations'],{encoding:'utf8',cwd:tmpdir()});
      assert.equal(compiled.status,0,compiled.stderr);
      const {output,locations}=JSON.parse(compiled.stdout);
      assert.equal(locations.filter(l=>l.name==='rate').length,1);
      assert.equal(locations.find(l=>l.name==='rate').file,'lib/rate.mira');
      const actual=target==='js'?spawnSync('node',['-e',output+'\nconsole.log(result);'],{encoding:'utf8'}):
        spawnSync('php',['-r',output.replace(/^<\?php/,'')+'\necho $result;'],{encoding:'utf8'});
      assert.equal(actual.status,0,actual.stderr);assert.equal(actual.stdout.trim(),'60');
    }
    writeFileSync(join(dir,'lib/rate.mira'),'import "app.mira"; rate = 30;');
    const cycle=spawnSync('node',[compiler,join(dir,'app.mira'),'js'],{encoding:'utf8'});
    assert.notEqual(cycle.status,0);assert.match(cycle.stderr,/Import cycle: app\.mira -> lib\/fees\.mira -> lib\/rate\.mira -> app\.mira/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
