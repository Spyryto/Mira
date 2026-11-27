import {tokenizeMira} from '../syntax-highlight.js';
// A deliberately narrow completion site: a top-level value's RHS is a simple
// field chain. No guesses about shadowing, incomplete local blocks or scopes.
// The prefix is verified by the compiler, not inferred from this recognizer.
export function fieldContext(source,pos){
 const before=source.slice(0,pos);
 if(before.length>50000)return null;
 const tokens=tokenizeMira(before);
 let offset=0,boundary=0,stack=[],lastKind='';
 for(const token of tokens){
  offset+=token.text.length;lastKind=token.kind;
  if(token.kind!=='punctuation')continue;
  const c=token.text;
  if('([{'.includes(c))stack.push(c);
  else if(')]}'.includes(c)){
   if(stack.pop()!=={')':'(',']':'[','}':'{'}[c])return null;
  }else if(c===';'&&!stack.length)boundary=offset;
 }
 if(stack.length||lastKind==='comment'||lastKind==='string')return null;
 const current=before.slice(boundary);
 // Mask comments preceding the declaration without changing offsets.
 const text=tokenizeMira(current).map(t=>t.kind==='comment'?' '.repeat(t.text.length):t.text).join('');
 const match=text.match(/^\s*[A-Za-z_][A-Za-z_0-9]*\s*=\s*([A-Za-z_][A-Za-z_0-9]*(?:\s*~\s*[A-Za-z_][A-Za-z_0-9]*)*)\s*~\s*([A-Za-z_][A-Za-z_0-9]*)?$/);
 if(!match||!boundary)return null;
 const prefix=match[2]||'';
 return {base:source.slice(0,boundary),receiver:match[1].split('~').map(s=>s.trim()).join('~'),prefix,from:pos-prefix.length};
}
export function formatSchema(schema){
 if(!schema)return '';
 switch(schema.kind){
 case 'Named':return schema.name;
 case 'List':return '['+formatSchema(schema.item)+']';
 case 'Function':return '('+schema.parameters.map(formatSchema).join(', ')+') → '+formatSchema(schema.result);
 case 'Record':return '{'+schema.fields.map(f=>f.name+(f.optional?'?':'')+': '+formatSchema(f.type)).join(', ')+(schema.tail?', …':'')+'}';
 default:return schema.name||schema.kind||'';
 }
}
export function fieldRows(report){
 const rows=[];
 function descend(receiver,schema,depth){
  if(depth>32)return;
  while(schema?.kind==='Named')schema=schema.base;
  if(schema?.kind!=='Record')return;
  for(const field of schema.fields){
   if(!/^[A-Za-z_][A-Za-z_0-9]*$/.test(field.name))continue;
   rows.push({receiver,field:field.name,signature:formatSchema(field.type),optional:field.optional===true});
   if(!field.optional)descend(receiver+'~'+field.name,field.type,depth+1);
  }
 }
 for(const symbol of report)if(!symbol.file&&/^[A-Za-z_][A-Za-z_0-9]*$/.test(symbol.name))descend(symbol.name,symbol.schema,0);
 return rows;
}
