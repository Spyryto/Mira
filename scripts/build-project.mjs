import {mkdirSync,readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {loadProject,buildProject} from './project.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
if(args.length!==2){console.error('Usage: node scripts/build-project.mjs <mira.project.json> <output-directory>');process.exit(2);}
const work=mkdtempSync(join(tmpdir(),'mira-project-'));
try{
  const project=loadProject(args[0]);
  const compiler=join(work,'compiler.js');
  // Same Haxe bridge as Studio, without building the PWA or using stale output.
  const config=readFileSync(resolve(root,'studio.hxml'),'utf8').replace(/^-js .*$/m,'-js '+compiler);
  const hxml=join(work,'project.hxml');writeFileSync(hxml,config);
  const build=spawnSync('haxe',[hxml],{cwd:root,stdio:'inherit'});
  if(build.status!==0)throw Error(build.error?.message??'Compiler build failed');
  const context={};runInNewContext(readFileSync(compiler,'utf8'),context);
  const data=buildProject(context.MiraStudioCompiler,project);
  // Emit only after every configured target has passed checked compilation.
  const destination=resolve(args[1]);mkdirSync(destination,{recursive:true});
  writeFileSync(join(destination,'host.json'),data.host+'\n');
  if(data.decoder)writeFileSync(join(destination,'decoder.json'),JSON.stringify(data.decoder,null,2)+'\n');
  for(const target of Object.keys(project.targets)){
    writeFileSync(join(destination,'program.'+target),data[target]);
    writeFileSync(join(destination,'bindings-'+target+'.json'),data[target+'Bindings']+'\n');
  }
  console.log('Mira project built: '+destination);
}catch(error){console.error(error.message);process.exitCode=1;}
finally{rmSync(work,{recursive:true,force:true});}
