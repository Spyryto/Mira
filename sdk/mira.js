#!/usr/bin/env node
// Standalone Node bootstrap; no npm packages. Run in a trusted workspace.
(async () => {
const {createRequire} = await import('node:module');
const require = createRequire(process.cwd() + '/mira-bootstrap.cjs');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), cp = require('node:child_process');
const version = process.env.MIRA_VERSION || '0.108';
const home = path.resolve(process.env.MIRA_HOME || path.join(os.homedir(), '.mira'));
const root = path.join(home, 'versions', version);
if (!/^\d+\.\d+(\.\d+)?$/.test(version)) throw Error('Invalid MIRA_VERSION');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function read(p) { return fs.readFileSync(p, 'utf8'); }
function spawn(program, args, capture = false) {
  const r = cp.spawnSync(program, args, {encoding:'utf8',stdio:capture?['ignore','pipe','inherit']:'inherit'});
  if (r.error) throw r.error;
  if (r.status !== 0) throw Error(program+' exited '+r.status);
  return r.stdout;
}
function safeName(p) {
  return typeof p==='string' && p.split('/').every(s=>/^[A-Za-z0-9_. -]+$/.test(s) && !/^\.|[. ]$/.test(s) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s));
}
async function install(local) {
  if (fs.existsSync(root)) { console.log('Already installed: '+root); return; }
  const url = 'https://github.com/Spyryto/Mira/releases/download/sdk-v'+version+'/mira-sdk.json';
  const get = async u => {const r=await fetch(u,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Download failed: '+r.status);return Buffer.from(await r.arrayBuffer());};
  const data = local?fs.readFileSync(local):await get(url);
  const checksum = (local?read(local+'.sha256'):(await get(url+'.sha256')).toString()).trim();
  if (!/^[a-f0-9]{64}$/.test(checksum) || digest(data)!==checksum) throw Error('SDK checksum mismatch');
  const bundle=JSON.parse(data.toString('utf8'));
  if(bundle.version!==version || !bundle.files || Array.isArray(bundle.files))throw Error('Wrong SDK version or bundle');
  const parent=path.dirname(root);fs.mkdirSync(parent,{recursive:true});
  const stage=fs.mkdtempSync(path.join(parent,'.install-'));
  try {
    for(const [name,content] of Object.entries(bundle.files)){
      if(!safeName(name)||typeof content!=='string')throw Error('Invalid SDK entry: '+name);
      const dest=path.join(stage,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,content,{flag:'wx'});
    }
    for(const name of ['compiler/mira.cjs','compiler/php/index.php','console-host.json','gui-host.json','ui-host.js']) if(!fs.statSync(path.join(stage,name)).isFile())throw Error('Incomplete SDK');
    fs.renameSync(stage,root);
  } finally { fs.rmSync(stage,{recursive:true,force:true}); }
  console.log('Installed '+root);
}
function compile(source,target,manifest) {
  return spawn(process.execPath,[path.join(root,'compiler/mira.cjs'),path.resolve(source),target,'--host',path.join(root,manifest)],true);
}
function build(source,target,out) {
  const code=compile(source,target,'console-host.json');
  const output=out||source.replace(/\.mira$/i,target==='js'?'.mjs':'.php');
  if(path.resolve(output)===path.resolve(source))throw Error('Output would overwrite source');
  const prefix='const __miraHost = {log: value => console.log(value)};\n';
  const phpHost='$GLOBALS["__miraHost"] = ["log" => function ($value) { echo is_scalar($value) ? (string)$value : json_encode($value); echo PHP_EOL; }];\n';
  if(target==='php'&&!code.includes('declare(strict_types=1);'))throw Error('Unexpected PHP output');
  fs.writeFileSync(output,target==='js'?prefix+code:code.replace('declare(strict_types=1);','declare(strict_types=1);\n'+phpHost));
  return output;
}
function web(source,dir) {
  const code=compile(source,'js','gui-host.json');
  fs.mkdirSync(dir,{recursive:true});
  // Exclusive creation: never overwrite existing site files.
  const assets={'index.html':read(path.join(root,'gui.html')),'ui-host.js':read(path.join(root,'ui-host.js')),'app.js':read(path.join(root,'gui-entry.js'))+'\n'+code};
  for(const name of Object.keys(assets))if(fs.existsSync(path.join(dir,name)))throw Error('Output exists: '+name);
  for(const [name,content] of Object.entries(assets))fs.writeFileSync(path.join(dir,name),content,{flag:'wx'});
}
async function main(){
  const [cmd,source,option,out]=process.argv.slice(2);
  if(cmd==='install'){await install(source);return;}
  if(cmd==='info'){console.log(version+' '+root);return;}
  if(!['build','run','web','serve'].includes(cmd)||!source||!source.endsWith('.mira'))throw Error('Usage: node mira.js install [bundle.json] | info | build/run FILE.mira [js|php] [output] | web FILE.mira DIRECTORY | serve FILE.mira [port]');
  await install();
  if(cmd==='web'){if(!option)throw Error('Specify output directory');web(source,option);console.log(option);return;}
  if(cmd==='serve'){
    const port=Number(option||8765);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mira-gui-'));web(source,dir);
    const server=require('node:http').createServer((req,res)=>{
      const names={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/ui-host.js':'ui-host.js'};
      const name=Object.hasOwn(names,req.url)?names[req.url]:null;
      if(!name||req.method!=='GET'){res.writeHead(404).end();return;}
      res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
      res.end(read(path.join(dir,name)));
    });
    server.on('error',e=>{fs.rmSync(dir,{recursive:true,force:true});console.error(e.message);process.exitCode=1;});
    server.listen(port,'127.0.0.1',()=>console.log('http://127.0.0.1:'+port+'/'));
    process.on('SIGINT',()=>server.close(()=>{fs.rmSync(dir,{recursive:true,force:true});}));
    return;
  }
  const target=option||'js';if(!['js','php'].includes(target))throw Error('Expected js or php');
  if(cmd==='build'){console.log(build(source,target,out));return;}
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mira-run-'));
  try{const file=build(source,target,path.join(dir,target==='js'?'app.mjs':'app.php'));spawn(target==='js'?process.execPath:'php',[file]);}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
}
await main();
})().catch(e=>{console.error(e.message);process.exitCode=1;});
