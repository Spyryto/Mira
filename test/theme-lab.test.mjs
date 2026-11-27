import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../dist/studio/'+name,import.meta.url),'utf8');
test('theme lab uses real Mira compiler and existing native descriptors',()=>{
  const context={};
  runInNewContext(read('compiler.js'),context);
  runInNewContext(read('theme-lab.js'),context);
  const compiled=context.MiraStudioCompiler.compile(context.MiraThemeLab.source,'js');
  assert.equal(compiled.ok,true,compiled.message);
  const view=runInNewContext(compiled.output+'\ntheme_view',context);
  const model={name:'Hello, Mira!',target:'JavaScript',active:true,count:0};
  const children=view(model).children;
  assert.equal(children[1].update(model,'New').name,'New');
  assert.equal(children[2].update(model,'PHP').target,'PHP');
  assert.equal(children[3].update(model,false).active,false);
  assert.equal(children[4].children[2].update(model).count,1);
  assert.equal(children[4].children[0].update(model).count,-1);
  assert.equal(children[5].update({...model,count:9}).count,0);
});
test('theme is scoped and all lab assets are published and cached',()=>{
  const css=read('mira-theme.css'),html=read('theme-native-lab.html'),sw=read('sw.js');
  for(const name of ['grafite','prisma','bosco','ambra'])assert.ok(css.includes('[data-palette="'+name+'"]'));
  for(const axis of ['palette','surface','type','geometry','density'])assert.ok(html.includes('data-theme-axis="'+axis+'"'));
  for(const file of ['theme-lab.html','theme-native-lab.html','theme-lab.js','mira-theme.css'])assert.ok(sw.includes("'./"+file+"'"));
  assert.ok(read('index.html').includes('./theme-lab.html'));
  assert.ok(css.includes('.mira-theme .mira-ui-button'));
});

test('Cozy Edition is the main Theme Lab and retains the approved defaults',()=>{
  const html=read('theme-lab.html'),sw=read('sw.js');
  assert.ok(html.includes('./theme-native-lab.html'));
  assert.ok(sw.includes("endsWith('/theme-native-lab.html') ? './theme-native-lab.html'"));
  assert.ok(html.includes('--spacing:.05em;--size:16px'));
  assert.match(html,/id="czSize"[^>]*value="16"/);
  assert.match(html,/id="czSpacing"[^>]*value="5"/);
  const script=html.split('<script>')[1].split('</script>')[0];
  assert.doesNotThrow(()=>new Function(script));
  assert.ok(script.includes('q("Size").value=16;q("Spacing").value=5'));
  assert.ok(script.includes('outer:74,inner:0,inset:29,toggle:64,grain:0'));
  for(const palette of ['Prisma','Acqua','Cristallo','Ambra','Salvia','Corallo','Avorio','Laguna','Orchidea','Notturno','Grafite','Bosco']){
    assert.ok(script.includes('["'+palette+'",'));
  }
  assert.ok(script.includes('[0,9,10,1,2,3,4,5,6,7,8,11].map'));
  assert.ok(script.includes('data-color='));
  assert.ok(script.includes('function apply()'));
});
