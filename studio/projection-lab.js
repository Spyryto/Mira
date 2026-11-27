import {seedSource,matchPrefix,matchSeed,compositionSeed,compositionPrefix,compositionHost,checkSource,fromAst,getNode,source,history,operators,completions,semanticContext,revealDelta,nextHole} from './projection-core.js';
import * as mira from './projection-program.js';
const q=id=>document.getElementById('projection-'+id);
const compiler=globalThis.MiraStudioCompiler,code=q('code'),message=q('message');
let session,editing=null,exported='',revealFrame=0;
function span(cls,text){const e=document.createElement('span');e.className=cls;e.textContent=text;return e;}
function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);return b;}
const surface=document.createElement('div');surface.className='projection-surface';code.append(surface);
// One connected native input for a whole editing sequence. A placeholder in
// the projected expression reserves exactly the space occupied by the overlay.
// The overlay never moves in the DOM when advancing to the next slot.
const anchor=span('inline-editor',''),input=document.createElement('input');
input.type='text';input.autocomplete='off';input.autocapitalize='off';input.spellcheck=false;input.setAttribute('aria-label','Modifica espressione numerica');input.placeholder='? Number';input.enterKeyHint='next';
const choices=span('inline-choices',''),error=span('inline-error','');error.setAttribute('role','status');
const accept=button('✓',()=>commit());accept.setAttribute('aria-label','Conferma');
const close=button('×',()=>cancel());close.setAttribute('aria-label','Annulla modifica');
anchor.append(input,accept,close,choices,error);anchor.hidden=true;code.append(anchor);
// Keep focus on the native input when a completion/control is clicked.
// Pointer scrolling of the strip is still native.
anchor.addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault();});
let candidates=[],all=[],active=0,context;
function positionEditor(){
  if(!editing)return;
  const slot=editing.slot,rect=slot.getBoundingClientRect(),base=code.getBoundingClientRect();
  const width=rect.width;
  if(width<=0)return;
  anchor.style.width=width+'px';
  slot.style.height=anchor.offsetHeight+'px';
  const placed=slot.getBoundingClientRect();
  anchor.style.left=(placed.left-base.left-code.clientLeft)+'px';
  anchor.style.top=(placed.top-base.top-code.clientTop)+'px';
}
function queueReveal(){
  if(!editing||revealFrame)return;
  revealFrame=requestAnimationFrame(()=>{
    revealFrame=0;
    if(!editing)return;
    positionEditor();
    if(document.activeElement!==input)return;
    const vv=window.visualViewport;
    const viewport={offsetTop:vv?.offsetTop??0,height:vv?.height??window.innerHeight};
    const delta=revealDelta(anchor.getBoundingClientRect(),input.getBoundingClientRect(),viewport);
    if(delta)window.scrollBy({top:delta,behavior:'instant'});
  });
}
function revealAfterFocus(current){
  queueReveal();
  for(const delay of [80,220,450,700])setTimeout(()=>{if(editing===current)queueReveal();},delay);
}
window.visualViewport?.addEventListener('resize',queueReveal);
window.addEventListener('resize',queueReveal);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(queueReveal).observe(anchor);
function token(n){
  const b=document.createElement('button');b.type='button';b.dataset.node=String(n.id);
  b.className={Binary:'operator',Name:'var',Number:'literal',Text:'literal',Hole:'hole',Match:'keyword',Call:'keyword'}[n.kind];
  if(n.kind==='Binary'){b.dataset.op=n.text;b.append(span('symbol',n.text));}
  else b.textContent=n.kind==='Hole'?'? '+semanticContext({...session.state,selected:n.id},compiler).expected:n.kind==='Match'?'match:':n.text;
  b.setAttribute('aria-label',n.kind==='Hole'?'Espressione mancante':n.kind==='Binary'?'Operatore '+n.text:n.kind==='Match'?'Match':n.text);
  return b;
}
function expression(id){
  const s=session.state,n=getNode(s,id),group=span('expression','');group.dataset.expression=String(id);
  if(n.kind==='Binary')group.append('(',expression(n.left),' ',token(n),' ',expression(n.right),')');
  else if(n.kind==='Call')group.append('(',token(n),' ',expression(n.left),')');
  else if(n.kind==='Match'){
    group.append(token(n),' ',span('var',n.text),' {');
    for(const c of n.cases){const line=span('match-case','');line.append(span('keyword',c.tag.charAt(0).toLowerCase()+c.tag.slice(1)+':'),' {',span('var',c.param),' | ',expression(c.root),'},');group.append(line);}
    group.append('}');
  }else group.append(token(n));
  return group;
}
function findExpression(id){return surface.querySelector('[data-expression="'+id+'"]');}
function draw(){
  const s=session.state,fragment=document.createDocumentFragment();
  if(s.prefix)for(const line of s.prefix.trim().split('\n'))fragment.append(span('definition prefix',line));
  for(const d of s.defs){const line=span('definition','');const assign=span('assign','');assign.append(span('symbol','='));line.append(span('var',d.name+(s.expected==='Integer'&&d===s.defs.at(-1)?' (Integer)':'')),' ',assign,' ',expression(d.root),span('terminator',';'));fragment.append(line);}
  surface.replaceChildren(fragment);
}
function selection(focus=false){
  const s=session.state,n=getNode(s);
  for(const b of surface.querySelectorAll('[data-node]')){const active=Number(b.dataset.node)===s.selected;b.setAttribute('aria-pressed',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus({preventScroll:true});}
  q('selection').textContent='Selezione · '+(n.kind==='Hole'?'? '+semanticContext(s,compiler).expected:n.kind==='Match'?'match':n.text);
  q('undo').disabled=!session.canUndo;q('redo').disabled=!session.canRedo;
}
function check(){
  exported='';q('export').textContent='';q('copy').disabled=true;
  try{const text=source(session.state);q('export').textContent=text;const report=checkSource(session.state,compiler,text);if(!report.ok)throw Error(report.message);exported=text;q('check').textContent='✓ Verifica statica superata';q('copy').disabled=false;}
  catch(e){q('check').textContent=e.message;}
}
function endEdit(restore=true){
  if(!editing)return;
  if(restore)editing.slot.replaceWith(editing.original);
  editing=null;anchor.hidden=true;
}
function changed(focus=true){endEdit(false);draw();selection(focus);check();}
function cancel(focus=true){if(!editing)return;endEdit();selection(focus);message.textContent='Modifica annullata.';}
function apply(action,open=false){
  try{
    const previous=session.state.selected,wasHole=getNode(session.state).kind==='Hole';
    const target=editing?.slot??findExpression(previous);
    session.apply(action,wasHole);
    if(!target)throw Error('Proiezione del nodo non disponibile');
    // Only the changed subtree is replaced. The overlay, other expressions
    // and unrelated definitions retain their actual DOM identity.
    target.replaceWith(expression(previous));
    editing=null;
    message.textContent='';
    const advance=wasHole&&['literal','reference','compose','adapt'].includes(action.kind)&&getNode(session.state).kind==='Hole';
    if(open||advance){selection(false);beginEdit('');}
    else{anchor.hidden=true;selection(true);}
    check();return true;
  }catch(e){message.textContent=e.message;if(editing){error.textContent=e.message;queueReveal();}return false;}
}
function refresh(){
  const query=input.value.trim().toLowerCase();
  candidates=all.filter(c=>c.label.toLowerCase().includes(query));active=0;paint();
  error.textContent=context.verified?'':'Contesto precedente incompleto: suggerimenti parziali.';positionEditor();queueReveal();
}
function paint(){
  choices.replaceChildren(...candidates.map((c,i)=>{const b=button(c.label+' · '+c.detail,()=>apply(c.action,['match','call'].includes(c.action.kind)));b.className='inline-option';b.setAttribute('aria-pressed',String(i===active));return b;}));
  choices.hidden=!candidates.length;
  const selected=choices.children[active];
  if(selected){const a=choices.getBoundingClientRect(),b=selected.getBoundingClientRect();if(b.right>a.right)choices.scrollLeft+=b.right-a.right;else if(b.left<a.left)choices.scrollLeft-=a.left-b.left;}
  positionEditor();queueReveal();
}
function commit(){
  const value=input.value.trim(),exact=candidates.find(c=>c.label===value);
  if(!value){error.textContent='Digita un valore o seleziona un suggerimento.';positionEditor();queueReveal();return;}
  if(exact)return apply(exact.action,['match','call'].includes(exact.action.kind));
  if(candidates.length&&!/^[0-9"]/.test(value)){const c=candidates[active];return apply(c.action,['match','call'].includes(c.action.kind));}
  return apply({kind:'literal',value});
}
function beginEdit(initial){
  if(editing){input.focus({preventScroll:true});revealAfterFocus(editing);return;}
  const s=session.state,n=getNode(s),original=findExpression(n.id);
  if(!original)return;
  const slot=span('inline-slot','');slot.dataset.slot=String(n.id);slot.setAttribute('aria-hidden','true');
  original.replaceWith(slot);
  editing={slot,original,input,anchor,error};
  anchor.hidden=false;
  input.value=initial??(['Name','Number','Text'].includes(n.kind)?n.text:'');
  input.enterKeyHint=nextHole(s,n.id)!==undefined&&s.nodes.some(x=>x.kind==='Hole'&&x.id!==n.id)?'next':'done';
  context=semanticContext(s,compiler);all=completions(s,compiler,'',mira);input.placeholder='? '+context.expected;input.setAttribute('aria-label','Modifica espressione, tipo atteso '+context.expected);
  refresh();if(document.activeElement!==input)input.focus({preventScroll:true});
  if(initial===undefined)input.select();
  revealAfterFocus(editing);
}
input.addEventListener('input',refresh);
input.addEventListener('keydown',e=>{
  if(e.isComposing||!editing)return;
  if(e.key==='Escape'){e.preventDefault();cancel();}
  else if(e.key==='Enter'){e.preventDefault();commit();}
  else if(e.key==='Tab'){
    const next=nextHole(session.state,session.state.selected,e.shiftKey?-1:1);
    if(next!==undefined&&next!==session.state.selected){
      e.preventDefault();editing.slot.replaceWith(editing.original);editing=null;session.select(next);selection(false);beginEdit('');
    }
  }
  else if((e.key==='ArrowDown'||e.key==='ArrowUp')&&candidates.length){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+candidates.length)%candidates.length;paint();}
});
function load(){
  endEdit(false);
  const sample=q('sample').value,match=sample==='match',composition=sample==='composition',parsed=compiler.ast(composition?compositionSeed:match?matchSeed:seedSource);
  if(!parsed.ok)throw Error(parsed.message);
  session=history(fromAst(JSON.parse(parsed.output),composition?compositionPrefix:match?matchPrefix:'',composition?'Integer':'Number',composition?compositionHost:null),mira,compiler);
  changed(false);
}
code.addEventListener('click',e=>{
  const b=e.target.closest('[data-node]');if(!b)return;
  const id=Number(b.dataset.node),kind=getNode(session.state,id).kind;
  const open=['Name','Number','Text','Hole'].includes(kind);
  if(editing&&open){
    // Move only the placeholder; keep the connected, focused input.
    editing.slot.replaceWith(editing.original);editing=null;
    session.select(id);selection(false);beginEdit();return;
  }
  cancel(false);session.select(id);selection(!open);if(open)beginEdit();
});
code.addEventListener('keydown',e=>{
  if(editing||e.target.tagName==='INPUT'||e.isComposing)return;
  const dirs={ArrowLeft:'previous',ArrowRight:'next',ArrowUp:'parent',ArrowDown:'child'};
  if(dirs[e.key]){e.preventDefault();session.navigate(dirs[e.key]);selection(true);}
  else if(operators.includes(e.key)&&!e.ctrlKey&&!e.metaKey){e.preventDefault();apply({kind:'wrap',value:e.key},true);}
  else if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();apply({kind:'remove'},true);}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?session.redo():session.undo();changed();}
  else if(e.key==='Enter'){e.preventDefault();beginEdit();}
  else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&/[a-zA-Z0-9"]/.test(e.key)){e.preventDefault();beginEdit(e.key);}
});
document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{cancel(false);session.navigate(b.dataset.nav);selection(true);}));
document.querySelectorAll('[data-wrap]').forEach(b=>b.addEventListener('click',()=>{cancel(false);apply({kind:'wrap',value:b.dataset.wrap},true);}));
q('edit').addEventListener('click',()=>beginEdit());
q('remove').addEventListener('click',()=>{cancel(false);apply({kind:'remove'},true);});
q('undo').addEventListener('click',()=>{if(editing)cancel(false);session.undo();changed();});
q('redo').addEventListener('click',()=>{if(editing)cancel(false);session.redo();changed();});
q('sample').addEventListener('change',load);
q('style').addEventListener('change',()=>{code.classList.toggle('php',q('style').value==='php');code.classList.toggle('math',q('style').value==='math');queueReveal();});
q('semicolon').addEventListener('change',()=>{code.classList.toggle('no-semi',!q('semicolon').checked);queueReveal();});
q('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(exported);message.textContent='Sorgente copiato.';}catch{message.textContent='Copia non disponibile: seleziona il sorgente.';}});
load();
