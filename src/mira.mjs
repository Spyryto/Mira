#!/usr/bin/env node
// Mira 0.1: deliberately small, type-checker-free discursive syntax prototype.
import { readFileSync, writeFileSync } from 'node:fs';

export class MiraError extends Error {
  constructor(message, token) {
    super(token ? `${message} at ${token.line}:${token.column}` : message);
    this.name = 'MiraError';
  }
}

export function tokenize(source) {
  const out = [];
  let i = 0, line = 1, column = 1;
  const push = (type, value, startLine, startColumn) => out.push({type, value, line:startLine, column:startColumn});
  const advance = (s) => { for (const ch of s) { if (ch === '\n') {line++;column=1;} else column++; } i += s.length; };
  while (i < source.length) {
    const c = source[i];
    if (/\s/.test(c)) {advance(c);continue;}
    if (c === '#') { const end = source.indexOf('\n',i); advance(source.slice(i,end < 0 ? source.length : end));continue; }
    const sl=line, sc=column, rest=source.slice(i);
    if (c === '"') {
      let j=i+1, escaped=false;
      for (;j<source.length;j++) {const z=source[j]; if (!escaped && z==='"') break; if (!escaped && z==='\\') escaped=true; else escaped=false;}
      if (j>=source.length) throw new MiraError('Unterminated string', {line:sl,column:sc});
      const raw=source.slice(i,j+1); let val;
      try{val=JSON.parse(raw);}catch{throw new MiraError('Invalid string literal', {line:sl,column:sc});}
      push('string',val,sl,sc);advance(raw);continue;
    }
    const num=/^\d+(?:\.\d+)?(?![\w])/.exec(rest);
    if (num) {push('number',num[0],sl,sc);advance(num[0]);continue;}
    const word=/^[A-Za-z_][A-Za-z_0-9]*/.exec(rest);
    if (word) {push('word',word[0],sl,sc);advance(word[0]);continue;}
    const symbol=/^(?:==|!=|<=|>=|&&|\|\||[+*\/%<>~\-])/.exec(rest);
    if (symbol) {push('operator',symbol[0],sl,sc);advance(symbol[0]);continue;}
    if ('():,;='.includes(c)) { push(c,c,sl,sc);advance(c);continue; }
    throw new MiraError(`Unexpected character ${JSON.stringify(c)}`,{line:sl,column:sc});
  }
  out.push({type:'eof',value:'',line,column});
  return out;
}

function words(tokens) {
  if (!tokens.length || tokens.some(x=>x.type!=='word')) throw new MiraError('Expected a multiword name',tokens[0]);
  return tokens.map(x=>x.value).join(' ');
}
function splitTop(tokens, delimiter) {
  const chunks=[];let start=0,depth=0;
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i];
    if(t.type==='(') depth++;
    if(t.type===')') {depth--;if(depth<0)throw new MiraError('Unbalanced parentheses',t);}
    if(depth===0 && t.type===delimiter){chunks.push(tokens.slice(start,i));start=i+1;}
  }
  if(depth!==0)throw new MiraError('Unbalanced parentheses',tokens.at(-1));
  chunks.push(tokens.slice(start));return chunks;
}
function nameSlug(s) {
  return s.split(' ').map((w,i)=>i===0?w:w[0].toUpperCase()+w.slice(1)).join('');
}
function selectorSlug(labels) { return labels.map(x=>x.replaceAll(' ','_')).join('__'); }
function parseHeader(head) {
  if(!head.length) throw new MiraError('Missing definition header');
  const segments=splitTop(head,',');
  if(segments.some(s=>s.some(t=>t.type==='(' || t.type===')'))) throw new MiraError('Definition headers cannot contain parentheses',head[0]);
  if(segments.length===1 && !segments[0].some(t=>t.type===':')) return {kind:'value',name:words(head)};
  const labels=[],params=[];
  for(const s of segments){
    const colons=s.map((t,i)=>t.type===':'?i:-1).filter(i=>i>=0);
    if(colons.length!==1)throw new MiraError('Expected one label: argument pair',s[0]);
    const j=colons[0]; labels.push(words(s.slice(0,j)));params.push(words(s.slice(j+1)));
  }
  return {kind:'function',labels,params,selector:labels.join(':')+':'};
}
function parseDefinitions(tokens) {
  const content=tokens.slice(0,-1);
  if(content.length && content.at(-1).type!==';') throw new MiraError('Expected ; to terminate the final definition',content.at(-1));
  const units=splitTop(content,';');
  const defs=[];
  for(const chunk of units){
    if(!chunk.length)continue;
    const equals=chunk.map((t,i)=>t.type==='='?i:-1).filter(i=>i>=0);
    if(equals.length!==1)throw new MiraError('Each definition needs exactly one =',chunk[0]);
    const header=parseHeader(chunk.slice(0,equals[0]));
    const body=chunk.slice(equals[0]+1);
    if(!body.length)throw new MiraError('Missing definition body',chunk.at(-1));
    defs.push({...header,body,location:chunk[0]});
  }
  return defs;
}

