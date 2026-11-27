import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';

function files(dir){
 return readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(join(dir,x.name)):x.name.endsWith('.mira')?[join(dir,x.name)]:[]).sort();
}
const legacy=[
 ['lib/gui.mira','GUI','Descrittori GUI: funzioni ordinarie, non un renderer.','./theme-native-lab.html'],
 ['lib/grammar.mira','Grammar','Costruttori di grammatiche regolari.','./grammar-lab.html'],
 ['lib/gui-typed-styles.mira','GUI Styles','Tipi e refinement opzionali per gli stili GUI.','./type-lab.html']
];
const notes={
 'Services / Text':['Text','Operazioni testuali; richiede un provider.','./host-module-lab.html'],
 'Services / Date':['Date','Date civili; richiede un provider.','./host-module-lab.html'],
 'Services / Date Safe':['Date','Operazioni fallibili su date civili; richiede un provider.','./host-module-lab.html'],
 'Services / Json':['JSON','Decoder tipizzato del record lezione, non un parser JSON generico. Richiede un provider.','./lesson-import.html'],
 'Services / Storage':['Storage','Persistenza testuale; provider browser o file.','./host-module-lab.html'],
 'Services / Storage Safe':['Storage','Persistenza fallibile con errori espliciti; richiede un provider.','./host-module-lab.html'],
 'Services / Storage Optional':['Storage','Adattatore Option sopra il contratto Storage.','./host-module-lab.html'],
 'Services / Http':['HTTP','Costruzione di richieste e verifica dello status; l’effetto è interpretato dall’host.','./lesson-import.html']
};
export function buildNativeApi(root,compiler){
 const modules=new Map();
 for(const path of files(join(root,'lib'))){
  const rel=relative(root,path).replaceAll('\\','/');
  const source=readFileSync(path,'utf8');
  const name=source.match(/^module\s+([^;]+);/m)?.[1].trim();
  if(!name||! /^(Services|Data) \/ /.test(name))continue;
  if(modules.has(name))throw Error('Duplicate native contract '+name);
  modules.set(name,{name,path:rel,source});
 }
 const moduleJson=JSON.stringify(Object.fromEntries([...modules].map(([name,entry])=>[name,entry.source])));
 const groups=[];
 for(const entry of modules.values()){
  const result=compiler.interfaces(entry.source,null,moduleJson);
  if(!result.ok)throw Error('Native API '+entry.name+': '+result.message);
  const report=JSON.parse(result.output).interfaces.find(x=>x.module===entry.name);
  if(!report?.surface)throw Error('Missing interface surface '+entry.name);
  const [category,description,lab]=notes[entry.name]||['Data','Tipi e operazioni condivisi.', './type-lab.html'];
  const symbols=report.surface.symbols.map(x=>({name:x.name,kind:x.kind,schema:x.schema}));
  const types=report.surface.types.map(x=>({name:x.name,kind:'type',schema:x}));
  const interfaceSource=entry.source.split(/^implementation\s*$/m)[0].trim();
  groups.push({...entry,source:interfaceSource,category,description,lab,kind:'interface',symbols,types});
 }
 for(const [path,name,description,lab] of legacy){
  const source=readFileSync(join(root,path),'utf8');
  // Legacy libraries have no public interface boundary. Their real AST
  // provides function selectors; the source documents declarations verbatim.
  const result=compiler.ast(source);
  if(!result.ok)throw Error('Native library '+path+': '+result.message);
  const defs=JSON.parse(result.output).definitions;
  const symbols=defs.filter(d=>d.kind==='Function'&&d.selector).map(d=>({name:d.selector,kind:'selector',line:d.line}));
  groups.push({name,path,source,category:name,description,lab,kind:'source',symbols,types:[]});
 }
 return groups.sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
}
