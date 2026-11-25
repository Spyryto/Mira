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
  assert.deepEqual(check('n = 42; s = "hello"; b = true; xs = [1, 2]; r = {name: s, age: n}; result = if (b) then n else 0;'),
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
    ['x = if (1) then 2 else 3;',/expected Boolean, got Number/],
    ['x = if (true) then 2 else "no";',/expected Number, got Text/],
    ['xs = [1, "x"];',/expected Number, got Text/],
    ['f: x = x ~ name; result = f: {age: 2};',/missing record field name/],
    ['xs = select: [1, 2], with: {x | x + 1};',/expected Boolean, got Number/],
    ['x = x;',/recursive value dependency not supported/],
    ['f: x = x >> x;',/infinite type/],
    ['x = 2;\ny = x + "a";',/at 2:7/]
  ])assert.throws(()=>check(source),pattern,source);
  assert.throws(()=>check('log 1;',{callables:['log']}),/host type signature required/);
});

test('types: direct and mutual recursion are inferred before generalization',()=>{
  const result=check('factorial: n = if (n <= 1) then 1 else (n * (factorial: (n - 1))); even: n = if (n <= 0) then true else (odd: (n - 1)); odd: n = if (n <= 0) then false else (even: (n - 1)); x = factorial: 5; y = even: 6;');
  assert.equal(result['factorial:'],'(Number) -> Number');
  assert.equal(result['even:'],'(Number) -> Boolean');
  assert.equal(result['odd:'],'(Number) -> Boolean');
  assert.equal(result.x,'Number');assert.equal(result.y,'Boolean');
  assert.throws(()=>check('bad: x = if (true) then (bad: 1) else (bad: "x");'),/expected Number, got Text|expected Text, got Number/);
  assert.throws(()=>check('a = b; b = a;'),/recursive value dependency not supported/);
});
test('types: dependencies respect lexical shadowing and source order',()=>{
  const result=check('a = identity: "hello"; identity: x = x; f: a = a; n = f: 42;');
  assert.equal(result.a,'Text');assert.equal(result.n,'Number');
  assert.equal(result['f:'],"('a) -> 'a");
});
test('types: structural projections are stable under deterministic field permutations',()=>{
  const pairs=['a: 1','b: 2','extra: true'];
  const orders=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for(const order of orders){
    const record=order.map(i=>pairs[i]).join(', ');
    const result=check('sum fields: r = r ~ a + r ~ b; result = sum fields: {'+record+'};');
    assert.equal(result['sum fields:'],"({a: Number, b: Number | 'a}) -> Number");
    assert.equal(result.result,'Number');
  }
  assert.throws(()=>check('sum fields: r = r ~ a + r ~ b; result = sum fields: {a: 1, extra: true};'),/missing record field b/);
  assert.throws(()=>check('sum fields: r = r ~ a + r ~ b; result = sum fields: {a: 1, b: "x"};'),/expected Number, got Text|expected Text, got Number/);
});

