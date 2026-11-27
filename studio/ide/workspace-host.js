import {workspace_save__in,workspace_find__in,workspace_dependencies__in} from '../../dist/ide/editor-services.js';

export const key='mira-ide:workspace:v1';
const pathPattern=/^[A-Za-z_][A-Za-z_0-9 -]*(?:\/[A-Za-z_][A-Za-z_0-9 -]*)*\.mira$/;
export function validPath(path){return typeof path==='string'&&path.length<=240&&pathPattern.test(path)&&path.split('/').every(p=>p.trim()===p)}
export function logical(path){return path.slice(0,-5).split('/').join(' / ')}
export function validate(value){
 if(value?.format!==1||!Array.isArray(value.files)||!value.files.length||value.files.length>1000)throw Error('Workspace non valido.');
 const seen=new Set();
 for(const file of value.files){
  if(!validPath(file?.path)||typeof file.source!=='string'||file.source.length>1000000||seen.has(file.path.toLowerCase()))throw Error('File non valido o duplicato: '+file?.path);
  seen.add(file.path.toLowerCase());
 }
 if(!workspace_find__in(value.active,value.files).length)throw Error('File attivo non trovato.');
 return {format:1,active:value.active,files:value.files.map(({path,source})=>({path,source}))};
}
export function load(storage,initial){
 try{const raw=storage.getItem(key);if(raw)return validate(JSON.parse(raw));}
 catch(error){throw Error('Workspace salvato non leggibile: '+error.message)}
 return {format:1,active:'programma.mira',files:[{path:'programma.mira',source:storage.getItem('mira-ide:source:v1')??initial}]};
}
export function persist(storage,workspace){storage.setItem(key,JSON.stringify(validate(workspace)))}
export function update(workspace,path,source){return {...workspace,files:workspace_save__in({path,source},workspace.files)}}
export function get(workspace,path){return workspace_find__in(path,workspace.files)[0]}
export function modulesFor(workspace){
 const files=workspace_dependencies__in(workspace.active,workspace.files);
 return Object.fromEntries(files.map(f=>[logical(f.path),f.source]));
}
export function newFile(workspace,path){
 if(!validPath(path))throw Error('Usa un percorso relativo .mira, per esempio Music/Intervals.mira.');
 if(workspace.files.some(f=>f.path.toLowerCase()===path.toLowerCase()))throw Error('Il file esiste già.');
 const source='module '+logical(path)+';\ninterface\nimplementation\n';
 return {...update(workspace,path,source),active:path};
}
export async function readFolder(root){
 const files=[],skipped=[];
 async function walk(dir,prefix){
  for await(const [name,handle] of dir.entries()){
   if(name.startsWith('.')||name==='node_modules'||name==='dist')continue;
   const path=prefix+name;
   if(handle.kind==='directory'){await walk(handle,path+'/');continue}
   if(!name.endsWith('.mira'))continue;
   if(!validPath(path)){skipped.push(path);continue}
   if(files.length>=1000)throw Error('Limite di 1000 file Mira.');
   const file=await handle.getFile();if(file.size>1000000)throw Error('File troppo grande: '+path);
   files.push({path,source:await file.text()});
  }
 }
 await walk(root,'');
 if(!files.length)throw Error('Nessun file .mira compatibile nella cartella.');
 files.sort((a,b)=>a.path.localeCompare(b.path));
 return {workspace:validate({format:1,active:files.find(f=>f.path==='App.mira')?.path||files[0].path,files}),skipped};
}
async function fileHandle(root,path,create){
 if(!validPath(path))throw Error('Percorso non valido.');
 const parts=path.split('/'),name=parts.pop();let dir=root;
 for(const part of parts)dir=await dir.getDirectoryHandle(part,{create});
 return dir.getFileHandle(name,{create});
}
// Explicit save only. Never overwrite a file changed outside this IDE since opening.
export async function saveDisk(root,file,baseline){
 let handle;
 try{handle=await fileHandle(root,file.path,false)}catch(error){if(error.name!=='NotFoundError')throw error}
 if(handle){
  const current=await (await handle.getFile()).text();
  if(!baseline.has(file.path)||current!==baseline.get(file.path))throw Error('Conflitto su disco: '+file.path+'. Riapri la cartella prima di sovrascrivere.');
 }else if(baseline.has(file.path))throw Error('File rimosso su disco: '+file.path);
 else handle=await fileHandle(root,file.path,true);
 const stream=await handle.createWritable();
 try{await stream.write(file.source);await stream.close()}catch(error){try{await stream.abort()}catch{}throw error}
 baseline.set(file.path,file.source);
}