class ExpressionParser {
  constructor(tokens, definitions, locals, globals) {this.tokens=[...tokens,{type:'eof',value:''}];this.i=0;this.definitions=definitions;this.locals=locals;this.globals=globals;}
  peek(){return this.tokens[this.i];}
  take(type){if(this.peek().type!==type)throw new MiraError(`Expected ${type}, got ${this.peek().type}`,this.peek());return this.tokens[this.i++];}
  startsWords(name){const parts=name.split(' ');return parts.every((p,j)=>this.tokens[this.i+j]?.type==='word'&&this.tokens[this.i+j].value===p);}
  takeWords(name){for(const _ of name.split(' '))this.take('word');}
  parse(){const exp=this.expression();if(this.peek().type!=='eof')throw new MiraError(`Unexpected token ${this.peek().value}`,this.peek());return exp;}
  expression(){let left=this.primary();while(this.peek().type==='operator'){
      const op=this.take('operator').value;
      if(op==='~'){
        const right=this.primary();
        if(right.kind==='call') {if(right.args.length!==right.labels.length)throw new MiraError('Invalid pipeline target');left={...right,args:[left,...right.args]};}
        else if(right.kind==='name')left={kind:'apply',fn:right,arg:left};
        else throw new MiraError('Pipeline target must be a function',this.peek());
      }else{const right=this.primary();left={kind:'binary',op,left,right};}
    }return left;}
  primary(){const t=this.peek();
    if(t.type==='('){this.take('(');const e=this.expression();this.take(')');return e;}
    if(t.type==='number'){this.i++;return {kind:'number',value:t.value};}
    if(t.type==='string'){this.i++;return {kind:'string',value:t.value};}
    if(t.type!=='word')throw new MiraError(`Expected expression, got ${t.type}`,t);
    // Recognize keyword selectors by declared label structure, not by type inference.
    const candidates=this.definitions.filter(d=>d.kind==='function'&&this.startsWords(d.labels[0])).sort((a,b)=>b.labels.length-a.labels.length);
    for(const d of candidates){const save=this.i;try {
        this.takeWords(d.labels[0]);const args=[];
        for(let j=0;j<d.labels.length;j++){
          const punctuated=this.peek().type===':';
          if(punctuated)this.take(':');
          if(!punctuated && !['(','number','string'].includes(this.peek().type))throw new MiraError('Abbreviated arguments must be delimited by literal or parentheses',this.peek());
          args.push(this.primary());
          if(j<d.labels.length-1){
            if(this.peek().type===',')this.take(',');
            if(!this.startsWords(d.labels[j+1]))throw new MiraError('Expected next selector label',this.peek());
            this.takeWords(d.labels[j+1]);
          }
        }
        return {kind:'call',selector:d.selector,labels:d.labels,args};
      }catch(e){this.i=save; if(!(e instanceof MiraError))throw e;}
    }
    const names=[...this.locals,...this.globals].sort((a,b)=>b.split(' ').length-a.split(' ').length);
    const name=names.find(n=>this.startsWords(n));
    if(name){this.takeWords(name);return {kind:'name',value:name};}
    throw new MiraError('Unknown identifier or ambiguous call; use explicit selector labels and parentheses',t);
  }
}

