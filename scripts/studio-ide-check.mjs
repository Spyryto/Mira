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
  console.log(name+' initial analysis: '+await page.locator('#status').textContent());
  if(name==='phone')await page.locator('#workspace-tree summary').click();
  await page.locator('#symbols button',{hasText:'double:'}).click();
  assert.match(await page.locator('#inspect').textContent(),/Number/);
  if(name==='phone')await page.locator('#workspace-tree summary').click();
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:resolve(out,name+'-ide.png'),fullPage:true});
  const editor=page.locator('.cm-content');await editor.click();await editor.press('Control+End');await editor.press('Enter');const completionStart=performance.now();await editor.pressSequentially('coll');
  await page.locator('.cm-tooltip-autocomplete').waitFor();
  assert.match(await page.locator('.cm-tooltip-autocomplete').textContent(),/collect:with:/);
  console.log(name+' completion observed after typing four characters: '+(performance.now()-completionStart).toFixed(1)+' ms');
  await page.screenshot({path:resolve(out,name+'-ide-completion.png')});
  await editor.press('Enter');await page.waitForFunction(()=>document.querySelector('.cm-content').textContent.includes('collect: items'));
  await editor.fill('result = @;');
  await page.locator('#status').filter({hasText:'Unexpected character'}).waitFor();
  await page.locator('.cm-lintRange-error').waitFor();
  assert.match(await page.locator('#inspect').textContent(),/Ultima analisi valida/);
  await page.screenshot({path:resolve(out,name+'-ide-error.png'),fullPage:true});
  await editor.fill('result = 1 + "a";');
  await page.locator('#status').filter({hasText:'Type check'}).waitFor();
  await page.locator('.cm-lintRange-error').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r))}
