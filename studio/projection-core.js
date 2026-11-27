// Narrow adapter from the actual compiler AST to an editable node table.
// No parser or checker here; export is checked by Mira's compiler.
export const seedSource = 'hours = 4;\nrate = 30;\nresult = hours * rate;';
export const matchPrefix = 'Payment :: Cash | Card (Number) | Transfer (Text);\npayment = Card: 7;\n';
export const matchSeed = 'hours = 4;\nresult = 0;';
// The existing Unicode host counts code points as Number; explicitly validate
// the portable Integer refinement rather than pretending the host returns it.
export const compositionHost=JSON.stringify({callables:['native code points'],types:{'native code points':{parameters:['Text'],result:'Number'}}});
export const compositionPrefix='name = "Mira";\ncount (Integer) = 4;\nfraction = 1.5;\nzero (Integer) = 0;\nlength of: value (Text) -> Integer = validate: (native code points (value)), as: (Integer), then: {n | n}, else: {error | zero};\n';
export const compositionSeed='result = 0;';
export function checkSource(s,compiler,text=source(s)){return compiler.check(text,s.host??undefined);}
export const operators = ['+', '-', '*', '/'];
const identifier = /^[A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*$/;
const node = (id, kind, text='', left=0, right=0, cases=[]) => ({id,kind,text,left,right,cases});
export function fromAst(ast,prefix='',expected='Number',host=null) {
  let next=1; const nodes=[], defs=[];
  function visit(expr) {
    const id=next++;
    if (expr.kind==='Binary' && operators.includes(expr.symbol)) {
      const left=visit(expr.left), right=visit(expr.right);
      nodes.push(node(id,'Binary',expr.symbol,left,right));
    } else if (expr.kind==='Number' && Number.isFinite(Number(expr.value))) {
      nodes.push(node(id,'Number',String(expr.value)));
    } else if (expr.kind==='Text') {
      nodes.push(node(id,'Text',JSON.stringify(expr.value)));
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
  return {nodes,defs,next,prefix,host,expected,selected:defs[defs.length-1].root};
}
export const getNode=(s,id=s.selected)=>s.nodes.find(n=>n.id===id);
const children=n=>n.kind==='Binary'?[n.left,n.right]:n.kind==='Call'?[n.left]:n.kind==='Match'?n.cases.map(c=>c.root):[];
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
    if(c.param)names.push(c.param);
  }
  return [...new Set(names)];
}
// Read actual checker output, not a second checker. The graph uses only
// closed primitive unary signatures; other visible values remain selectable.
const primitive=k=>['Number','Integer','Text','Boolean'].includes(k);
export const compatible=(actual,expected)=>actual===expected||(actual==='Integer'&&expected==='Number');
const selectorName=/^[A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*:$/;
export function semanticContext(s,compiler){
  const {root,chain}=ancestry(s),at=s.defs.findIndex(d=>d.root===root);
  let report;
  try{
    const prefix=source({...s,defs:s.defs.slice(0,at)},false);
    if(prefix.trim()){const checked=checkSource(s,compiler,prefix);if(checked.ok)report=JSON.parse(checked.output);}
    else report=[];
  }catch{/* Earlier incomplete declarations are still visible but unproved. */}
  const rows=report??[];
  const functions=rows.filter(r=>selectorName.test(r.name)&&r.schema?.kind==='Function'&&r.schema.parameters.length===1&&primitive(r.schema.parameters[0].kind)&&primitive(r.schema.result.kind)).map(r=>({name:r.name,input:r.schema.parameters[0].kind,output:r.schema.result.kind}));
  const values=new Map(rows.filter(r=>identifier.test(r.name)&&r.schema?.kind!=='Function').map(r=>[r.name,{name:r.name,type:r.schema?.kind??'Unknown'}]));
  for(const name of references(s))if(!values.has(name))values.set(name,{name,type:'Unknown'});
  // Innermost lexical binding shadows outer bindings, including globals.
  for(const {parent,child} of [...chain].reverse())if(parent.kind==='Match'){
    const c=parent.cases.find(c=>c.root===child);
    if(c.param)values.set(c.param,{name:c.param,type:c.type||'Unknown'});
  }
  let expected=at===s.defs.length-1?s.expected??'Number':'Number';
  for(const {parent} of chain){
    if(parent.kind==='Binary'){expected='Number';break;}
    if(parent.kind==='Call'){expected=functions.find(fn=>fn.name===parent.text)?.input??'Unknown';break;}
  }
  const refs=[...values.values()];
  const numeric=refs.filter(v=>compatible(v.type,'Number')).map(v=>v.name);
  const sums=rows.filter(r=>r.schema?.kind==='Sum'&&identifier.test(r.name)&&values.get(r.name)?.type==='Sum');
  const current=getNode(s);
  const actual=current.kind==='Name'?values.get(current.text)?.type??'Unknown':current.kind==='Text'?'Text':current.kind==='Number'?'Number':current.kind==='Call'?functions.find(fn=>fn.name===current.text)?.output??'Unknown':'Unknown';
  return {expected,numeric,sums,values:refs,functions,actual,verified:report!==undefined};
}
// Bounded search, at most two unary edges, no repeated selectors or type
// cycles. It is a discovery heuristic, not a proof of assignability.
export function pathsTo(functions,start,expected){
  const paths=[];
  function walk(type,path,seen){
    if(path.length>=2)return;
    for(const fn of functions){
      if(!compatible(type,fn.input)||seen.has(fn.output)||path.some(p=>p.name===fn.name))continue;
      const next=[...path,fn];
      if(compatible(fn.output,expected))paths.push(next);
      else walk(fn.output,next,new Set([...seen,fn.output]));
      if(paths.length>=12)return;
    }
  }
  walk(start,[],new Set([start]));return paths;
}
function callLabel(path,argument){return path.reduce((text,fn)=>fn.name+' '+(text.includes(':')?'('+text+')':text),argument);}
export function completions(s,compiler,query='',mira){
  const c=semanticContext(s,compiler),q=query.trim().toLowerCase(),items=[];
  const rank=(actual)=>mira?mira.projection_rank__expected(actual,c.expected):compatible(actual,c.expected)?0:3;
  for(const v of c.values){
    items.push({label:v.name,detail:v.type+(rank(v.type)===0?'':' · da adattare'),rank:rank(v.type),action:{kind:'reference',value:v.name}});
    for(const path of pathsTo(c.functions,v.type,c.expected))items.push({label:callLabel(path,v.name),detail:v.type+' → '+c.expected,rank:1,action:{kind:'compose',value:v.name,path:path.map(fn=>fn.name)}});
  }
  for(const fn of c.functions)items.push({label:fn.name+' ? '+fn.input,detail:fn.input+' → '+fn.output,rank:compatible(fn.output,c.expected)?2:4,action:{kind:'call',value:fn.name}});
  if(c.actual!=='Unknown'&&!compatible(c.actual,c.expected))for(const path of pathsTo(c.functions,c.actual,c.expected))
    items.push({label:'avvolgi: '+callLabel(path,getNode(s).text),detail:c.actual+' → '+c.expected,rank:0,action:{kind:'adapt',path:path.map(fn=>fn.name)}});
  if(c.expected==='Number'||c.expected==='Integer')for(const row of c.sums)items.push({label:'match: '+row.name,detail:row.schema.name+' · '+row.schema.alternatives.length+' casi',rank:2,action:{kind:'match',value:row.name}});
  return items.filter(item=>item.label.toLowerCase().includes(q)).sort((a,b)=>a.rank-b.rank);
}

export function order(s) {
  const ids=[];
  function walk(id){const n=getNode(s,id);if(n.kind==='Binary')walk(n.left);ids.push(id);if(n.kind==='Binary')walk(n.right);else if(n.kind==='Match')n.cases.forEach(c=>walk(c.root));else if(n.kind==='Call')walk(n.left);}
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
export function source(s,annotate=true) {
  function render(id){const n=getNode(s,id);if(n.kind==='Hole')throw Error('Completa tutti i buchi prima di esportare.');
    if(n.kind==='Binary')return '('+render(n.left)+' '+n.text+' '+render(n.right)+')';
    if(n.kind==='Call')return '('+n.text+' '+render(n.left)+')';
    if(n.kind==='Match')return '(match: '+n.text+' { '+n.cases.map(c=>c.tag.charAt(0).toLowerCase()+c.tag.slice(1)+': {'+c.param+' | '+render(c.root)+'}').join(', ')+' })';
    return n.text;
  }
  return (s.prefix??'')+s.defs.map((d,i)=>d.name+(annotate&&s.expected==='Integer'&&i===s.defs.length-1?' (Integer)':'')+' = '+render(d.root)+';').join('\n');
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
  if(['call','compose','adapt'].includes(action.kind)){
    if(!compiler)throw Error('Serve il checker');
    const c=semanticContext(s,compiler);
    const names=action.kind==='call'?[action.value]:action.path;
    if(!names?.length||names.length>2)throw Error('Percorso non disponibile');
    const functions=names.map(name=>c.functions.find(fn=>fn.name===name));
    if(functions.some(fn=>!fn))throw Error('Funzione non disponibile');
    const ref=c.values.find(v=>v.name===action.value);
    if(action.kind==='compose'&&!ref)throw Error('Riferimento non disponibile');
    let type=action.kind==='adapt'?c.actual:action.kind==='compose'?ref.type:functions[0].input;
    for(const fn of functions){if(!compatible(type,fn.input))throw Error('Percorso incompatibile');type=fn.output;}
    const removed=new Set(action.kind==='adapt'?[]:descendants(s,n.id));
    let nodes=s.nodes.filter(x=>!removed.has(x.id)),next=s.next;
    const leafId=next++;
    const leaf=action.kind==='adapt'?{...n,id:leafId}:node(leafId,action.kind==='call'?'Hole':'Name',action.kind==='call'?'':action.value);
    // Build inside-out. The outer node keeps its identity; the Mira reducer
    // installs each new child using the immutable node table.
    let child=leaf;
    for(let i=0;i<functions.length;i++){
      const id=i===functions.length-1?n.id:next++;
      const outer=node(id,'Call',functions[i].name,child.id);
      if(id===n.id)nodes=mira.projection_enclose__child__in(outer,child,nodes);
      else nodes=[...nodes,child];
      child=outer;
    }
    return {...s,nodes,next,selected:action.kind==='call'?leafId:n.id};
  }
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
    if(value.startsWith('"')){
      let parsed;try{parsed=JSON.parse(value);}catch{throw Error('Stringa non valida');}
      if(typeof parsed!=='string')throw Error('Stringa non valida');
      replacement=node(n.id,'Text',JSON.stringify(parsed));
    }else{
    if(!/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,8})?$/.test(value)) throw Error('Inserisci un numero decimale non negativo (max 9 cifre intere).');
    replacement=node(n.id,'Number',value);}
  } else if(action.kind==='reference'){
    if(!(compiler?semanticContext(s,compiler).values.map(v=>v.name):references(s)).includes(action.value))throw Error('Riferimento non disponibile');
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
      if(advance&&getNode(state).kind==='Hole'&&['literal','reference','compose','adapt'].includes(action.kind)){
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
