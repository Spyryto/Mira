import {seedSource,fromAst,getNode,references,source,history,operators} from './projection-core.js';
import * as mira from './projection-program.js';
const q=id=>document.getElementById('projection-'+id);
const compiler=globalThis.MiraStudioCompiler;
const parsed=compiler.ast(seedSource);
if(!parsed.ok)throw Error(parsed.message);
const session=history(fromAst(JSON.parse(parsed.output)),mira);
const code=q('code'), input=q('input'), message=q('message');
let exported='';
function span(cls,text){const e=document.createElement('span');e.className=cls;e.textContent=text;return e;}
function token(n) {
  const b=document.createElement('button');b.type='button';b.dataset.node=String(n.id);
  b.className={Binary:'operator',Name:'var',Number:'literal',Hole:'hole'}[n.kind];
  if(n.kind==='Binary'){b.dataset.op=n.text;b.append(span('symbol',n.text));}
  else b.textContent=n.kind==='Hole'?'?':n.text;
  b.setAttribute('aria-label',n.kind==='Hole'?'Espressione mancante':n.kind==='Binary'?'Operatore '+n.text:n.text);
  return b;
}
function draw() {
  const s=session.state, fragment=document.createDocumentFragment();
  function expression(id, into){const n=getNode(s,id);if(n.kind==='Binary'){into.append('(');expression(n.left,into);into.append(' ',token(n),' ');expression(n.right,into);into.append(')');}else into.append(token(n));}
  for(const d of s.defs){const line=span('definition','');const assign=span('assign','');assign.append(span('symbol','='));line.append(span('var',d.name),' ',assign,' ');expression(d.root,line);line.append(span('terminator',';'));fragment.append(line);}
  code.replaceChildren(fragment);
}
function selection(focus=false){
  const s=session.state,n=getNode(s);
  for(const b of code.querySelectorAll('[data-node]')){const active=Number(b.dataset.node)===s.selected;b.setAttribute('aria-pressed',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus({preventScroll:true});}
  q('selection').textContent='Selezione · '+(n.kind==='Hole'?'Espressione mancante':n.text);
  const buttons=references(s).map(name=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('click',()=>apply({kind:'reference',value:name}));return b;});
  q('suggestions').replaceChildren(...buttons);
  q('undo').disabled=!session.canUndo;q('redo').disabled=!session.canRedo;
}
function check(){
  exported='';q('export').textContent='';q('copy').disabled=true;
  try{const text=source(session.state);q('export').textContent=text;const report=compiler.check(text);if(!report.ok)throw Error(report.message);exported=text;q('check').textContent='✓ Verifica statica superata';q('copy').disabled=false;}
  catch(e){q('check').textContent=e.message;}
}
function changed(focus=true){draw();selection(focus);check();}
function apply(action){try{session.apply(action);message.textContent='';changed();return true;}catch(e){message.textContent=e.message;return false;}}
code.addEventListener('click',e=>{const b=e.target.closest('[data-node]');if(b){session.select(Number(b.dataset.node));selection(true);}});
code.addEventListener('keydown',e=>{
  const dirs={ArrowLeft:'previous',ArrowRight:'next',ArrowUp:'parent',ArrowDown:'child'};
  if(dirs[e.key]){e.preventDefault();session.navigate(dirs[e.key]);selection(true);}
  else if(operators.includes(e.key)&&!e.ctrlKey&&!e.metaKey){e.preventDefault();apply({kind:'wrap',value:e.key});input.focus();}
  else if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();apply({kind:'remove'});}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?session.redo():session.undo();changed();}
  else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&/[a-zA-Z0-9]/.test(e.key)){e.preventDefault();input.value=e.key;input.focus();}
});
document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{session.navigate(b.dataset.nav);selection(true);}));
document.querySelectorAll('[data-wrap]').forEach(b=>b.addEventListener('click',()=>{if(apply({kind:'wrap',value:b.dataset.wrap}))input.focus();}));
q('remove').addEventListener('click',()=>apply({kind:'remove'}));
q('undo').addEventListener('click',()=>{session.undo();changed();});q('redo').addEventListener('click',()=>{session.redo();changed();});
q('form').addEventListener('submit',e=>{e.preventDefault();const value=input.value.trim();if(apply({kind:references(session.state).includes(value)?'reference':'literal',value}))input.value='';});
q('style').addEventListener('change',()=>{code.classList.toggle('php',q('style').value==='php');code.classList.toggle('math',q('style').value==='math');});
q('semicolon').addEventListener('change',()=>code.classList.toggle('no-semi',!q('semicolon').checked));
q('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(exported);message.textContent='Sorgente copiato.';}catch{message.textContent='Copia non disponibile: seleziona il sorgente qui sotto.';}});
changed(false);
