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
  const css=read('mira-theme.css'),html=read('theme-lab.html'),sw=read('sw.js');
  for(const name of ['grafite','prisma','bosco','ambra'])assert.ok(css.includes('[data-palette="'+name+'"]'));
  for(const axis of ['palette','surface','type','geometry','density'])assert.ok(html.includes('data-theme-axis="'+axis+'"'));
  for(const file of ['theme-lab.html','theme-lab.js','mira-theme.css'])assert.ok(sw.includes("'./"+file+"'"));
  assert.ok(read('index.html').includes('./theme-lab.html'));
  assert.ok(css.includes('.mira-theme .mira-ui-button'));
});