test('types: immutable local identity and projection can be polymorphic',()=>{
  const result=check('result = () >> {| id = {x | x}; get = {x | x ~ name}; {a: (1 >> id), b: ("x" >> id), c: ({name: true, age: 2} >> get), d: ({name: 7} >> get)}};');
  assert.equal(result.result,'{a: Number, b: Text, c: Boolean, d: Number}');
});
test('types: local generalization never quantifies captured variables',()=>{
  const result=check('make: x = () >> {| get = {y | x}; {a: (1 >> get), b: ("x" >> get)}}; result = make: true;');
  assert.equal(result['make:'],"('a) -> {a: 'a, b: 'a}");
  assert.equal(result.result,'{a: Boolean, b: Boolean}');
  assert.throws(()=>check('bad: f = () >> {| alias = f; a = 1 >> alias; "x" >> alias};'),/expected Number, got Text|expected Text, got Number/);
  assert.throws(()=>check('bad: x = () >> {| get = {y | x}; a = (1 >> get) + 2; if ("x" >> get) then a else 0};'),/expected Boolean, got Number|expected Number, got Boolean/);
});
test('types: computed locals remain monomorphic under the value restriction',()=>{
  assert.throws(()=>check('result = () >> {| id = () >> {| {x | x}}; a = 1 >> id; "x" >> id};'),/expected Number, got Text|expected Text, got Number/);
});
test('types: open record updates replace fields without losing the remaining row',()=>{
  const result=check('rename: r = update: r, with: {name: "Ada"}; a = rename: {name: 1, age: 20}; b = rename: {name: true, active: false}; bump: r = update: r, with: {hours: (r ~ hours + 1)}; c = bump: {hours: 2, paid: false};');
  assert.equal(result['rename:'],"({name: 'a | 'b}) -> {name: Text | 'b}");
  assert.equal(result.a,'{age: Number, name: Text}');
  assert.equal(result.b,'{active: Boolean, name: Text}');
  assert.equal(result['bump:'],"({hours: Number | 'a}) -> {hours: Number | 'a}");
  assert.equal(result.c,'{hours: Number, paid: Boolean}');
  assert.throws(()=>check('rename: r = update: r, with: {name: "Ada"}; a = rename: {age: 20};'),/missing record field name/);
  assert.throws(()=>check('bump: r = update: r, with: {hours: (r ~ hours + 1)}; a = bump: {hours: "x"};'),/expected Number, got Text|expected Text, got Number/);
});
test('types: multi-field open updates retain the untouched fields',()=>{
  const result=check('change: r = update: r, with: {a: "x", b: false}; result = change: {a: 1, b: 2, c: true};');
  assert.equal(result.result,'{a: Text, b: Boolean, c: Boolean}');
  assert.throws(()=>check('change: r = update: r, with: {a: "x", b: false}; result = change: {a: 1, c: true};'),/missing record field b/);
});

test('types: scalar equality is inferred and instantiated independently',()=>{
  const result=check('same: a, as: b = a == b; different: a, from: b = a != b; n = same: 2, as: 2; t = same: "a", as: "b"; b = different: true, from: false;');
  assert.equal(result['same:as:'],"('a, 'a) -> Boolean where 'a: ScalarEq");
  assert.equal(result['different:from:'],"('a, 'a) -> Boolean where 'a: ScalarEq");
  for(const name of ['n','t','b'])assert.equal(result[name],'Boolean');
});
test('types: equality constraints survive local and higher-order instantiation',()=>{
  const result=check('same: a, as: b = a == b; compare: f = {x | f x}; lifted = compare: {x | same: x, as: x}; local = () >> {| eq = {x | x == x}; {number: (1 >> eq), text: ("a" >> eq), flag: (true >> eq)}};');
  assert.equal(result.lifted,"('a) -> Boolean where 'a: ScalarEq");
  assert.equal(result.local,'{flag: Boolean, number: Boolean, text: Boolean}');
  assert.throws(()=>check('same: a, as: b = a == b; compare: f = {x | f x}; lifted = compare: {x | same: x, as: x}; bad = [1] >> lifted;'),/ScalarEq requires/);
  assert.throws(()=>check('bad = () >> {| eq = {x | x == x}; [1] >> eq};'),/ScalarEq requires/);
});
test('types: constrained record fields and captured variables retain their restrictions',()=>{
  const result=check('same field: r, as: s = r ~ value == s ~ value; n = same field: {value: 1, extra: true}, as: {value: 2}; s = same field: {value: "x"}, as: {value: "y"}; capture: x = {y | x == y};');
  assert.equal(result['same field:as:'],"({value: 'a | 'b}, {value: 'a | 'c}) -> Boolean where 'a: ScalarEq");
  assert.equal(result['capture:'],"('a) -> ('a) -> Boolean where 'a: ScalarEq");
  assert.throws(()=>check('same field: r, as: s = r ~ value == s ~ value; bad = same field: {value: [1]}, as: {value: [2]};'),/ScalarEq requires/);
  assert.throws(()=>check('bad: x = () >> {| eq = {y | x == y}; first = 1 >> eq; "a" >> eq};'),/expected Number, got Text|expected Text, got Number/);
});
test('types: scalar predicates reject incompatible types regardless of alias direction',()=>{
  for(const source of [
    'same: a, as: b = a == b; x = same: 1, as: "a";',
    'same: a, as: b = a == b; x = same: [1], as: [2];',
    'same: a, as: b = a == b; x = same: {a: 1}, as: {a: 2};',
    'same: a, as: b = a == b; x = same: {x | x}, as: {y | y};',
    'bad: x = () >> {| a = x == x; x ~ name};',
    'bad: x = () >> {| a = x ~ name; x == x};'
  ])assert.throws(()=>check(source),/ScalarEq requires|expected Number, got Text|expected Text, got Number/);
});
test('types: scalar constraints resolve through arithmetic and recursive groups',()=>{
  const result=check('positive: x = if (x == x) then (x + 1) else 0; first: x, with: y = if (x == y) then true else (second: y, with: x); second: x, with: y = first: y, with: x; n = first: 1, with: 1;');
  assert.equal(result['positive:'],'(Number) -> Number');
  assert.equal(result['first:with:'],"('a, 'a) -> Boolean where 'a: ScalarEq");
  assert.equal(result['second:with:'],"('a, 'a) -> Boolean where 'a: ScalarEq");
  assert.equal(result.n,'Boolean');
});

