import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const context={};runInNewContext(readFileSync(resolve(root,'dist/studio/compiler.js'),'utf8'),context);
const compiler=context.MiraStudioCompiler;
const {tokenizeMira,mountMiraHighlight}=await import(pathToFileURL(
  resolve(root,'dist/studio/syntax-highlight.js')).href);

test('Mira highlighting recognizes selectors, operators, strings and comments',()=>{
  const source='result = collect: lessons, if: (billable: _); # filter\n' +
    'label = "if: # quoted"; hours = 1.5 >> (_ + 2);';
  const tokens=tokenizeMira(source);
  assert.equal(tokens.map(t=>t.text).join(''),source);
  assert.deepEqual(tokens.filter(t=>t.kind==='selector').map(t=>t.text),
    ['collect:','if:','billable:']);
  assert.deepEqual(tokens.filter(t=>t.kind==='string').map(t=>t.text),
    ['"if: # quoted"']);
  assert.deepEqual(tokens.filter(t=>t.kind==='comment').map(t=>t.text),
    ['# filter']);
  assert.ok(tokens.some(t=>t.kind==='number'&&t.text==='1.5'));
  assert.ok(tokens.some(t=>t.kind==='operator'&&t.text==='>>'));
  assert.ok(tokens.some(t=>t.kind==='placeholder'&&t.text==='_'));
});

test('Mira highlighter preserves invalid/incomplete source and caps huge inputs',()=>{
  const source='value = "unterminated\nresult = @; # never parsed';
  assert.equal(tokenizeMira(source).map(t=>t.text).join(''),source);
  const large='a'.repeat(50001);
  assert.deepEqual(tokenizeMira(large),[{kind:'plain',text:large}]);
});

test('editor overlay uses text nodes, stays scroll-synchronized, and preserves editing',()=>{
  const handlers=new Map();
  const classes=new Set();
  const doc={
    body:{classList:{
      add:kind=>classes.add(kind),
      remove:kind=>classes.delete(kind)
    }},
    createDocumentFragment:()=>({
      children:[],append(node){this.children.push(node);}
    }),
    createTextNode:text=>({textContent:text,nodeType:3}),
    createElement:tag=>({tagName:tag,textContent:'',className:''})
  };
  const textarea={
    value:'result = "<script>"; # ok\n',scrollTop:24,scrollLeft:15,
    addEventListener:(name,fn)=>handlers.set(name,fn),
    removeEventListener:(name)=>handlers.delete(name)
  };
  const mirror={
    children:[],
    replaceChildren(fragment){this.children=fragment.children;},
    scrollTop:0,scrollLeft:0
  };
  const editor=mountMiraHighlight(textarea,mirror,doc);
  assert.ok(classes.has('mira-highlight-ready'));
  assert.equal(mirror.scrollTop,24);
  assert.equal(mirror.scrollLeft,15);
  assert.ok(mirror.children.some(node=>node.textContent==='"<script>"'));
  assert.equal(mirror.children.some(node=>node.tagName==='script'),false);
  const original=textarea.value;
  textarea.value='result = 42;';
  handlers.get('input')();
  assert.equal(mirror.children.map(node=>node.textContent).join(''),textarea.value);
  assert.notEqual(textarea.value,original);
  textarea.scrollTop=40;textarea.scrollLeft=7;
  handlers.get('scroll')();
  assert.equal(mirror.scrollTop,40);
  assert.equal(mirror.scrollLeft,7);
  editor.dispose();
  assert.equal(classes.has('mira-highlight-ready'),false);
  assert.equal(handlers.size,0);
});

test('natural if then else is highlighted as language keywords',()=>{
  const source='result = if (1 < 2) then "valid" else "invalid";';
  const tokens=tokenizeMira(source);
  assert.equal(tokens.map(token=>token.text).join(''),source);
  assert.deepEqual(tokens.filter(token=>token.kind==='keyword').map(token=>token.text),
    ['if','then','else']);
  assert.deepEqual(tokens.filter(token=>token.kind==='string').map(token=>token.text),
    ['"valid"','"invalid"']);
});

test('compiler semantic spans distinguish compound selectors, parameters, locals and record keys',()=>{
  const source='counter view: model = {x | local = x; {volume: (model ~ volume), value: local}}; result = counter view: _;';
  const tokens=tokenizeMira(source,compiler);
  assert.equal(tokens.map(t=>t.text).join(''),source);
  assert.deepEqual(tokens.filter(t=>t.kind==='selector').map(t=>t.text),['counter view:','counter view:']);
  assert.deepEqual(tokens.filter(t=>t.kind==='parameter').map(t=>t.text),['model','x','x','model']);
  assert.deepEqual(tokens.filter(t=>t.kind==='field').map(t=>t.text),['volume:','volume','value:']);
  assert.ok(tokens.some(t=>t.kind==='plain'&&t.text==='local'));
});
test('optional selector separators and nested block parameters use resolver spans',()=>{
  const source='add to: x, and: y = x + y; result = add to 2 and 3;';
  const tokens=tokenizeMira(source,compiler);
  assert.equal(tokens.map(t=>t.text).join(''),source);
  assert.deepEqual(tokens.filter(t=>t.kind==='selector').map(t=>t.text),['add to:','and:','add to','and']);
});
test('incomplete code preserves source with fallback and confirmed spans',()=>{
  for(const source of ['counter view: model = {x | x','bad = "unfinished','value = @;']){
    assert.equal(tokenizeMira(source,compiler).map(t=>t.text).join(''),source);
  }
});
test('all five palettes meet contrast 4.5:1 for all semantic text categories',async()=>{
  const {syntaxPalettes,syntaxKeys}=await import(pathToFileURL(resolve(root,'dist/studio/syntax-theme.js')).href);
  const L=c=>c.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
  for(const [name,colors] of Object.entries(syntaxPalettes))for(let i=1;i<12;i++){
    const a=L(colors[0]),b=L(colors[i]);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,name+' '+syntaxKeys[i]);
  }
});

test('local font assets and licenses are copied and precached',()=>{
  const sw=readFileSync(resolve(root,'dist/studio/sw.js'),'utf8');
  for(const font of ['jetbrains-regular.ttf','jetbrains-italic.ttf','fira-regular.ttf','dejavu-regular.ttf','dejavu-italic.ttf','cascadia-regular.ttf','cascadia-italic.ttf','jetbrains-LICENSE.txt','fira-LICENSE.txt','dejavu-LICENSE.txt','cascadia-LICENSE.txt']){
    assert.ok(readFileSync(resolve(root,'dist/studio/fonts',font)).length>1000);
    assert.ok(sw.includes('./fonts/'+font));
  }
});
