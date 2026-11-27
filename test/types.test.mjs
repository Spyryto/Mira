import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
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

test('types: structured schemas preserve variables, constraints and open rows',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-schema-'));
  try{
    const input=join(dir,'program.mira');
    const source='same: a, as: b = a == b; name of: r = r ~ name; a = {z: true, a: [1]};';
    writeFileSync(input,source);
    const read=()=>JSON.parse(spawnSync('node',['dist/mira.cjs',input,'--check'],{encoding:'utf8'}).stdout);
    const report=read();
    assert.deepEqual(read(),report);
    const v=(id,scalarEq=false,row=false,lacks=[])=>({kind:'Variable',id,scalarEq,row,lacks});
    assert.deepEqual(report[0].schema,{kind:'Function',parameters:[v(0,true),v(0,true)],result:{kind:'Boolean'}});
    assert.deepEqual(report[1].schema,{kind:'Function',parameters:[{kind:'Record',fields:[{name:'name',type:v(0)}],tail:v(1,false,true,['name'])}],result:v(0)});
    assert.deepEqual(report[2].schema,{kind:'Record',fields:[{name:'a',type:{kind:'List',item:{kind:'Number'}}},{name:'z',type:{kind:'Boolean'}}],tail:null});
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: optional annotations constrain parameters, values and results before generalization',()=>{
  const source='rate (Number) = 30; quote: p ({hours: Number, student: Text}) -> {total: Number, student: Text} = {total: (p ~ hours * rate), student: (p ~ student)}; result = quote: {student: "Ada", hours: 2}; same: a (Number), as: b = a == b; empty ([Text]) = [];';
  const result=check(source);
  assert.equal(result.rate,'Number');
  assert.equal(result['quote:'],'({hours: Number, student: Text}) -> {student: Text, total: Number}');
  assert.equal(result.result,'{student: Text, total: Number}');
  assert.equal(result['same:as:'],'(Number, Number) -> Boolean');
  assert.equal(result.empty,'[Text]');
});
test('types: annotations remain structural, exact and checked in recursive groups',()=>{
  const result=check('even: n (Number) -> Boolean = if (n <= 0) then true else (odd: (n - 1)); odd: n = if (n <= 0) then false else (even: (n - 1)); x = even: 2;');
  assert.equal(result['odd:'],'(Number) -> Boolean');
  for(const [source,pattern] of [
    ['x (Text) = 1;',/expected Text, got Number/],
    ['f: x (Text) = x + 1;',/expected Number, got Text/],
    ['f: x (Number) -> Boolean = x + 1;',/expected Boolean, got Number/],
    ['f: r ({name: Text}) = r ~ age;',/missing record field age/],
    ['f: r ({name: Text}) = r ~ name; a = f: {name: "Ada", age: 1};',/missing record field age/],
    ['even: n (Number) -> Boolean = odd: n; odd: n = 1;',/expected Boolean, got Number/],
    ['xs ([Text]) = [1];',/expected Text, got Number/],
    ['x (Dynamic) = 1;',/Unknown annotation type Dynamic/],
    ['f: x ({a: Number, a: Text}) = x;',/Duplicate type field a/],
    ['f: x (Number, y: Text) = x;',/Unexpected token in type annotation/]
  ])assert.throws(()=>check(source),pattern,source);
});
test('types: annotations erase identically for JS and PHP emission',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-annotations-'));
  try{
    const input=join(dir,'program.mira');
    const annotated='rate (Number) = 30; quote: p ({hours: Number}) -> Number = p ~ hours * rate; result = quote: {hours: 2};';
    assert.equal(check(annotated).result,'Number');
    const bare='rate = 30; quote: p = p ~ hours * rate; result = quote: {hours: 2};';
    for(const target of ['js','php']){
      const compile=source=>{writeFileSync(input,source);const r=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
      const output=compile(annotated);
      assert.equal(output,compile(bare));
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,output+(target==='js'?'\nconsole.log(result);':'\necho $result;'));
      const r=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'60');
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: shared postfix annotations support multiword names and nested data types',()=>{
  const result=check('first rate (Number) = 30; multiply: first number (Number), by: second number (Number) -> Number = first number * second number; lesson list ([{student name: Text, hours: Number}]) = [{student name: "Ada", hours: 2}]; r = multiply: first rate, by: 2;');
  assert.equal(result['first rate'],'Number');
  assert.equal(result['multiply:by:'],'(Number, Number) -> Number');
  assert.equal(result['lesson list'],'[{hours: Number, student name: Text}]');
  assert.equal(result.r,'Number');
});
test('types: obsolete and malformed annotations are rejected, not interpreted as names',()=>{
  for(const [source,pattern] of [
    ['f: (x: Number) = x;',/Expected name before type annotation/],
    ['x -> Number = 1;',/Use name \(Type\) for a value annotation/],
    ['f: x () = x;',/Expected a type annotation/],
    ['x (Number) (Text) = 1;',/Unexpected token in type annotation/],
    ['x (Number) extra = 1;',/Expected closing \)/],
    ['(Number) = 1;',/Expected name before type annotation/]
  ])assert.throws(()=>check(source),pattern,source);
});

