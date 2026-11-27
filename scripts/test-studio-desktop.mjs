import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startDesktop} from './studio-desktop.mjs';
const dir=await mkdtemp(join(tmpdir(),'mira-desktop-')),root=join(dir,'project'),site=join(dir,'site');
await mkdir(root);await mkdir(site);await writeFile(join(site,'ide.html'),'studio');await writeFile(join(root,'App.mira'),'result = 1;');
const h=await startDesktop(root,site);
try{
 const get=(auth=true)=>fetch(h.origin+'/_desktop/project',{headers:auth?{'X-Mira-Session':h.token}:{}});
 const save=payload=>fetch(h.origin+'/_desktop/save',{method:'POST',headers:{'X-Mira-Session':h.token,Origin:h.origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 assert.equal((await get(false)).status,403);
 const data=await (await get()).json();assert.equal(data.workspace.files[0].source,'result = 1;');
 assert.equal((await save({path:'App.mira',source:'result = 2;',expected:'result = 1;'})).status,200);
 assert.equal(await readFile(join(root,'App.mira'),'utf8'),'result = 2;');
 assert.equal((await save({path:'Music/Intervals.mira',source:'module Music / Intervals;',expected:null})).status,200);
 assert.equal(await readFile(join(root,'Music','Intervals.mira'),'utf8'),'module Music / Intervals;');
 assert.equal((await save({path:'App.mira',source:'wrong',expected:'result = 1;'})).status,409);
 assert.equal((await save({path:'../Escape.mira',source:'wrong',expected:null})).status,400);
 await symlink(site,join(root,'Link'),'dir');
 assert.equal((await save({path:'Link/Escape.mira',source:'wrong',expected:null})).status,403);
 assert.equal(await (await fetch(h.origin+'/ide.html')).text(),'studio');
 console.log('Desktop host: authenticated loopback, actual disk writes, nested files, conflict and path checks passed.');
}finally{await new Promise(r=>h.server.close(r));await rm(dir,{recursive:true,force:true})}
