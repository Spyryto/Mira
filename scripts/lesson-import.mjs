import {generateJsonDecoder} from './json-contract.mjs';

// Compose actual library contracts, not copies of their source or manifests.
export function buildLessonImport(compiler,source,decoderConfig,modules,hosts,bindings){
  const modulesJson=JSON.stringify(modules);
  const report=compiler.interfaces(source,null,modulesJson);
  if(!report.ok)throw Error('Lesson import contract: '+report.message);
  const generated=generateJsonDecoder(JSON.parse(report.output),decoderConfig);
  const host={callables:[],selectors:[],types:{},scopes:{}};
  for(const entry of [...hosts,generated.host]){
    for(const name of [...(entry.callables??[]),...(entry.selectors??[])]){
      if(Object.hasOwn(host.types,name))throw Error('Duplicate lesson import host capability '+name);
      host.types[name]=entry.types[name];host.scopes[name]=entry.scopes[name];
    }
    host.callables.push(...(entry.callables??[]));host.selectors.push(...(entry.selectors??[]));
  }
  const data={source,modules:modulesJson,host:JSON.stringify(host),decoder:generated.decoder};
  for(const [target,link] of Object.entries(bindings)){
    for(const name of Object.keys(generated.bindings)){
      if(Object.hasOwn(link,name))throw Error('Duplicate lesson import provider binding '+name);
    }
    const selected=JSON.stringify({...link,...generated.bindings});
    const compiled=compiler.compile(source,target,data.host,false,modulesJson,true,true,selected);
    if(!compiled.ok)throw Error('Lesson import '+target+': '+compiled.message);
    data[target]=compiled.output;data[target+'Bindings']=selected;
  }
  return data;
}
