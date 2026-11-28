// Real browser smoke checks and reviewable screenshots, not approved pixel baselines.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const base=resolve('dist/studio'), out=resolve('dist/studio-screenshots');
await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try {
    const path=resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
    if(!path.startsWith(base+sep))throw Error('outside root');
    const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'text/plain'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch();
const failures=[];
try{
 for(const [name,width,height] of [['small-phone',320,720],['phone',390,844],['tablet',768,1024],['desktop',1440,900],['tv',1920,1080]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
  try{
   await page.goto(url);
   await page.locator('#source').waitFor();
   await page.screenshot({path:resolve(out,name+'-editor.png'),fullPage:true});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   assert.equal(overflow,false,name+' home horizontal overflow');
   await page.locator('#tab-reference').click();
   await page.locator('.reference-search').waitFor();
   await page.locator('.reference-controls a',{hasText:'Esempi'}).click();
   await page.waitForURL('**/#/guide/examples');
   await page.locator('.reference-controls a[aria-current="page"]',{hasText:'Esempi'}).waitFor();
   await page.locator('.reference-search').fill('gui');
   await page.waitForFunction(()=>document.querySelector('.reference-search')?.value==='gui'&&document.querySelector('.reference-example-card'));
   assert.equal(await page.locator('.reference-search').inputValue(),'gui');
   assert.ok(await page.locator('.reference-example-card').count()>0);
   assert.equal(await page.locator('.reference-example-card').first().locator('.reference-meta span').first().textContent(),'GUI',name+' semantic search ranking');
   await page.locator('.reference-search').scrollIntoViewIfNeeded();
   await page.screenshot({path:resolve(out,name+'-examples.png'),fullPage:false});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' guide horizontal overflow');
   if(name==='phone'){
     await page.locator('.reference-search').fill('');
     await page.locator('.reference-filter-panel summary').click();
     await page.getByLabel('Funzione chiamata (AST)').selectOption('fold:with:from:');
     assert.equal(await page.locator('.reference-example-card').count(),10,'fold call facet');
   }
   if(name==='phone'){
     await page.goto(url+'#/guide/quickstart');
     await page.getByRole('heading',{name:'Quickstart · Dal codice all’app'}).waitFor();
     await page.getByText('Apri lib/gui.mira',{exact:true}).click();
     assert.ok(await page.locator('#reference details').filter({has:page.getByText('Apri lib/gui.mira',{exact:true})}).locator('pre').textContent().then(t=>t.includes('column: items')));
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'quickstart horizontal overflow');
     await page.screenshot({path:resolve(out,name+'-quickstart.png'),fullPage:false});
     page.once('dialog',d=>d.accept());
     await page.getByRole('button',{name:'Prova nell’editor'}).first().click();
     assert.match(await page.locator('#source').inputValue(),/hours = 3/);
     await page.locator('[data-target="js"]').click();
     await page.locator('#run').click();
     await page.waitForFunction(()=>document.querySelector('#runOutput')?.textContent.includes('150'));
     await page.locator('#tab-reference').click();
     await page.getByRole('heading',{name:'Quickstart · Dal codice all’app'}).waitFor();
     page.once('dialog',d=>d.accept());
     await page.getByRole('button',{name:'Prova nell’editor'}).last().click();
     assert.match(await page.locator('#source').inputValue(),/import "lib\/gui.mira"/);
     await page.locator('#previewUI').click();
     const preview=page.frameLocator('iframe.mira-ui-frame');
     await preview.getByText('Mira counter',{exact:true}).waitFor();
     await preview.getByRole('button',{name:'+1',exact:true}).click();
     await preview.getByText('1',{exact:true}).waitFor();
   }
   await page.goto(url+'theme-native-lab.html');
   await page.locator('#theme-preview .mira-ui-button').first().waitFor();
   await page.screenshot({path:resolve(out,name+'-widgets.png'),fullPage:true});
   if(name==='phone'||name==='desktop'){
    for(const route of ['type-lab','grammar-lab','host-module-lab','module-explorer','projection-lab','lesson-import','persistent-ledger','effects-demo','gui-benchmark','theme-lab','laboratory','design-notes']){
     await page.goto(url+route+'.html');
     await page.screenshot({path:resolve(out,name+'-'+route+'.png'),fullPage:false});
     if(['type-lab','grammar-lab','module-explorer','host-module-lab'].includes(route))assert.ok((await page.locator('textarea#source').boundingBox()).height>=180,name+' '+route+' editor too short');
     if(route==='gui-benchmark')assert.equal(await page.evaluate(()=>{const b=document.body.getBoundingClientRect();return Math.abs(b.left-(innerWidth-b.right))<=2&&getComputedStyle(document.body).backgroundColor===getComputedStyle(document.documentElement).backgroundColor;}),true,name+' benchmark centered and coordinated');
    }
   }
  }catch(error){failures.push(name+': '+error.message);}finally{await page.close();}
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
assert.deepEqual(failures,[]);