export function parse(source){
  const definitions=parseDefinitions(tokenize(source));
  const selectors=new Set(),globals=new Set(),generated=new Map();
  for(const d of definitions){
    const key=d.kind==='function'?d.selector:d.name;
    if(d.kind==='function'){
      if(selectors.has(key))throw new MiraError(`Duplicate selector ${key}`,d.location);
      if(new Set(d.params).size!==d.params.length)throw new MiraError('Duplicate parameter name',d.location);
      selectors.add(key);
    }else{if(globals.has(key))throw new MiraError(`Duplicate value ${key}`,d.location);globals.add(key);}
    const gen=d.kind==='function'?selectorSlug(d.labels):nameSlug(d.name);
    if(!/^[A-Za-z_][A-Za-z_0-9]*$/.test(gen))throw new MiraError('Invalid generated name',d.location);
    if(generated.has(gen))throw new MiraError(`Generated-name collision: ${gen}`,d.location);
    generated.set(gen,key);
  }
  for(const d of definitions){d.expr=new ExpressionParser(d.body,definitions,d.params||[],Array.from(globals)).parse();delete d.body;}
  return {kind:'program',definitions};
}

function emitExpression(expr,target,names,scope){
  const writeName=(name)=>{
    if(!scope.has(name))throw new MiraError(`Unbound name ${name}`);
    return target==='php'?`$${nameSlug(name)}`:nameSlug(name);
  };
  switch(expr.kind){
    case 'name':return writeName(expr.value);
    case 'number':return expr.value;
    case 'string':return target==='js'?JSON.stringify(expr.value):`'${expr.value.replaceAll('\\','\\\\').replaceAll("'","\\'")}'`;
    case 'binary': {
      if(!['+','-','*','/','%'].includes(expr.op))throw new MiraError(`Unsupported operator ${expr.op} in 0.1`);
      return `(${emitExpression(expr.left,target,names,scope)} ${expr.op} ${emitExpression(expr.right,target,names,scope)})`;
    }
    case 'call': {
      const def=names.get(expr.selector);
      if(!def || expr.args.length!==def.labels.length)throw new MiraError(`Unknown or incomplete selector ${expr.selector}`);
      return `${selectorSlug(def.labels)}(${expr.args.map(a=>emitExpression(a,target,names,scope)).join(', ')})`;
    }
    case 'apply':throw new MiraError('Unary function-value application is not yet implemented');
    default:throw new MiraError(`Unsupported expression ${expr.kind}`);
  }
}
export function emit(ast,target){
  if(!['js','php'].includes(target))throw new MiraError('Target must be js or php');
  const functions=new Map(ast.definitions.filter(d=>d.kind==='function').map(d=>[d.selector,d]));
  const values=new Set(ast.definitions.filter(d=>d.kind==='value').map(d=>d.name));
  const lines=[];
  if(target==='php')lines.push('<?php','declare(strict_types=1);','');
  else lines.push('// Generated by Mira 0.1. Do not edit.','');
  for(const d of ast.definitions){
    const isFn=d.kind==='function';
    const scope=isFn?new Set(d.params):values;
    const value=emitExpression(d.expr,target,functions,scope);
    if(isFn){
      const params=d.params.map(p=>target==='php'?`$${nameSlug(p)}`:nameSlug(p)).join(', ');
      lines.push(`function ${selectorSlug(d.labels)}(${params}) {`,`  return ${value};`,'}','');
    }else lines.push(target==='php'?`$${nameSlug(d.name)} = ${value};`:`const ${nameSlug(d.name)} = ${value};`);
  }
  return lines.join('\n')+'\n';
}
export function transpile(source,target){return emit(parse(source),target);}

if(process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href){
  const [input,target='js',output]=process.argv.slice(2);
  if(!input||!['js','php'].includes(target)){
    console.error('Usage: node src/mira.mjs <input.mira> [js|php] [output]');process.exitCode=2;
  }else{
    try{
      const code=transpile(readFileSync(input,'utf8'),target);
      if(output)writeFileSync(output,code);else process.stdout.write(code);
    }catch(e){console.error(e.message);process.exitCode=1;}
  }
}
