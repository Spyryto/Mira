import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {transpile,parse} from '../src/mira.mjs';
const run=(src,target)=>{
  const dir=mkdtempSync(join(tmpdir(),'mira-'));
  try{
    const file=join(dir,`main.${target==='js'?'mjs':'php'}`);
    const value=target==='js'?'result':'$result';
    const code=transpile(src,target)+(target==='js'?`\nconsole.log(JSON.stringify(${value}));\n`:`\necho json_encode(${value}), "\\n";\n`);
    writeFileSync(file,code);
    return execFileSync(target==='js'?'node':'php',[file],{encoding:'utf8'}).trim();
  }finally{rmSync(dir,{recursive:true,force:true});}
};
const sample=readFileSync(new URL('../examples/arithmetic.mira',import.meta.url),'utf8');
test('same canonical selector for explicit and abbreviated calls',()=>{
  const ast=parse(sample);
  const calls=ast.definitions.filter(x=>x.kind==='value'&&['two','six','four','seven'].includes(x.name));
  assert.deepEqual(calls.map(x=>x.expr.selector),['add:and:','add:and:','add:and:','add:and:']);
});
test('both JS and PHP compute the same result',()=>{
  assert.equal(run(sample,'js'),'49');
  assert.equal(run(sample,'php'),'49');
});
test('multiword names survive transpilation and are mangled',()=>{
  for(const target of ['js','php']){
    const code=transpile(sample,target);
    assert.match(code,/function add__and\(.*aNumber.*anotherNumber/);
  }
});
test('bare multiword positional args are rejected',()=>{
  assert.throws(()=>transpile('add: a number, and: another number = a number + another number; x = add a number and another number;','js'));
});
test('undeclared selector is rejected, not guessed',()=>{
  assert.throws(()=>transpile('x = add 2 and 3;','js'));
});
test('unknown lexical tokens show source location',()=>{
  assert.throws(()=>transpile('x = @;','js'),/1:5/);
});
test('generated name collisions are rejected',()=>{
  assert.throws(()=>transpile('a b = 1; aB = 2;','js'),/collision/);
});
test('arithmetic operators have equal precedence, left-associative',()=>{
  assert.equal(run('result = 1 + 2 * 3;','js'),'9');
  assert.equal(run('result = 1 + (2 * 3);','php'),'7');
});
