import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
function check(source,host){
  const dir=mkdtempSync(join(tmpdir(),'mira-types-'));
  try {
    const input=join(dir,'program.mira');
    writeFileSync(input,source);
    const args=['dist/mira.cjs',input,'--check'];
    if(host){const path=join(dir,'host.json');writeFileSync(path,JSON.stringify(host));args.push('--host',path);}
    const r=spawnSync('node',args,{encoding:'utf8'});
    if(r.status!==0)throw Error(r.stderr);
    return Object.fromEntries(JSON.parse(r.stdout).map(x=>[x.name,x.type]));
  } finally {rmSync(dir,{recursive:true,force:true});}
}
test('types: literals, records, homogeneous lists, conditionals',()=>{
  assert.deepEqual(check('n = 42; s = "hello"; b = true; xs = [1, 2]; r = {name: s, age: n}; result = if b then n else 0;'),
    {n:'Number',s:'Text',b:'Boolean',xs:'[Number]',r:'{age: Number, name: Text}',result:'Number'});
});
test('types: top-level polymorphism and open structural field access',()=>{
  const result=check('identity: x = x; name of: x = x ~ name; a = identity: 42; b = identity: "ok"; c = name of: {name: "Ada", age: 2}; d = name of: {name: 9};');
  assert.equal(result['identity:'],"('a) -> 'a");
  assert.equal(result['name of:'],"({name: 'a | 'b}) -> 'a");
  assert.equal(result.a,'Number');assert.equal(result.b,'Text');assert.equal(result.c,'Text');assert.equal(result.d,'Number');
});
test('types: multiple fields on the same structural row and closure capture',()=>{
  const result=check('sum fields: x = x ~ a + x ~ b; r = sum fields: {a: 2, b: 3, extra: true}; make: x = {y | x + y}; f = make: 3; y = 2 >> f;');
  assert.equal(result['sum fields:'],"({a: Number, b: Number | 'a}) -> Number");
  assert.equal(result.r,'Number');assert.equal(result.y,'Number');
});
test('types: sections, collection map and fold, immutable closed update',()=>{
  const result=check('xs = [1, 2]; ys = collect: xs, with: {x | x + 1}; sum = fold: ys, with: {acc, x | acc + x}, from: 0; inc = (_ + 1); n = 2 >> inc; r = update: {a: 1}, with: {a: "x", b: true};');
  assert.equal(result.ys,'[Number]');assert.equal(result.sum,'Number');assert.equal(result.n,'Number');assert.equal(result.r,'{a: Text, b: Boolean}');
});
test('types: invalid programs are rejected, not coerced',()=>{
  for(const [source,pattern] of [
    ['n = 1 + "x";',/expected Number, got Text/],
    ['x = if 1 then 2 else 3;',/expected Boolean, got Number/],
    ['x = if true then 2 else "no";',/expected Number, got Text/],
    ['xs = [1, "x"];',/expected Number, got Text/],
    ['f: x = x ~ name; result = f: {age: 2};',/missing record field name/],
    ['xs = select: [1, 2], with: {x | x + 1};',/expected Boolean, got Number/],
    ['f: x = f: x;',/recursive dependency not supported/],
    ['f: x = x >> x;',/infinite type/],
    ['x = 2;\ny = x + "a";',/at 2:1/]
  ])assert.throws(()=>check(source),pattern,source);
  assert.throws(()=>check('log 1;',{callables:['log']}),/host type signature required/);
});