test('types: postfix annotations on block parameters and immutable locals',()=>{
  const result=check('f = {first number (Number), second number | first number * second number}; names = () >> {| students ([Text]) = []; students}; nested = {x (Number) | {y (Number) | x + y}}; r = collect: [{hours: 2}], with: {lesson ({hours: Number}) | fee (Number) = lesson ~ hours * 30; fee};');
  assert.equal(result.f,'(Number, Number) -> Number');
  assert.equal(result.names,'[Text]');
  assert.equal(result.nested,'(Number) -> (Number) -> Number');
  assert.equal(result.r,'[Number]');
  const mixed=check('f = {x (Number), y | {n: x, value: y}};');
  assert.equal(mixed.f,"(Number, 'a) -> {n: Number, value: 'a}");
});
test('types: local annotations check initializers, preserve scope and reject invalid syntax',()=>{
  for(const [source,pattern] of [
    ['f = {x (Text) | x + 1};',/expected Number, got Text/],
    ['f = {x (Number) | x}; r = "a" >> f;',/expected Number, got Text/],
    ['r = () >> {| values ([Text]) = [1]; values};',/expected Text, got Number/],
    ['r = () >> {| first = later; later (Number) = 1; first};',/used before its declaration/],
    ['f = {x (Number) | x (Text) = "a"; x};',/Duplicate or shadowed local name/],
    ['f = {x (Number), x (Text) | x};',/Duplicate or conflicting block parameter/],
    ['f = {x (Dynamic) | x};',/Unknown annotation type Dynamic/],
    ['r = () >> {| x () = 1; x};',/Expected a type annotation/],
    ['r = () >> {| x (Number) = 1;};',/end with a value expression/]
  ])assert.throws(()=>check(source),pattern,source);
  assert.equal(check('f = {x | x}; r = () >> {| f (1 + 2)};').r,'Number');
  assert.equal(check('r = () >> {| id = {x | x}; {a: (1 >> id), b: ("a" >> id)}};').r,'{a: Number, b: Text}');
});
test('types: typed blocks and locals erase identically in JS and PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-local-annotations-'));
  try{
    const input=join(dir,'program.mira');
    const typed='result = 2 >> {hours (Number) | rate (Number) = 30; hours * rate};';
    const bare='result = 2 >> {hours | rate = 30; hours * rate};';
    assert.equal(check(typed).result,'Number');
    for(const target of ['js','php']){
      const compile=source=>{writeFileSync(input,source);const r=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
      const output=compile(typed);assert.equal(output,compile(bare));
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,output+(target==='js'?'\nconsole.log(result);':'\necho $result;'));
      const r=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'60');
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: distinct nominal identities and transitive parent compatibility',()=>{
  const source='Identifier :: Number; Student Id :: Identifier; Request Id :: Identifier; student (Student Id) = 42; request (Request Id) = 7; id of: x (Identifier) -> Identifier = x; number of: x (Number) = x + 1; s = id of: student; n = number of: student; read student: x (Student Id) = x; r = read student: student;';
  const result=check(source);
  assert.equal(result.student,'Student Id');assert.equal(result.request,'Request Id');
  assert.equal(result.s,'Identifier');assert.equal(result.n,'Number');assert.equal(result.r,'Student Id');
  for(const extra of ['bad = read student: request;','bad = read student: 42;','bad (Student Id) = request;','bad = student == request;'])
    assert.throws(()=>check(source+extra),/expected/,extra);
});
test('types: named record families support projection and closed structural consumers',()=>{
  const result=check('Pixels :: Number; Size :: {width: Pixels, height: Pixels}; Window Size :: Size; Image Size :: Size; w (Pixels) = 12; h (Pixels) = 10; window size (Window Size) = {width: w, height: h}; image size (Image Size) = {width: w, height: h}; area of: size (Size) = size ~ width * size ~ height; a = area of: window size; b = area of: image size; width of: size = size ~ width; c = width of: window size;');
  assert.equal(result['window size'],'Window Size');assert.equal(result['image size'],'Image Size');
  assert.equal(result['area of:'],'(Size) -> Number');
  assert.equal(result.a,'Number');assert.equal(result.b,'Number');assert.equal(result.c,'Pixels');
});
test('types: nominal declarations are available in locals and blocks, including multiword names',()=>{
  const result=check('Student Id :: Number; f = {id (Student Id) | id}; result = () >> {| id (Student Id) = 42; id >> f};');
  assert.equal(result.f,'(Student Id) -> Student Id');assert.equal(result.result,'Student Id');
  for(const [source,pattern] of [
    ['A :: A;',/Unknown annotation type A/],
    ['A :: Number; A :: Text;',/Duplicate or reserved type A/],
    ['Number :: Text;',/Duplicate or reserved type Number/],
    ['A :: Number; x (A) = "a";',/expected Number, got Text/],
    ['A :: Number; B :: A; a (A) = 1; f: x (B) = x; r = f: a;',/expected B/]
  ])assert.throws(()=>check(source),pattern,source);
});
test('types: nominal declarations erase identically in JS and PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-nominal-'));
  try{
    const input=join(dir,'program.mira');
    const typed='Student Id :: Number; id (Student Id) = 42; f: x (Student Id) -> Number = x + 1; result = f: id;';
    const bare='id = 42; f: x = x + 1; result = f: id;';
    assert.equal(check(typed).result,'Number');
    for(const target of ['js','php']){
      const compile=source=>{writeFileSync(input,source);const r=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
      const output=compile(typed);assert.equal(output,compile(bare));
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,output+(target==='js'?'\nconsole.log(result);':'\necho $result;'));
      const r=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'43');
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: explicit structural projection accepts unrelated nominal records and additional fields',()=>{
  const source='Pixels :: Number; Size :: {width: Pixels, height: Pixels}; Window Size :: Size; Window :: {width: Pixels, height: Pixels, title: Text}; w (Pixels) = 12; h (Pixels) = 10; window (Window) = {width: w, height: h, title: "Mira"}; small (Window Size) = {width: w, height: h}; area of: size (~ Size) = size ~ width * size ~ height; a = area of: window; b = area of: small; c = area of: {width: w, height: h, visible: true};';
  const result=check(source);
  assert.equal(result['area of:'],'(~ Size) -> Number');
  for(const key of ['a','b','c'])assert.equal(result[key],'Number');
  assert.equal(check(source+'view (~ Window Size) = window; d = area of: view;').d,'Number');
  for(const [extra,pattern] of [
    ['bad = area of: {width: w};',/missing record field height/],
    ['bad = area of: {width: 12, height: h};',/expected Pixels/],
    ['bad = area of: 1;',/structural projection requires a record/],
    ['bad: s (~ Size) = s ~ title;',/missing record field title/],
    ['nominal: s (Size) = s; bad = nominal: window;',/expected Size/],
    ['view (~ Size) = window; bad (Size) = view;',/expected/]
  ])assert.throws(()=>check(source+extra),pattern,extra);
});
test('types: structural projection preserves nested nominal identities and field compatibility direction',()=>{
  const source='Student Id :: Number; Request Id :: Number; Special Student Id :: Student Id; Student :: {id: Student Id, name: Text}; Request :: {id: Request Id, name: Text}; sid (Special Student Id) = 1; rid (Request Id) = 2; request (Request) = {id: rid, name: "a"}; read student: s (~ Student) = s ~ id; a = read student: {id: sid, name: "a", active: true};';
  assert.equal(check(source).a,'Student Id');
  assert.throws(()=>check(source+'bad = read student: request;'),/expected Student Id/);
  assert.throws(()=>check(source+'bad = read student: {id: 1, name: "a"};'),/expected Student Id/);
});
test('types: projected annotations work in local bindings, blocks and return types without exposing extra fields',()=>{
  const source='Size :: {width: Number}; f = {s (~ Size) | s ~ width}; view of: s (~ Size) -> ~ Size = s; result = () >> {| v (~ Size) = {width: 12, title: "a"}; v >> f};';
  const result=check(source);
  assert.equal(result.f,'(~ Size) -> Number');assert.equal(result['view of:'],'(~ Size) -> ~ Size');assert.equal(result.result,'Number');
  assert.throws(()=>check(source+'projected view = view of: {width: 1, title: "a"}; bad = projected view ~ title;'),/missing record field title/);
  for(const [src,pattern] of [
    ['x (~ Number) = 1;',/requires a named record type/],
    ['A :: Number; x (~ A) = 1;',/requires a named record type/],
    ['A :: {width: Number}; B :: ~ A;',/projection is an annotation/],
    ['A :: {width: Number}; x ([~ A]) = [];',/Expected a type annotation/]
  ])assert.throws(()=>check(src),pattern,src);
});
test('types: structural views erase identically and retain extra runtime fields',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-structural-'));
  try{
    const input=join(dir,'program.mira');
    const typed='Size :: {width: Number}; view of: s (~ Size) -> ~ Size = s; result = view of: {width: 12, title: "Mira"};';
    const bare='view of: s = s; result = view of: {width: 12, title: "Mira"};';
    assert.equal(check(typed).result,'~ Size');
    for(const target of ['js','php']){
      const compile=source=>{writeFileSync(input,source);const r=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
      const output=compile(typed);assert.equal(output,compile(bare));
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,output+(target==='js'?'\nconsole.log(result.title);':'\necho $result["title"];'));
      const r=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'Mira');
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: numeric refinement literals, composed bounds and distinct identities',()=>{
  const source='Percentage :: Number where _ >= 0 AND _ <= 100; Small Percentage :: Percentage where _ <= 10; p (Percentage) = 80; small (Small Percentage) = 10; copy (Percentage) = small; read: x (Percentage) = x; result = read: small;';
  const result=check(source);
  assert.equal(result.p,'Percentage');assert.equal(result.small,'Small Percentage');
  assert.equal(result.copy,'Percentage');assert.equal(result.result,'Percentage');
  assert.equal(check(source+'local = () >> {| v (Percentage) = 42; v};').local,'Percentage');
  for(const [extra,pattern] of [
    ['bad (Percentage) = 120;',/refinement violated/],
    ['bad (Small Percentage) = 11;',/refinement violated/],
    ['bad (Small Percentage) = p;',/refinement not statically proven/],
    ['bad = read: 80;',/expected Percentage/],
    ['bad (Percentage) = 100 + 10;',/refinement violated/],
    ['Sibling :: Number where _ >= 0 AND _ <= 100; sibling (Sibling) = 10; bad (Percentage) = sibling;',/expected Percentage/]
  ])assert.throws(()=>check(source+extra),pattern,extra);
});
test('types: anonymous numeric refinements accept only proven input and reject invalid declarations',()=>{
  const source='Percentage :: Number where _ >= 0 AND _ <= 100; p (Percentage) = 20; read: x (Number where _ >= 0) = x + 1; result = read: p; value (Number where _ > 1 AND _ < 5) = 3;';
  const result=check(source);assert.equal(result.result,'Number');
  assert.equal(result.value,'Number where _ > 1 AND _ < 5');
  for(const [src,pattern] of [
    ['Bad :: Number where _ > 10 AND _ <= 10;',/Empty numeric refinement/],
    ['Positive :: Number where _ > 0; Bad :: Positive where _ <= 0;',/Empty numeric refinement/],
    ['Bad :: Text where _ > 0;',/requires a Number representation/],
    ['Bad :: Number where _ > 0 && _ < 10;',/Unexpected token/],
    ['Bad :: Number where _ > 0 AND;',/Expected _/],
    ['p (Number where _ > 0) = 0;',/refinement violated/],
    ['read: x (Number where _ > 0) = x; bad = read: 0;',/refinement not statically proven/],
    ['p (Number where _ > 0) = 1; q (Number where _ >= 1) = p;',/refinement not statically proven/]
  ])assert.throws(()=>check(src),pattern,src);
});
test('types: word operators support boolean conjunction with comparison precedence and short circuit',()=>{
  assert.deepEqual(check('a = 1 < 2 AND 3 <= 4; both: x, and: y = x AND y; b = both: true, and: false;'),{a:'Boolean','both:and:':'(Boolean, Boolean) -> Boolean',b:'Boolean'});
  assert.throws(()=>check('x = 1 AND true;'),/expected Boolean, got Number/);
  const dir=mkdtempSync(join(tmpdir(),'mira-logic-'));
  try{
    const input=join(dir,'program.mira');
    const source='Percentage :: Number where _ >= 0 AND _ <= 100; p (Percentage) = 42; result = p > 0 AND p <= 100; lazy = false AND ({a: true} ~ missing);';
    for(const target of ['js','php']){
      writeFileSync(input,source);
      const r=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
      assert.ok(r.stdout.includes('&&'));
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,r.stdout+(target==='js'?'\nconsole.log(JSON.stringify([result,lazy]));':'\necho json_encode([$result,$lazy]);'));
      const executed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(executed.status,0,executed.stderr);assert.deepEqual(JSON.parse(executed.stdout),[true,false]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: logical precedence, NOT, and operators as first-class functions',()=>{
  const src='a = NOT 1 < 2 OR true AND false; b = true OR false AND false; sum = fold: [1, 2, 3], with: (+), from: 0; invert = (NOT); c = false >> invert; both = (AND); d = fold: [true, false], with: (OR), from: false; plus = (+);';
  const types=check(src);
  assert.equal(types.a,'Boolean');assert.equal(types.b,'Boolean');
  assert.equal(types.sum,'Number');assert.equal(types.invert,'(Boolean) -> Boolean');
  assert.equal(types.c,'Boolean');assert.equal(types.both,'(Boolean, Boolean) -> Boolean');
  assert.equal(types.d,'Boolean');assert.equal(types.plus,'(Number, Number) -> Number');
  assert.throws(()=>check('bad = NOT 1;'),/expected Boolean/);
  assert.throws(()=>check('bad = false OR 1;'),/expected Boolean/);
  assert.throws(()=>check('AND = 1;'),/identifier/);
  const dir=mkdtempSync(join(tmpdir(),'mira-operators-'));
  try{
    const input=join(dir,'program.mira');
    writeFileSync(input,src+' lazy = true OR ({a: false} ~ missing);');
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,r.stdout+(target==='js'?'\nconsole.log(JSON.stringify([a,b,sum,c,d,lazy]));':'\necho json_encode([$a,$b,$sum,$c,$d,$lazy]);'));
      const executed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(executed.status,0,executed.stderr);
      assert.deepEqual(JSON.parse(executed.stdout),[false,true,6,true,true,true]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('types: refinements accept decimal bounds and reject out-of-range decimal literals',()=>{
  assert.equal(check('Ratio :: Number where _ >= 0.25 AND _ <= 0.75; r (Ratio) = 0.5;').r,'Ratio');
  assert.throws(()=>check('Ratio :: Number where _ >= 0.25 AND _ <= 0.75; r (Ratio) = 0.8;'),/refinement violated/);
});

test('types: static interval proofs for bounded arithmetic and typed function results',()=>{
  const source='Percentage :: Number where _ >= 0 AND _ <= 100; half of: p (Percentage) -> Percentage = p / 2; complement of: p (Percentage) -> Percentage = 100 - p; average of: a (Percentage), and: b (Percentage) -> Percentage = (a + b) / 2; volume (Percentage) = 50 + 10; result = half of: volume; nested (Percentage) = (2 * 15) + 0.5; local = () >> {| p (Percentage) = 60 + 20; p};';
  const result=check(source);
  assert.equal(result['half of:'],'(Percentage) -> Percentage');
  assert.equal(result['complement of:'],'(Percentage) -> Percentage');
  assert.equal(result['average of:and:'],'(Percentage, Percentage) -> Percentage');
  for(const name of ['volume','result','nested','local'])assert.equal(result[name],'Percentage');
  for(const [extra,pattern] of [
    ['bad (Percentage) = 50 * 3;',/refinement violated/],
    ['bad (Percentage) = 10 - 20;',/refinement violated/],
    ['bad: p (Percentage) -> Percentage = p * 2;',/refinement not statically proven/],
    ['bad: p (Percentage) -> Percentage = 1 / p;',/refinement not statically proven/],
    ['bad: p (Number) -> Percentage = p / 2;',/refinement not statically proven/],
    ['bad (Percentage) = 9007199254740991 + 1;',/refinement violated/],
    ['bad (Percentage) = 10 % 3;',/refinement not statically proven/],
    ['bad: p (Number where _ > 0 AND _ <= 100) -> Number where _ > 0 = p / 2;',/refinement not statically proven/]
  ])assert.throws(()=>check(source+extra),pattern,extra);
});
test('types: proven arithmetic emits exactly the ordinary JS/PHP and runs at interval boundaries',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-range-proof-'));
  try{
    const input=join(dir,'program.mira');
    const typed='Percentage :: Number where _ >= 0 AND _ <= 100; half of: p (Percentage) -> Percentage = p / 2; low (Percentage) = 0; high (Percentage) = 100; a = half of: low; b = half of: high; result = [a, b];';
    const bare='half of: p = p / 2; low = 0; high = 100; a = half of: low; b = half of: high; result = [a, b];';
    assert.equal(check(typed).result,'[Percentage]');
    for(const target of ['js','php']){
      const compile=source=>{writeFileSync(input,source);const r=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
      const output=compile(typed);assert.equal(output,compile(bare));
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,output+(target==='js'?'\nconsole.log(JSON.stringify(result));':'\necho json_encode($result);'));
      const r=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),[0,50]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: Integer construction, nominal refinements and portable arithmetic',()=>{
  const src='Request Id :: Integer where _ > 0; Retry Count :: Integer where _ >= 0 AND _ <= 3; Timeout :: Integer where _ >= 100 AND _ <= 60000; Request :: {id: Request Id, timeout: Timeout, retries: Retry Count}; id (Request Id) = 7; timeout (Timeout) = 1000; retry (Retry Count) = 1; request (Request) = {id: id, timeout: timeout, retries: retry}; n (Integer) = 2 * 3; quotient (Integer) = 8 / 2; next retry: r (Retry Count) -> Integer = r + 1; consume: x (Number) = x; result = consume: n;';
  const t=check(src);
  assert.equal(t.id,'Request Id');assert.equal(t.timeout,'Timeout');assert.equal(t.retry,'Retry Count');assert.equal(t.request,'Request');assert.equal(t.n,'Integer');assert.equal(t.quotient,'Integer');assert.equal(t['next retry:'],'(Retry Count) -> Integer');assert.equal(t.result,'Number');
  assert.equal(check(src+'copy (Integer) = id;').copy,'Integer');
  assert.equal(check(src+'r (Integer) = 3.0;').r,'Integer');
  for(const [extra,pattern] of [
    ['bad (Integer) = 3.5;',/Integer violated/],
    ['bad (Integer) = 9 / 2;',/Integer violated/],
    ['bad (Integer) = 9007199254740992;',/Integer overflow/],
    ['bad: x (Integer) -> Integer = x + 1;',/Integer not statically proven/],
    ['bad: x (Number) -> Integer = x;',/Integer not statically proven/],
    ['bad (Request Id) = 0;',/refinement violated/],
    ['bad (Retry Count) = 4;',/refinement violated/],
    ['bad (Timeout) = 1000.5;',/Integer violated/],
    ['Other Id :: Integer; other (Other Id) = 7; bad (Request Id) = other;',/expected Request Id/],
    ['Empty :: Integer where _ > 0 AND _ < 1;',/Empty numeric refinement/],
    ['Empty :: Integer where _ == 2.5;',/Empty numeric refinement/],
    ['Integer :: Number;',/Duplicate or reserved type/]
  ])assert.throws(()=>check(src+extra),pattern,extra);
});
test('types: discrete Integer intervals tighten open and fractional bounds',()=>{
  const src='Small :: Integer where _ > 0 AND _ < 4; Larger :: Integer where _ > 0.5 AND _ < 4.5; one (Small) = 1; up: p (Small) -> Integer where _ >= 2 AND _ <= 4 = p + 1; down: q (Larger) -> Integer where _ >= 0 AND _ <= 3 = q - 1; result = up: one;';
  const t=check(src);
  assert.equal(t.result,'Integer where _ >= 2 AND _ <= 4');
  assert.throws(()=>check(src+'bad (Small) = 4;'),/refinement violated/);
  assert.throws(()=>check(src+'Empty :: Small where _ > 3;',),/Empty numeric refinement/);
});
test('types: proven Integer operations erase without overhead on JS/PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-integer-'));
  try{
    const input=join(dir,'program.mira');
    const typed='Retry Count :: Integer where _ >= 0 AND _ <= 3; increment retry: r (Retry Count) -> Integer = r + 1; retry (Retry Count) = 3; result = increment retry: retry;';
    const bare='increment retry: r = r + 1; retry = 3; result = increment retry: retry;';
    assert.equal(check(typed).result,'Integer');
    for(const target of ['js','php']){
      const compile=src=>{writeFileSync(input,src);const r=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
      const output=compile(typed);assert.equal(output,compile(bare));
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,output+(target==='js'?'\nconsole.log(result);':'\necho $result;'));
      const r=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'4');
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: numeric narrowing proves conditional results without changing their ordinary type',()=>{
  const src='Percentage :: Number where _ >= 0 AND _ <= 100; Wide :: Number where _ >= 0 AND _ <= 200; normalize percentage: x (Number) -> Percentage = if (x >= 0 AND x <= 100) then x else 0; reversed bounds: x (Number) -> Percentage = if (0 <= x AND 100 >= x) then x else 0; cap percentage: x (Wide) -> Percentage = if (x > 100) then 100 else (x + 0); outside range: x (Wide) -> Percentage = if (x < 0 OR x > 100) then 0 else (x + 0); inverted condition: x (Wide) -> Percentage = if (NOT x > 100) then (x + 0) else 100; nested bounds: x (Number) -> Percentage = if (x >= 0) then (if (x <= 100) then x else 0) else 0; Count :: Integer where _ >= 0 AND _ <= 10; Small :: Integer where _ >= 0 AND _ <= 3; cap count: x (Count) -> Small = if (x > 3) then 3 else (x + 0);';
  const t=check(src);
  for(const name of ['normalize percentage:','reversed bounds:','nested bounds:'])assert.equal(t[name],'(Number) -> Percentage');
  for(const name of ['cap percentage:','outside range:','inverted condition:'])assert.equal(t[name],'(Wide) -> Percentage');
  assert.equal(t['cap count:'],'(Count) -> Small');
});
test('types: narrowing remains lexical and conservative for incomplete or disjunctive facts',()=>{
  const prefix='Percentage :: Number where _ >= 0 AND _ <= 100; ';
  for(const program of [
    'bad: x (Number) -> Percentage = if (x >= 0 AND x <= 100) then x else x;',
    'bad: x (Number) -> Percentage = if (x >= 0 OR x <= 100) then x else 0;',
    'bad: x (Number) -> Percentage = if (x >= 0 AND x <= 100) then (x + 1) else 0;',
    'bad: x (Number) -> Number where _ >= 0 = if (x < 0) then 0 else x;',
    'bad: x (Number) -> Number where _ >= 0 = if (x >= 0) then x else 0;',
    'bad: x (Number) -> Percentage = if (x >= 0 AND x <= 100) then (150 >> {x (Number) | v (Percentage) = x; 0}) else 0;'
  ])assert.throws(()=>check(prefix+program),/refinement not statically proven/,program);
});
test('types: branch proofs erase, and native conditional behavior is identical on JS/PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-narrowing-'));
  try{
    const input=join(dir,'program.mira');
    const typed='Percentage :: Number where _ >= 0 AND _ <= 100; normalize percentage: x (Number) -> Percentage = if (x >= 0 AND x <= 100) then x else 0; a = normalize percentage: 42; b = normalize percentage: 101; c = normalize percentage: 100; result = [a, b, c];';
    const bare='normalize percentage: x = if (x >= 0 AND x <= 100) then x else 0; a = normalize percentage: 42; b = normalize percentage: 101; c = normalize percentage: 100; result = [a, b, c];';
    assert.equal(check(typed).result,'[Percentage]');
    for(const target of ['js','php']){
      const compile=src=>{writeFileSync(input,src);const r=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
      const output=compile(typed);assert.equal(output,compile(bare));
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,output+(target==='js'?'\nconsole.log(JSON.stringify(result));':'\necho json_encode($result);'));
      const r=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),[42,0,100]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: numeric obligations distinguish certain overflow, fractional values and unknown proofs',()=>{
  for(const src of [
    'bad (Integer) = 9007199254740991 + 1;',
    'bad (Integer) = (0 - 9007199254740991) - 1;',
    'bad (Integer) = 9007199254740991 * 2;',
    'Top :: Integer where _ >= 9007199254740990; bad: x (Top) -> Integer = x + 2;'
  ])assert.throws(()=>check(src),/Integer overflow/,src);
  for(const src of [
    'bad (Integer) = 0.5;',
    'bad (Integer) = 3 / 2;',
    'Fraction :: Number where _ > 0 AND _ < 1; bad: x (Fraction) -> Integer = x;'
  ])assert.throws(()=>check(src),/Integer violated/,src);
  for(const src of [
    'increment: x (Integer) -> Integer = x + 1;',
    'bad: x (Number) -> Integer = x;',
    'bad (Integer) = (9007199254740991 + 1) - 1;',
    'bad (Integer) = 1 / 0;'
  ])assert.throws(()=>check(src),/Integer not statically proven/,src);
  assert.equal(check('good (Integer) = 9007199254740990 + 1;').good,'Integer');
  assert.equal(check('n = 9007199254740991 + 1;').n,'Number');
  const bounded='Safe :: Integer where _ >= 0 AND _ <= 10; cap increment: x (Safe) -> Integer = if (x < 10) then (x + 1) else 10;';
  assert.equal(check(bounded)['cap increment:'],'(Safe) -> Integer');
  assert.throws(()=>check('Low :: Number where _ >= 0 AND _ <= 1; High :: Low where _ > 1;'),/Empty numeric refinement/);
  assert.throws(()=>check('Low :: Number where _ >= 0 AND _ <= 1; f: x (Number where _ >= 2 AND _ <= 3) = x; low (Low) = 0; bad = f: low;'),/refinement violated/);
});

test('types: checked compilation emits only unresolved numerical guards and rejects certain violations',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-checked-'));
  try{
    const input=join(dir,'program.mira');
    const compile=(src,target,checked=true)=>{
      writeFileSync(input,src);
      return spawnSync('node',['dist/mira.cjs',input,target,...(checked?['--checked']:[])],{encoding:'utf8'});
    };
    const proven='Percentage :: Number where _ >= 0 AND _ <= 100; half of: p (Percentage) -> Percentage = p / 2; p (Percentage) = 42; result = half of: p;';
    const guarded='Percentage :: Number where _ >= 0 AND _ <= 100; Retry Count :: Integer where _ >= 0 AND _ <= 3; bounded value: x (Number) -> Percentage = x; retry value: x (Number) -> Retry Count = x; increment checked: x (Integer) -> Integer = x + 1; local checked: x (Number) -> Percentage = () >> {| p (Percentage) = x; p};';
    for(const target of ['js','php']){
      const p=compile(proven,target);
      assert.equal(p.status,0,p.stderr);
      assert.equal(p.stdout,compile(proven,target,false).stdout);
      assert.ok(!p.stdout.includes('__miraNumericValue'));
      const g=compile(guarded,target);
      assert.equal(g.status,0,g.stderr);
      assert.match(g.stdout,/__miraNumericValue/);
      assert.ok(!compile(guarded,target,false).stdout.includes('__miraNumericValue'));
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      const execute=(js,php)=>{
        writeFileSync(file,g.stdout+'\n'+(target==='js'?js:php));
        return spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      };
      const ok=execute('console.log(JSON.stringify([bounded_value(42),retry_value(3),increment_checked(9007199254740990),local_checked(5)]));','echo json_encode([bounded_value(42),retry_value(3),increment_checked(9007199254740990),local_checked(5)]);');
      assert.equal(ok.status,0,ok.stderr);
      assert.deepEqual(JSON.parse(ok.stdout),[42,3,9007199254740991,5]);
      for(const [js,php] of [
        ['bounded_value(101);','bounded_value(101);'],
        ['bounded_value(NaN);','bounded_value(NAN);'],
        ['bounded_value(Infinity);','bounded_value(INF);'],
        ['bounded_value("42");','bounded_value("42");'],
        ['retry_value(2.5);','retry_value(2.5);'],
        ['retry_value(4);','retry_value(4);'],
        ['increment_checked(9007199254740991);','increment_checked(9007199254740991);'],
        ['local_checked(-1);','local_checked(-1);']
      ]){
        const bad=execute(js,php);
        assert.notEqual(bad.status,0,js);assert.match(bad.stderr,/Mira (Integer constraint|numeric refinement) violated/);
      }
      for(const src of [
        'x (Integer) = 9007199254740991 + 1;',
        'x (Integer) = 3 / 2;',
        'x (Integer) = (9007199254740991 + 2) - 2;',
        'x (Integer) = 1 / 0;',
        'bad: x (Integer) -> Integer = x / 2;',
        'f: x (Integer) = x; bad = f: 3;'
      ])assert.notEqual(compile(src,target).status,0,src);
    }
    assert.throws(()=>check(guarded),/refinement not statically proven/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('types: checked refinement evaluates a host expression once',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-checked-host-'));
  try{
    const input=join(dir,'program.mira'),host=join(dir,'host.json');
    writeFileSync(input,'Percentage :: Number where _ >= 0 AND _ <= 100; probe once: x (Number) -> Percentage = probe x;');
    writeFileSync(host,JSON.stringify({callables:['probe'],types:{probe:{parameters:['Number'],result:'Number'}}}));
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked','--host',host],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,r.stdout+(target==='js'?'\nlet calls=0; const __miraHost={probe:x=>{calls++;return x;}}; console.log(JSON.stringify([probe_once(42),calls]));':'\n$calls=0; $GLOBALS["__miraHost"]=["probe"=>function($x) use (&$calls){$calls++;return $x;}]; echo json_encode([probe_once(42),$calls]);'));
      const executed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(executed.status,0,executed.stderr);
      assert.deepEqual(JSON.parse(executed.stdout),[42,1]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: fallible validation gives the success handler the nominal type',()=>{
  const src='Percentage :: Number where _ >= 0 AND _ <= 100; display percent: p (Percentage) = p + 0; read percent: x = validate: (x), as: (Percentage), then: {p | display percent: p}, else: {error | 0}; result = read percent: 120;';
  const t=check(src);
  assert.equal(t['read percent:'],"('a) -> Number");assert.equal(t.result,'Number');
  assert.equal(check(src+'message = validate: ("oops"), as: (Percentage), then: {p | "valid"}, else: {error | error};').message,'Text');
  for(const [extra,pattern] of [
    ['bad = validate: (42), as: (Percentage), then: {p | p + 0}, else: {error | error};',/expected Number, got Text/],
    ['bad = validate: (42), as: (Text), then: {p | 1}, else: {error | 0};',/requires a numeric type/],
    ['bad = validate: (42), as: (Percentage), then: {| 1}, else: {error | 0};',/unary handler/],
    ['Other :: Number; o (Other) = 42; bad = validate: (o), as: (Percentage), then: {p | 1}, else: {error | 0};',/unrelated nominal types/],
    ['validate: x = x;',/Reserved validation selector/]
  ])assert.throws(()=>check(src+extra),pattern,extra);
});
test('types: fallible numeric validation runs only the selected handler on JS and PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-validation-'));
  try{
    const input=join(dir,'program.mira'),host=join(dir,'host.json');
    const src='Percentage :: Number where _ >= 0 AND _ <= 100; Retry Count :: Integer where _ >= 0 AND _ <= 3; show percent: p (Percentage) = p + 0; validate percent: x = validate: (probe x), as: (Percentage), then: {p | on valid (show percent: p)}, else: {error | on invalid error}; validate retry: x = validate: (x), as: (Retry Count), then: {r | "valid"}, else: {error | error};';
    writeFileSync(input,src);
    writeFileSync(host,JSON.stringify({callables:['probe','on valid','on invalid'],types:{probe:{parameters:['Number'],result:'Number'},'on valid':{parameters:['Number'],result:'Text'},'on invalid':{parameters:['Text'],result:'Text'}}}));
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked','--host',host],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      const js='let probes=0,yes=0,no=0; const __miraHost={probe:x=>{probes++;return x;}, "on valid":x=>{yes++;return "ok";}, "on invalid":x=>{no++;return x;}}; console.log(JSON.stringify([validate_percent(42),validate_percent(120),validate_percent(NaN),validate_retry(3),validate_retry(2.5),validate_retry("3"),probes,yes,no]));';
      const php='$probes=0;$yes=0;$no=0;$GLOBALS["__miraHost"]=["probe"=>function($x) use (&$probes){$probes++;return $x;}, "on valid"=>function($x) use (&$yes){$yes++;return "ok";}, "on invalid"=>function($x) use (&$no){$no++;return $x;}]; echo json_encode([validate_percent(42),validate_percent(120),validate_percent(NAN),validate_retry(3),validate_retry(2.5),validate_retry("3"),$probes,$yes,$no]);';
      writeFileSync(file,r.stdout+'\n'+(target==='js'?js:php));
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);
      assert.deepEqual(JSON.parse(run.stdout),['ok','Invalid numeric value','Invalid numeric value','valid','Invalid Integer value','Invalid Integer value',3,1,2]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: closed nominal sums synthesize typed constructors',()=>{
  const src='Session :: {user: Text}; Connection :: Disconnected | Connecting | Connected (Session) | Failed (Text); session (Session) = {user: "Ada"}; initial = Disconnected; active connection = Connected: session; failure = Failed: "timeout"; states = [initial, active connection, failure]; identity connection: c (Connection) -> Connection = c; result = identity connection: active connection;';
  const t=check(src);
  assert.equal(t.Disconnected,'Connection');
  assert.equal(t['Connected:'],'(Session) -> Connection');
  assert.equal(t['Failed:'],'(Text) -> Connection');
  assert.equal(t.states,'[Connection]');
  assert.equal(t.result,'Connection');
  assert.equal(check('Only :: | Single; value = Single;').value,'Only');
  assert.equal(check('Tree :: Leaf (Tree) | Empty; value = Leaf: Empty;').value,'Tree');
  for(const [extra,pattern] of [
    ['bad = Connected: "wrong";',/expected Session/],
    ['bad (Connection) = {tag: "Connected", value: session};',/expected Connection/],
    ['Other :: Unrelated | Unknown; bad (Connection) = Unrelated;',/expected Connection/],
    ['bad = active connection ~ tag;',/expected Connection, got \{tag:/],
    ['Duplicate :: Same | Same;',/Duplicate sum alternative/],
    ['Empty :: A |;',/Empty sum alternative/],
    ['Lower :: a | B;',/uppercase/],
    ['Duplicate Value :: Disconnected | Something;',/Duplicate or conflicting value/],
    ['Connected: x = x;',/Duplicate or conflicting selector/],
    ['Tree :: Leaf (Missing Tree) | Empty;',/Unknown annotation type Missing Tree/]
  ])assert.throws(()=>check(src+extra),pattern,extra);
});
test('types: native tagged sum representations agree on JS and PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-sum-'));
  try{
    const input=join(dir,'program.mira');
    const src='Session :: {user: Text}; Connection :: Disconnected | Connected (Session) | Failed (Text); session (Session) = {user: "Ada"}; active connection = Connected: session; failure = Failed: "timeout"; result = [Disconnected, active connection, failure];';
    writeFileSync(input,src);
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,r.stdout+(target==='js'?'\nconsole.log(JSON.stringify(result));':'\necho json_encode($result);'));
      const executed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(executed.status,0,executed.stderr);
      assert.deepEqual(JSON.parse(executed.stdout),[{tag:'Disconnected'},{tag:'Connected',value:{user:'Ada'}},{tag:'Failed',value:'timeout'}]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: exhaustive contextual match types payloads and preserves user selectors',()=>{
  const src='Session :: {user: Text}; Connection :: Disconnected | Connecting | Connected (Session) | Failed (Text); session (Session) = {user: "Ada"}; connection = Connected: session; describe connection: c (Connection) = match: c {disconnected: {| "offline"}, connecting: {| "waiting"}, connected: {s | s ~ user}, failed: {error | error}}; match: x = x; match: x, with: y = y; process = {handlers | handlers}; ordinary = match: 42; ordinary with = match: connection, with: 7; ordinary record = match: (process {connected: {| 1}, disconnected: {| 0}}); result = describe connection: connection; direct = match: (Connected: session) {disconnected: {| 0}, connecting: {| 1}, connected: {s | 2}, failed: {e | 3}};';
  const t=check(src);
  assert.equal(t['describe connection:'],'(Connection) -> Text');assert.equal(t.result,'Text');
  assert.equal(t.ordinary,'Number');assert.equal(t['ordinary with'],'Number');assert.equal(t.direct,'Number');
  assert.equal(t['ordinary record'],'{connected: () -> Number, disconnected: () -> Number}');
  for(const [extra,pattern] of [
    ['bad = match: connection {disconnected: {| 0}};',/Non-exhaustive match/],
    ['bad = match: connection {disconnected: {| 0}, disconnected: {| 1}};',/Duplicate match alternative/],
    ['bad = match: connection {missing: {| 0}};',/Unknown match alternative/],
    ['bad = match: connection {disconnected: {| 0}, connecting: {| 1}, connected: {| 2}, failed: {e | 3}};',/Wrong match handler arity/],
    ['bad = match: connection {disconnected: {| 0}, connecting: {| 1}, connected: {s | 2}, failed: {e | e}};',/expected Number, got Text/],
    ['bad = match: 42 {disconnected: {| 0}};',/requires a known sum type/],
    ['bad = match: connection {disconnected: {| 0}, connecting: {| 1}, connected: {s (Text) | 2}, failed: {e | 3}};',/Match handler parameters are typed/]
  ])assert.throws(()=>check(src+extra),pattern,extra);
});
test('types: match dispatch evaluates the scrutinee once and only the selected body',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-match-'));
  try{
    const input=join(dir,'program.mira'),host=join(dir,'host.json');
    const src='Connection :: Disconnected | Connected (Text) | Failed (Text); get connection: value (Text) = Connected: (probe value); describe connection: c (Connection) = match: c {disconnected: {| on branch "offline"}, connected: {s | on branch s}, failed: {e | on branch e}}; run match: name (Text) = match: (get connection: name) {disconnected: {| on branch "offline"}, connected: {s | on branch s}, failed: {e | on branch e}}; capture match: c (Connection), prefix: p (Text) = match: c {disconnected: {| p}, connected: {s | p}, failed: {e | p}};';
    writeFileSync(input,src);
    writeFileSync(host,JSON.stringify({callables:['probe','on branch'],types:{probe:{parameters:['Text'],result:'Text'},'on branch':{parameters:['Text'],result:'Text'}}}));
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked','--host',host],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      const js='let probes=0; const branches=[]; const __miraHost={probe:x=>{probes++;return x;}, "on branch":x=>{branches.push(x);return x;}}; console.log(JSON.stringify([run_match("Ada"),describe_connection(Disconnected),describe_connection(Failed("timeout")),capture_match__prefix(Disconnected,"captured"),probes,branches]));';
      const php='$probes=0;$branches=[];$GLOBALS["__miraHost"]=["probe"=>function($x) use (&$probes){$probes++;return $x;}, "on branch"=>function($x) use (&$branches){$branches[]=$x;return $x;}]; echo json_encode([run_match("Ada"),describe_connection($Disconnected),describe_connection(Failed("timeout")),capture_match__prefix($Disconnected,"captured"),$probes,$branches]);';
      writeFileSync(file,r.stdout+'\n'+(target==='js'?js:php));
      const executed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(executed.status,0,executed.stderr);
      assert.deepEqual(JSON.parse(executed.stdout),['Ada','offline','timeout','captured',1,['Ada','offline','timeout']]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: ordinary match selectors coexist with the special form in JS and PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-match-selectors-'));
  try{
    const input=join(dir,'program.mira');
    writeFileSync(input,'State :: Idle | Running (Number); match: x = x; match: x, with: y = y; process = {handlers | handlers}; ordinary = match: 42; ordinary with = match: 1, with: 7; ordinary record = match: (process {idle: {| 1}}); selected = match: (Running: 2) {idle: {| 0}, running: {n | n}}; result = [ordinary, ordinary with, selected];');
    for(const target of ['js','php']){
      const compiled=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(compiled.status,0,compiled.stderr);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,compiled.stdout+(target==='js'?'\nconsole.log(JSON.stringify(result));':'\necho json_encode($result);'));
      const executed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(executed.status,0,executed.stderr);
      assert.deepEqual(JSON.parse(executed.stdout),[42,7,2]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: parametric nominal sums instantiate independently and infer constructor arguments',()=>{
  const src='Result (T, E) :: Ok (T) | Err (E); Option (T) :: Some (T) | None; Envelope (T) :: Wrapped (Option (T)) | Missing; Percentage :: Number where _ >= 0 AND _ <= 100; p (Percentage) = 42; a (Result (Number, Text)) = Ok: 42; b (Result (Text, Number)) = Ok: "Ada"; failure (Result (Number, Text)) = Err: "timeout"; values = [a, failure]; some number = Some: 7; some text = Some: "Mira"; none text (Option (Text)) = None; none number (Option (Number)) = None; percent (Option (Percentage)) = Some: p; wrapped (Envelope (Number)) = Wrapped: (Some: 3); inferred = Ok: 1; read result: r (Result (Number, Text)) -> Number = match: r {ok: {n | n}, err: {e | 0}}; result = read result: a;';
  const t=check(src);
  assert.equal(t['Ok:'],"('a) -> Result ('a, 'b)");
  assert.equal(t['Err:'],"('a) -> Result ('b, 'a)");
  assert.equal(t.None,"Option ('a)");
  assert.equal(t.a,'Result (Number, Text)');
  assert.equal(t.b,'Result (Text, Number)');
  assert.equal(t.values,'[Result (Number, Text)]');
  assert.equal(t['some number'],'Option (Number)');
  assert.equal(t['some text'],'Option (Text)');
  assert.equal(t['none text'],'Option (Text)');
  assert.equal(t['none number'],'Option (Number)');
  assert.equal(t.percent,'Option (Percentage)');
  assert.equal(t.wrapped,'Envelope (Number)');
  assert.equal(t.inferred,"Result (Number, 'a)");
  assert.equal(t.result,'Number');
  for(const [extra,pattern] of [
    ['bad (Result (Number, Text)) = Ok: "wrong";',/expected Number, got Text/],
    ['bad = [a,b];',/expected Number, got Text|expected Text, got Number/],
    ['bad (Result) = Ok: 42;',/requires 2 type arguments/],
    ['bad (Result (Number)) = Ok: 42;',/Expected ,/],
    ['bad (Option (Number, Text)) = None;',/Expected \)/],
    ['bad (T) = 42;',/Unknown annotation type T/],
    ['Duplicate (T, T) :: One (T) | Other;',/Invalid or duplicate type parameter/],
    ['Box (T) :: T;',/require a record or list base/],
    ['bad = match: a {ok: {n | n}, err: {e | e}};',/expected Number, got Text/],
    ['Wrong :: Wrong One | Wrong Two; bad (Result (Number, Text)) = Wrong One;',/expected Result/]
  ])assert.throws(()=>check(src+extra),pattern,extra);
  const pair='Pair (T) :: Both ({left: T, right: T}) | Neither; good = Both: {left: 1, right: 2};';
  assert.equal(check(pair).good,'Pair (Number)');
  assert.throws(()=>check(pair+'bad = Both: {left: 1, right: "x"};'),/expected Number, got Text|expected Text, got Number/);
});
test('types: generic sums preserve native representation and typed match on both targets',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-parametric-sum-'));
  try{
    const input=join(dir,'program.mira');
    const src='Result (Success Type, Failure Type) :: Ok (Success Type) | Err (Failure Type); Option (element type) :: Some (element type) | None; a (Result (Number, Text)) = Ok: 42; b (Result (Number, Text)) = Err: "bad"; empty (Option (Number)) = None; present = Some: 7; read result: r (Result (Number, Text)) = match: r {ok: {n | n}, err: {e | 0}}; read option: o (Option (Number)) = match: o {some: {n | n}, none: {| 0}}; result = [(read result: a), (read result: b), (read option: empty), (read option: present)];';
    writeFileSync(input,src);
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,r.stdout+(target==='js'?'\nconsole.log(JSON.stringify([a,b,empty,present,result]));':'\necho json_encode([$a,$b,$empty,$present,$result]);'));
      const executed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(executed.status,0,executed.stderr);
      assert.deepEqual(JSON.parse(executed.stdout),[{tag:'Ok',value:42},{tag:'Err',value:'bad'},{tag:'None'},{tag:'Some',value:7},[42,0,0,7]]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: discursive type parameters use ordinary names and declaration-local slots',()=>{
  const src='Result (Success Type, failure type) :: Ok (Success Type) | Err (failure type); Option (element type) :: Some (element type) | None; Envelope (element type) :: Wrapped (Option (element type)) | Missing; Pair (item type) :: Both ({left: item type, right: item type}) | Neither; a (Result (Number, Text)) = Ok: 42; b (Result (Number, Text)) = Err: "bad"; wrapped = Wrapped: (Some: 3); pair = Both: {left: 1, right: 2}; result = match: a {ok: {n | n}, err: {e | 0}};';
  const t=check(src);
  assert.equal(t.a,'Result (Number, Text)');
  assert.equal(t.b,'Result (Number, Text)');
  assert.equal(t.wrapped,'Envelope (Number)');
  assert.equal(t.pair,'Pair (Number)');
  assert.equal(t.result,'Number');
  for(const [extra,pattern] of [
    ['Duplicate (item type, item type) :: One (item type) | Other;',/Invalid or duplicate type parameter/],
    ['Invalid (item where type) :: One (Number) | Other;',/Invalid or duplicate type parameter/],
    ['Invalid (Result) :: One (Number) | Other;',/Invalid or duplicate type parameter/],
    ['Invalid (item type,) :: One (Number) | Other;',/Empty final selector segment/],
    ['bad (item type) = 1;',/Unknown annotation type item type/],
    ['bad (Result (Number, Text)) = Err: 1;',/expected Text, got Number/]
  ])assert.throws(()=>check(src+extra),pattern,extra);
});

test('types: host name hygiene keeps Error constructors and native guards independent',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-host-names-'));
  try{
    const input=join(dir,'program.mira');
    const src='Result (T, E) :: Ok (T) | Error (E); failure (Result (Number, Text)) = Error: "timeout"; Array = 7; Object = {n: 9}; __miraEsc_Array = 4; count: x (Number) = x + 1; array map: x (Number) = x * 2; result = [(match: failure {ok: {n | n}, error: {e | 0}}), Array, Object ~ n, __miraEsc_Array, (count: 2), (array map: 3)];';
    const checked=src+' mapped = collect: [1, 2], with: {Array | Array + 1};';
    writeFileSync(input,checked);
    for(const target of ['js','php']){
      const compiled=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(compiled.status,0,compiled.stderr);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      const suffix=target==='js'
        ? '\nconsole.log(JSON.stringify([result,mapped]));'
        : '\necho json_encode([$result,$mapped]);';
      writeFileSync(file,compiled.stdout+suffix);
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);
      assert.deepEqual(JSON.parse(run.stdout),[[0,7,9,4,3,6],[2,3]]);
      // An unchecked missing field must still raise the native exception.
      writeFileSync(input,'Result (T, E) :: Ok (T) | Error (E); failure = Error: "timeout"; Object = {n: 9}; bad = Object ~ missing;');
      const bad=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});
      assert.equal(bad.status,0,bad.stderr);
      writeFileSync(file,bad.stdout);
      const failed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.notEqual(failed.status,0);
      assert.match(failed.stderr,/Missing record field: missing/);
      writeFileSync(input,checked);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: explicitly generic functions are universally checked and independently instantiated',()=>{
  const src='Option (Element Type) :: Some (Element Type) | None; identity (Value Type): x (Value Type) -> Value Type = x; singleton (element type): value (element type) -> [element type] = [value]; choose (Item Type): option (Option (Item Type)), fallback: value (Item Type) -> Item Type = match: option {some: {x | x}, none: {| value}}; pair (Left Type, Right Type): x (Left Type), with: y (Right Type) -> {left: Left Type, right: Right Type} = {left: x, right: y}; a = identity: 42; b = identity: "Ada"; c = singleton: "Mira"; d = choose: (Some: 7), fallback: 0; e = choose: None, fallback: "empty"; f = pair: 1, with: "x";';
  const t=check(src);
  assert.equal(t['identity:'],"('a) -> 'a");
  assert.equal(t.a,'Number');
  assert.equal(t.b,'Text');
  assert.equal(t.c,'[Text]');
  assert.equal(t.d,'Number');
  assert.equal(t.e,'Text');
  for(const [extra,pattern] of [
    ['bad (T): x (T) -> T = 1;',/Cannot specialize explicit type parameter/],
    ['bad (T): x (T) -> Number = x + 1;',/Cannot specialize explicit type parameter/],
    ['bad (T): x (T) -> Boolean = x == x;',/does not guarantee scalar equality/],
    ['bad (T, U): x (T) -> U = x;',/Cannot specialize explicit type parameter/],
    ['bad (T): x (T) -> Number = x ~ field;',/Cannot specialize explicit type parameter/],
    ['bad (T): x -> T = x;',/require all parameter and result annotations/],
    ['bad (T): x (T) = x;',/require all parameter and result annotations/],
    ['bad (T, T): x (T) -> T = x;',/Invalid or duplicate type parameter/],
    ['bad (Value Type) = 1;',/Unknown annotation type Value Type/],
    ['bad (T): x (T) -> T = bad: x;',/Recursive explicitly generic/],
    ['bad = choose: (Some: 1), fallback: "wrong";',/expected Number, got Text|expected Text, got Number/]
  ]) assert.throws(()=>check(src+extra),pattern,extra);
});
test('types: explicit generic function signatures are erased on JS and PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-generic-functions-'));
  try{
    const input=join(dir,'program.mira');
    const source='identity (Value Type): x (Value Type) -> Value Type = x; a = identity: 42; b = identity: "Ada"; result = {a: a, b: b};';
    const plain='identity: x = x; a = identity: 42; b = identity: "Ada"; result = {a: a, b: b};';
    for(const target of ['js','php']){
      writeFileSync(input,source);
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      writeFileSync(input,plain);
      const baseline=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(baseline.status,0,baseline.stderr);
      assert.equal(r.stdout,baseline.stdout);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,r.stdout+(target==='js'?'\nconsole.log(JSON.stringify(result));':'\necho json_encode($result);'));
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);
      assert.deepEqual(JSON.parse(run.stdout),{a:42,b:'Ada'});
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: validation results retain the requested nominal identity',()=>{
  const src='Result (Value Type, Failure Type) :: Ok (Value Type) | Err (Failure Type); Percentage :: Number where _ >= 0 AND _ <= 100; display percent: p (Percentage) = p + 0; read percent: x = validate: (x), as: (Percentage); a = read percent: 42; b = read percent: "bad"; result = match: a {ok: {p | display percent: p}, err: {e | 0}};';
  const t=check(src);
  assert.equal(t.a,'Result (Percentage, Text)');
  assert.equal(t.b,'Result (Percentage, Text)');
  assert.equal(t.result,'Number');
  for(const [extra,pattern] of [
    ['bad = validate: (42), as: (Text);',/requires a numeric type/],
    ['Other :: Number; o (Other) = 42; bad = validate: (o), as: (Percentage);',/unrelated nominal types/],
    ['bad (Result (Number, Text)) = a;',/expected Number, got Percentage|expected Percentage, got Number/],
    ['bad = match: a {ok: {p | p}};',/Non-exhaustive match/]
  ]) assert.throws(()=>check(src+extra),pattern,extra);
  for(const template of ['', 'Result (T, E) :: Ok (E) | Err (T);','Result (T, E) :: Ok (T) | Err (E) | Pending;','Result :: Ok (Number) | Err (Text);'])
    assert.throws(()=>check(template+' bad = validate: (42), as: (Number);'),/Short validation requires Result/);
  assert.equal(check('result = validate: (42), as: (Number), then: {n | n}, else: {e | 0};').result,'Number');
});
test('types: first-class validation results evaluate the input once on JS and PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-validation-result-'));
  try{
    const input=join(dir,'program.mira'),host=join(dir,'host.json');
    const src='Result (T, E) :: Ok (T) | Err (E); Percentage :: Number where _ >= 0 AND _ <= 100; Retry Count :: Integer where _ >= 0 AND _ <= 3; read percent: x = validate: (probe x), as: (Percentage); read retry: x = validate: (x), as: (Retry Count); read closure: x = () >> {| validate: (x), as: (Percentage)}; result = read percent: 42;';
    writeFileSync(input,src);
    writeFileSync(host,JSON.stringify({callables:['probe'],types:{probe:{parameters:['Number'],result:'Number'}}}));
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked','--host',host],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      const setup=target==='js'?'let calls=0; const __miraHost={probe:x=>{calls++;return x;}};':'$calls=0; $GLOBALS["__miraHost"]=["probe"=>function($x) use (&$calls){$calls++;return $x;}];';
      const suffix=target==='js'?'\nconsole.log(JSON.stringify([result,read_percent(120),read_percent(NaN),read_retry(3),read_retry(2.5),read_retry("3"),read_closure(7),calls]));':'\necho json_encode([$result,read_percent(120),read_percent(NAN),read_retry(3),read_retry(2.5),read_retry("3"),read_closure(7),$calls]);';
      writeFileSync(file,(target==='js'?setup+'\n'+r.stdout:r.stdout.replace('declare(strict_types=1);','declare(strict_types=1);\n'+setup))+suffix);
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);
      assert.deepEqual(JSON.parse(run.stdout),[{tag:'Ok',value:42},{tag:'Err',value:'Invalid numeric value'},{tag:'Err',value:'Invalid numeric value'},{tag:'Ok',value:3},{tag:'Err',value:'Invalid Integer value'},{tag:'Err',value:'Invalid Integer value'},{tag:'Ok',value:7},3]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: parametric nominal records and lists preserve their identity and arguments',()=>{
  const src='Pair (First Type, Second Type) :: {first: First Type, second: Second Type}; Bag (Element Type) :: [Element Type]; Envelope (T) :: {pair: Pair (T, Text), items: Bag (T)}; make pair (A, B): x (A), with: y (B) -> Pair (A, B) = {first: x, second: y}; first of (T, U): p (Pair (T, U)) -> T = p ~ first; a = make pair: 42, with: "Ada"; b = make pair: "Mira", with: true; c (Bag (Number)) = [1, 2]; wrapped (Envelope (Number)) = {pair: a, items: c}; result = first of: a; other = first of: b;';
  const t=check(src);
  assert.equal(t.a,'Pair (Number, Text)');
  assert.equal(t.b,'Pair (Text, Boolean)');
  assert.equal(t.c,'Bag (Number)');
  assert.equal(t.wrapped,'Envelope (Number)');
  assert.equal(t.result,'Number');
  assert.equal(t.other,'Text');
  for(const [extra,pattern] of [
    ['bad (Pair (Text, Number)) = a;',/expected Text, got Number/],
    ['bad (Pair (Number, Text)) = {first: "wrong", second: "x"};',/expected Number, got Text/],
    ['bad (Pair) = a;',/requires 2 type arguments/],
    ['bad (Pair (Number)) = a;',/Expected , in type annotation/],
    ['bad (Bag (Text)) = c;',/expected Text, got Number/],
    ['Sibling (T, U) :: {first: T, second: U}; bad (Sibling (Number, Text)) = a;',/expected Sibling/],
    ['bad = first of: {first: 1, second: "x"};',/expected Pair/],
    ['bad (T) = 1;',/Unknown annotation type T/],
    ['Loop (T) :: {next: Loop (T)};',/Unknown annotation type Loop/]
  ]) assert.throws(()=>check(src+extra),pattern,extra);
});
test('types: nominal parametric data erase to ordinary records and lists on both targets',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-parametric-data-'));
  try{
    const input=join(dir,'program.mira');
    const typed='Pair (T, U) :: {first: T, second: U}; Bag (T) :: [T]; a (Pair (Number, Text)) = {first: 42, second: "Ada"}; b (Bag (Number)) = [1, 2]; result = {a: a, b: b};';
    const plain='a = {first: 42, second: "Ada"}; b = [1, 2]; result = {a: a, b: b};';
    for(const target of ['js','php']){
      writeFileSync(input,typed);
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      writeFileSync(input,plain);
      const baseline=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(baseline.status,0,baseline.stderr);
      assert.equal(r.stdout,baseline.stdout);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,r.stdout+(target==='js'?'\nconsole.log(JSON.stringify(result));':'\necho json_encode($result);'));
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);
      assert.deepEqual(JSON.parse(run.stdout),{a:{first:42,second:'Ada'},b:[1,2]});
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('types: recursive sum references preserve arguments and allow nested exhaustive match',()=>{
  const src='Tree (Element Type) :: Leaf (Element Type) | Branch ([Tree (Element Type)]); Chain :: End | Link ({value: Number, next: Chain}); sum tree: tree (Tree (Number)) -> Number = match: tree {leaf: {n | n}, branch: {children | fold: children, with: {acc, child | acc + (sum tree: child)}, from: 0}}; head: chain (Chain) -> Number = match: chain {end: {| 0}, link: {node | match: (node ~ next) {end: {| node ~ value}, link: {next | next ~ value}}}}; a = Leaf: 42; b = Branch: [a, (Branch: [(Leaf: 7)])]; c = Leaf: "Mira"; chain = Link: {value: 1, next: (Link: {value: 2, next: End})}; result = sum tree: b; other = head: chain;';
  const t=check(src);
  assert.equal(t.a,'Tree (Number)');
  assert.equal(t.b,'Tree (Number)');
  assert.equal(t.c,'Tree (Text)');
  assert.equal(t.chain,'Chain');
  assert.equal(t.result,'Number');
  assert.equal(t.other,'Number');
  for(const [extra,pattern] of [
    ['bad = Branch: [a, c];',/expected Number, got Text|expected Text, got Number/],
    ['bad = sum tree: c;',/expected Number, got Text/],
    ['bad = match: b {leaf: {n | n}};',/Non-exhaustive match/],
    ['Wrong (T) :: Stop | Again (Wrong ([T]));',/Recursive sum must preserve its type parameters/],
    ['Wrong (T, U) :: Stop | Again (Wrong (U, T));',/Recursive sum must preserve its type parameters/],
    ['Wrong (T) :: Stop | Again (Wrong);',/requires 1 type arguments/],
    ['Wrong :: Stop | Again (Unknown);',/Unknown annotation type Unknown/]
  ]) assert.throws(()=>check(src+extra),pattern,extra);
});
test('types: recursive trees and chains use ordinary native sum records on JS and PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-recursive-sums-'));
  try{
    const input=join(dir,'program.mira');
    const src='Tree (T) :: Leaf (T) | Branch ([Tree (T)]); sum tree: tree (Tree (Number)) -> Number = match: tree {leaf: {n | n}, branch: {children | fold: children, with: {acc, child | acc + (sum tree: child)}, from: 0}}; a = Branch: [(Leaf: 2), (Branch: [(Leaf: 3), (Leaf: 4)])]; result = sum tree: a;';
    writeFileSync(input,src);
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const plain=spawnSync('node',['dist/mira.cjs',input,target],{encoding:'utf8'});
      assert.equal(plain.status,0,plain.stderr);
      assert.equal(r.stdout,plain.stdout);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,r.stdout+(target==='js'?'\nconsole.log(JSON.stringify([a,result]));':'\necho json_encode([$a,$result]);'));
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);
      assert.deepEqual(JSON.parse(run.stdout),[{tag:'Branch',value:[{tag:'Leaf',value:2},{tag:'Branch',value:[{tag:'Leaf',value:3},{tag:'Leaf',value:4}]}]},9]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.65 module identities preserve local names, constructors, sections and recursive types',()=>{
  const src='module Music / Jazz Harmony; Note :: Number; Tree (T) :: Leaf (T) | Branch ([Tree (T)]); Result (T, E) :: Ok (T) | Err (E); Pitch :: Number where _ >= 0 AND _ <= 127; rate = 2; scale: x = x * rate; local: rate = rate; a (Note) = 42; tree = Branch: [(Leaf: 3)]; f = scale: _; result = 3 >> f; shadow = local: 9; valid = validate: (42), as: (Pitch);';
  const t=check(src);
  const prefix='Music / Jazz Harmony / ';
  assert.equal(t[prefix+'a'],prefix+'Note');
  assert.equal(t[prefix+'tree'],prefix+'Tree (Number)');
  assert.equal(t[prefix+'result'],'Number');
  assert.equal(t[prefix+'shadow'],'Number');
  assert.equal(t[prefix+'valid'],prefix+'Result ('+prefix+'Pitch, Text)');
  assert.equal(check('module name = "legacy"; result = module name;').result,'Text');
});
test('0.65 isolated modules sharing local names compile and execute on both targets',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-isolated-modules-'));
  const m=(path,name,kind='v')=>'__miraModule_'+kind+'_'+Buffer.from(path+' / '+name).toString('hex').toUpperCase();
  try{
    const input=join(dir,'program.mira');
    writeFileSync(join(dir,'parent.mira'),'module Music; Note :: Number; rate = 2; scale: x = x * rate; Scale: x = x + rate; result = scale: 4; other = Scale: 4;');
    writeFileSync(join(dir,'sibling.mira'),'module Music / Rhythm; Note :: Text; rate = 3; scale: x = x * rate; result = scale: 4;');
    const src='module Music / Jazz Harmony; import "parent.mira"; import "sibling.mira"; Note :: Number; Option (T) :: Some (T) | None; rate = 5; scale: x = x * rate; a = Some: 4; result = match: a {some: {x | scale: x}, none: {| 0}};';
    writeFileSync(input,src);
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const names=[m('Music','result'),m('Music','other'),m('Music / Rhythm','result'),m('Music / Jazz Harmony','result')];
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      const code=target==='js'?'\nconsole.log(JSON.stringify(['+names.join(',')+']));':'\necho json_encode(['+names.map(x=>'$'+x).join(',')+']);';
      writeFileSync(file,r.stdout+code);
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);
      assert.deepEqual(JSON.parse(run.stdout),[8,6,12,20]);
      if(target==='php') assert.ok(!r.stdout.split('\n').filter(l=>l.trim().startsWith('global ')).some(l=>l.includes(m('Music','rate'))&&l.includes(m('Music / Rhythm','rate'))));
    }
    for(const [source,pattern] of [
      ['module Music / Jazz Harmony; import "parent.mira"; bad = rate;',/Unknown identifier/],
      ['module Music / Jazz Harmony; import "parent.mira"; bad = scale: 1;',/Unknown identifier/],
      ['module Music / Jazz Harmony; import "parent.mira"; bad (Note) = 1;',/Unknown annotation type Note/],
      ['import "parent.mira"; bad = rate;',/Unknown identifier/],
      ['module Music; import "parent.mira";',/Duplicate module Music/],
      ['module Music / ; x = 1;',/Expected module path/]
    ]){
      writeFileSync(input,source);
      const result=spawnSync('node',['dist/mira.cjs',input,'--check'],{encoding:'utf8'});
      assert.notEqual(result.status,0,source);
      assert.match(result.stderr,pattern,source);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.66 flat interfaces accept inferred selectors, values and public nominal types',()=>{
  const src='module Math / Integer Math;\ninterface\nPair (T, U) :: {first: T, second: U}; Option (T) :: Some (T) | None; rate; square:; add: by: ;\nimplementation\nrate = 2; square: x = x * x; add: x, by: y = x + y; private constant = 42; a (Pair (Number, Text)) = {first: 1, second: "x"}; b = Some: 7; result = add: (square: rate), by: private constant;';
  const t=check(src), p='Math / Integer Math / ';
  assert.equal(t[p+'square:'],'(Number) -> Number');
  assert.equal(t[p+'add:by:'],'(Number, Number) -> Number');
  assert.equal(t[p+'a'],p+'Pair (Number, Text)');
  assert.equal(t[p+'b'],p+'Option (Number)');
  assert.equal(t[p+'result'],'Number');
  assert.equal(check('module M; interface implementation x = 1;')['M / x'],'Number');
  for(const [source,pattern] of [
    ['interface missing:; implementation x = 1;',/Unknown interface export missing:/],
    ['interface add:by:; add: by: ; implementation add: a, by: b = a + b;',/Duplicate interface export add:by:/],
    ['interface add: by; implementation x = 1;',/Expected complete export selector/],
    ['interface x; x; implementation x = 1;',/Duplicate interface export x/],
    ['interface x: ;',/requires explicit selector signature/],
    ['interface interface implementation x = 1;',/Duplicate interface section/],
    ['interface x; implementation x = 1; implementation y = 2;',/Unexpected module section marker/],
    ['interface T; implementation T :: Number; T = 1;',/Ambiguous value or type export/],
    ['interface T :: Number; implementation T :: Text;',/Duplicate or reserved type T/],
    ['interface import "unused.mira"; x; implementation x = 1;',/Interface exports must precede imports/],
    ['interface import Data / Math {f:;}; implementation x = 1;',/Module not found: Data \/ Math/]
  ]) assert.throws(()=>check('module M; '+source),pattern,source);
});
test('0.66 adding an interface does not change emitted JS or PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-flat-interface-'));
  try {
    const input=join(dir,'program.mira');
    const types='Option (T) :: Some (T) | None;';
    const body='rate = 2; square: x = x * x; add: x, by: y = x + y; a = Some: (square: rate); result = match: a {some: {x | add: x, by: 1}, none: {| 0}};';
    const plain='module Math / Integer Math; '+types+body;
    const exposed='module Math / Integer Math; interface '+types+'rate; square:; add: by:; implementation '+body;
    for(const target of ['js','php']){
      const compile=src=>{writeFileSync(input,src);return spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});};
      const a=compile(plain),b=compile(exposed);
      assert.equal(a.status,0,a.stderr);assert.equal(b.status,0,b.stderr);
      assert.equal(a.stdout,b.stdout);
      const name='__miraModule_v_'+Buffer.from('Math / Integer Math / result').toString('hex').toUpperCase();
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,b.stdout+(target==='js'?'\nconsole.log('+name+');':'\necho $'+name+';'));
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'5');
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.67 logical imports resolve aliases and types to their original canonical identities',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-selective-imports-'));
  try{
    const input=join(dir,'program.mira');
    mkdirSync(join(dir,'Math'),{recursive:true});
    writeFileSync(join(dir,'Math','Integer Math.mira'),'module Math / Integer Math; interface Amount :: Number; Option (T) :: Some (T) | None; rate; square: ; add: by: ; implementation rate = 2; square: x = x * x; add: x, by: y = x + y; secret = 42;');
    const pre='module App; interface Pair :: {amount: Quantity}; result; import Math / Integer Math {Amount => Quantity; rate => unit rate; square: ; add: by: => somma: a: ; Option; Some: => Just: ; None;}; implementation ';
    const body='amount (Quantity) = 3; pair (Pair) = {amount: amount}; calc: x = somma: (square: x), a: unit rate; section = somma: _, a: 1; wrapped (Option (Number)) = Just: (calc: 3); result = match: wrapped {some: {x | x >> section}, none: {| 0}};';
    const src=pre+body;
    writeFileSync(input,src);
    const checked=spawnSync('node',['dist/mira.cjs',input,'--check'],{encoding:'utf8'});
    assert.equal(checked.status,0,checked.stderr);
    const report=JSON.parse(checked.stdout);
    assert.equal(report.find(x=>x.name==='App / amount').type,'Math / Integer Math / Amount');
    assert.equal(report.find(x=>x.name==='App / result').type,'Number');
    for(const target of ['js','php']){
      const compile=source=>{writeFileSync(input,source);return spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});};
      const a=compile(src), b=compile(src.replace('somma: a: ;','plus: with: ;').replaceAll('somma:','plus:').replaceAll(', a:',', with:'));
      assert.equal(a.status,0,a.stderr);assert.equal(b.status,0,b.stderr);
      assert.equal(a.stdout,b.stdout);
      const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,a.stdout+(target==='js'?'\nconsole.log('+name+');':'\necho $'+name+';'));
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'12');
    }
    const valid=['module App; import Math / Integer Math { * }; result = add: (square: 3), by: rate;','module App; import Math / Integer Math / square: ; result = square: 3;'];
    for(const source of valid){writeFileSync(input,source);const a=spawnSync('node',['dist/mira.cjs',input,'--check'],{encoding:'utf8'});assert.equal(a.status,0,a.stderr);}
    for(const [source,pattern] of [
      ['module App; import Math / Integer Math {secret;}; result = secret;',/Symbol not exported/],
      ['module App; import Math / Integer Math {square: ;}; result = add: 1, by: 2;',/Unknown identifier/],
      ['module App; import Math / Integer Math {add: by: => add: ;};',/preserve selector arity/],
      ['module App; import Math / Integer Math {rate; rate;};',/Duplicate imported name/],
      ['module App; import Math / Integer Math {rate;}; rate = 1;',/Imported name conflicts/],
      ['module App; interface Pair :: {amount: Amount}; implementation import Math / Integer Math {Amount;}; x = 1;',/Unknown annotation type Amount/],
      ['module App; import App {x;}; x = 1;',/Import cycle/]
    ]){
      writeFileSync(input,source);const a=spawnSync('node',['dist/mira.cjs',input,'--check'],{encoding:'utf8'});
      assert.notEqual(a.status,0,source);assert.match(a.stderr,pattern,source);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.68 public contracts supply parameter and result annotations without repetition',()=>{
  const src='module Math / Example; interface Amount :: Number; rate (Number); square: :: (Number) -> Number; add: by: :: (Number, Number) -> Number; identity (Value Type): :: (Value Type) -> Value Type; pair (A, B): with: :: (A, B) -> {first: A, second: B}; make amount: :: (Number) -> Amount; double: ; implementation rate = 2; square: x = x * x; add: x, by: y = x + y; identity: x = x; pair: x, with: y = {first: x, second: y}; make amount: x = x; double: x = x + x; a = identity: 42; b = identity: "Mira"; c = pair: 1, with: "Mira"; result = make amount: 7;';
  const t=check(src), p='Math / Example / ';
  assert.equal(t[p+'rate'],'Number');
  assert.equal(t[p+'square:'],'(Number) -> Number');
  assert.equal(t[p+'add:by:'],'(Number, Number) -> Number');
  assert.equal(t[p+'identity:'],"('a) -> 'a");
  assert.equal(t[p+'a'],'Number');assert.equal(t[p+'b'],'Text');
  assert.equal(t[p+'c'],'{first: Number, second: Text}');
  assert.equal(t[p+'result'],p+'Amount');
  assert.equal(t[p+'double:'],'(Number) -> Number');
  assert.equal(check('module M; interface f: :: (Number) -> Number; implementation f: x (Number) -> Number = x;')['M / f:'],'(Number) -> Number');
  assert.equal(check('module M; interface id (T): :: (T) -> T; implementation id (U): x (U) -> U = x;')['M / id:'],"('a) -> 'a");
  for(const [src,pattern] of [
    ['interface f: :: (Number) -> Number; implementation f: x = "bad";',/Type check/],
    ['interface f: :: (Text) -> Text; implementation f: x = x * 2;',/Type check/],
    ['interface id (T): :: (T) -> T; implementation id: x = 42;',/Type check/],
    ['interface f: :: (Number) -> Number; implementation f: x (Text) = x;',/Implementation parameter annotation conflicts/],
    ['interface f: :: (Number) -> Number; implementation f: x -> Text = "x";',/Implementation result annotation conflicts/],
    ['interface rate (Number); implementation rate (Text) = "x";',/Implementation result annotation conflicts/],
    ['interface rate (Number); implementation rate = "x";',/Type check/],
    ['interface f: by: :: (Number) -> Number; implementation f: x, by: y = x;',/Public signature arity mismatch/],
    ['interface f: :: (Number) -> Number; implementation x = 1;',/Unknown interface export/],
    ['interface f: ; f: :: (Number) -> Number; implementation f: x = x;',/Duplicate interface export/],
    ['interface f: :: (Hidden) -> Number; implementation Hidden :: Number; f: x = x;',/Unknown annotation type Hidden/]
  ]) assert.throws(()=>check('module M; '+src),pattern,src);
});

