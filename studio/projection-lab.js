import {seedSource,matchPrefix,matchSeed,fromAst,getNode,source,history,operators,completions,semanticContext,revealDelta} from './projection-core.js';
import * as mira from './projection-program.js';
const q=id=>document.getElementById('projection-'+id);
const compiler=globalThis.MiraStudioCompiler,code=q('code'),message=q('message');
let session,editing=null,exported='',revealFrame=0;
// iOS shrinks/pans the visual viewport, not necessarily the layout viewport.
// Resize plus bounded post-focus checks cover the keyboard animation. Do not
// react to ordinary page scrolling, which the user must remain free to do.
function queueReveal(){
  if(!editing||revealFrame)return;
  revealFrame=requestAnimationFrame(()=>{
    revealFrame=0;
    if(!editing||document.activeElement!==editing.input)return;
    const vv=window.visualViewport;
    const viewport={offsetTop:vv?.offsetTop??0,height:vv?.height??window.innerHeight};
    const delta=revealDelta(editing.anchor.getBoundingClientRect(),editing.input.getBoundingClientRect(),viewport);
    if(delta)window.scrollBy({top:delta,behavior:'instant'});
  });
}
function revealAfterFocus(current){
  queueReveal();
  for(const delay of [80,220,450,700])setTimeout(()=>{if(editing===current)queueReveal();},delay);
}
window.visualViewport?.addEventListener('resize',queueReveal);
window.addEventListener('resize',queueReveal);
function span(cls,text){const e=document.createElement('span');e.className=cls;e.textContent=text;return e;}
function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);return b;}
function token(n) {
  const b=document.createElement('button');b.type='button';b.dataset.node=String(n.id);
  b.className={Binary:'operator',Name:'var',Number:'literal',Hole:'hole',Match:'keyword'}[n.kind];
  if(n.kind==='Binary'){b.dataset.op=n.text;b.append(span('symbol',n.text));}
  else b.textContent=n.kind==='Hole'?'? Number':n.kind==='Match'?'match:':n.text;
  b.setAttribute('aria-label',n.kind==='Hole'?'Espressione mancante, Number':n.kind==='Binary'?'Operatore '+n.text:n.kind==='Match'?'Match':n.text);
  return b;
}
function draw(){
  const s=session.state,fragment=document.createDocumentFragment();
  function expression(id,into){
    const n=getNode(s,id),group=span('expression','');group.dataset.expression=String(id);
    if(n.kind==='Binary'){group.append('(');expression(n.left,group);group.append(' ',token(n),' ');expression(n.right,group);group.append(')');}
    else if(n.kind==='Match'){
      group.append(token(n),' ',span('var',n.text),' {');
      for(const c of n.cases){const line=span('match-case','');line.append(span('keyword',c.tag.charAt(0).toLowerCase()+c.tag.slice(1)+':'),' {',span('var',c.param),' | ');expression(c.root,line);line.append('},');group.append(line);}
      group.append('}');
    }else group.append(token(n));
    into.append(group);
  }
  if(s.prefix)for(const line of s.prefix.trim().split('\n'))fragment.append(span('definition prefix',line));
  for(const d of s.defs){const line=span('definition','');const assign=span('assign','');assign.append(span('symbol','='));line.append(span('var',d.name),' ',assign,' ');expression(d.root,line);line.append(span('terminator',';'));fragment.append(line);}
  code.replaceChildren(fragment);
}
function selection(focus=false){
  const s=session.state,n=getNode(s);
  for(const b of code.querySelectorAll('[data-node]')){const active=Number(b.dataset.node)===s.selected;b.setAttribute('aria-pressed',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus({preventScroll:true});}
  q('selection').textContent='Selezione · '+(n.kind==='Hole'?'? Number':n.kind==='Match'?'match':n.text);
  q('undo').disabled=!session.canUndo;q('redo').disabled=!session.canRedo;
}
function check(){
  exported='';q('export').textContent='';q('copy').disabled=true;
  try{const text=source(session.state);q('export').textContent=text;const report=compiler.check(text);if(!report.ok)throw Error(report.message);exported=text;q('check').textContent='✓ Verifica statica superata';q('copy').disabled=false;}
  catch(e){q('check').textContent=e.message;}
}
function changed(focus=true){editing=null;draw();selection(focus);check();}
function cancel(focus=true){if(!editing)return;const old=editing;editing=null;old.anchor.replaceWith(old.original);selection(focus);message.textContent='Modifica annullata.';}
function apply(action,open=false){
  try{session.apply(action);message.textContent='';changed(!open);if(open)beginEdit('');return true;}
  catch(e){message.textContent=e.message;if(editing){editing.error.textContent=e.message;queueReveal();}return false;}
}
function beginEdit(initial){
  if(editing){editing.input.focus({preventScroll:true});revealAfterFocus(editing);return;}
  const s=session.state,n=getNode(s);
  const original=code.querySelector('[data-expression="'+n.id+'"]');
  if(!original)return;
  const anchor=span('inline-editor',''),input=document.createElement('input');
  input.type='text';input.autocomplete='off';input.autocapitalize='off';input.spellcheck=false;input.setAttribute('aria-label','Modifica espressione numerica');input.placeholder='? Number';
  input.value=initial??(n.kind==='Name'||n.kind==='Number'?n.text:'');
  const choices=span('inline-choices',''),error=span('inline-error','');error.setAttribute('role','status');
  const accept=button('✓',()=>commit());accept.setAttribute('aria-label','Conferma');
  const close=button('×',()=>cancel());close.setAttribute('aria-label','Annulla modifica');
  anchor.append(input,accept,close,choices,error);
  original.replaceWith(anchor);
  editing={anchor,original,input,error};
  let candidates=[],active=0;
  const context=semanticContext(s,compiler);
  const all=completions(s,compiler);
  function refresh(){
    const query=input.value.trim().toLowerCase();
    candidates=all.filter(c=>c.label.toLowerCase().includes(query));active=0;paint();
    error.textContent=context.verified?'':'Contesto precedente incompleto: suggerimenti parziali.';queueReveal();
  }
  function paint(){
    choices.replaceChildren(...candidates.map((c,i)=>{const b=button(c.label+' · '+c.detail,()=>apply(c.action,c.action.kind==='match'));b.className='inline-option';b.setAttribute('aria-pressed',String(i===active));return b;}));
    choices.hidden=!candidates.length;
    const selected=choices.children[active];
    if(selected){const a=choices.getBoundingClientRect(),b=selected.getBoundingClientRect();if(b.right>a.right)choices.scrollLeft+=b.right-a.right;else if(b.left<a.left)choices.scrollLeft-=a.left-b.left;}
    queueReveal();
  }
  function commit(){
    const value=input.value.trim(),exact=candidates.find(c=>c.label===value);
    if(exact)return apply(exact.action,exact.action.kind==='match');
    if(candidates.length&&!/^[0-9]/.test(value)){const c=candidates[active];return apply(c.action,c.action.kind==='match');}
    return apply({kind:'literal',value});
  }
  input.addEventListener('input',refresh);
  input.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    if(e.key==='Escape'){e.preventDefault();cancel();}
    else if(e.key==='Enter'){e.preventDefault();commit();}
    else if((e.key==='ArrowDown'||e.key==='ArrowUp')&&candidates.length){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+candidates.length)%candidates.length;paint();}
  });
  refresh();input.focus({preventScroll:true});if(initial===undefined)input.select();revealAfterFocus(editing);
}
function load(){
  const match=q('sample').value==='match',parsed=compiler.ast(match?matchSeed:seedSource);
  if(!parsed.ok)throw Error(parsed.message);
  session=history(fromAst(JSON.parse(parsed.output),match?matchPrefix:''),mira,compiler);
  changed(false);
}
code.addEventListener('click',e=>{
  const b=e.target.closest('[data-node]');if(!b)return;
  const id=Number(b.dataset.node);cancel(false);session.select(id);selection(true);
  if(['Name','Number','Hole'].includes(getNode(session.state).kind))beginEdit();
});
code.addEventListener('keydown',e=>{
  if(editing||e.target.tagName==='INPUT'||e.isComposing)return;
  const dirs={ArrowLeft:'previous',ArrowRight:'next',ArrowUp:'parent',ArrowDown:'child'};
  if(dirs[e.key]){e.preventDefault();session.navigate(dirs[e.key]);selection(true);}
  else if(operators.includes(e.key)&&!e.ctrlKey&&!e.metaKey){e.preventDefault();apply({kind:'wrap',value:e.key},true);}
  else if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();apply({kind:'remove'},true);}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?session.redo():session.undo();changed();}
  else if(e.key==='Enter'){e.preventDefault();beginEdit();}
  else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&/[a-zA-Z0-9]/.test(e.key)){e.preventDefault();beginEdit(e.key);}
});
document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{cancel(false);session.navigate(b.dataset.nav);selection(true);}));
document.querySelectorAll('[data-wrap]').forEach(b=>b.addEventListener('click',()=>{cancel(false);apply({kind:'wrap',value:b.dataset.wrap},true);}));
q('edit').addEventListener('click',()=>beginEdit());
q('remove').addEventListener('click',()=>{cancel(false);apply({kind:'remove'},true);});
q('undo').addEventListener('click',()=>{if(editing)cancel(false);session.undo();changed();});
q('redo').addEventListener('click',()=>{if(editing)cancel(false);session.redo();changed();});
q('sample').addEventListener('change',load);
q('style').addEventListener('change',()=>{code.classList.toggle('php',q('style').value==='php');code.classList.toggle('math',q('style').value==='math');});
q('semicolon').addEventListener('change',()=>code.classList.toggle('no-semi',!q('semicolon').checked));
q('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(exported);message.textContent='Sorgente copiato.';}catch{message.textContent='Copia non disponibile: seleziona il sorgente.';}});
load();
