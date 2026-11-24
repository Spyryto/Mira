import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
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
