import test from 'node:test';
import assert from 'node:assert/strict';
import {decorateStudioHtml} from '../scripts/studio-presentation.mjs';
import {tokenizeMira,tokenizeCode} from '../studio/syntax-highlight.js';
test('decoration tags the source but not a diagnostic report',()=>{
 const html='<html><head></head><body><textarea id="source"></textarea><pre id="result"></pre></body></html>';
 const result=decorateStudioHtml('type-lab.html',html);
 assert.match(result,/id="source" data-code-language="mira"/);
 assert.match(result,/<pre id="result">/);
 assert.match(result,/lab-highlight\.js/);
});
test('syntax scanners preserve the exact source',()=>{
 for(const [language,source] of [['mira','value :: Number; result = if true then 2 else 3;'],['js','const x = "<script>"; // comment'],['php','<?php echo "x";'],['json','{"foo":true}']]){
  const tokens=language==='mira'?tokenizeMira(source):tokenizeCode(source,language);
  assert.equal(tokens.map(t=>t.text).join(''),source);
  assert.ok(tokens.some(t=>t.kind!=='plain'));
 }
});
