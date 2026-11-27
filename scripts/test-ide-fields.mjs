import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fieldContext,fieldRows} from '../studio/ide/field-context.js';
import {editor_fields__prefix__from as fields,editor_field_lookup__name__from as lookup,editor_field_tooltip as tooltip} from '../dist/ide/editor-services.js';
const ctx={};runInNewContext(readFileSync('dist/studio/compiler.js','utf8'),ctx);
const base='Invoice :: {hours: Number, note?: Text, client: {name: Text}};\ninvoice (Invoice) = {hours: 2, client: {name: "A"}};';
const report=ctx.MiraStudioCompiler.check(base);assert.equal(report.ok,true,report.message);
const rows=fieldRows(JSON.parse(report.output));
assert.deepEqual(fields('invoice','',rows).map(x=>x.field),['client','hours']);
assert.equal(fields('invoice','ho',rows)[0].signature,'Number');
assert.equal(fields('invoice~client','',rows)[0].signature,'Text');
assert.equal(tooltip(lookup('invoice','note',rows)[0]).summary,'Campo opzionale: può essere assente.');
assert.deepEqual(fields('unknown','',rows),[]);
const code=base+'\nresult = invoice ~ client ~ na';
assert.deepEqual(fieldContext(code,code.length),{base,receiver:'invoice~client',prefix:'na',from:code.length-2});
for(const suffix of ['\nresult = {invoice | invoice ~ ', '\nresult = "invoice ~ ', '\n# result = invoice ~ ', '\nresult = other: invoice ~ ']){
 const s=base+suffix;assert.equal(fieldContext(s,s.length),null);
}
const php=readFileSync('dist/ide/editor-services.php','utf8').replace(/^<\?php\s*/,'');
const payload=Buffer.from(JSON.stringify(rows)).toString('base64');
const run=spawnSync('php',['-r',php+'\n$GLOBALS["__miraHost"]=["starts with:in:"=>fn($a,$b)=>str_starts_with($b,$a)];$rows=json_decode(base64_decode("'+payload+'"),true);echo json_encode(editor_fields__prefix__from("invoice","ho",$rows));'],{encoding:'utf8'});
assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),fields('invoice','ho',rows));
console.log('Verified real compiler schemas, nested fields, optional fields, context limits and JS/PHP parity.');
