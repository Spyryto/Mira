import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {collectionHost} from '../studio/collection-host.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const hostJson=readFileSync(resolve(root,'studio/host.json'),'utf8');
const browser={};
runInNewContext(readFileSync(resolve(root,'dist/studio/compiler.js'),'utf8'),browser);
const compiler=browser.MiraStudioCompiler;

function runPhp(code) {
  const dir=mkdtempSync(join(tmpdir(),'mira-alias-'));
  try {
    const php=code.replace(/^<\?php\s*declare\(strict_types=1\);\s*/,'');
    const adapter=JSON.stringify(resolve(root,'test/fixtures/CollectionHost.php'));
    const path=join(dir,'program.php');
    writeFileSync(path,'<?php\n declare(strict_types=1);\nrequire_once '+
      adapter+';\n$GLOBALS["__miraHost"]=makeCollectionHost();\n'+php+
      '\necho json_encode($result);\n');
    const child=spawnSync('php',[path],{encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);
    return JSON.parse(child.stdout);
  } finally { rmSync(dir,{recursive:true,force:true}); }
}

test('collection aliases compile and execute identically in JS/PHP',()=>{
  for(const [selector,expected] of [
    ['filter: numbers, with: (_ >= 2)',[2,3]],
    ['select: numbers, with: (_ >= 2)',[2,3]],
    ['select: numbers, if: (_ >= 2)',[2,3]],
    ['collect: numbers, if: (_ >= 2)',[2,3]],
    ['map: numbers, with: (_ * 2)',[2,4,6]],
    ['collect: numbers, with: (_ * 2)',[2,4,6]]
  ]) {
    const source='numbers = [1,2,3]; result = '+selector+';';
    const js=compiler.compile(source,'js',hostJson);
    const php=compiler.compile(source,'php',hostJson);
    assert.equal(js.ok,true,js.message);
    assert.equal(php.ok,true,php.message);
    const actualJs=new Function('__miraHost',js.output+'\nreturn result;')(collectionHost());
    assert.deepEqual(actualJs,expected,selector+' JS');
    assert.deepEqual(runPhp(php.output),expected,selector+' PHP');
  }
});

test('collection aliases share the bounded-list validation and are not built-ins',()=>{
  const host=collectionHost();
  assert.equal(host['collect:if:'],host['filter:with:']);
  assert.equal(host['select:with:'],host['filter:with:']);
  assert.equal(host['select:if:'],host['filter:with:']);
  assert.equal(host['collect:with:'],host['map:with:']);
  assert.throws(()=>host['collect:if:']('not a list',()=>true),/bounded list/);
  assert.throws(()=>host['collect:with:'](Array(10001).fill(0),x=>x),/bounded list/);
  const missing=compiler.compile(
    'result = collect: [1,2], if: (_ > 1);','js');
  assert.equal(missing.ok,false);
});
