import {requirePortable} from './rpc-contract.mjs';

// Contract is the compiler's canonical interface report, not a hand-written schema.
function hostType(schema){
  switch(schema.kind){
    case 'Number': case 'Text': case 'Boolean': return schema.kind;
    case 'List': return {list:hostType(schema.item)};
    case 'Record': return {record:Object.fromEntries(schema.fields.map(f=>[f.name,hostType(f.type)]))};
    default: throw Error('Unsupported JSON decoder type: '+schema.kind);
  }
}
export function generateJsonDecoder(report,config){
  const {service,selector,provider,capability}=config;
  const mod=report.interfaces.find(m=>m.module===service);
  const symbol=mod?.surface.symbols.find(s=>s.kind==='selector'&&s.name===selector);
  const signature=symbol?.schema;
  if(mod?.resolvedModule!==service||signature?.kind!=='Function'||signature.parameters.length!==1||signature.parameters[0].kind!=='Text')
    throw Error('JSON decoder requires an independent contract with signature (Text) -> concrete data');
  requirePortable(signature.result);
  const decoder={capability,schema:signature.result};
  const host={callables:[capability],types:{[capability]:{parameters:['Text'],result:hostType(decoder.schema)}},scopes:{[capability]:[provider]}};
  return {decoder,host,bindings:{[service]:{provider}}};
}
