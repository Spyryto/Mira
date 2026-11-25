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

test('two-parameter reducer blocks execute identically on JavaScript and PHP',()=>{
  const cases = [
    ['numbers = [1,2,3,4]; result = fold: numbers, with: ({total, item | total + item}), from: 0;',10],
    ['numbers = [1,2,3]; result = fold: numbers, with: ({a running total, each item | a running total + each item}), from: 5;',11],
    ['multiplier = 2; numbers = [1,2,3]; result = fold: numbers, with: ({sum, item | sum + (item * multiplier)}), from: 0;',12],
    ['numbers = [1,2,3]; result = fold: numbers, with: ({_, item | _ + item}), from: 0;',6],
    ['numbers = [1,2,3]; reducer = {total, item | total + item}; result = fold: numbers, with: (reducer), from: 0;',6],
    ['numbers = []; result = fold: numbers, with: ({total, item | total + item}), from: 9;',9]
  ];
  for (const [source, expected] of cases) {
    const js=compiler.compile(source,'js',hostJson);
    const php=compiler.compile(source,'php',hostJson);
    assert.equal(js.ok,true,js.message+' / JS '+source);
    assert.equal(php.ok,true,php.message+' / PHP '+source);
    const actualJs=new Function('__miraHost',js.output+'\nreturn result;')(collectionHost());
    assert.equal(actualJs,expected,'JS '+source);
    assert.equal(runPhp(php.output),expected,'PHP '+source);
  }
});

test('unwrapped reducer blocks preserve nested punctuation and selector boundaries on JS/PHP',()=>{
  const exact = \`lessons = [
  {hours: 2, rate: 30},
  {hours: 1.5, rate: 40}
];

result = fold: lessons,
  with: {total, lesson |
    total + (lesson ~ hours * lesson ~ rate)
  },
  from: 0;\`;
  const cases=[
    [exact,120],
    ['numbers = [1,2,3,4]; result = fold: numbers, with: {total, item | total + item}, from: 0;',10],
    ['numbers = [1,2,3]; result = fold: numbers with {total, item | total + item} from 0;',6],
    ['numbers = [1,2,3]; result = fold: numbers, with: ({total, item | total + item}), from: 0;',6],
    ['numbers = [1,2,3]; result = collect: numbers, with: {_ | _ * 2};', [2,4,6]],
    ['numbers = [1,2,3]; result = select: numbers, if: {_ | _ >= 2};', [2,3]],
    ['numbers = [1,2]; result = collect: numbers, with: {_ | if (_ > 1) then ({result: _} ~ result) else 0};', [0,2]]
  ];
  for (const [source, expected] of cases) {
    const js=compiler.compile(source,'js',hostJson);
    const php=compiler.compile(source,'php',hostJson);
    assert.equal(js.ok,true,js.message+' / JS '+source);
    assert.equal(php.ok,true,php.message+' / PHP '+source);
    const actualJs=new Function('__miraHost',js.output+'\nreturn result;')(collectionHost());
    assert.deepEqual(actualJs,expected,'JS '+source);
    assert.deepEqual(runPhp(php.output),expected,'PHP '+source);
  }
});
