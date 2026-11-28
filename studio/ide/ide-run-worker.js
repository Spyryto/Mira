// Explicit execution of trusted editable examples, not a sandbox.
importScripts('./compiler.js','./text-host.js','./date-host.js','./typed-data.js','./json-host.js','./json-module-data.js');
self.onmessage=({data:{source,modules,host,bindings,target,run}})=>{
 try{
  const c=MiraStudioCompiler,start=performance.now();
  const compiled=c.compile(source,target,host,false,modules,true,false,bindings);
  if(!compiled.ok){self.postMessage(compiled);return}
  const compileMs=performance.now()-start;
  if(!run){self.postMessage({ok:true,output:compiled.output,compileMs});return}
  const checked=c.check(source,host,modules,bindings);
  if(!checked.ok){self.postMessage(checked);return}
  const rows=JSON.parse(checked.output);
  const result=rows.find(x=>!x.file&&(x.name==='result'||x.name===x.module+' / result'));
  if(!result)throw Error('Definisci un valore result nel documento di ingresso.');
  const name=result.module?'__miraModule_v_'+Array.from(new TextEncoder().encode(result.name),n=>n.toString(16).padStart(2,'0').toUpperCase()).join(''):'result';
  const native=Object.freeze({...MiraTextHost,...MiraDateHost,...MiraJsonDecoder.host(MiraJsonModuleData.decoder)});
  const execute=new Function('__miraHost','"use strict";\n'+compiled.output+'\nreturn '+name+';');
  const began=performance.now(),value=execute(native);
  if(typeof value==='function'||(value&&typeof value==='object'&&Object.values(value).some(x=>typeof x==='function')))throw Error('Questo risultato richiede il laboratorio/host specializzato (GUI, Storage o effetti).');
  self.postMessage({ok:true,output:JSON.stringify(value,null,2)??String(value),compileMs,executionMs:performance.now()-began});
 }catch(error){self.postMessage({ok:false,message:String(error?.message||error)});}
};
