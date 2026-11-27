import {execFileSync} from 'node:child_process';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const editions=Object.freeze([
 {id:'classic',name:'Mira Studio Classic',commit:'4e50b8acb55d11a008db74ed70c07453cf070561',description:'L’edizione brutalista, prima del redesign Cozy.'},
 {id:'cozy',name:'Mira Studio Cozy',commit:'281a71c2433565ee7b2b3f5389124c91741fce62',description:'L’edizione Cozy Functional con la reference delle API native.'}
]);
const root=fileURLToPath(new URL('../',import.meta.url));
const archive=resolve(root,'dist/studio/archive');

export function isolateEdition(directory,edition){
 const namespace='mira-archive-'+edition.id;
 const worker=join(directory,'sw.js');
 let sw=readFileSync(worker,'utf8');
 sw=sw.replaceAll('mira-studio-',namespace+'-');
 // Relative assets remain inside this worker scope. Cache lookups must
 // never select a response from the live IDE or a sibling edition.
 sw=sw.replace('caches.match(page)', 'caches.open(CACHE).then(cache => cache.match(page))');
 sw=sw.replace('caches.match(request)', 'caches.open(CACHE).then(cache => cache.match(request))');
 writeFileSync(worker,sw);
 // Local storage is origin-wide, unlike service worker scope. Only
 // rewrite the existing storage namespaces, not compiler source or UI IDs.
 for(const file of ['app.js','ast-inspector.js','persistent-ledger.js','storage-host.js']){
   const path=join(directory,file);
   if(!existsSync(path))continue;
   const source=readFileSync(path,'utf8').replaceAll('mira-studio:',namespace+':').replaceAll('mira:apps:',namespace+':apps:').replaceAll('mira:kv:',namespace+':kv:');
   writeFileSync(path,source);
 }
 // Source links refer to the edition, not the moving main branch.
 for(const file of readdirSync(directory).filter(name=>/\.(html|json|js)$/.test(name)&&name!=='compiler.js')){
   const path=join(directory,file);
   let source=readFileSync(path,'utf8');
   source=source.replaceAll('https://github.com/Spyryto/Mira/blob/main/','https://github.com/Spyryto/Mira/blob/'+edition.commit+'/');
   if(file==='reference-ui.js')source=source.replaceAll("https://github.com/Spyryto/Mira/blob/main/","https://github.com/Spyryto/Mira/blob/"+edition.commit+"/");
   writeFileSync(path,source);
 }
 const manifestPath=join(directory,'manifest.webmanifest');
 const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
 manifest.name=edition.name;manifest.short_name=edition.id==='classic'?'Mira Classic':'Mira Cozy';manifest.id='./';
 writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 const index=join(directory,'index.html');
 const html=readFileSync(index,'utf8');
 writeFileSync(index,html.replace('<body>','<body><aside style="padding:.6rem 1rem;background:#eee9e2;color:#37313e;font:14px system-ui;text-align:center">Edizione storica · '+edition.name+' · <a href="../">Archivio</a> · <a href="../../">Studio attuale</a></aside>'));
 writeFileSync(join(directory,'archive-edition.json'),JSON.stringify(edition,null,2)+'\n');
}
export function buildArchives(){
 mkdirSync(archive,{recursive:true});
 const work=mkdtempSync(join(tmpdir(),'mira-archives-'));
 try{
   for(const edition of editions){
     const checkout=join(work,edition.id);
     execFileSync('git',['worktree','add','--detach',checkout,edition.commit],{cwd:root,stdio:'inherit'});
     try{
       execFileSync('npm',['run','build:studio'],{cwd:checkout,env:{...process.env,GITHUB_SHA:edition.commit},stdio:'inherit'});
       const target=join(archive,edition.id);
       rmSync(target,{recursive:true,force:true});cpSync(join(checkout,'dist/studio'),target,{recursive:true});
       isolateEdition(target,edition);
     }finally{execFileSync('git',['worktree','remove','--force',checkout],{cwd:root,stdio:'inherit'});}
   }
 }finally{rmSync(work,{recursive:true,force:true});}
 const cards=editions.map(e=>'<article><h2><a href="./'+e.id+'/">'+e.name+'</a></h2><p>'+e.description+'</p><code>'+e.commit.slice(0,12)+'</code></article>').join('');
 writeFileSync(join(archive,'index.html'),'<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Archivio Mira Studio</title><style>body{font:16px/1.6 system-ui;color:#39334e;background:#f5e9ed;max-width:720px;margin:auto;padding:24px}article{background:#fff8f4;border:1px solid #cbbbc9;border-radius:16px;padding:18px;margin:16px 0}a{color:#514688}h2{margin:0}</style><body><a href="../">← Studio attuale</a><h1>Archivio Mira Studio</h1><p>Edizioni storiche congelate, con compilatore e documentazione della propria revisione.</p>'+cards+'</body></html>');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))buildArchives();
