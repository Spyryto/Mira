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
    ['Tree :: Leaf (Tree) | Empty;',/Unknown annotation type/]
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
    ['Box (T) :: T;',/require a sum declaration/],
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
