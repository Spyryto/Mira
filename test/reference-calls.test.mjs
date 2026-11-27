import test from 'node:test';
import assert from 'node:assert/strict';
import {collectExampleCalls,analyzeExampleCalls} from '../scripts/reference-calls.mjs';
test('indexes canonical calls and sections, not record keys or library definitions',()=>{
 const ast={kind:'Program',definitions:[{line:1,body:{kind:'Call',selector:'library only:'}},{line:10,body:{kind:'Record',fields:[{key:'not a call:',value:{kind:'Call',selector:'add:and:',arguments:[{kind:'HostCall',selector:'log:'},{kind:'Section',selector:'fold:with:'}]}}]}}]};
 assert.deepEqual(collectExampleCalls(ast,5),{calls:['add:and:','log:'],sections:['fold:with:']});
});
test('failed AST is not silently represented as an empty valid call graph',()=>{
 assert.equal(analyzeExampleCalls({ast:()=>({ok:false})},{source:'?',expect:{kind:'error'}}).status,'expected-invalid');
 assert.equal(analyzeExampleCalls({ast:()=>({ok:false})},{source:'?',expect:{kind:'result'}}).status,'unavailable');
});