test('types: CLI reports expression anchors with machine-readable token ranges',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-diagnostics-'));
  try {
    const input=join(dir,'program.mira');
    const cases=[
      ['x = 1;\ny = x + "a";',2,7,8],
      ['x = [1, "a"];',1,9,12],
      ['x = if (1) then 2 else 3;',1,9,10],
      ['x = if (true) then 1 else "a";',1,27,30],
      ['x = {a: 1} ~ missing;',1,14,21],
      ['x = () >> {|\n  a = 2;\n  a + "x"\n};',3,5,6],
      ['f: x = x;\ny = f: (1 + "a");',2,11,12],
      ['f = (_ + "a");',1,8,9],
      ['a = 1 + 2;\nb = 1 + "x";',2,7,8]
    ];
    for(const [source,line,column,endColumn] of cases){
      writeFileSync(input,source);
      const r=spawnSync('node',['dist/mira.cjs',input,'--check-json'],{encoding:'utf8'});
      assert.equal(r.status,1,source+' '+r.stderr);
      const report=JSON.parse(r.stdout);
      assert.equal(report.ok,false);
      const d=report.diagnostics[0];
      assert.equal(d.code,'type_error');
      assert.deepEqual([d.line,d.column,d.endLine,d.endColumn],[line,column,line,endColumn],source);
    }
    writeFileSync(input,'import "bad.mira";\nx = 1;');
    writeFileSync(join(dir,'bad.mira'),'f: x = x + "a";');
    let r=spawnSync('node',['dist/mira.cjs',input,'--check-json'],{encoding:'utf8'});
    assert.equal(r.status,1);
    const imported=JSON.parse(r.stdout).diagnostics[0];
    assert.equal(imported.file,'bad.mira');assert.equal(imported.column,10);
    writeFileSync(input,'x = 1;');
    r=spawnSync('node',['dist/mira.cjs',input,'--check-json'],{encoding:'utf8'});
    assert.equal(r.status,0);
    assert.equal(JSON.parse(r.stdout).types[0].type,'Number');
    assert.deepEqual(JSON.parse(r.stdout).diagnostics,[]);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

const typedHost={
  values:['rate','lesson'],
  callables:['format','apply callback','zero'],
  selectors:['multiply:by:'],
  types:{
    rate:'Number',lesson:{record:{hours:'Number',name:'Text'}},
    format:{parameters:['Number'],result:'Text'},
    'apply callback':{parameters:[{parameters:['Number'],result:'Number'}],result:'Number'},
    zero:{parameters:[],result:'Number'},
    'multiply:by:':{parameters:['Number','Number'],result:'Number'}
  }
};
test('types: host values, callables, selectors, sections and callbacks reuse normal inference',()=>{
  const result=check('quote: x = multiply: x, by: rate; amount = quote: (lesson ~ hours); label = format amount; triple = (multiply: _, by: 3); n = 2 >> triple; callback = apply callback {x | x + 1}; z = () >> zero;',typedHost);
  assert.equal(result['quote:'],'(Number) -> Number');
  assert.equal(result.amount,'Number');assert.equal(result.label,'Text');
  assert.equal(result.triple,'(Number) -> Number');assert.equal(result.n,'Number');
  assert.equal(result.callback,'Number');assert.equal(result.z,'Number');
});
test('types: typed host errors are rejected at call sites; untyped hosts remain explicit',()=>{
  for(const [source,pattern] of [
    ['x = format "x";',/expected Number, got Text/],
    ['x = multiply: 2, by: "x";',/expected Number, got Text/],
    ['x = apply callback {x | "x"};',/expected Number, got Text/],
    ['x = lesson ~ missing;',/missing record field missing/],
    ['x = zero 1;',/function arity mismatch/],
    ['x = format rate; y = format true;',/expected Number, got Boolean/]
  ])assert.throws(()=>check(source,typedHost),pattern,source);
  assert.throws(()=>check('x = log 1;',{callables:['log']}),/host type signature required/);
  assert.throws(()=>check('x = hidden 1;',{types:{hidden:{parameters:['Number'],result:'Number'}}}),/name is not registered/);
});
test('types: malformed host manifests are rejected before inference',()=>{
  const invalid=[
    {values:['x'],types:{x:'Dynamic'}},
    {values:['x'],types:{x:{list:'Number',extra:true}}},
    {values:['x'],types:{x:{record:[]}}},
    {values:['x'],types:{x:{parameters:'Number',result:'Text'}}},
    {callables:['x'],types:{x:'Number'}},
    {selectors:['f:with:'],types:{'f:with:':{parameters:['Number'],result:'Number'}}},
    {types:[]}
  ];
  for(const manifest of invalid)assert.throws(()=>check('x1 = 1;',manifest),/Host type/);
});
test('types: same host contract checks and executes with actual JavaScript and PHP hosts',()=>{
  const source='quote: x = multiply: x, by: rate; result = format (quote: (lesson ~ hours));';
  assert.equal(check(source,typedHost).result,'Text');
  const dir=mkdtempSync(join(tmpdir(),'mira-typed-host-'));
  try{
    const input=join(dir,'program.mira'),manifest=join(dir,'host.json');
    writeFileSync(input,source);writeFileSync(manifest,JSON.stringify(typedHost));
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--host',manifest],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const program=join(dir,target==='js'?'program.mjs':'program.php');
      const entry=target==='js'?
        'const __miraHost = {rate:30,lesson:{hours:2,name:"Ada"}, "multiply:by:":(x,y)=>x*y, format:x=>String(x)};\n'+r.stdout+'\nconsole.log(result);':
        r.stdout.replace('declare(strict_types=1);','declare(strict_types=1);\n$GLOBALS["__miraHost"] = ["rate"=>30,"lesson"=>["hours"=>2,"name"=>"Ada"],"multiply:by:"=>fn($x,$y)=>$x*$y,"format"=>fn($x)=>(string)$x];')+'\necho $result, "\\n";';
      writeFileSync(program,entry);
      const executed=spawnSync(target==='js'?'node':'php',[program],{encoding:'utf8'});
      assert.equal(executed.status,0,executed.stderr);assert.equal(executed.stdout.trim(),'60');
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
