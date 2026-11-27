// Local-only desktop host. A root chosen on the command line is the entire
// filesystem authority; no remote URL, command execution or generic FS API.
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile,readdir,lstat,realpath,mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,join,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const pathPattern=/^[A-Za-z_][A-Za-z_0-9]*(?: [A-Za-z_][A-Za-z_0-9]*)*(?:\/[A-Za-z_][A-Za-z_0-9]*(?: [A-Za-z_][A-Za-z_0-9]*)*)*\.mira$/;
const valid=path=>typeof path==='string'&&path.length<=240&&pathPattern.test(path);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const fail=(status,message)=>Object.assign(Error(message),{status});
async function exists(path){try{return await lstat(path)}catch(e){if(e.code==='ENOENT')return null;throw e}}
export async function startDesktop(root,site,port=0){
 root=await realpath(root);site=await realpath(site);
 if(!(await lstat(root)).isDirectory())throw Error('Project root must be a directory.');
 const token=randomBytes(24).toString('hex');
 async function projectFiles(){
  const files=[];
  async function walk(dir,prefix){
   for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.')||['node_modules','dist'].includes(entry.name)||entry.isSymbolicLink())continue;
    const path=prefix+entry.name,absolute=join(dir,entry.name);
    if(entry.isDirectory()){await walk(absolute,path+'/');continue}
    if(!entry.isFile()||!valid(path))continue;
    const info=await lstat(absolute);if(!info.isFile()||info.isSymbolicLink())throw fail(409,'File changed: '+path);
    if(info.size>1000000||files.length>=1000)throw fail(413,'Workspace size limit.');
    files.push({path,source:await readFile(absolute,'utf8')});
   }
  }
  await walk(root,'');files.sort((a,b)=>a.path.localeCompare(b.path));
  if(!files.length)files.push({path:'App.mira',source:'module App;\ninterface\nresult;\nimplementation\nresult = 0;'});
  return {files,active:files.find(f=>f.path==='App.mira')?.path||files[0].path,format:1};
 }
 async function safeTarget(path){
  if(!valid(path))throw fail(400,'Invalid project path.');
  let dir=root;const parts=path.split('/'),name=parts.pop();
  for(const part of parts){
   dir=join(dir,part);let st=await exists(dir);
   if(!st){try{await mkdir(dir)}catch(e){if(e.code!=='EEXIST')throw e}st=await lstat(dir)}
   if(!st.isDirectory()||st.isSymbolicLink()||await realpath(dir)!==dir)throw fail(403,'Unsafe project directory.');
  }
  return join(dir,name);
 }
 async function save({path,source,expected}){
  if(!valid(path)||typeof source!=='string'||Buffer.byteLength(source)>1000000||(expected!==null&&typeof expected!=='string'))throw fail(400,'Invalid save.');
  const target=await safeTarget(path),st=await exists(target);
  if(st&&(!st.isFile()||st.isSymbolicLink()))throw fail(403,'Unsafe file.');
  const current=st?await readFile(target,'utf8'):null;
  if(current!==expected)throw fail(409,'File modificato su disco: '+path);
  const temp=join(dirname(target),'.mira-save-'+randomBytes(12).toString('hex'));
  try{
   await writeFile(temp,source,{flag:'wx'});
   const again=await exists(target);
   if(again&&(!again.isFile()||again.isSymbolicLink()))throw fail(409,'Unsafe file change.');
   if((again?await readFile(target,'utf8'):null)!==expected)throw fail(409,'File modificato su disco: '+path);
   await rename(temp,target);
  }finally{await unlink(temp).catch(()=>{})}
  return {ok:true};
 }
 let saveQueue=Promise.resolve();
 const server=createServer(async(req,res)=>{
  const send=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body)};
  try{
   const host='127.0.0.1:'+server.address().port,origin='http://'+host;
   if(req.headers.host!==host)throw fail(403,'Invalid host.');
   const url=new URL(req.url,origin);
   if(url.pathname.startsWith('/_desktop/')){
    if(req.headers['x-mira-session']!==token)throw fail(403,'Invalid session.');
    if(req.headers.origin&&req.headers.origin!==origin)throw fail(403,'Invalid origin.');
    if(req.method==='GET'&&url.pathname==='/_desktop/project'){
     const workspace=await projectFiles();
     // Actual absent files have a null baseline, including an empty project's starter.
     const baseline={};for(const file of workspace.files){const st=await exists(join(root,file.path));baseline[file.path]=st?file.source:null}
     return send(200,JSON.stringify({workspace,baseline,name:root.split(sep).at(-1)}));
    }
    if(req.method==='POST'&&url.pathname==='/_desktop/save'){
     if(req.headers.origin!==origin)throw fail(403,'Invalid origin.');
     let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>3000000)throw fail(413,'Payload too large.');chunks.push(chunk)}
     const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
     const action=saveQueue.then(()=>save(payload));saveQueue=action.catch(()=>{});
     return send(200,JSON.stringify(await action));
    }
    throw fail(404,'Unknown desktop endpoint.');
   }
   if(req.method!=='GET')throw fail(405,'GET only.');
   const name=decodeURIComponent(url.pathname==='/'?'/ide.html':url.pathname);
   const target=resolve(site,'.'+name);
   if(!target.startsWith(site+sep))throw fail(403,'Outside Studio.');
   const actual=await realpath(target);
   if(!actual.startsWith(site+sep))throw fail(403,'Outside Studio.');
   send(200,await readFile(actual),mime[extname(actual)]||'application/octet-stream');
  }catch(error){send(error.status||(error.code==='ENOENT'?404:500),JSON.stringify({error:error.status?error.message:'Desktop host: '+(error.code||'invalid request')}))}
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok)});
 const origin='http://127.0.0.1:'+server.address().port;
 return {server,origin,token,url:origin+'/ide.html#desktop='+token};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];
 if(!root){console.error('Usage: npm run studio:desktop -- <project folder>');process.exitCode=1}
 else{const host=await startDesktop(root,resolve('dist/studio'));console.log('Mira Studio Desktop — open in Firefox/Chrome:\n'+host.url+'\nPress Ctrl+C to stop.')}
}
