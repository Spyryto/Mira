import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {seedSource,matchPrefix,matchSeed,fromAst,source,references,history,getNode,order,semanticContext,completions} from '../dist/studio/projection-core.js';
import * as mira from '../dist/studio/projection-program.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const context={};runInNewContext(read('../dist/studio/compiler.js'),context);
const compiler=context.MiraStudioCompiler;
function initial(){const ast=compiler.ast(seedSource);assert.equal(ast.ok,true,ast.message);return fromAst(JSON.parse(ast.output));}
test('Projection uses the real AST and checked export; stable identities, wrap, holes, undo/redo',()=>{
  const start=initial(),h=history(start,mira);
  assert.equal(source(start),'hours = 4;\nrate = 30;\nresult = (hours * rate);');
  assert.equal(compiler.check(source(start)).ok,true);
  const before=JSON.stringify(start),root=start.selected;
  h.apply({kind:'wrap',value:'+'});
  assert.equal(getNode(h.state).kind,'Hole');
  assert.throws(()=>source(h.state),/buchi/);
  assert.deepEqual(references(h.state),['hours','rate']);
  h.apply({kind:'literal',value:'2'});
  assert.equal(source(h.state),'hours = 4;\nrate = 30;\nresult = ((hours * rate) + 2);');
  assert.equal(compiler.check(source(h.state)).ok,true);
  assert.equal(getNode(h.state,root).text,'+');
  assert.equal(JSON.stringify(start),before);
  const complete=source(h.state);h.undo();assert.throws(()=>source(h.state),/buchi/);
  h.undo();assert.equal(source(h.state),source(start));h.redo();h.redo();assert.equal(source(h.state),complete);
  h.select(root);h.apply({kind:'remove'});assert.throws(()=>source(h.state),/buchi/);
  assert.equal(h.state.nodes.length,3);assert.equal(order(h.state).length,3);
  assert.throws(()=>h.apply({kind:'reference',value:'result'}),/non disponibile/);
  h.apply({kind:'reference',value:'hours'});assert.equal(compiler.check(source(h.state)).ok,true);
  assert.throws(()=>h.apply({kind:'literal',value:'1; log 2'}),/numero/);
});
test('Projection transitions execute identically in generated PHP and JS',()=>{
  const start=initial(),n=getNode(start),replacement={...n,kind:'Number',text:'8',left:0,right:0};
  const expected=mira.projection_replace__in(replacement,start.nodes);
  const payload=JSON.stringify({replacement,nodes:start.nodes});
  const php=read('../dist/projection-program.php').replace(/^\s*<\?php\s*/,'').replace(/\?>\s*$/,'');
  const call="\n$p=json_decode(stream_get_contents(STDIN),true); echo json_encode(projection_replace__in($p['replacement'],$p['nodes']));";
  assert.deepEqual(JSON.parse(execFileSync('php',['-r',php+call],{input:payload,encoding:'utf8'})),expected);
});
test('Projection lab is discoverable and offline-ready, with no global textarea',()=>{
  const html=read('../dist/studio/projection-lab.html');
  assert.match(html,/projection-code/);assert.doesNotMatch(html,/<textarea/i);
  assert.match(read('../dist/studio/index.html'),/href="\.\/projection-lab.html"/);
  const sw=read('../dist/studio/sw.js');
  for(const asset of ['projection-lab.html','projection-lab.css','projection-lab.js','projection-core.js','projection-model.mira','projection-program.js'])assert.ok(sw.includes("'./"+asset+"'"),asset);
  assert.match(sw,/endsWith\('\/projection-lab.html'\)/);
});

test('Match cases come from compiler sum schema and numeric holes stay incomplete until filled',()=>{
  const parsed=compiler.ast(matchSeed);assert.equal(parsed.ok,true,parsed.message);
  const h=history(fromAst(JSON.parse(parsed.output),matchPrefix),mira,compiler);
  const context=semanticContext(h.state,compiler);
  assert.equal(context.expected,'Number');assert.deepEqual(context.numeric,['hours']);
  const options=completions(h.state,compiler,'mat');
  const payment=options.find(option=>option.label==='match: payment');assert.ok(payment);
  h.apply(payment.action);
  const root=h.state.defs.at(-1).root,match=getNode(h.state,root);
  assert.deepEqual(match.cases.map(c=>c.tag),context.sums.find(row=>row.name==='payment').schema.alternatives.map(c=>c.tag));
  assert.equal(match.cases.length,3);assert.throws(()=>source(h.state),/buchi/);
  for(const c of match.cases){h.select(c.root);const numeric=semanticContext(h.state,compiler).numeric;
    if(c.type==='Number'){assert.ok(numeric.includes(c.param));h.apply({kind:'reference',value:c.param});}
    else {assert.ok(!numeric.includes(c.param));h.apply({kind:'literal',value:'0'});}
  }
  const text=source(h.state),checked=compiler.check(text);assert.equal(checked.ok,true,checked.message);
  for(const target of ['js','php']){const compiled=compiler.compile(text,target,null,false,null,true);assert.equal(compiled.ok,true,compiled.message);}
  h.undo();assert.throws(()=>source(h.state),/buchi/);
});
test('Inline editing replaces the selected expression; no detached textbox in markup',()=>{
  const html=read('../dist/studio/projection-lab.html'),js=read('../dist/studio/projection-lab.js');
  assert.doesNotMatch(html,/id="projection-input"/);
  assert.match(js,/original\.replaceWith\(anchor\)/);assert.match(js,/old\.anchor\.replaceWith\(old\.original\)/);
  assert.match(js,/input\.addEventListener\('input',refresh\)/);
});