test('0.68 a public contract is equivalent to implementation annotations in checked JS/PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-public-contract-'));
  try{
    const input=join(dir,'program.mira');
    const a='module Library; interface rate (Number); square: :: (Number) -> Number; identity (T): :: (T) -> T; implementation rate = 2; square: x = x * x; identity: x = x; result = square: (identity: rate);';
    const b='module Library; interface rate; square: ; identity: ; implementation rate (Number) = 2; square: x (Number) -> Number = x * x; identity (T): x (T) -> T = x; result = square: (identity: rate);';
    for(const target of ['js','php']){
      const compile=src=>{writeFileSync(input,src);return spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});};
      const x=compile(a),y=compile(b);
      assert.equal(x.status,0,x.stderr);assert.equal(y.status,0,y.stderr);assert.equal(x.stdout,y.stdout);
      const name='__miraModule_v_'+Buffer.from('Library / result').toString('hex').toUpperCase();
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,x.stdout+(target==='js'?'\nconsole.log('+name+');':'\necho $'+name+';'));
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'4');
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.69 rejects private type escape from inferred public contracts',()=>{
  for(const src of [
    'interface exported; implementation Hidden :: Number; exported (Hidden) = 1;',
    'interface exposed: ; implementation Hidden :: Number; exposed: x (Hidden) = x;',
    'interface exposed; implementation Hidden :: Number; value (Hidden) = 1; exposed = {items: [value]};',
    'interface exposed; implementation Hidden :: Number; value (Hidden) = 1; exposed = {| value};',
    'interface exposed; implementation Hidden (T) :: [T]; exposed (Hidden (Number)) = [1];'
  ]) assert.throws(()=>check('module M; '+src),/Public signature exposes private type M \/ Hidden/,src);
  const types=check('module M; interface Token; make: :: (Number) -> Token; implementation Hidden :: Number; Token :: {secret: Hidden}; make: n = () >> {| value (Hidden) = n; {secret: value}};');
  assert.equal(types['M / make:'],'(Number) -> M / Token');
});

