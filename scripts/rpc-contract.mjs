// Read literal declarations using the real Mira AST, never evaluate source.
const fail=message=>{throw Error('RPC contract: '+message);};
const has=(obj,key)=>Object.hasOwn(obj,key);
function literal(node){
  switch(node.kind){
    case 'Text': case 'Boolean': return node.value;
    case 'Number': return Number(node.value);
    case 'Sequence': return node.items.map(literal);
    case 'Record': {
      const record=Object.create(null);
      for(const field of node.fields){
        if(has(record,field.key))fail('duplicate field '+field.key);
        record[field.key]=literal(field.value);
      }
      return record;
    }
    default: fail('only literal data is allowed, got '+node.kind);
  }
}
function ast(compiler,source){
  const result=compiler.ast(source);
  if(!result.ok)fail(result.message);
  return JSON.parse(result.output).definitions;
}
function shape(value,keys){
  return value && typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).length===keys.length&&keys.every(k=>has(value,k));
}
const ident=/^[a-z][a-z0-9_]{0,47}$/;
const selector=/^[a-z][a-z0-9]*( [a-z][a-z0-9]*)*$/;
const methodName=/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const phpName=/^[a-zA-Z_][a-zA-Z0-9_]*$/;
const phpString=s=>"'"+s.replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
const phpArray=value=>{
  if(Array.isArray(value))return '['+value.map(phpArray).join(', ')+']';
  if(value&&typeof value==='object')return '['+Object.entries(value).map(([k,v])=>phpString(k)+' => '+phpArray(v)).join(', ')+']';
  return typeof value==='string'?phpString(value):String(value);
};
// RPC wire subset: closed, first-order data only. The checker, not this
// generator, specializes and unifies the actual function signature.
function requirePortable(schema,depth=0){
  if(!schema||depth>30)fail('RPC type exceeds wire depth');
  switch(schema.kind){
    case 'Number': case 'Text': case 'Boolean': return;
    case 'List': return requirePortable(schema.item,depth+1);
    case 'Record':
      if(schema.tail!==null||!schema.fields.length)fail('RPC requires nonempty closed records');
      for(const field of schema.fields){
        if(/^-?\\d+$/.test(field.name))fail('nonportable RPC record key '+field.name);
        requirePortable(field.type,depth+1);
      }
      return;
    default: fail('RPC requires concrete data types, got '+schema.kind);
  }
}
export function generateRpcContract(compiler,source,serverSource){
  const defs=ast(compiler,source);
  if(defs.length!==1||defs[0].kind!=='Value'||defs[0].name!=='services')fail('expected only services = [...]');
  const services=literal(defs[0].body);
  if(!Array.isArray(services)||!services.length||services.length>64)fail('expected 1–64 services');
  const functions=ast(compiler,serverSource).filter(d=>d.kind==='Function'&&d.labels.length===1);
  const capabilities=new Set(),methods=new Set(),bindings=Object.create(null),schemas=Object.create(null),php=[];
  for(const entry of services){
    const common=['capability','method','kind','handler'];
    if(!shape(entry,entry?.kind==='mira'?[...common,'parameters']:common))fail('invalid service fields');
    const {capability,method,kind,handler}=entry;
    if(typeof capability!=='string'||!ident.test(capability)||typeof method!=='string'||!methodName.test(method)||method.length>100)fail('invalid capability or method');
    if(capabilities.has(capability)||methods.has(method))fail('duplicate capability or method');
    capabilities.add(capability);methods.add(method);bindings[capability]=method;
    if(kind==='host'){
      if(typeof handler!=='string'||!phpName.test(handler))fail('invalid host callable');
      php.push(phpString(method)+' => '+phpString(handler));
    }else if(kind==='mira'){
      if(typeof handler!=='string'||!selector.test(handler)||!functions.some(d=>d.labels[0]===handler))fail('unknown unary Mira selector '+handler);
      const params=entry.parameters;
      if(!Array.isArray(params)||!params.length||params.length>32)fail('expected parameter fields');
      const seen=new Set();
      for(const p of params){
        if(!shape(p,['name','type','min','max'])||typeof p.name!=='string'||!ident.test(p.name)||p.type!=='integer'||
          !Number.isSafeInteger(p.min)||!Number.isSafeInteger(p.max)||p.min>p.max||seen.has(p.name))fail('invalid integer parameter');
        seen.add(p.name);
      }
      // Existing integer policies specialize Number, not the reverse:
      // integer/range validation remains a separate boundary policy.
      const argument={record:Object.fromEntries(params.map(p=>[p.name,'Number']))};
      const checked=compiler.specialize(serverSource,handler+':',JSON.stringify([argument]));
      if(!checked.ok)fail(checked.message);
      const signature=JSON.parse(checked.output).schema;
      requirePortable(signature.parameters[0]);
      requirePortable(signature.result);
      schemas[method]={parameters:signature.parameters[0],result:signature.result,integerPolicy:params};
      const callable=handler.replaceAll(' ','_');
      php.push(phpString(method)+' => static fn($params) => '+callable+'(\\Mira\\Rpc\\checkParams($params, '+phpArray(params)+'))');
    }else fail('unknown service kind');
  }
  return {
    schemas:JSON.stringify({version:1,methods:schemas},null,2)+'\n',
    client:'globalThis.MiraRpcBindings = Object.freeze('+JSON.stringify(bindings,null,2)+');\n',
    server:'<?php\ndeclare(strict_types=1);\n// Generated from Mira service declarations.\nreturn [\n  '+php.join(',\n  ')+'\n];\n'
  };
}
