import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {mergeHosts,mergeBindings} from './project.mjs';
export function buildIdeLibraryCatalog(root,site,compiler){
 const read=path=>readFileSync(resolve(root,path),'utf8');
 const modules=Object.create(null),sources=[];
 function walk(dir){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
   const path=join(dir,entry.name);
   if(entry.isDirectory()){walk(path);continue}
   if(!entry.name.endsWith('.mira'))continue;
   const source=readFileSync(path,'utf8'),name=source.match(/^module\s+([^;]+);/m)?.[1].trim();
   const rel=relative(root,path).replaceAll('\\','/');
   sources.push({path:rel,source,name:name||null});
   // App fixtures are not library modules. Only real library contracts/data/providers.
   if(!name||! /^(Services|Data|Providers) \/ /.test(name))continue;
   if(Object.hasOwn(modules,name))throw Error('Duplicate library '+name);
   modules[name]=source;
  }
 }
 walk(resolve(root,'lib'));
 const context={};
 for(const service of ['text','date','json','storage','http'])runInNewContext(readFileSync(resolve(site,service+'-module-data.js'),'utf8'),context);
 const data=['Text','Date','Json','Storage','Http'].map(name=>({name,...context['Mira'+name+'ModuleData']}));
 const host=mergeHosts(data.filter(x=>x.host).map(x=>JSON.parse(x.host)));
 const bindings=mergeBindings([...data.filter(x=>x.bindings||x.browser).map(x=>JSON.parse(x.bindings||x.browser)),{
  'Services / Date Safe':{provider:'Providers / Date Safe Native'},
  'Services / Storage Safe':{provider:'Providers / Storage Safe Browser'}
 }]);
 const reference=JSON.parse(readFileSync(resolve(site,'reference.json'),'utf8'));
 const examples=[];
 function add(id,title,description,source,lab,execute){
  const check=compiler.check(source,JSON.stringify(host),JSON.stringify(modules),JSON.stringify(bindings));
  if(!check.ok)throw Error('IDE example '+id+': '+check.message);
  const rows=JSON.parse(check.output);
  const result=rows.find(x=>!x.file&&(x.name==='result'||x.name.endsWith(' / result')));
  if(execute&&!result)throw Error('IDE example lacks result: '+id);
  for(const target of ['js','php']){
   // Storage has different target providers; this catalog describes browser JS.
   const targetBindings={...bindings};
   if(target==='php'){
    targetBindings['Services / Storage']={provider:'Providers / Storage Files'};
    targetBindings['Services / Storage Safe']={provider:'Providers / Storage Safe Files'};
   }
   const emitted=compiler.compile(source,target,JSON.stringify(host),false,JSON.stringify(modules),true,false,JSON.stringify(targetBindings));
   if(!emitted.ok)throw Error('IDE '+target+' example '+id+': '+emitted.message);
  }
  examples.push({id,title,description,source,lab,execute});
 }
 for(const item of data)add('library-'+item.name.toLowerCase(),item.name+' · libreria','Esempio originale della libreria Mira.',item.source,item.name==='Storage'?'storage-module-lab.html':item.name==='Http'?'host-module-lab.html':'host-module-lab.html',['Text','Date','Json'].includes(item.name));
 for(const e of reference.examples){
  if(e.host||e.expect?.kind!=='result'||!e.source)continue;
  const r=compiler.check(e.source);
  if(!r.ok||!JSON.parse(r.output).some(x=>x.name==='result'&&!x.file))continue;
  const js=compiler.compile(e.source,'js',null,false,null,true);
  const php=compiler.compile(e.source,'php',null,false,null,true);
  if(!js.ok||!php.ok)continue;
  // GUI/effect results need their existing specialized host, not generic evaluation.
  if(/\b(?:import|extern|view)\b/.test(e.source))continue;
  add(e.id,e.title,e.description,e.source,null,true);
 }
 const catalog={format:1,modules,sources,host:JSON.stringify(host),bindings:JSON.stringify(bindings),examples};
 writeFileSync(resolve(site,'ide-libraries.json'),JSON.stringify(catalog)+'\n');
 console.log('IDE offline library modules: '+Object.keys(modules).length+'; editable examples: '+examples.length);
 return catalog;
}
