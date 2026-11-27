// Narrow adapter from the actual compiler AST to an editable node table.
// No parser or checker here; export is checked by Mira's compiler.
export const seedSource = 'hours = 4;\nrate = 30;\nresult = hours * rate;';
export const matchPrefix = 'Payment :: Cash | Card (Number) | Transfer (Text);\npayment = Card: 7;\n';
export const matchSeed = 'hours = 4;\nresult = 0;';
export const operators = ['+', '-', '*', '/'];
const identifier = /^[A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*$/;
const node = (id, kind, text='', left=0, right=0, cases=[]) => ({id,kind,text,left,right,cases});
export function fromAst(ast,prefix='') {
  let next=1; const nodes=[], defs=[];
  function visit(expr) {
    const id=next++;
    if (expr.kind==='Binary' && operators.includes(expr.symbol)) {
      const left=visit(expr.left), right=visit(expr.right);
      nodes.push(node(id,'Binary',expr.symbol,left,right));
    } else if (expr.kind==='Number' && Number.isFinite(Number(expr.value))) {
      nodes.push(node(id,'Number',String(expr.value)));
    } else if (expr.kind==='Name' && identifier.test(expr.value)) {
      nodes.push(node(id,'Name',expr.value));
    } else throw Error('Nodo non supportato: '+expr.kind);
    return id;
  }
  if (ast.kind!=='Program' || !ast.definitions.length) throw Error('Programma non supportato');
  for (const d of ast.definitions) {
    if (d.kind!=='Value' || !identifier.test(d.name)) throw Error('Dichiarazione non supportata');
    defs.push({name:d.name,root:visit(d.body)});
  }
  return {nodes,defs,next,prefix,selected:defs[defs.length-1].root};
}
export const getNode=(s,id=s.selected)=>s.nodes.find(n=>n.id===id);
const children=n=>n.kind==='Binary'?[n.left,n.right]:n.kind==='Match'?n.cases.map(c=>c.root):[];
function ancestry(s){
  const chain=[];let current=s.selected;
  for(;;){const parent=s.nodes.find(n=>children(n).includes(current));if(!parent)return {chain,root:current};
    chain.push({parent,child:current});current=parent.id;}
}
export function references(s) {
  const {root,chain}=ancestry(s);
  const at=s.defs.findIndex(d=>d.root===root);
  const names=s.defs.slice(0,Math.max(0,at)).map(d=>d.name);
  for(const {parent,child} of chain)if(parent.kind==='Match'){
    const c=parent.cases.find(c=>c.root===child);
    if(c.param&&c.type==='Number')names.push(c.param);
  }
  return [...new Set(names)];
}
// Read actual checker output, not a hand-coded list of constructors.
export function semanticContext(s,compiler){
  const {root,chain}=ancestry(s),at=s.defs.findIndex(d=>d.root===root);
  let report;
  try{
    const prefix=source({...s,defs:s.defs.slice(0,at)});
    if(prefix.trim()){const checked=compiler.check(prefix);if(checked.ok)report=JSON.parse(checked.output);}
    else report=[];
  }catch{/* An earlier hole means no checked proof of those bindings. */}
  const refs=references(s);
  const numeric=refs.filter(name=>report?.some(r=>r.name===name&&r.schema?.kind==='Number') ||
    chain.some(({parent,child})=>parent.kind==='Match'&&parent.cases.some(c=>c.root===child&&c.param===name&&c.type==='Number')));
  const sums=(report??[]).filter(r=>r.schema?.kind==='Sum'&&/^[A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*$/.test(r.name));
  return {expected:'Number',numeric,sums,verified:report!==undefined};
}
export function completions(s,compiler,query=''){
  const context=semanticContext(s,compiler),q=query.trim().toLowerCase();
  return [...context.numeric.map(name=>({label:name,detail:'Number',action:{kind:'reference',value:name}})),
    ...context.sums.map(row=>({label:'match: '+row.name,detail:row.schema.name+' · '+row.schema.alternatives.length+' casi',action:{kind:'match',value:row.name}}))]
    .filter(item=>item.label.toLowerCase().includes(q));
}

export function order(s) {
  const ids=[];
  function walk(id){const n=getNode(s,id);if(n.kind==='Binary')walk(n.left);ids.push(id);if(n.kind==='Binary')walk(n.right);else if(n.kind==='Match')n.cases.forEach(c=>walk(c.root));}
  s.defs.forEach(d=>walk(d.root));return ids;
}
// Next unfilled slot in visual order, wrapping once to earlier holes.
export function nextHole(s,from=s.selected,direction=1){
  const ids=order(s),at=ids.indexOf(from);
  if(at<0)return undefined;
  for(let step=1;step<=ids.length;step++){
    const id=ids[(at+direction*step+ids.length)%ids.length];
    if(getNode(s,id).kind==='Hole')return id;
  }
}
export function navigate(s,dir) {
  const ids=order(s), i=ids.indexOf(s.selected), n=getNode(s);
  const parent=s.nodes.find(x=>children(x).includes(n.id));
  const selected=dir==='parent'?parent?.id:dir==='child'?children(n)[0]:ids[i+(dir==='previous'?-1:1)];
  return selected===undefined?s:{...s,selected};
}
export function source(s) {
  function render(id){const n=getNode(s,id);if(n.kind==='Hole')throw Error('Completa tutti i buchi prima di esportare.');
    if(n.kind==='Binary')return '('+render(n.left)+' '+n.text+' '+render(n.right)+')';
    if(n.kind==='Match')return '(match: '+n.text+' { '+n.cases.map(c=>c.tag.charAt(0).toLowerCase()+c.tag.slice(1)+': {'+c.param+' | '+render(c.root)+'}').join(', ')+' })';
    return n.text;
  }
  return (s.prefix??'')+s.defs.map(d=>d.name+' = '+render(d.root)+';').join('\n');
}
function descendants(s,id) {const n=getNode(s,id);return children(n).flatMap(child=>[child,...descendants(s,child)]);}
export function edit(s,action,mira,compiler) {
  const n=getNode(s);
  if(action.kind==='wrap'){
    if(!operators.includes(action.value))throw Error('Operatore non supportato');
    const left={...n,id:s.next},right=node(s.next+1,'Hole');
    return {...s,nodes:mira.projection_wrap__left__right__in(node(n.id,'Binary',action.value,left.id,right.id),left,right,s.nodes),next:s.next+2,selected:right.id};
  }
  let replacement;
  if(action.kind==='match'){
    if(!compiler)throw Error('Serve il checker');
    const row=semanticContext(s,compiler).sums.find(r=>r.name===action.value);
    if(!row)throw Error('Tipo somma non disponibile');
    const cases=row.schema.alternatives.map((c,i)=>({tag:c.tag,param:c.payload?'case value '+String.fromCharCode(97+i):'',type:c.payload?.kind??'',root:s.next+i}));
    const removed=new Set(descendants(s,n.id));
    const replacement=node(n.id,'Match',row.name,0,0,cases);
    return {...s,nodes:[...mira.projection_replace__in(replacement,s.nodes.filter(x=>!removed.has(x.id))),...cases.map(c=>node(c.root,'Hole'))],next:s.next+cases.length,selected:cases[0].root};
  }
  if(action.kind==='remove') replacement=node(n.id,'Hole');
  else if(action.kind==='literal'){
    const value=action.value.trim();
    if(!/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,8})?$/.test(value)) throw Error('Inserisci un numero decimale non negativo (max 9 cifre intere).');
    replacement=node(n.id,'Number',value);
  } else if(action.kind==='reference'){
    if(!(compiler?semanticContext(s,compiler).numeric:references(s)).includes(action.value))throw Error('Riferimento non disponibile');
    replacement=node(n.id,'Name',action.value);
  } else throw Error('Azione non supportata');
  const removed=new Set(descendants(s,n.id));
  return {...s,nodes:mira.projection_replace__in(replacement,s.nodes.filter(x=>!removed.has(x.id)))};
}
export function history(initial,mira,compiler){
  let state=initial;const past=[],future=[];
  return {
    get state(){return state},get canUndo(){return past.length>0},get canRedo(){return future.length>0},
    select(id){if(getNode(state,id))state={...state,selected:id};},
    navigate(dir){state=navigate(state,dir);},
    apply(action,advance=false){
      let next=edit(state,action,mira,compiler);
      if(advance&&getNode(state).kind==='Hole'&&['literal','reference'].includes(action.kind)){
        const id=nextHole(next,state.selected);
        if(id!==undefined)next={...next,selected:id};
      }
      past.push(state);future.length=0;state=next;
    },
    undo(){if(past.length){future.push(state);state=past.pop();}},
    redo(){if(future.length){past.push(state);state=future.pop();}}
  };
}

// Rectangles are in layout-viewport coordinates, as is VisualViewport.offsetTop.
// Keep the whole compact editor visible when possible; prioritize the input
// when an exceptionally small viewport cannot contain the editor.
export function revealDelta(editor,input,viewport,margin=12){
  const top=viewport.offsetTop+margin,bottom=viewport.offsetTop+viewport.height-margin;
  if(bottom<=top)return 0;
  const rect=editor.bottom-editor.top<=bottom-top?editor:input;
  if(rect.bottom-rect.top>bottom-top)return rect.top-top;
  if(rect.bottom>bottom)return Math.ceil(rect.bottom-bottom);
  if(rect.top<top)return Math.floor(rect.top-top);
  return 0;
}
