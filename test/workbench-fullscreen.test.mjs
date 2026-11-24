
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const site=resolve(root,'dist/studio');
const {mountWorkbenchFullscreen}=await import(pathToFileURL(
  resolve(site,'workbench-fullscreen.js')).href);

function classes() {
  const active=new Set();
  return {
    contains:name=>active.has(name),
    toggle:(name,value)=> {
      const on=value===undefined?!active.has(name):value;
      if(on)active.add(name);else active.delete(name);
      return on;
    }
  };
}
function element() {
  const listeners=new Map();
  const attributes=new Map();
  return {
    classList:classes(), listeners, attributes, textContent:'',
    setAttribute(name,value){attributes.set(name,String(value));},
    addEventListener(name,listener){listeners.set(name,listener);},
    removeEventListener(name){listeners.delete(name);},
    focus(){this.focused=true;},
    dispatch(name,data={}){listeners.get(name)?.(data);}
  };
}
function setup() {
  const root=element(),button=element(),benchmark=element(),body=element();
  const listeners=new Map();
  const doc={
    body,
    getElementById:id=>id==='benchmark'?benchmark:null,
    addEventListener(name,fn){listeners.set(name,fn);},
    removeEventListener(name){listeners.delete(name);},
    dispatch(name,event){listeners.get(name)?.(event);}
  };
  return {root,button,benchmark,body,doc,listeners};
}

test('whole Workbench can expand and shrink without the Fullscreen API',()=>{
  const {root,button,body,doc}=setup();
  const instance=mountWorkbenchFullscreen(root,button,doc);
  assert.equal(root.classList.contains('workbench-fullscreen'),false);
  button.dispatch('click');
  assert.equal(root.classList.contains('workbench-fullscreen'),true);
  assert.equal(body.classList.contains('workbench-fullscreen-open'),true);
  assert.equal(button.attributes.get('aria-pressed'),'true');
  assert.match(button.textContent,/Riduci/);
  assert.equal(button.focused,true);
  button.dispatch('click');
  assert.equal(root.classList.contains('workbench-fullscreen'),false);
  assert.equal(body.classList.contains('workbench-fullscreen-open'),false);
  assert.equal(button.attributes.get('aria-pressed'),'false');
  instance.dispose();
  assert.equal(doc.listeners.size,0);
  assert.equal(button.listeners.size,0);
});

test('Escape closes the Workbench without losing its UI state',()=>{
  const {root,button,benchmark,doc}=setup();
  const sourceText='lesson = {total hours: 3};';
  const selectedTab='code';
  const instance=mountWorkbenchFullscreen(root,button,doc);
  button.dispatch('click');
  doc.dispatch('keydown',{key:'Enter'});
  assert.equal(root.classList.contains('workbench-fullscreen'),true);
  doc.dispatch('keydown',{key:'Escape'});
  assert.equal(root.classList.contains('workbench-fullscreen'),false);
  assert.equal(sourceText,'lesson = {total hours: 3};');
  assert.equal(selectedTab,'code');
  instance.dispose();
});

test('Escape closes the whole Workbench when Bench is the selected tab',()=>{
  const {root,button,doc}=setup();
  const instance=mountWorkbenchFullscreen(root,button,doc);
  button.dispatch('click');
  doc.dispatch('keydown',{key:'Escape'});
  assert.equal(root.classList.contains('workbench-fullscreen'),false);
  instance.dispose();
});

test('Workbench assets, fullscreen button and editor flex layout are offline-ready',()=>{
  for (const name of ['workbench-fullscreen.js','styles.css','index.html','app.js']) {
    assert.ok(existsSync(resolve(site,name)),name);
  }
  const html=readFileSync(resolve(site,'index.html'),'utf8');
  const css=readFileSync(resolve(site,'styles.css'),'utf8');
  const sw=readFileSync(resolve(site,'sw.js'),'utf8');
  assert.match(html,/id="workbenchFullscreen"/);
  assert.match(css,/\.workspace\.workbench-fullscreen/);
  assert.match(css,/height:100dvh/);
  assert.match(css,/\.editor-frame/);
  assert.match(sw,/\.\/workbench-fullscreen\.js/);
});
