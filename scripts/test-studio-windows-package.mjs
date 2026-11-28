import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {once} from 'node:events';
import {chromium} from 'playwright';
const packageDir=resolve('dist/windows-portable');
const base=await mkdtemp(join(tmpdir(),'mira-package-'));
const root=join(base,'Progetto con spazi è');await mkdir(root);
const app='module App;\ninterface\nresult;\nimplementation\nresult = 1;';
await writeFile(join(root,'App.mira'),app);
let child,browser;
async function start(){
 child=spawn(join(packageDir,'runtime','node.exe'),[join(packageDir,'launcher.mjs'),root,'--no-browser'],{cwd:base,stdio:['ignore','pipe','pipe'],windowsHide:true});
 return await new Promise((ok,no)=>{
  let output='',errors='';
  const timer=setTimeout(()=>no(Error('Launcher timeout: '+errors)),15000);
  child.stderr.on('data',x=>errors+=x);
  child.stdout.on('data',x=>{output+=x;const match=output.match(/http:\/\/127\.0\.0\.1:\d+\/ide\.html#desktop=[a-f0-9]{48}/);if(match){clearTimeout(timer);ok(match[0]);}});
  child.once('error',e=>{clearTimeout(timer);no(e)});
  child.once('exit',code=>{clearTimeout(timer);no(Error('Launcher exit '+code+': '+errors))});
 });
}
async function stop(){
 if(child&&child.exitCode===null){const done=once(child,'exit');child.kill();await done;}
 child=null;
}
try{
 let url=await start();
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
 await page.goto(url);const editor=page.locator('.cm-content'),status=page.locator('#status'),persist=page.locator('#persistence');
 await status.filter({hasText:'Verificato'}).waitFor();await page.locator('#save-disk:enabled').waitFor();
 assert.match(await editor.textContent(),/result = 1;/);
 const edited=app.replace('1;','2;');
 await editor.fill(edited);await editor.press('Control+s');await persist.filter({hasText:'Scritto su disco'}).waitFor();
 assert.equal(await readFile(join(root,'App.mira'),'utf8'),edited);
 page.once('dialog',d=>d.accept('Music/Intervals.mira'));await page.locator('#new-file').click();
 const lib='module Music / Intervals;\ninterface\noctave;\nimplementation\noctave = 12;';
 await editor.fill(lib);await page.locator('#save-disk').click();await persist.filter({hasText:'Scritto su disco'}).waitFor();
 assert.equal(await readFile(join(root,'Music','Intervals.mira'),'utf8'),lib);
 await page.locator('#files button',{hasText:'App.mira'}).click();
 const imported='module App;\ninterface\nresult;\nimport Music / Intervals { octave; };\nimplementation\nresult = octave;';
 await editor.fill(imported);await status.filter({hasText:'Verificato'}).waitFor();
 await page.locator('#save-disk').click();await persist.filter({hasText:'Scritto su disco'}).waitFor();
 assert.equal(await readFile(join(root,'App.mira'),'utf8'),imported);
 await page.screenshot({path:resolve('dist/windows-desktop.png'),fullPage:true});
 await page.close();await stop();
 url=await start();const reopened=await browser.newPage({serviceWorkers:'block'});
 await reopened.goto(url);await reopened.locator('#status').filter({hasText:'Verificato'}).waitFor();
 assert.match(await reopened.locator('.cm-content').textContent(),/result = octave;/);
 assert.equal(await reopened.locator('#files button',{hasText:'Music/Intervals.mira'}).count(),1);
 await writeFile(join(root,'App.mira'),edited);
 await reopened.locator('.cm-content').fill(app);await reopened.locator('#save-disk').click();
 await reopened.locator('#persistence').filter({hasText:'File modificato su disco'}).waitFor();
 assert.equal(await readFile(join(root,'App.mira'),'utf8'),edited);
 console.log('Windows package: bundled runtime, launcher, real file creation and edits, imports, restart persistence and conflict protection verified.');
}finally{if(browser)await browser.close();await stop();await rm(base,{recursive:true,force:true});}
