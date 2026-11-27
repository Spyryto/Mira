import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const reference=JSON.parse(readFileSync(new URL('../dist/studio/reference.json',import.meta.url),'utf8'));
test('native API indexes actual contracts and legacy libraries',()=>{
 const groups=reference.nativeApi;
 assert.ok(groups.length>=14);
 assert.equal(new Set(groups.map(x=>x.name)).size,groups.length);
 const text=groups.find(x=>x.name==='Services / Text');
 assert.equal(text.kind,'interface');
 assert.ok(text.symbols.some(s=>s.name==='contains:in:'&&s.schema.kind==='Function'));
 assert.ok(groups.find(x=>x.name==='Services / Date').types.some(t=>t.name==='Date'));
 assert.ok(groups.find(x=>x.name==='GUI').symbols.some(s=>s.name==='column:'));
 assert.ok(groups.every(g=>!g.path.includes('/Providers/')));
});
