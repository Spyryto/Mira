// Narrow adapter from the actual compiler AST to an editable node table.
// No parser or checker here; export is checked by Mira's compiler.
export const seedSource = 'hours = 4;\nrate = 30;\nresult = hours * rate;';
export const operators = ['+', '-', '*', '/'];
const identifier = /^[A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*$/;
const node = (id, kind, text='', left=0, right=0) => ({id,kind,text,left,right});
export function fromAst(ast) {
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
  return {nodes,defs,next,selected:defs[defs.length-1].root};
}
export const getNode=(s,id=s.selected)=>s.nodes.find(n=>n.id===id);
export function references(s) {
  const parent=new Map();
  for(const n of s.nodes) if(n.kind==='Binary') {parent.set(n.left,n.id);parent.set(n.right,n.id);}
  let root=s.selected;
  while(parent.has(root)) root=parent.get(root);
  const at=s.defs.findIndex(d=>d.root===root);
  return s.defs.slice(0,Math.max(0,at)).map(d=>d.name);
}
export function order(s) {
  const ids=[];
  function walk(id){const n=getNode(s,id);if(n.kind==='Binary')walk(n.left);ids.push(id);if(n.kind==='Binary')walk(n.right);}
  s.defs.forEach(d=>walk(d.root));return ids;
}
export function navigate(s,dir) {
  const ids=order(s), i=ids.indexOf(s.selected), n=getNode(s);
  const parent=s.nodes.find(x=>x.kind==='Binary'&&(x.left===n.id||x.right===n.id));
  const selected=dir==='parent'?parent?.id:dir==='child'?(n.kind==='Binary'?n.left:undefined):ids[i+(dir==='previous'?-1:1)];
  return selected===undefined?s:{...s,selected};
}
export function source(s) {
  function render(id){const n=getNode(s,id);if(n.kind==='Hole')throw Error('Completa tutti i buchi prima di esportare.');
    if(n.kind==='Binary')return '('+render(n.left)+' '+n.text+' '+render(n.right)+')';
    return n.text;
  }
  return s.defs.map(d=>d.name+' = '+render(d.root)+';').join('\n');
}
function descendants(s,id) {const n=getNode(s,id);return n.kind==='Binary'?[n.left,n.right,...descendants(s,n.left),...descendants(s,n.right)]:[];}
export function edit(s,action,mira) {
  const n=getNode(s);
  if(action.kind==='wrap'){
    if(!operators.includes(action.value))throw Error('Operatore non supportato');
    const left={...n,id:s.next},right=node(s.next+1,'Hole');
    return {...s,nodes:mira.projection_wrap__left__right__in(node(n.id,'Binary',action.value,left.id,right.id),left,right,s.nodes),next:s.next+2,selected:right.id};
  }
  let replacement;
  if(action.kind==='remove') replacement=node(n.id,'Hole');
  else if(action.kind==='literal'){
    const value=action.value.trim();
    if(!/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,8})?$/.test(value)) throw Error('Inserisci un numero decimale non negativo (max 9 cifre intere).');
    replacement=node(n.id,'Number',value);
  } else if(action.kind==='reference'){
    if(!references(s).includes(action.value))throw Error('Riferimento non disponibile');
    replacement=node(n.id,'Name',action.value);
  } else throw Error('Azione non supportata');
  const removed=new Set(descendants(s,n.id));
  return {...s,nodes:mira.projection_replace__in(replacement,s.nodes.filter(x=>!removed.has(x.id)))};
}
export function history(initial,mira){
  let state=initial;const past=[],future=[];
  return {
    get state(){return state},get canUndo(){return past.length>0},get canRedo(){return future.length>0},
    select(id){if(getNode(state,id))state={...state,selected:id};},
    navigate(dir){state=navigate(state,dir);},
    apply(action){const next=edit(state,action,mira);past.push(state);future.length=0;state=next;},
    undo(){if(past.length){future.push(state);state=past.pop();}},
    redo(){if(future.length){past.push(state);state=future.pop();}}
  };
}
