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
  if(config.fallibleSelector!==undefined||config.fallibleCapability!==undefined){
    const name=config.fallibleCapability;
    const fallible=mod.surface.symbols.find(s=>s.kind==='selector'&&s.name===config.fallibleSelector)?.schema;
    const sum=fallible?.result;
    const ok=sum?.alternatives?.find(a=>a.tag==='Ok');
    const err=sum?.alternatives?.find(a=>a.tag==='Err');
    if(typeof name!=='string'||name===capability||fallible?.kind!=='Function'||fallible.parameters.length!==1||fallible.parameters[0].kind!=='Text'
      ||sum?.kind!=='Sum'||sum.name!==(config.resultType??service+' / Result')||sum.alternatives.length!==2||!ok||err?.payload?.kind!=='Text'
      ||sum.arguments?.length!==2||JSON.stringify(ok.payload)!==JSON.stringify(signature.result)
      ||JSON.stringify(sum.arguments[0])!==JSON.stringify(ok.payload)||sum.arguments[1].kind!=='Text')
      throw Error('JSON fallible decoder must return the contract Result (decoded data, Text)');
    // Native capability returns only structural data. Mira constructs the
    // nominal sum itself, avoiding forged identities and dummy success values.
    decoder.fallibleCapability=name;
    host.callables.push(name);
    host.types[name]={parameters:['Text'],result:{record:{values:{list:hostType(decoder.schema)},error:'Text'}}};
    host.scopes[name]=[provider];
  }
  return {decoder,host,bindings:{[service]:{provider}}};
}
