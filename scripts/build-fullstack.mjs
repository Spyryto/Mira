import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {generateRpcContract} from './rpc-contract.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const target=resolve(root,process.argv[2] ?? 'dist/fullstack');
const pub=resolve(target,'public'), priv=resolve(target,'private');
mkdirSync(pub,{recursive:true}); mkdirSync(priv,{recursive:true});
const read=path=>readFileSync(resolve(root,path),'utf8');
const ctx={};
runInNewContext(read('dist/studio/compiler.js'),ctx);
const compiler=ctx.MiraStudioCompiler;
const client=read('examples/fullstack/ledger-client.mira');
const server=read('examples/fullstack/ledger-server.mira');
const manifest=JSON.stringify({callables:['start','send']});
function compile(source,target,host){
  const result=compiler.compile(source,target,host);
  if(!result.ok)throw Error(result.message);
  return result.output;
}
const output=compile(client,'js',manifest);
compile(client,'php',manifest);
compile(server,'js');
writeFileSync(resolve(pub,'ledger-client-program.js'),'globalThis.MiraFullstackLedgerProgram = function(__miraHost) {\n'+output+'\n};\n');
writeFileSync(resolve(priv,'ledger-program.php'),compile(server,'php'));
const contract=generateRpcContract(compiler,read('examples/fullstack/services.mira'),server);
writeFileSync(resolve(pub,'rpc-bindings.js'),contract.client);
writeFileSync(resolve(priv,'rpc-methods.php'),contract.server);
writeFileSync(resolve(priv,'rpc-types.json'),contract.schemas);
copyFileSync(resolve(root,'runtime/php/Rpc.php'),resolve(priv,'Rpc.php'));
copyFileSync(resolve(root,'runtime/php/TypedData.php'),resolve(priv,'TypedData.php'));
copyFileSync(resolve(root,'runtime/js/typed-data.js'),resolve(pub,'typed-data.js'));
for(const file of ['ui-host.js','effects.js','styles.css','persistent-ledger.css'])copyFileSync(resolve(root,'studio',file),resolve(pub,file));
for(const file of ['index.html','ledger.php','ledger-client.js'])copyFileSync(resolve(root,'examples/fullstack',file),resolve(pub,file));
console.log('Full-stack bundle ready in '+target+' (serve public only)');
