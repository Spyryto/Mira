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
const previews=[];
async function review(page,name){
 if(!['phone-editor','phone-examples','desktop-editor','desktop-examples','phone-widgets'].includes(name))return;
 const bytes=await page.screenshot({type:'jpeg',quality:55,fullPage:false});
 previews.push({name,bytes});
}
try{
 for(const [name,width,height] of [['small-phone',320,720],['phone',390,844],['tablet',768,1024],['desktop',1440,900],['tv',1920,1080]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
  try{
   await page.goto(url);
   await page.locator('#source').waitFor();
   await page.screenshot({path:resolve(out,name+'-editor.png'),fullPage:true});
   await review(page,name+'-editor');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   assert.equal(overflow,false,name+' home horizontal overflow');
   await page.locator('#tab-reference').click();
   await page.locator('.reference-search').waitFor();
   await page.locator('.reference-controls a',{hasText:'Esempi'}).click();
   await page.locator('.reference-count').waitFor();
   await page.locator('.reference-search').fill('gui');
   await page.screenshot({path:resolve(out,name+'-examples.png'),fullPage:false});
   await review(page,name+'-examples');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' guide horizontal overflow');
   await page.goto(url+'theme-native-lab.html');
   await page.locator('#theme-preview .mira-ui-button').first().waitFor();
   await page.screenshot({path:resolve(out,name+'-widgets.png'),fullPage:true});
   await review(page,name+'-widgets');
   if(name==='phone'||name==='desktop'){
    for(const route of ['type-lab','grammar-lab','host-module-lab','module-explorer','projection-lab','lesson-import','persistent-ledger','effects-demo','gui-benchmark','theme-lab','laboratory','design-notes']){
     await page.goto(url+route+'.html');
     await page.screenshot({path:resolve(out,name+'-'+route+'.png'),fullPage:false});
    }
   }
  }catch(error){failures.push(name+': '+error.message);}finally{await page.close();}
 }
  if(previews.length){
    const sheet=await browser.newPage({viewport:{width:1120,height:1000},deviceScaleFactor:1});
    const cards=previews.map(({name,bytes})=>'<section><b>'+name+'</b><img src="data:image/jpeg;base64,'+bytes.toString('base64')+'"></section>').join('');
    await sheet.setContent('<style>body{margin:12px;background:#faf4f6;color:#39334e;font:16px system-ui;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}section{display:grid;gap:4px;align-content:start}img{max-width:100%;max-height:460px;object-fit:contain;object-position:top left}</style>'+cards);
    await sheet.locator('img').first().waitFor();
    const jpeg=await sheet.screenshot({type:'jpeg',quality:65,fullPage:true,path:resolve(out,'review-contact-sheet.jpg')});
    const data=jpeg.toString('base64');
    if(process.env.CI)for(let i=0;i<data.length;i+=1500)console.log('MIRA_REVIEW_JPEG '+data.slice(i,i+1500));
    await sheet.close();
  }
}finally{await browser.close();await new Promise(r=>server.close(r));}
assert.deepEqual(failures,[]);
