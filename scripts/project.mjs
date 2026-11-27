import {readFileSync,readdirSync,lstatSync,realpathSync,statSync} from 'node:fs';
import {resolve,dirname,join,relative,sep,isAbsolute} from 'node:path';
import {generateJsonDecoder} from './json-contract.mjs';

const fail=message=>{throw Error('Mira project: '+message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function fields(value,allowed,label){
  if(!object(value))fail(label+' must be an object');
  for(const key of Object.keys(value))if(!allowed.includes(key))fail('Unknown '+label+' field '+key);
}
function list(value,label){
  if(!Array.isArray(value))fail(label+' must be an array');
  return value;
}
function text(value,label){
  if(typeof value!=='string'||!value.trim())fail(label+' must be nonempty text');
  return value;
}
const logical=/^[A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*( \/ [A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*)*$/;
const readJson=path=>JSON.parse(readFileSync(path,'utf8'));
const manifest=(base,value,label)=>typeof value==='string'?readJson(resolve(base,text(value,label))):value;

// Preserve each capability's declaration, type and scope as one unit.
// No silent override even when definitions happen to be identical.
export function mergeHosts(entries){
  const host={values:[],callables:[],selectors:[],types:Object.create(null),scopes:Object.create(null)};
  const seen=new Set();
  for(const entry of entries){
    fields(entry,['values','callables','selectors','types','scopes'],'host manifest');
    const own=new Set();
    for(const kind of ['values','callables','selectors']){
      for(const name of list(entry[kind]??[],kind)){
        text(name,'host capability');
        if(seen.has(name))fail('Duplicate host capability '+name);
        seen.add(name);own.add(name);host[kind].push(name);
      }
    }
    for(const kind of ['types','scopes']){
      if(!object(entry[kind]??{}))fail('Host '+kind+' must be an object');
      for(const [name,value] of Object.entries(entry[kind]??{})){
        if(!own.has(name))fail('Orphan host '+kind+' entry '+name);
        host[kind][name]=value;
      }
    }
  }
  return host;
}
export function mergeBindings(entries){
  const result=Object.create(null);
  for(const entry of entries){
    if(!object(entry))fail('Binding manifest must be an object');
    for(const [name,value] of Object.entries(entry)){
      if(Object.hasOwn(result,name))fail('Duplicate provider binding '+name);
      result[name]=value;
    }
  }
  return result;
}

// Only declared subtrees are enumerated. Directory names retain logical
// path segments; no filename-based discovery outside the selected roots.
function sources(base,entry,roots){
  const modules=Object.create(null);
  function walk(root,path){
    const info=lstatSync(path);
    if(info.isSymbolicLink())fail('Module symlinks are not supported: '+path);
    if(info.isDirectory()){
      for(const name of readdirSync(path).sort())walk(root,join(path,name));
      return;
    }
    if(!info.isFile()||!path.endsWith('.mira')||path===entry)return;
    const name=relative(root,path).slice(0,-5).split(sep).join(' / ');
    if(!logical.test(name))fail('Invalid logical module path '+name);
    if(Object.hasOwn(modules,name))fail('Duplicate logical module '+name);
    modules[name]=readFileSync(path,'utf8');
  }
  for(const item of list(roots,'moduleRoots')){
    fields(item,['root','include'],'module root');
    const root=realpathSync(resolve(base,text(item.root,'root')));
    if(!statSync(root).isDirectory())fail('Module root is not a directory '+root);
    for(const selected of list(item.include,'include')){
      const path=resolve(root,text(selected,'include path'));
      const rel=relative(root,path);
      if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep)||resolve(root,rel)!==path)fail('Include outside module root '+selected);
      if(realpathSync(path)!==path)fail('Module symlinks are not supported: '+path);
      walk(root,path);
    }
  }
  return modules;
}

export function loadProject(filename){
  const path=resolve(filename),base=dirname(path),config=readJson(path);
  fields(config,['format','entry','moduleRoots','hosts','bindings','targets','decoder','treeShake'],'project');
  if(config.format!==1)fail('Expected project format 1');
  if(config.treeShake!==undefined&&typeof config.treeShake!=='boolean')fail('treeShake must be Boolean');
  const entry=realpathSync(resolve(base,text(config.entry,'entry')));
  if(!statSync(entry).isFile())fail('Entry must be a file');
  const modules=sources(base,entry,config.moduleRoots??[]);
  const source=readFileSync(entry,'utf8');
  const hosts=list(config.hosts??[],'hosts').map(v=>manifest(base,v,'host'));
  const shared=list(config.bindings??[],'bindings').map(v=>manifest(base,v,'binding'));
  fields(config.targets,['js','php'],'targets');
  if(!Object.keys(config.targets).length)fail('At least one target is required');
  const targets=Object.fromEntries(Object.entries(config.targets).map(([target,options])=>{
    fields(options,['bindings'],'target '+target);
    return [target,list(options.bindings??[],'target bindings').map(v=>manifest(base,v,'binding'))];
  }));
  const decoder=config.decoder===undefined?null:manifest(base,config.decoder,'decoder');
  if(decoder!==null&&!object(decoder))fail('Decoder must be an object');
  return {source,modules,hosts,shared,targets,decoder,treeShake:config.treeShake??true};
}

export function buildProject(compiler,project){
  const {source}=project,modules=JSON.stringify(project.modules);
  const baseHost=mergeHosts(project.hosts);
  // Validate collisions before doing any target compilation.
  for(const entries of Object.values(project.targets))mergeBindings([...project.shared,...entries]);
  let generated=null;
  if(project.decoder){
    const report=compiler.interfaces(source,JSON.stringify(baseHost),modules);
    if(!report.ok)fail('Decoder contract: '+report.message);
    generated=generateJsonDecoder(JSON.parse(report.output),project.decoder);
  }
  const host=JSON.stringify(mergeHosts([...project.hosts,...(generated?[generated.host]:[])]));
  const data={source,modules,host};
  if(generated)data.decoder=generated.decoder;
  for(const [target,entries] of Object.entries(project.targets)){
    const selected=JSON.stringify(mergeBindings([...project.shared,...entries,...(generated?[generated.bindings]:[])]));
    const result=compiler.compile(source,target,host,false,modules,true,project.treeShake,selected);
    if(!result.ok)fail(target+': '+result.message);
    data[target]=result.output;data[target+'Bindings']=selected;
  }
  return data;
}