test('0.69 opaque types retain nominal identity while hiding native representation',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-opaque-types-'));
  try{
    const input=join(dir,'program.mira'), lib=join(dir,'Vault.mira');
    const body='Secret :: {value: Number}; Score :: Number; State :: Ready | Busy (Number); make: n = {value: n}; reveal: s = s ~ value; score: n = n; points: n = n + 0; ready = Ready; state value: s = match: s {ready: {| 1}, busy: {n | n}};';
    const library='module Vault; interface Secret; Score; State; make: :: (Number) -> Secret; reveal: :: (Secret) -> Number; score: :: (Number) -> Score; points: :: (Score) -> Number; ready (State); state value: :: (State) -> Number; implementation '+body;
    writeFileSync(lib,library);
    const src='module App; import Vault {Secret => Token; make: ; reveal: ; Score; score: ; points: ; State; ready; state value: ;}; token (Token) = make: 7; number (Score) = score: 5; result = (reveal: token) + (points: number) + (state value: ready);';
    writeFileSync(input,src);
    const report=spawnSync('node',['dist/mira.cjs',input,'--check'],{encoding:'utf8'});
    assert.equal(report.status,0,report.stderr);
    const rows=JSON.parse(report.stdout);
    assert.equal(rows.find(x=>x.name==='App / token').type,'Vault / Secret');
    assert.deepEqual(rows.find(x=>x.name==='App / token').schema,{kind:'Opaque',name:'Vault / Secret'});
    assert.deepEqual(rows.find(x=>x.name==='Vault / make:').schema.result,{kind:'Opaque',name:'Vault / Secret'});
    for(const target of ['js','php']){
      const compile=()=>spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      const a=compile();assert.equal(a.status,0,a.stderr);
      const transparent=library.replace('Secret; Score; State;','Secret :: {value: Number}; Score :: Number; State :: Ready | Busy (Number);').replace('implementation Secret :: {value: Number}; Score :: Number; State :: Ready | Busy (Number);','implementation');
      writeFileSync(lib,transparent);
      const b=compile();assert.equal(b.status,0,b.stderr);assert.equal(a.stdout,b.stdout);
      writeFileSync(lib,library);
      const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,a.stdout+(target==='js'?'\nconsole.log('+name+');':'\necho $'+name+';'));
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'13');
    }
    for(const [code,pattern] of [
      ['import Vault {Secret;}; token (Secret) = {value: 7};',/Type check/],
      ['import Vault {make: ;}; token = make: 7; bad = token ~ value;',/Type check/],
      ['import Vault {Secret;}; bad: s (~ Secret) = s;',/Structural projection requires/],
      ['import Vault {Score;}; score (Score) = 5;',/Type check/],
      ['import Vault {score: ;}; n = score: 5; bad = n + 1;',/Type check/],
      ['import Vault {score: ;}; n = score: 5; bad = n == n;',/Type check/],
      ['import Vault {score: ;}; n = score: 5; bad (Integer) = n;',/Type check/],
      ['import Vault {score: ;}; n = score: 5; bad = validate: (n), as: (Integer), then: {x | x}, else: {e | 0};',/Cannot validate opaque representation/],
      ['import Vault {State; ready;}; bad = match: ready {ready: {| 1}, busy: {n | n}};',/Match requires a known sum type/],
      ['import Vault {Ready;}; bad = Ready;',/Symbol not exported/],
      ['import Vault {Secret;}; bad: s (Secret) = s ~ value;',/Type check/]
    ]){
      writeFileSync(input,'module App; '+code);
      const x=spawnSync('node',['dist/mira.cjs',input,'--check'],{encoding:'utf8'});
      assert.notEqual(x.status,0,code);assert.match(x.stderr,pattern,code);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.69.1 opaque type templates and public nested references preserve type arguments',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-parametric-opaque-'));
  try{
    const input=join(dir,'program.mira'),lib=join(dir,'Boxes.mira');
    const header='module Boxes; interface Box (Element Type); Envelope (T) :: {box: Box (T)}; Choice (T); box (T): :: (T) -> Box (T); item (T): :: (Box (T)) -> T; envelope (T): :: (Box (T)) -> Envelope (T); item in (T): :: (Envelope (T)) -> T; choose (T): :: (T) -> Choice (T); get (T): fallback: :: (Choice (T), T) -> T; implementation ';
    const body='Box (U) :: {item: U}; Choice (U) :: Empty | Full (U); box: x = {item: x}; item: b = b ~ item; envelope: b = {box: b}; item in: e = (e ~ box) ~ item; choose: x = Full: x; get: c, fallback: x = match: c {empty: {| x}, full: {v | v}};';
    writeFileSync(lib,header+body);
    const src='module App; import Boxes {Box => Container; Envelope; Choice; box: ; item: ; envelope: ; item in: ; choose: ; get: fallback: ;}; n (Container (Number)) = box: 7; s (Container (Text)) = box: "Mira"; e (Envelope (Number)) = envelope: n; nested = e ~ box; a = item: nested; b = item: s; result = (item in: e) + (get: (choose: 3), fallback: 0);';
    writeFileSync(input,src);
    const check=()=>spawnSync('node',['dist/mira.cjs',input,'--check'],{encoding:'utf8'});
    const report=check();assert.equal(report.status,0,report.stderr);
    const rows=JSON.parse(report.stdout);
    assert.deepEqual(rows.find(x=>x.name==='App / n').schema,{kind:'Opaque',name:'Boxes / Box',arguments:[{kind:'Number'}]});
    assert.equal(rows.find(x=>x.name==='App / nested').type,'Boxes / Box (Number)');
    assert.equal(rows.find(x=>x.name==='App / b').type,'Text');
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,r.stdout+(target==='js'?'\nconsole.log('+name+');':'\necho $'+name+';'));
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'10');
    }
    for(const [code,pattern] of [
      ['import Boxes {Box; box: ;}; n (Box (Text)) = box: 7;',/Type check/],
      ['import Boxes {Box;}; n (Box (Number)) = {item: 7};',/Type check/],
      ['import Boxes {Box;}; n (Box) = 7;',/requires 1 type arguments/],
      ['import Boxes {box: ;}; n = box: 7; bad = n ~ item;',/Type check/],
      ['import Boxes {box: ; envelope: ;}; e = envelope: (box: 7); bad = (e ~ box) ~ item;',/Type check/],
      ['import Boxes {choose: ;}; c = choose: 7; bad = match: c {empty: {| 0}, full: {x | x}};',/Match requires a known sum type/],
      ['import Boxes {Full: ;}; bad = Full: 7;',/Symbol not exported/],
      ['interface leaked; import Boxes {box: ;}; implementation Hidden :: Number; h (Hidden) = 7; leaked = box: h;',/Public signature exposes private type App \/ Hidden/]
    ]){
      writeFileSync(input,'module App; '+code);const x=check();assert.notEqual(x.status,0,code);assert.match(x.stderr,pattern,code);
    }
    writeFileSync(input,'module App; interface Box (A, B); implementation Box (T) :: [T];');
    assert.match(check().stderr,/Opaque type parameter count mismatch/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.70 re-exports preserve original canonical declarations, aliases and opaque types',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-reexports-'));
  try{
    const input=join(dir,'program.mira');
    writeFileSync(join(dir,'Core.mira'),'module Core; interface Box (T); box (T): :: (T) -> Box (T); item (T): :: (Box (T)) -> T; add: by: ; rate; implementation Box (T) :: {item: T}; box: x = {item: x}; item: b = b ~ item; rate = 2; add: x, by: y = x + y; hidden = 42;');
    writeFileSync(join(dir,'Facade.mira'),'module Facade; interface export Core {Box => Container; box: ; item: ; add: by: => plus: with: ; rate => unit rate;}; implementation');
    writeFileSync(join(dir,'API.mira'),'module API; interface export Facade { * }; implementation');
    const direct='module App; import Core {Box => Container; box: ; item: ; add: by: => plus: with: ; rate => unit rate;}; n (Container (Number)) = box: 7; result = plus: (item: n), with: unit rate;';
    const forwarded=direct.replace('import Core {Box => Container; box: ; item: ; add: by: => plus: with: ; rate => unit rate;};','import API {Container; box: ; item: ; plus: with: ; unit rate;};');
    writeFileSync(input,forwarded);
    const check=()=>spawnSync('node',['dist/mira.cjs',input,'--check'],{encoding:'utf8'});
    const report=check();assert.equal(report.status,0,report.stderr);
    const rows=JSON.parse(report.stdout);
    assert.deepEqual(rows.find(x=>x.name==='App / n').schema,{kind:'Opaque',name:'Core / Box',arguments:[{kind:'Number'}]});
    assert.equal(rows.filter(x=>x.name==='Core / add:by:').length,1);
    assert.equal(rows.some(x=>x.name==='API / plus:with:'),false);
    for(const target of ['js','php']){
      const compile=src=>{writeFileSync(input,src);return spawnSync('node',['dist/mira.cjs',input,target,'--checked'],{encoding:'utf8'});};
      const a=compile(direct),b=compile(forwarded);
      assert.equal(a.status,0,a.stderr);assert.equal(b.status,0,b.stderr);assert.equal(a.stdout,b.stdout);
      const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      writeFileSync(file,b.stdout+(target==='js'?'\nconsole.log('+name+');':'\necho $'+name+';'));
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'9');
    }
    const local='module App; interface result; export Core {rate => unit rate;}; implementation result = unit rate + 1;';
    writeFileSync(input,local);assert.equal(check().status,0,check().stderr);
    for(const [src,pattern] of [
      ['module App; interface export Core {hidden;}; implementation',/Symbol not exported/],
      ['module App; interface export Core {add: by: => sum: ;}; implementation',/preserve selector arity/],
      ['module App; interface export Core {rate;}; import Core {rate;}; implementation',/Duplicate imported name/],
      ['module App; interface export Core {rate;}; implementation rate = 3;',/Imported name conflicts/],
      ['module App; interface import Core {rate;}; export Core {box: ;}; implementation',/Interface exports must precede imports/],
      ['module App; export Core {rate;};',/Re-exports belong in the interface/],
      ['module App; import API {box: ;}; n = box: 1; bad = n ~ item;',/Type check/],
      ['module App; import API {hidden;};',/Symbol not exported/],
      ['module App; import API {Box;};',/Symbol not exported/],
      ['module App; interface export App {rate;}; implementation',/Import cycle/]
    ]) {
      writeFileSync(input,src);const x=check();assert.notEqual(x.status,0,src);assert.match(x.stderr,pattern,src);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.70.1 checked tree shaking retains entry roots, sections, recursive dependencies and effects on JS/PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-tree-shaking-'));
  try{
    const input=join(dir,'program.mira'),host=join(dir,'host.json');
    writeFileSync(host,JSON.stringify({selectors:['tick:'],types:{'tick:':{parameters:['Number'],result:'Number'}}}));
    writeFileSync(join(dir,'Core.mira'),'module Core; interface inc: ; unused: ; even: ; implementation rate = 2; dead data = {label: "unused", items: [1,2,3]}; inc: x = x + rate; unused: x = x * 12345; even: n = if (n <= 0) then true else (odd: (n - 1)); odd: n = if (n <= 0) then false else (even: (n - 1)); effect = tick: 3;');
    writeFileSync(join(dir,'API.mira'),'module API; interface export Core {inc: ; unused: ; even: ;}; implementation');
    writeFileSync(join(dir,'legacy.mira'),'legacy value = 42;');
    writeFileSync(input,'module App; import "legacy.mira"; import API {inc: ; even: ; unused: ;}; f = inc: _; result = 5 >> f; parity = even: 4;');
    for(const target of ['js','php']){
      const compile=(opt,loc=false)=>spawnSync('node',['dist/mira.cjs',input,target,'--checked','--host',host,...(opt?['--tree-shake']:[]),...(loc?['--locations']:[])],{encoding:'utf8'});
      const a=compile(false),b=compile(true);
      assert.equal(a.status,0,a.stderr);assert.equal(b.status,0,b.stderr);
      assert.ok(b.stdout.length<a.stdout.length);
      const m=(owner,name,kind='v')=>'__miraModule_'+kind+'_'+Buffer.from(owner+' / '+name).toString('hex').toUpperCase();
      assert.ok(!b.stdout.includes(m('Core','dead data')));
      assert.ok(!b.stdout.includes(m('Core','unused','s')));
      assert.ok(b.stdout.includes(m('Core','rate')));
      assert.ok(b.stdout.includes('legacyValue'));
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      for(const code of [a.stdout,b.stdout]){
        const init=target==='js'?'const events=[]; const __miraHost={"tick:":x=>(events.push(x),x)};\n':'$events=[]; $GLOBALS["__miraHost"]=["tick:"=>function($x){global $events;$events[]=$x;return $x;}];\n';
        const out=target==='js'?'\nconsole.log(JSON.stringify(['+m('App','result')+','+m('App','parity')+',events]));':'\necho json_encode([$'+m('App','result')+',$'+m('App','parity')+',$events]);';
        writeFileSync(file,target==='js'?init+code+out:code.replace('declare(strict_types=1);','declare(strict_types=1);\n'+init)+out);
        const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
        assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),[7,true,[3]]);
      }
      const located=compile(true,true);assert.equal(located.status,0,located.stderr);
      assert.equal(JSON.parse(located.stdout).output,b.stdout);
    }
    const rejected=spawnSync('node',['dist/mira.cjs',input,'js','--tree-shake'],{encoding:'utf8'});
    assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/requires --checked/);
    // A checked numerical guard in an unused initializer must still execute.
    writeFileSync(join(dir,'Guarded.mira'),'module Guarded; interface implementation Percentage :: Number where _ >= 0 AND _ <= 100; bad (Percentage) = tick: 101;');
    writeFileSync(input,'module App; import Guarded { * }; result = 1;');
    for(const target of ['js','php']){
      const g=spawnSync('node',['dist/mira.cjs',input,target,'--checked','--tree-shake','--host',host],{encoding:'utf8'});
      assert.equal(g.status,0,g.stderr);assert.match(g.stdout,/__miraNumericValue/);
    }
    // Checking precedes pruning: unused invalid code cannot disappear.
    writeFileSync(join(dir,'Broken.mira'),'module Broken; interface implementation bad: x (Number) -> Text = x;');
    writeFileSync(input,'module App; import Broken { * }; result = 1;');
    const bad=spawnSync('node',['dist/mira.cjs',input,'js','--checked','--tree-shake'],{encoding:'utf8'});
    assert.notEqual(bad.status,0);assert.match(bad.stderr,/Type check/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.73 build-time provider selection is checked and emits the original direct calls on both targets',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-provider-binding-'));
  try {
    const input=join(dir,'program.mira'),manifest=join(dir,'bindings.json');
    mkdirSync(join(dir,'Providers'),{recursive:true});
    for(const [name,body] of [['Memory','x + initial'],['Native','x * initial'],['Broken','"bad"']])
      writeFileSync(join(dir,'Providers',name+'.mira'),'module Providers / '+name+'; interface initial; read: ; identity: ; extra; implementation initial = 2; read: x = '+body+'; identity: x = x; extra = 99;');
    const contract='initial (Number); read: :: (Number) -> Number; identity (T): :: (T) -> T;';
    const src='module App; import Services / Storage {read: => load: ; identity: ;}; result = load: (identity: 5);';
    const config=(provider,text=contract)=>writeFileSync(manifest,JSON.stringify({'Services / Storage':{provider,contract:text}}));
    const compile=(target,extra=[])=>spawnSync('node',['dist/mira.cjs',input,target,...extra],{encoding:'utf8'});
    for(const [provider,expected] of [['Providers / Memory',7],['Providers / Native',10]]){
      config(provider);
      for(const target of ['js','php']){
        writeFileSync(input,src);
        const a=compile(target,['--checked','--tree-shake','--bindings',manifest]);
        assert.equal(a.status,0,a.stderr);
        writeFileSync(input,src.replace('Services / Storage',provider));
        const direct=compile(target,['--checked','--tree-shake']);
        assert.equal(direct.status,0,direct.stderr);
        assert.equal(a.stdout,direct.stdout);
        const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
        const file=join(dir,target==='js'?'out.mjs':'out.php');
        writeFileSync(file,a.stdout+(target==='js'?'\nconsole.log('+name+');':'\necho $'+name+';'));
        const executed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
        assert.equal(executed.status,0,executed.stderr);assert.equal(Number(executed.stdout),expected);
      }
    }
    config('Providers / Memory');
    for(const [source,pattern] of [
      ['module App; import Services / Storage {extra;}; result = extra;',/Symbol not exported/],
      ['module App; import Services / Storage { * }; result = extra;',/Unknown identifier/],
      ['module App; import Services / Storage {read: ;}; result = read: "bad";',/Type check/]
    ]){
      writeFileSync(input,source);
      const x=compile('--check',['--bindings',manifest]);
      assert.notEqual(x.status,0,source);assert.match(x.stderr,pattern);
    }
    writeFileSync(input,src);
    const unchecked=compile('js',['--bindings',manifest]);
    assert.notEqual(unchecked.status,0);assert.match(unchecked.stderr,/requires --checked/);
    config('Providers / Broken');
    const broken=compile('js',['--checked','--bindings',manifest]);
    assert.notEqual(broken.status,0);assert.match(broken.stderr,/Type check/);
    config('Providers / Memory',contract+' missing (Number);');
    const missing=compile('js',['--checked','--bindings',manifest]);
    assert.notEqual(missing.status,0);assert.match(missing.stderr,/Contract symbol not publicly defined/);
    config('Services / Storage');
    const loop=compile('js',['--checked','--bindings',manifest]);
    assert.notEqual(loop.status,0);assert.match(loop.stderr,/Provider must be a concrete module/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.74 interface-only modules supply public signatures and abstract representations to providers',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-interface-contract-'));
  try {
    mkdirSync(join(dir,'Services'),{recursive:true});
    mkdirSync(join(dir,'Providers'),{recursive:true});
    const input=join(dir,'program.mira'),manifest=join(dir,'bindings.json'),contractFile=join(dir,'Services','Storage.mira');
    const contract='module Services / Storage; interface Storage; open: :: (Text) -> Storage; read: key: :: (Storage, Text) -> Text; close: :: (Storage) -> Boolean;';
    writeFileSync(contractFile,contract);
    const prefix=name=>'module Providers / '+name+'; implements Services / Storage; implementation ';
    const memory=prefix('Memory')+'Storage :: {name: Text}; open: name = {name: name}; read: store, key: k = store ~ name; close: store = true; extra = 99;';
    const native=prefix('Native')+'Storage :: Text; open: name = name; read: store, key: k = k; close: store = true;';
    writeFileSync(join(dir,'Providers','Memory.mira'),memory);
    writeFileSync(join(dir,'Providers','Native.mira'),native);
    const source='module App; import Services / Storage {Storage; open: ; read: key: ; close: ;}; store (Storage) = open: "memory"; result = read: store, key: "native"; done = close: store;';
    const config=provider=>writeFileSync(manifest,JSON.stringify({'Services / Storage':{provider}}));
    const compile=(target,flags)=>spawnSync('node',['dist/mira.cjs',input,target,...flags],{encoding:'utf8'});
    for(const [provider,expected] of [['Providers / Memory','memory'],['Providers / Native','native']]){
      config(provider);
      for(const target of ['js','php']){
        writeFileSync(input,source);
        const bound=compile(target,['--checked','--bindings',manifest,'--tree-shake']);
        assert.equal(bound.status,0,bound.stderr);
        writeFileSync(input,source.replace('import Services / Storage','import '+provider));
        const direct=compile(target,['--checked','--tree-shake']);
        assert.equal(direct.status,0,direct.stderr);assert.equal(bound.stdout,direct.stdout);
        const name='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
        const file=join(dir,target==='js'?'out.mjs':'out.php');
        writeFileSync(file,bound.stdout+(target==='js'?'\nconsole.log('+name+');':'\necho $'+name+';'));
        const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
        assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),expected);
      }
    }
    config('Providers / Memory');
    for(const [bad,pattern] of [
      [source+' leaked = store ~ name;',/Type check/],
      ['module App; import Services / Storage {Storage;}; store (Storage) = {name: "forged"};',/Type check/],
      ['module App; import Services / Storage {extra;}; result = extra;',/Symbol not exported/]
    ]){
      writeFileSync(input,bad);const x=compile('--check',['--bindings',manifest]);assert.notEqual(x.status,0);assert.match(x.stderr,pattern);
    }
    writeFileSync(input,source.replace('import Services / Storage','import Providers / Memory'));
    const unchecked=compile('js',[]);assert.notEqual(unchecked.status,0);assert.match(unchecked.stderr,/require checked compilation/);
    writeFileSync(input,source);
    writeFileSync(join(dir,'Providers','Memory.mira'),memory.replace('Storage :: {name: Text};',''));
    let bad=compile('--check',['--bindings',manifest]);assert.notEqual(bad.status,0);assert.match(bad.stderr,/Missing abstract type implementation/);
    writeFileSync(join(dir,'Providers','Memory.mira'),memory.replace('close: store = true;',''));
    bad=compile('--check',['--bindings',manifest]);assert.notEqual(bad.status,0);assert.match(bad.stderr,/Unknown interface export/);
    writeFileSync(join(dir,'Providers','Memory.mira'),memory.replace('close: store = true;','close: store = "bad";'));
    bad=compile('--check',['--bindings',manifest]);assert.notEqual(bad.status,0);assert.match(bad.stderr,/Type check/);
    writeFileSync(join(dir,'Providers','Memory.mira'),'module Providers / Memory; interface implementation');
    bad=compile('--check',['--bindings',manifest]);assert.notEqual(bad.status,0);assert.match(bad.stderr,/must implement contract/);
    writeFileSync(join(dir,'Providers','Memory.mira'),memory);
    writeFileSync(contractFile,contract+' implementation');
    bad=compile('--check',['--bindings',manifest]);assert.notEqual(bad.status,0);assert.match(bad.stderr,/cannot contain implementation/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.75 checks a consumer and a contract before a provider exists, but never emits unbound contracts',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-abstract-check-'));
  try {
    mkdirSync(join(dir,'Services'),{recursive:true});
    const input=join(dir,'program.mira');
    const contract='module Services / Storage; interface Storage; Box (T); Envelope (T) :: {box: Box (T)}; version (Number); open: :: (Text) -> Storage; read: key: :: (Storage, Text) -> Text; box (T): :: (T) -> Box (T); item (T): :: (Box (T)) -> T;';
    writeFileSync(join(dir,'Services','Storage.mira'),contract);
    writeFileSync(join(dir,'Services','Other.mira'),'module Services / Other; interface Storage; open: :: (Text) -> Storage;');
    const source='module App; import Services / Storage {Storage; Box; Envelope; version; open: ; read: key: ; box: ; item: ;}; store (Storage) = open: "db"; result = read: store, key: "x"; n (Box (Number)) = box: 7; s (Box (Text)) = box: "text"; e (Envelope (Number)) = {box: n}; number result = item: (e ~ box); text result = item: s;';
    const run=(src,flags)=>{writeFileSync(input,src);return spawnSync('node',['dist/mira.cjs',input,...flags],{encoding:'utf8'});};
    const checked=run(source,['--check-json']);assert.equal(checked.status,0,checked.stderr);
    const report=JSON.parse(checked.stdout);assert.equal(report.ok,true);
    const row=name=>report.types.find(x=>x.name===name);
    assert.equal(row('App / store').schema.name,'Services / Storage / Storage');
    assert.equal(row('App / store').schema.kind,'Opaque');
    assert.equal(row('App / number result').type,'Number');
    assert.equal(row('App / text result').type,'Text');
    assert.equal(row('Services / Storage / open:').abstractContract,true);
    for(const target of ['js','php'])for(const flags of [[],['--checked'],['--checked','--tree-shake']]){
      const emitted=run(source,[target,...flags]);assert.notEqual(emitted.status,0);assert.match(emitted.stderr,/selected provider/);
    }
    for(const bad of [
      source+' leaked = store ~ name;',
      source+' forged (Storage) = "forged";',
      source+' invalid (Box (Text)) = n;',
      source+' invalid = read: 42, key: "x";',
      'module App; import Services / Storage {Storage; read: key: ;}; import Services / Other {Storage => Other Storage; open: ;}; other (Other Storage) = open: "db"; result = read: other, key: "x";'
    ]){
      const result=run(bad,['--check-json']);assert.notEqual(result.status,0,bad);assert.equal(JSON.parse(result.stdout).ok,false);
    }
    const standalone=run('module Standalone; interface Token; make: :: (Number) -> Token;',['--check']);
    assert.equal(standalone.status,0,standalone.stderr);
    const typo=run('module Standalone; interface value (Misspelled);',['--check']);
    assert.notEqual(typo.status,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.76 contract type identities remain stable before linking and across different providers',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-contract-identity-'));
  try{
    mkdirSync(join(dir,'Services'),{recursive:true});mkdirSync(join(dir,'Providers'),{recursive:true});
    const input=join(dir,'program.mira'),manifest=join(dir,'bindings.json');
    writeFileSync(join(dir,'Services','Storage.mira'),'module Services / Storage; interface Storage; Envelope :: {store: Storage}; open: :: (Text) -> Storage; read: key: :: (Storage, Text) -> Text; wrap: :: (Storage) -> Envelope;');
    const provider=(name,type,body,read)=>'module Providers / '+name+'; implements Services / Storage; implementation Storage :: '+type+'; open: x = '+body+'; read: s, key: k = '+read+'; wrap: s = {store: s};';
    writeFileSync(join(dir,'Providers','Memory.mira'),provider('Memory','{name: Text}','{name: x}','s ~ name'));
    writeFileSync(join(dir,'Providers','Native.mira'),provider('Native','Text','x','k'));
    const source='module App; import Services / Storage {Storage; Envelope; open: ; read: key: ; wrap: ;}; store (Storage) = open: "memory"; envelope (Envelope) = wrap: store; result = read: (envelope ~ store), key: "native";';
    const run=(src,flags)=>{writeFileSync(input,src);return spawnSync('node',['dist/mira.cjs',input,...flags],{encoding:'utf8'});};
    function rows(flags){const r=run(source,['--check',...flags]);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout).filter(x=>x.module==='App').map(x=>({name:x.name,type:x.type,schema:x.schema}));}
    const abstract=rows([]);
    assert.equal(abstract.find(x=>x.name==='App / store').schema.name,'Services / Storage / Storage');
    assert.equal(abstract.find(x=>x.name==='App / envelope').schema.name,'Services / Storage / Envelope');
    for(const [name,expected] of [['Memory','memory'],['Native','native']]){
      writeFileSync(manifest,JSON.stringify({'Services / Storage':{provider:'Providers / '+name}}));
      const flags=['--bindings',manifest];
      assert.deepEqual(rows(flags),abstract);
      const forbidden=run(source+' leaked = store ~ name;',['--check',...flags]);
      assert.notEqual(forbidden.status,0);assert.match(forbidden.stderr,/Type check/);
      for(const target of ['js','php']){
        const compiled=run(source,[target,'--checked','--tree-shake',...flags]);
        assert.equal(compiled.status,0,compiled.stderr);
        const result='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
        const file=join(dir,target==='js'?'out.mjs':'out.php');
        writeFileSync(file,compiled.stdout+(target==='js'?'\nconsole.log('+result+');':'\necho $'+result+';'));
        const executed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
        assert.equal(executed.status,0,executed.stderr);assert.equal(executed.stdout.trim(),expected);
      }
    }
    writeFileSync(manifest,JSON.stringify({'Services / Storage':{provider:'Providers / Memory'}}));
    const imports='module App; import Services / Storage {Storage; open: ; read: key: ;}; import Providers / Native {Storage => Native Storage; open: => native open: ; read: key: => native read: key: ;}; ';
    const mixed=imports+'a (Storage) = open: "one"; b (Native Storage) = native open: "two"; result = native read: b, key: "ok";';
    const valid=run(mixed,['--check','--bindings',manifest]);assert.equal(valid.status,0,valid.stderr);
    const report=JSON.parse(valid.stdout);
    assert.equal(report.find(x=>x.name==='App / b').schema.name,'Providers / Native / Storage');
    const invalid=run(mixed+' wrong = read: b, key: "bad";',['--check','--bindings',manifest]);
    assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Type check/);
    const unbound=run(mixed+' wrong = read: b, key: "bad";',['--check']);
    assert.notEqual(unbound.status,0);assert.match(unbound.stderr,/Type check/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('0.77 canonical public interface fingerprints ignore private changes and detect public type changes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-interfaces-'));
  try{
    const input=join(dir,'program.mira');
    const src='module Lib; interface Secret; Window :: Number where _ >= 0 AND _ <= 10; Unused :: {x: Text, y: Number}; value (Number); id (T): :: (T) -> T; make: :: (Text) -> Secret; implementation Secret :: {name: Text}; value = 1; id: x = x; make: x = {name: x}; private value = 3;';
    const snapshot=source=>{
      writeFileSync(input,source);
      const r=spawnSync('node',['dist/mira.cjs',input,'--interfaces'],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const report=JSON.parse(r.stdout);assert.equal(report.format,1);
      const data=report.interfaces.find(x=>x.module==='Lib');
      assert.equal(data.fingerprint,createHash('sha256').update(data.canonical).digest('hex'));
      assert.deepEqual(JSON.parse(data.canonical),data.surface);
      return data;
    };
    const first=snapshot(src);
    assert.equal(first.surface.types.find(x=>x.name==='Secret').schema.kind,'Opaque');
    assert.ok(!first.canonical.includes('private value'));
    assert.ok(!first.canonical.includes('"name":"name"'));
    assert.equal(snapshot(src.replace('private value = 3','private value = 300').replace('value = 1','value = 99').replace('Secret :: {name: Text}','Secret :: Text').replace('make: x = {name: x}','make: x = x')).fingerprint,first.fingerprint);
    assert.equal(snapshot(src.replace('value (Number); id (T): :: (T) -> T;','id (U): :: (U) -> U; value (Number);').replace('{x: Text, y: Number}','{y: Number, x: Text}')).fingerprint,first.fingerprint);
    assert.notEqual(snapshot(src.replace('_ <= 10','_ <= 20')).fingerprint,first.fingerprint);
    assert.notEqual(snapshot(src.replace('y: Number','y: Text')).fingerprint,first.fingerprint);
    assert.notEqual(snapshot(src.replace('value (Number)','value (Integer)')).fingerprint,first.fingerprint);
    writeFileSync(join(dir,'Core.mira'),'module Core; interface Item :: {text: Text}; read: :: (Text) -> Text; implementation read: x = x;');
    writeFileSync(input,'module Facade; interface export Core {Item => Public Item; read: => load: ;}; implementation');
    const f=spawnSync('node',['dist/mira.cjs',input,'--interfaces'],{encoding:'utf8'});
    assert.equal(f.status,0,f.stderr);
    const facade=JSON.parse(f.stdout).interfaces.find(x=>x.module==='Facade');
    assert.equal(facade.surface.types[0].schema.name,'Core / Item');
    assert.equal(facade.surface.symbols[0].name,'load:');
    assert.equal(facade.surface.symbols[0].schema.result.kind,'Text');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.79 interface reports hash the entry and the exact resolver reads independently of public surfaces',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-interface-inputs-'));
  try{
    const input=join(dir,'program.mira');
    const source='module App; interface result; import Core {rate;}; implementation result = rate;';
    const core='module Core; interface rate (Number); implementation rate = 2;';
    const hash=text=>createHash('sha256').update(text).digest('hex');
    writeFileSync(input,source);writeFileSync(join(dir,'Core.mira'),core);
    writeFileSync(join(dir,'Unused.mira'),'module Unused; x = 3;');
    const run=()=>{const r=spawnSync('node',['dist/mira.cjs',input,'--interfaces'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
    const first=run();
    assert.deepEqual(first.sourceInputs,{entry:hash(source),reads:[{path:'Core',fingerprint:hash(core)}]});
    const changed=core.replace('rate = 2','rate = 9');
    writeFileSync(join(dir,'Core.mira'),changed);
    const second=run();
    assert.equal(second.sourceInputs.reads[0].fingerprint,hash(changed));
    assert.deepEqual(second.interfaces.map(x=>x.fingerprint),first.interfaces.map(x=>x.fingerprint));
    assert.equal(second.sourceInputs.entry,first.sourceInputs.entry);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.80 CLI profiles the checked pipeline without changing either emitter output',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-profile-'));
  try{
    const input=join(dir,'program.mira');
    writeFileSync(input,'module App; interface result; implementation result = 2 + 3; unused = 7;');
    const run=flags=>spawnSync('node',['dist/mira.cjs',input,...flags],{encoding:'utf8'});
    for(const target of ['js','php'])for(const optimized of [false,true]){
      const flags=[target,'--checked',...(optimized?['--tree-shake']:[])];
      const raw=run(flags),profiled=run([...flags,'--profile']);
      assert.equal(raw.status,0,raw.stderr);assert.equal(profiled.status,0,profiled.stderr);
      const data=JSON.parse(profiled.stdout);
      assert.equal(data.output,raw.stdout);
      assert.deepEqual(data.profile.phases.map(p=>p.phase),['collect','scopes','expressions','checking',...(optimized?['pruning']:[]),'emission']);
      assert.ok(data.profile.phases.every(p=>Number.isFinite(p.ms)&&p.ms>=0));
      assert.ok(Math.abs(data.profile.phases.reduce((sum,p)=>sum+p.ms,0)-data.profile.totalMs)<1e-6);
    }
    assert.notEqual(run(['js','--profile']).status,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.81 scoped typed host capabilities support statically selected native adapters on JS and PHP',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-host-modules-'));
  try{
    mkdirSync(join(dir,'Services'));mkdirSync(join(dir,'Providers'));
    const input=join(dir,'program.mira'),manifest=join(dir,'host.json'),bindings=join(dir,'bindings.json');
    const source='module App; interface result; import Services / Math {magnitude: ;}; implementation result = magnitude: (0 - 81);';
    const contract='module Services / Math; interface magnitude: :: (Number) -> Number;';
    const native='module Providers / Native; implements Services / Math; implementation magnitude: x = native magnitude x;';
    const pure='module Providers / Pure; implements Services / Math; implementation magnitude: x = if (x < 0) then (0 - x) else x;';
    writeFileSync(join(dir,'Services','Math.mira'),contract);
    writeFileSync(join(dir,'Providers','Native.mira'),native);
    writeFileSync(join(dir,'Providers','Pure.mira'),pure);
    const host={callables:['native magnitude'],types:{'native magnitude':{parameters:['Number'],result:'Number'}},scopes:{'native magnitude':['Providers / Native']}};
    writeFileSync(manifest,JSON.stringify(host));
    const bind=provider=>writeFileSync(bindings,JSON.stringify({'Services / Math':{provider}}));
    const run=(src,flags)=>{writeFileSync(input,src);return spawnSync('node',['dist/mira.cjs',input,...flags,'--host',manifest],{encoding:'utf8'});};
    const flags=['--bindings',bindings];
    const resultName='__miraModule_v_'+Buffer.from('App / result').toString('hex').toUpperCase();
    for(const [provider,isNative] of [['Providers / Native',true],['Providers / Pure',false]]){
      bind(provider);
      for(const target of ['js','php']){
        const emitted=run(source,[target,'--checked','--tree-shake',...flags]);
        assert.equal(emitted.status,0,emitted.stderr);
        assert.equal(emitted.stdout.includes('native magnitude'),isNative);
        const file=join(dir,target==='js'?'out.mjs':'out.php');
        const js=(isNative?'const __miraHost={"native magnitude":Math.abs};\n':'')+emitted.stdout+'\nconsole.log('+resultName+');';
        const php=(isNative?emitted.stdout.replace('declare(strict_types=1);','declare(strict_types=1);\n$GLOBALS["__miraHost"]=["native magnitude"=>abs(...)];'):emitted.stdout)+'\necho $'+resultName+';';
        writeFileSync(file,target==='js'?js:php);
        const executed=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
        assert.equal(executed.status,0,executed.stderr);assert.equal(executed.stdout.trim(),'81');
      }
    }
    bind('Providers / Native');
    for(const bad of [source+' leak = native magnitude (0 - 81);',source+' leak = native magnitude;', 'result = native magnitude (0 - 81);']){
      for(const target of ['--check','js','php']){
        const r=run(bad,target==='--check'?[target,...flags]:[target,'--checked',...flags]);
        assert.notEqual(r.status,0,bad);
      }
    }
    writeFileSync(join(dir,'Providers','Native.mira'),native.replace('native magnitude x','native magnitude "bad"'));
    const wrong=run(source,['--check',...flags]);assert.notEqual(wrong.status,0);assert.match(wrong.stderr,/expected Number, got Text/);
    for(const scopes of [{'missing':['App']},{'native magnitude':[]},{'native magnitude':['../App']},{'native magnitude':['App','App']}]) {
      writeFileSync(manifest,JSON.stringify({...host,scopes}));
      const invalid=run('result = 1;',['--check']);assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/scope/i);
    }
    writeFileSync(manifest,JSON.stringify({...host,types:{}}));
    assert.notEqual(run('result = 1;',['--check']).status,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.83 Text service runs on both CLI targets using the reusable native adapters',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-text-'));
  try{
    const expected={points:7,contains:true,starts:true,ends:true};
    const result='__miraModule_v_417070202F20726573756C74';
    for(const target of ['js','php']){
      const r=spawnSync('node',['dist/mira.cjs','lib/text/App.mira',target,'--checked','--tree-shake','--host','lib/text/host.json','--bindings','lib/text/bindings.json'],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const file=join(dir,target==='js'?'out.mjs':'out.php');
      const js='await import('+JSON.stringify(pathToFileURL(resolve('lib/text/text-host.js')).href)+');\nconst __miraHost=globalThis.MiraTextHost;\n'+r.stdout+'\nconsole.log(JSON.stringify('+result+'));';
      const php=r.stdout.replace('declare(strict_types=1);','declare(strict_types=1);\n$GLOBALS["__miraHost"]=require $argv[1];')+'\necho json_encode($'+result+');';
      writeFileSync(file,target==='js'?js:php);
      const executed=spawnSync(target==='js'?'node':'php',target==='js'?[file]:[file,'lib/text/text-host.php'],{encoding:'utf8'});
      assert.equal(executed.status,0,executed.stderr);assert.deepEqual(JSON.parse(executed.stdout),expected);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.84 CLI generates the JSON decoder manifest from the independent contract',async()=>{
  const {generateJsonDecoder}=await import('../scripts/json-contract.mjs');
  const {readFileSync}=await import('node:fs');
  const run=spawnSync('node',['dist/mira.cjs','lib/json/App.mira','--interfaces','--module-root','lib/common'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const config=JSON.parse(readFileSync('lib/json/decoder.json','utf8'));
  const report=JSON.parse(run.stdout),generated=generateJsonDecoder(report,config);
  assert.equal(generated.host.types[config.capability].result.record.hours,'Number');
  const dir=mkdtempSync(join(tmpdir(),'mira-json-'));
  try{
    const host=join(dir,'host.json'),bindings=join(dir,'bindings.json');
    writeFileSync(host,JSON.stringify(generated.host));writeFileSync(bindings,JSON.stringify(generated.bindings));
    for(const target of ['js','php']){
      const out=spawnSync('node',['dist/mira.cjs','lib/json/App.mira',target,'--module-root','lib/common','--checked','--tree-shake','--host',host,'--bindings',bindings],{encoding:'utf8'});
      assert.equal(out.status,0,out.stderr);
      const name='__miraModule_v_417070202F20726573756C74';
      const file=join(dir,target==='js'?'out.mjs':'out.php');
      const js='await import('+JSON.stringify(pathToFileURL(resolve('runtime/js/typed-data.js')).href)+');\nawait import('+JSON.stringify(pathToFileURL(resolve('lib/json/json-host.js')).href)+');\nconst __miraHost=globalThis.MiraJsonDecoder.host('+JSON.stringify(generated.decoder)+');\n'+out.stdout+'\nconsole.log(JSON.stringify('+name+'));';
      const php=out.stdout.replace('declare(strict_types=1);','declare(strict_types=1);\nrequire $argv[1];$GLOBALS["__miraHost"]=\\Mira\\Json\\host(json_decode($argv[2],true));')+'\necho json_encode($'+name+');';
      writeFileSync(file,target==='js'?js:php);
      const actual=spawnSync(target==='js'?'node':'php',target==='js'?[file]:[file,'lib/json/json-host.php',JSON.stringify(generated.decoder)],{encoding:'utf8'});
      assert.equal(actual.status,0,actual.stderr);assert.deepEqual(JSON.parse(actual.stdout),{name:'Ada',total:60,paid:false,tags:['chitarra']});
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
  const changed=structuredClone(report);changed.interfaces.find(m=>m.module===config.service).surface.symbols.find(s=>s.name===config.selector).schema.result={kind:'Variable',id:0};
  assert.throws(()=>generateJsonDecoder(changed,config),/concrete data types/);
});

test('0.85 fallible JSON schema is consistent with direct decoder and rejects divergence',async()=>{
  const {generateJsonDecoder}=await import('../scripts/json-contract.mjs');
  const {readFileSync}=await import('node:fs');
  const run=spawnSync('node',['dist/mira.cjs','lib/json/App.mira','--interfaces','--module-root','lib/common'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const config=JSON.parse(readFileSync('lib/json/decoder.json','utf8'));
  const report=JSON.parse(run.stdout),generated=generateJsonDecoder(report,config);
  assert.equal(report.interfaces.find(m=>m.module===config.service).surface.symbols.find(s=>s.name===config.fallibleSelector).schema.result.name,'Data / Outcome / Result');
  const wrongIdentity=structuredClone(report);
  wrongIdentity.interfaces.find(m=>m.module===config.service).surface.symbols.find(s=>s.name===config.fallibleSelector).schema.result.name='Services / Json / Result';
  assert.throws(()=>generateJsonDecoder(wrongIdentity,config),/Result/);
  assert.equal(generated.decoder.fallibleCapability,config.fallibleCapability);
  assert.deepEqual(generated.host.types[config.fallibleCapability].result.record.values.list,generated.host.types[config.capability].result);
  const altered=structuredClone(report);
  altered.interfaces.find(m=>m.module===config.service).surface.symbols.find(s=>s.name===config.fallibleSelector).schema.result.alternatives.find(x=>x.tag==='Ok').payload={kind:'Text'};
  assert.throws(()=>generateJsonDecoder(altered,config),/Result/);
  const dir=mkdtempSync(join(tmpdir(),'mira-json-result-'));
  try{
    const host=join(dir,'host.json'),bindings=join(dir,'bindings.json');
    writeFileSync(host,JSON.stringify(generated.host));writeFileSync(bindings,JSON.stringify(generated.bindings));
    const expected=[{accepted:true,total:60,error:''},{accepted:false,total:0,error:'invalid_json_data'},{accepted:false,total:0,error:'invalid_json_data'}];
    for(const target of ['js','php']){
      const out=spawnSync('node',['dist/mira.cjs','lib/json/Fallible.mira',target,'--module-root','lib/common','--checked','--tree-shake','--host',host,'--bindings',bindings],{encoding:'utf8'});
      assert.equal(out.status,0,out.stderr);
      const name='__miraModule_v_417070202F20726573756C74',file=join(dir,target==='js'?'out.mjs':'out.php');
      const js='await import('+JSON.stringify(pathToFileURL(resolve('runtime/js/typed-data.js')).href)+');\nawait import('+JSON.stringify(pathToFileURL(resolve('lib/json/json-host.js')).href)+');\nconst __miraHost=globalThis.MiraJsonDecoder.host('+JSON.stringify(generated.decoder)+');\n'+out.stdout+'\nconsole.log(JSON.stringify('+name+'));';
      const php=out.stdout.replace('declare(strict_types=1);','declare(strict_types=1);\nrequire $argv[1];$GLOBALS["__miraHost"]=\\Mira\\Json\\host(json_decode($argv[2],true));')+'\necho json_encode($'+name+');';
      writeFileSync(file,target==='js'?js:php);
      const actual=spawnSync(target==='js'?'node':'php',target==='js'?[file]:[file,'lib/json/json-host.php',JSON.stringify(generated.decoder)],{encoding:'utf8'});
      assert.equal(actual.status,0,actual.stderr);assert.deepEqual(JSON.parse(actual.stdout),expected);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.86 Date service CLI emits portable date operations without exposing representation',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-date-'));
  try{
    const expected={start:'2028-02-28',finish:'2028-03-01',elapsed:2,weekday:3,leap:true,invalid:false};
    for(const target of ['js','php']){
      const out=spawnSync('node',['dist/mira.cjs','lib/date/App.mira',target,'--checked','--tree-shake','--host','lib/date/host.json','--bindings','lib/date/bindings.json'],{encoding:'utf8'});
      assert.equal(out.status,0,out.stderr);
      const name='__miraModule_v_417070202F20726573756C74',file=join(dir,target==='js'?'out.mjs':'out.php');
      const js='await import('+JSON.stringify(pathToFileURL(resolve('lib/date/date-host.js')).href)+');\nconst __miraHost=globalThis.MiraDateHost;\n'+out.stdout+'\nconsole.log(JSON.stringify('+name+'));';
      const php=out.stdout.replace('declare(strict_types=1);','declare(strict_types=1);\n$GLOBALS["__miraHost"]=require $argv[1];')+'\necho json_encode($'+name+');';
      writeFileSync(file,target==='js'?js:php);
      const actual=spawnSync(target==='js'?'node':'php',target==='js'?[file]:[file,'lib/date/date-host.php'],{encoding:'utf8'});
      assert.equal(actual.status,0,actual.stderr);assert.deepEqual(JSON.parse(actual.stdout),expected);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.87 Storage CLI providers and private filesystem persist across PHP processes',async()=>{
  const {symlinkSync,existsSync,readFileSync}=await import('node:fs');
  const dir=mkdtempSync(join(tmpdir(),'mira-storage-'));
  try{
    const store=join(dir,'private');mkdirSync(store);
    const result='__miraModule_v_417070202F20726573756C74';
    for(const [target,provider] of [['js','browser'],['php','files']]){
      const out=spawnSync('node',['dist/mira.cjs','lib/storage/App.mira',target,'--checked','--tree-shake','--host','lib/storage/host.json','--bindings','lib/storage/bindings-'+provider+'.json'],{encoding:'utf8'});
      assert.equal(out.status,0,out.stderr);
      assert.ok(out.stdout.includes(provider+' read text'));
      if(target==='js'){
        const file=join(dir,'program.mjs');
        const js='await import('+JSON.stringify(pathToFileURL(resolve('lib/storage/storage-host.js')).href)+');\nconst map=new Map();const __miraHost=globalThis.MiraStorageHost.browser({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},"test");\n'+out.stdout+'\nconst p='+result+';console.log(JSON.stringify([p.read("note"),p.save("","note"),p.read("note"),p.save("Caffè 🎸","note"),p.read("note"),p.remove("note"),p.read("note")]));';
        writeFileSync(file,js);const r=spawnSync('node',[file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),[[],true,[''],true,['Caffè 🎸'],true,[]]);
      }else{
        const file=join(dir,'program.php');
        const php=out.stdout.replace('declare(strict_types=1);','declare(strict_types=1);\nrequire $argv[1];$GLOBALS["__miraHost"]=\\Mira\\Storage\\files($argv[2]);')+'\ntry{$p=$'+result+';echo json_encode(["ok"=>true,"value"=>$p[$argv[3]](...array_slice($argv,4))],JSON_THROW_ON_ERROR);}catch(Throwable $e){echo json_encode(["ok"=>false,"error"=>$e->getMessage()]);}';
        writeFileSync(file,php);
        const run=(op,...args)=>{const r=spawnSync('php',[file,'lib/storage/storage-host.php',store,op,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
        const ok=value=>({ok:true,value}),error=error=>({ok:false,error});
        assert.deepEqual(run('read','note'),ok([]));
        assert.deepEqual(run('save','','note'),ok(true));assert.deepEqual(run('read','note'),ok(['']));
        assert.deepEqual(run('save','Caffè 🎸','note'),ok(true));assert.deepEqual(run('read','note'),ok(['Caffè 🎸']));
        assert.deepEqual(run('read','../note'),error('invalid_key'));
        assert.deepEqual(run('save','x'.repeat(65537),'note'),error('value_too_large'));
        assert.deepEqual(run('read','note'),ok(['Caffè 🎸']));
        assert.deepEqual(run('remove','note'),ok(true));assert.deepEqual(run('remove','note'),ok(true));assert.deepEqual(run('read','note'),ok([]));
        assert.equal(existsSync(join(store,'note.txt')),false);
        const outside=join(dir,'outside.txt');writeFileSync(outside,'untouched');
        symlinkSync(outside,join(store,'link.txt'));
        assert.deepEqual(run('read','link'),error('storage_failure'));assert.deepEqual(run('save','x','link'),error('storage_failure'));assert.deepEqual(run('remove','link'),error('storage_failure'));
        assert.equal(readFileSync(outside,'utf8'),'untouched');
      }
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.89.2 scalar equality is portable for numeric representations, sections and polymorphic bodies',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-equality-'));
  try{
    const input=join(dir,'program.mira');
    const source=[
      'same: a, as: b = a == b;',
      'different: a, from: b = a != b;',
      'numeric: x (Number) -> Boolean = x == 1.0;',
      'textual: x (Text) -> Boolean = x == "01";',
      'number section = (_ == 1.0);',
      'text section = (_ != "01");',
      'generic section = (_ == _);',
      'later: x = () >> {| equal = x == x; (x + 1) > 0 AND equal};',
      'result = [(1 == 1.0), (1 != 1.0), (same: 1, as: 1.0), (different: 1, from: 1.0), (numeric: 1), (textual: "1"), (1 >> number section), ("1" >> text section), (same: "01", as: "1"), (same: true, as: false), (later: 1), (1 == (2 / 2)), (same: 9007199254740991, as: 9007199254740991.0)];'
    ].join('\n');
    writeFileSync(input,source);
    const expected=[true,false,true,false,true,false,true,true,false,false,true,true,true];
    for(const target of ['js','php']){
      for(const flags of [[],['--checked'],['--checked','--tree-shake']]){
        const out=spawnSync('node',['dist/mira.cjs',input,target,...flags],{encoding:'utf8'});assert.equal(out.status,0,out.stderr);
        const file=join(dir,target==='js'?'program.mjs':'program.php');
        writeFileSync(file,out.stdout+(target==='js'?'\nconsole.log(JSON.stringify(result));':'\necho json_encode($result);'));
        const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),expected);
        if(target==='php'&&flags.includes('--checked')){
          assert.match(out.stdout,/return \(\$x == 1\.0\);/);
          assert.match(out.stdout,/return \(\$x === '01'\);/);
          assert.match(out.stdout,/__miraEqA/);
        }
      }
    }
    // Unchecked mixed scalar types are not coerced; checked ones are rejected.
    writeFileSync(input,'result = [(1 == "1"), (false == 0), ("01" == "1"), (1 != "1")];');
    const out=spawnSync('node',['dist/mira.cjs',input,'php'],{encoding:'utf8'});assert.equal(out.status,0,out.stderr);
    const run=spawnSync('php',['-r',out.stdout.replace(/^<\?php/,'')+'echo json_encode($result);'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),[false,false,false,true]);
    assert.notEqual(spawnSync('node',['dist/mira.cjs',input,'--check'],{encoding:'utf8'}).status,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.89.3 finite arithmetic differential matrix and fractional remainder',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-arithmetic-matrix-'));
  try{
    const input=join(dir,'program.mira');
    // Keep inputs and intermediate results in the portable numeric domain.
    // Binary fractions and ordinary decimals; mixed signs and safe boundary.
    const pairs=[[5.5,2],[-5.5,2],[5.5,-2],[-5.5,-2],[1.5,0.5],[0.75,0.5],[0.1,0.2],[7,3],[0,2],[9007199254740991,2]];
    const ops=['+','-','*','/','%'];
    const calculate=(op,a,b)=>({'+':()=>a+b,'-':()=>a-b,'*':()=>a*b,'/':()=>a/b,'%':()=>a%b})[op]();
    const literal=n=>n<0?'(0 - '+Math.abs(n)+')':String(n);
    const expressions=[],expected=[];
    for(const [a,b] of pairs)for(const op of ops){
      const value=calculate(op,a,b);
      if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)continue;
      expressions.push('('+literal(a)+' '+op+' '+literal(b)+')');expected.push(value===0?0:value);
    }
    const source=[
      'by two = (_ % 2);',
      'half divisor = (0.75 % _);',
      'rest: a, by: b = a % b;',
      'result = ['+expressions.join(', ')+', (5.5 >> by two), (0.5 >> half divisor), (rest: 1.5, by: 0.5)];',
      'zero remainder = (5 % 0) != (5 % 0);'
    ].join('\n');
    expected.push(1.5,0.25,0);
    writeFileSync(input,source);
    for(const target of ['js','php'])for(const flags of [[],['--checked'],['--checked','--tree-shake']]){
      const out=spawnSync('node',['dist/mira.cjs',input,target,...flags],{encoding:'utf8'});
      assert.equal(out.status,0,out.stderr);
      if(target==='php')assert.match(out.stdout,/\\fmod\(/);
      const file=join(dir,target==='js'?'program.mjs':'program.php');
      const suffix=target==='js'?'\nconsole.log(JSON.stringify([result,zeroRemainder]));':'\necho json_encode([$result,$zeroRemainder],JSON_THROW_ON_ERROR);';
      writeFileSync(file,out.stdout+suffix);
      const run=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);
      const [actual,zero]=JSON.parse(run.stdout);
      assert.deepEqual(actual.map(n=>n===0?0:n),expected,target+' '+flags.join(' '));
      assert.equal(zero,true);
    }
    // No new proof rule for remainder or weakened Integer validation.
    assert.throws(()=>check('bad (Integer) = 5.5 % 2;'),/Integer/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.89.4 independent contracts share nominal types with inherited selective imports',async()=>{
  const {readFileSync}=await import('node:fs');
  const dir=mkdtempSync(join(tmpdir(),'mira-common-outcomes-'));
  try{
    for(const folder of ['Data','Services','Providers'])mkdirSync(join(dir,folder));
    writeFileSync(join(dir,'Data','Outcome.mira'),readFileSync('lib/common/Data/Outcome.mira','utf8'));
    const a='module Services / A; interface parse: :: (Text) -> Result (Text, Text); import Data / Outcome {Result;};';
    const b='module Services / B; interface inspect: :: (Text) -> Result (Text, Text); import Data / Outcome {Result;};';
    const ca=join(dir,'Services','A.mira');
    writeFileSync(ca,a);writeFileSync(join(dir,'Services','B.mira'),b);
    writeFileSync(join(dir,'Providers','A.mira'),'module Providers / A; implements Services / A; implementation import Data / Outcome {Ok: ; Err: ;}; parse: x = if (x == "") then (Err: "empty") else (Ok: x);');
    writeFileSync(join(dir,'Providers','B.mira'),'module Providers / B; implements Services / B; implementation import Data / Outcome {Ok: ; Err: ;}; inspect: x = Ok: x;');
    const input=join(dir,'App.mira'),manifest=join(dir,'bindings.json');
    const source='module App; interface result; import Services / A {parse: ;}; import Services / B {inspect: ;}; import Data / Outcome {Result;}; implementation summarize: x (Result (Text, Text)) -> Text = match: x {ok: {v | v}, err: {e | e}}; result = [(summarize: (parse: "Ada")), (summarize: (parse: "")), (summarize: (inspect: "Mira"))];';
    writeFileSync(input,source);writeFileSync(manifest,JSON.stringify({'Services / A':{provider:'Providers / A'},'Services / B':{provider:'Providers / B'}}));
    const run=(...flags)=>spawnSync('node',['dist/mira.cjs',input,...flags],{encoding:'utf8'});
    const abstract=run('--interfaces');assert.equal(abstract.status,0,abstract.stderr);
    const bound=run('--interfaces','--bindings',manifest);assert.equal(bound.status,0,bound.stderr);
    const x=JSON.parse(abstract.stdout),y=JSON.parse(bound.stdout);
    for(const name of ['Services / A','Services / B']){
      const first=x.interfaces.find(m=>m.module===name),second=y.interfaces.find(m=>m.module===name);
      assert.equal(first.fingerprint,second.fingerprint);
      assert.equal(first.surface.symbols[0].schema.result.name,'Data / Outcome / Result');
      assert.deepEqual(first.surface.types,[]);
    }
    assert.ok(x.dependencies.some(e=>e.from==='Services / A'&&e.to==='Data / Outcome'&&e.phase==='interface'));
    assert.ok(y.dependencies.some(e=>e.from==='Providers / A'&&e.to==='Data / Outcome'&&e.phase==='interface'));
    for(const target of ['js','php']){
      const out=run(target,'--checked','--tree-shake','--bindings',manifest);assert.equal(out.status,0,out.stderr);
      const file=join(dir,target==='js'?'out.mjs':'out.php'),name='__miraModule_v_417070202F20726573756C74';
      writeFileSync(file,out.stdout+(target==='js'?'\nconsole.log(JSON.stringify('+name+'));':'\necho json_encode($'+name+');'));
      const result=spawnSync(target==='js'?'node':'php',[file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),['Ada','empty','Mira']);
    }
    writeFileSync(input,'module App; import Services / A {Result;}; result = 1;');
    let bad=run('--check');assert.notEqual(bad.status,0);assert.match(bad.stderr,/Symbol not exported/);
    writeFileSync(input,source);
    for(const [changed,pattern] of [
      [a.replace('Result;','*;'),/explicit type names/],
      [a.replace('Result;','Ok: ;'),/types only/],
      [a.replace('import Data','export Data'),/selective logical type imports/],
      [a.replace('Data / Outcome','Services / A'),/Import cycle/],
      [a.replace('import Data / Outcome {Result;};','import "foreign.mira";'),/selective logical type imports/]
    ]){
      writeFileSync(ca,changed);
      for(const flags of [[],['--bindings',manifest]]){
        bad=run('--check',...flags);assert.notEqual(bad.status,0,changed);assert.match(bad.stderr,pattern);
      }
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.89.7 logical module roots are explicit, unique and do not alter legacy imports',async()=>{
  const {symlinkSync}=await import('node:fs');
  const dir=mkdtempSync(join(tmpdir(),'mira-library-roots-'));
  try{
    const app=join(dir,'app'),lib=join(dir,'lib'),other=join(dir,'other');
    for(const folder of [app,lib,other])mkdirSync(folder);
    const input=join(app,'App.mira');
    writeFileSync(input,'module App; import Library / answer; result = answer;');
    const module='module Library; interface answer; implementation answer = 42;';
    writeFileSync(join(lib,'Library.mira'),module);
    const run=(...flags)=>spawnSync('node',['dist/mira.cjs',input,...flags],{encoding:'utf8'});
    assert.notEqual(run('--check').status,0);
    let out=run('--interfaces','--module-root',lib,'--module-root',lib);assert.equal(out.status,0,out.stderr);
    assert.ok(JSON.parse(out.stdout).interfaces.some(m=>m.module==='Library'));
    writeFileSync(join(other,'Library.mira'),module);
    out=run('--check','--module-root',lib,'--module-root',other);assert.notEqual(out.status,0);assert.match(out.stderr,/Ambiguous module Library/);
    out=run('--check','--module-root',join(dir,'missing'));assert.notEqual(out.status,0);assert.match(out.stderr,/not a directory/);
    out=run('--check','--module-root');assert.notEqual(out.status,0);assert.match(out.stderr,/requires a directory/);
    writeFileSync(join(app,'Library.mira'),module);
    out=run('--check','--module-root',lib);assert.notEqual(out.status,0);assert.match(out.stderr,/Ambiguous module Library/);
    writeFileSync(input,'import "legacy.mira"; result = answer;');
    writeFileSync(join(lib,'legacy.mira'),'answer = 42;');
    assert.notEqual(run('--check','--module-root',lib).status,0);
    writeFileSync(join(app,'legacy.mira'),'answer = 42;');
    out=run('--check','--module-root',lib);assert.equal(out.status,0,out.stderr);
    writeFileSync(input,'module App; import Alias / answer; result = answer;');
    symlinkSync(join(lib,'Library.mira'),join(other,'Alias.mira'));
    out=run('--check','--module-root',other);assert.notEqual(out.status,0);assert.match(out.stderr,/symlinks are not supported/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('0.90 project configuration rejects conflicts and composes manifests without silent overrides',async()=>{
  const {loadProject,mergeHosts,mergeBindings}=await import('../scripts/project.mjs');
  const project=loadProject('examples/lesson-import/mira.project.json');
  assert.ok(project.modules['Data / Outcome']);
  assert.ok(project.modules['Providers / Storage Safe Files']);
  assert.equal(Object.hasOwn(project.modules,'App'),false);
  const host=mergeHosts(project.hosts);
  assert.ok(host.types['native checked date']);
  assert.ok(host.scopes['files try read text']);
  assert.throws(()=>mergeHosts([project.hosts[0],project.hosts[0]]),/Duplicate host capability/);
  assert.throws(()=>mergeHosts([{callables:['a'],types:{b:'Text'}}]),/Orphan host types/);
  assert.throws(()=>mergeBindings([{A:{provider:'B'}},{A:{provider:'C'}}]),/Duplicate provider binding/);
  const dir=mkdtempSync(join(tmpdir(),'mira-project-config-'));
  try{
    for(const name of ['a','b']){mkdirSync(join(dir,name));writeFileSync(join(dir,name,'Shared.mira'),'module Shared; x = 1;');}
    writeFileSync(join(dir,'App.mira'),'module App; x = 1;');
    const file=join(dir,'mira.project.json');
    const base={format:1,entry:'App.mira',moduleRoots:[{root:'a',include:['.']}],targets:{js:{}}};
    const load=config=>{writeFileSync(file,JSON.stringify(config));return loadProject(file);};
    assert.ok(load(base).modules.Shared);
    assert.throws(()=>load({...base,moduleRoots:[...base.moduleRoots,{root:'b',include:['.']}]}),/Duplicate logical module/);
    assert.throws(()=>load({...base,moduleRoots:[{root:'a',include:['../b']}]}),/outside module root/);
    assert.throws(()=>load({...base,targets:{go:{}}}),/Unknown targets field/);
    assert.throws(()=>load({...base,typo:true}),/Unknown project field/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
