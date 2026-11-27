import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const context={};
runInNewContext(readFileSync('dist/studio/compiler.js','utf8'),context);
const compiler=context.MiraStudioCompiler;
const host=readFileSync('studio/host.json','utf8');
const library=readFileSync('lib/gui.mira','utf8');
const header='import "lib/gui.mira";\n';
const form=`view: model = column: [
  title: "Lezione",
  text: (model ~ hours),
  button: "+1", update: {old | {hours: (old ~ hours + 1), student: (old ~ student), paid: (old ~ paid)}},
  text input: "Nome", value: (model ~ student), update: {old, entered | {hours: (old ~ hours), student: entered, paid: (old ~ paid)}},
  checkbox: "Pagato", checked: (model ~ paid), update: {old, entered | {hours: (old ~ hours), student: (old ~ student), paid: entered}}
];
render (state: {hours: 2, student: "Ada", paid: false}, view: (view: _));`;
function ok(source,modules){
  const checked=compiler.check(source,host,modules);
  assert.equal(checked.ok,true,checked.message);
  return JSON.parse(checked.output);
}
function bad(source,pattern){
  const checked=compiler.check(header+source,host);
  assert.equal(checked.ok,false,source);
  assert.match(checked.message,pattern);
  for(const target of ['js','php']){
    const built=compiler.compile(header+source,target,host,false,undefined,true);
    assert.equal(built.ok,false,source);
  }
}
test('GUI checked: reusable heterogeneous view and immutable controlled form; zero emission overhead',()=>{
  const rows=ok(header+form);
  assert.match(rows.find(r=>r.name==='view:').type,/#GUI.View/);
  ok(library+'\n'+form);
  for(const target of ['js','php']){
    const checked=compiler.compile(header+form,target,host,false,undefined,true);
    const ordinary=compiler.compile(header+form,target,host);
    assert.equal(checked.ok,true,checked.message);
    assert.equal(ordinary.ok,true,ordinary.message);
    assert.equal(checked.output,ordinary.output);
  }
});
test('GUI checked: component polymorphism, independent child state and static root',()=>{
  ok(header+`label: n = text: n;
child: n = state: n, view: {old | button: "+1", update: {previous | previous + 1}};
parent: name = column: [label: name, label: 42, child: 0, text input: "Name", value: name, update: {old, entered | entered}];
render (state: "Ada", view: (parent: _));`);
  ok(header+'render (column: [title: "Static", text: 42]);');
  ok(header+'render (state: 0, view: {n | column: (each: [1, 2], identified by: {x | x}, view: {x | text: x})});');
});
test('GUI checked rejects wrong binding types, callbacks, child views and state escapes',()=>{
  bad('render (state: 0, view: {n | button: "Bad", update: {old | "wrong"}});',/expected .*got/);
  bad('render (state: 0, view: {n | checkbox: "Bad", checked: n, update: {old, x | old}});',/expected .*got/);
  bad('render (state: "a", view: {n | text input: "Bad", value: n, update: {old, x | x + 1}});',/expected .*got/);
  bad('render (state: "a", view: {n | choose: "Bad", value: n, options: [1, 2], update: {old, x | x}});',/expected .*got/);
  bad('render (state: 0, view: {n | button: "Bad", update: {old, extra | old}});',/arity/);
  bad('render (column: [text: "a", 42]);',/expected .*got/);
  bad('render (state: 0, view: {n | n});',/expected .*got/);
  bad('bad: x = button: "Bad", update: {old | old}; render (bad: 0);',/state owner/);
  bad('render {type: "text", text: "forged"};',/expected .*got/);
});
test('GUI ABI is pinned to exact library, not selector names or caller-controlled module paths',()=>{
  const fake=library.replace('type: "column"','type: "not a column"');
  const result=compiler.check(header+form,host,JSON.stringify({'lib/gui.mira':fake}));
  assert.equal(result.ok,false);
  const ordinary=compiler.check('column: xs = xs; result = column: [1, 2];');
  assert.equal(ordinary.ok,true,ordinary.message);
  assert.equal(JSON.parse(ordinary.output).find(r=>r.name==='result').type,'[Number]');
});
