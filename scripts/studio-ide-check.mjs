import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const base=resolve('dist/studio'),out=resolve('dist/studio-screenshots');
await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{const p=resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(base+sep))throw Error('outside');const bytes=await readFile(p);res.writeHead(200,{'Content-Type':mime[extname(p)]||'text/plain'});res.end(bytes)}catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
try{
 for(const [name,width,height] of [['phone',390,844],['desktop',1440,900]]){
  const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'});
  await page.goto('http://127.0.0.1:'+server.address().port+'/ide.html');
  await page.locator('#status').filter({hasText:'Verificato'}).waitFor();
  await page.locator('#symbols button',{hasText:'double:'}).click();
  assert.match(await page.locator('#inspect').textContent(),/Number/);
  await page.screenshot({path:resolve(out,name+'-ide.png')});
  const editor=page.locator('.cm-content');await editor.click();await editor.press('Control+End');await editor.press('Enter');await editor.pressSequentially('coll');
  await page.locator('.cm-tooltip-autocomplete').waitFor();
  assert.match(await page.locator('.cm-tooltip-autocomplete').textContent(),/collect:with:/);
  await page.screenshot({path:resolve(out,name+'-ide-completion.png')});
  await editor.press('Enter');await page.waitForFunction(()=>document.querySelector('.cm-content').textContent.includes('collect: items'));
  await editor.press('Control+a');await editor.fill('result = @;');
  await page.locator('#status').filter({hasText:'Unexpected character'}).waitFor();
  await page.locator('.cm-lintRange-error').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r))}
