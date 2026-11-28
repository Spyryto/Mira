import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const {version}=JSON.parse(fs.readFileSync('package.json','utf8'));
const files={};
function file(source,target){files[target]=fs.readFileSync(source,'utf8');}
function directory(source,target){for(const entry of fs.readdirSync(source,{withFileTypes:true})){const s=path.join(source,entry.name),t=target+'/'+entry.name;if(entry.isDirectory())directory(s,t);else if(entry.isFile())file(s,t);}}
file('dist/mira.cjs','compiler/mira.cjs');
directory('dist/compiler-php','compiler/php');
directory('lib','lib');
directory('runtime','runtime');
for(const name of ['console-host.json','gui-host.json','gui.html','gui-entry.js'])file('sdk/'+name,name);
file('studio/ui-host.js','ui-host.js');
directory('sdk/quickstart','quickstart');
file('lib/gui.mira','quickstart/lib/gui.mira');
file('sdk/README.md','README.md');
fs.mkdirSync('dist/sdk',{recursive:true});
const data=JSON.stringify({version,files});
fs.writeFileSync('dist/sdk/mira-sdk.json',data);
fs.writeFileSync('dist/sdk/mira-sdk.json.sha256',createHash('sha256').update(data).digest('hex')+'\n');
fs.copyFileSync('sdk/mira.js','dist/sdk/mira.js');
fs.copyFileSync('sdk/mira.php','dist/sdk/mira.php');
