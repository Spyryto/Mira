import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {editions} from './studio-archives.mjs';
const base=resolve('dist/studio');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
 try{
  const path=resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
  if(!path.startsWith(base+sep))throw Error('outside root');
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'text/plain'});res.end(await readFile(path));
 }catch{if(!res.headersSent)res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 await page.goto(origin);
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload();
 await page.evaluate(()=>localStorage.setItem('mira-studio:source:v1','live sentinel'));
 await page.goto(origin+'archive/');
 assert.equal(await page.locator('h1').textContent(),'Archivio Mira Studio');
 for(const edition of editions){
   await page.goto(origin+'archive/'+edition.id+'/');
   await page.locator('#source').waitFor();
   await page.waitForFunction(()=>!!globalThis.MiraStudioCompiler);
   assert.ok((await page.locator('aside').first().textContent()).includes(edition.name));
   const metadata=await page.evaluate(async()=>await (await fetch('./archive-edition.json')).json());
   assert.equal(metadata.commit,edition.commit);
   await page.evaluate(()=>navigator.serviceWorker.ready);
   await page.reload();
   await page.waitForFunction(id=>navigator.serviceWorker.controller?.scriptURL.includes('/archive/'+id+'/sw.js'),edition.id);
   assert.equal(await page.evaluate(()=>localStorage.getItem('mira-studio:source:v1')),'live sentinel');
   const manifest=await page.evaluate(async()=>await (await fetch('./manifest.webmanifest')).json());
   assert.equal(manifest.name,edition.name);
   await context.setOffline(true);await page.reload();
   await page.locator('#source').waitFor();await page.waitForFunction(()=>!!globalThis.MiraStudioCompiler);
   await context.setOffline(false);
 }
 await page.goto(origin);
 await page.locator('#source').waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('mira-studio:source:v1')),'live sentinel');
 await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
