import {basicSetup} from 'codemirror';
import {EditorState,RangeSetBuilder} from '@codemirror/state';
import {EditorView,Decoration,ViewPlugin,hoverTooltip,keymap} from '@codemirror/view';
import {autocompletion,snippetCompletion,startCompletion,completionKeymap} from '@codemirror/autocomplete';
import {setDiagnostics} from '@codemirror/lint';
import {tokenizeMira} from '../syntax-highlight.js';
import {fieldContext,fieldRows,formatSchema} from './field-context.js';
import {editor_complete__from,editor_lookup__from,editor_tooltip,editor_templates,editor_fields__prefix__from,editor_field_lookup__name__from,editor_field_tooltip,editor_signature__returning,editor_visible__globals,editor_catalog__from} from '../../dist/ide/editor-services.js';

import {load,persist,update,get,modulesFor,newFile,validate,readFolder,saveDisk,logical} from './workspace-host.js';
import {desktopEnabled,openDesktop,saveDesktop} from './desktop-host.js';
const $=id=>document.getElementById(id);
if(matchMedia('(max-width:850px)').matches)$('workspace-tree').open=false;
const initial='double: x (Number) -> Number = x * 2;\nitems = [1, 2, 3];\nresult = collect: items, with: {x | double: x};';
let workspace,storageBlocked=false;try{workspace=desktopEnabled?{format:1,active:'App.mira',files:[{path:'App.mira',source:''}]}:load(localStorage,initial)}catch(error){storageBlocked=true;workspace={format:1,active:'programma.mira',files:[{path:'programma.mira',source:initial}]};$('persistence').textContent=error.message+' · esporta per non perdere il lavoro.'}
const states=new Map();let folder=null,baseline=new Map();
const saved=get(workspace,workspace.active).source;
let library=null,reference=null;
const allModules=()=>({...library?.modules,...modulesFor(workspace)});
const moduleJson=()=>JSON.stringify(allModules());
const environment=()=>({modules:moduleJson(),host:library?.host??null,bindings:library?.bindings??null});
function hasUnsavedDisk(){return (desktopEnabled||folder)&&workspace.files.some(f=>baseline.get(f.path)!==f.source);}
function saveLocal(){if(desktopEnabled){$('persistence').textContent=hasUnsavedDisk()?'Modifiche non salvate su disco':'Workspace desktop · tutti i file salvati';return;}if(storageBlocked)return;try{persist(localStorage,workspace);$('persistence').textContent='Salvato nel browser'+(folder?' · '+folder.name:'');}catch(error){$('persistence').textContent='Salvataggio locale fallito: '+error.message+' · esporta il progetto.'}}
function renderFiles(){
 $('active-file').textContent=workspace.active;
 $('files').replaceChildren(...workspace.files.slice().sort((a,b)=>a.path.localeCompare(b.path)).map(f=>{const b=document.createElement('button');b.type='button';b.textContent=f.path;b.className=f.path===workspace.active?'selected':'';b.setAttribute('aria-pressed',String(f.path===workspace.active));b.onclick=()=>switchFile(f.path);return b}));
}
function switchFile(path){
 if(path===workspace.active)return;
 states.set(workspace.active,editor.state);workspace={...workspace,active:path};
 lastValid=[];inspected=[];validRevision=-1;fieldCache=null;scopeCache=null;$('symbols').replaceChildren();
 editor.setState(states.get(path)||EditorState.create({doc:get(workspace,path).source,extensions}));
 renderFiles();saveLocal();analyze(editor);

}
function replaceWorkspace(next){
 workspace=validate(next);states.clear();lastValid=[];inspected=[];validRevision=-1;fieldCache=null;scopeCache=null;$('symbols').replaceChildren();
 editor.setState(EditorState.create({doc:get(workspace,workspace.active).source,extensions}));renderFiles();saveLocal();analyze(editor);
}
const worker=new Worker('./ide-analysis-worker.js');
let revision=0,lastValid=[],validRevision=-1,timer,api=[],inspected=[];
const first=label=>label.split(':')[0];
const make=(label,signature,summary,snippet,origin,kind)=>({label,signature,summary,snippet,origin,first:first(label),kind});
const signature=formatSchema;
// Join real AST parameter names with the compiler's structured type report.
function namedSignature(item,def,schema){
 const labels=def?.labels||item.label.slice(0,-1).split(':');
 if(!item.label.endsWith(':')||(!def?.parameters&&schema?.kind!=='Function'))return item;
 const types=schema?.kind==='Function'?schema.parameters:[];
 const names=def?.parameters||[];
 if(labels.length!==(types.length||names.length))return item;
 const parameters=labels.map((selector,i)=>({selector,name:names[i]||'',type:formatSchema(types[i])}));
 const rich=editor_signature__returning(parameters,formatSchema(schema?.result));
 return {...item,rich};
}
function appendSignature(parent,rich,compact=false){
 rich.parameters.forEach((parts,i)=>{
  if(i)parent.append(document.createTextNode(', '));
  for(const part of parts){
   if(!part.text||(compact&&part.role==='selector'))continue;
   const node=document.createElement(part.role==='parameter'?'em':'span');node.className='mira-signature-'+part.role;node.textContent=part.text;parent.append(node);
  }
 });
 if(rich.result){const span=document.createElement('span');span.className='mira-signature-type';span.textContent=' → '+rich.result;parent.append(span)}
}
const snippet=(label,params=[])=>label.endsWith(':')?label.slice(0,-1).split(':').map((part,i)=>part+': \x24{'+(params[i]||'arg'+(i+1))+'}').join(', '):'';
const candidates=()=>[...lastValid,...editor_templates.filter(t=>!lastValid.some(s=>s.label===t.label))];
const provenance=()=>validRevision===revision?'Documento verificato':'Ultima analisi valida (non aggiornata)';
function renderTooltip(item){
 const info=editor_tooltip(item),el=document.createElement('div');el.className='mira-tooltip';
 const title=document.createElement('strong');title.textContent=info.title;el.append(title);
 if(item.rich||info.detail){const pre=document.createElement('pre');pre.className='mira-signature';if(item.rich)appendSignature(pre,item.rich);else pre.textContent=info.detail;el.append(pre)}
 const p=document.createElement('div');p.textContent=info.description;el.append(p);
 if(item.documentation){const link=document.createElement('a');link.href='./index.html#/guide/native/'+encodeURIComponent(item.documentation);link.textContent='Documentazione della libreria';el.append(link);}
 const source=document.createElement('small');source.textContent=info.provenance;el.append(source);return el;
}
function refreshInspector(){
 const items=inspected.map(item=>item.origin==='Documento verificato'||item.origin==='Ultima analisi valida (non aggiornata)'?{...(lastValid.find(s=>s.label===item.label)||item),origin:lastValid.some(s=>s.label===item.label)?provenance():'Simbolo non presente nell’ultima analisi'}:item);
 $('inspect').replaceChildren(...items.map(renderTooltip));if(!items.length)$('inspect').textContent='Nessuna informazione semantica disponibile per questa selezione.';
}
function inspect(items){inspected=items;refreshInspector();if(matchMedia('(max-width:850px)').matches)$('inspect').scrollIntoView({block:'nearest'});}
function wordAt(state,pos){
 const line=state.doc.lineAt(pos),offset=pos-line.from;
 const left=line.text.slice(0,offset).match(/[A-Za-z_][A-Za-z_0-9]*$/)?.[0]||'';
 const right=line.text.slice(offset).match(/^[A-Za-z_0-9]*/)?.[0]||'';
 return {from:pos-left.length,to:pos+right.length,name:left+right};
}
function lookup(name){return editor_lookup__from(name,candidates()).map(x=>lastValid.includes(x)?{...x,origin:provenance()}:x)}
let requestId=0,fieldCache=null;
const pendingFields=new Map();
function fieldsFor(base){
 if(fieldCache?.base===base)return fieldCache.promise;
 const request=++requestId;
 const promise=new Promise(resolve=>{pendingFields.set(request,resolve);worker.postMessage({kind:'fields',request,source:base,...environment()});});
 fieldCache={base,promise};return promise;
}
const pendingScopes=new Map();
let scopeCache=null;
function queryScope(source,line,column){
 const key=JSON.stringify([source,line,column,environment()]);
 if(scopeCache?.key===key)return scopeCache.promise;
 const request=++requestId;
 const promise=new Promise(resolve=>{pendingScopes.set(request,resolve);worker.postMessage({kind:'scope',request,source,line,column,...environment()});});
 scopeCache={key,promise};return promise;
}
function localSuggestions(report,probe=false){
 return (report?.bindings||[]).map(x=>make(x.name,probe?'':x.type,
   probe?'Binding lessicale visibile; tipo da verificare nel sorgente completo.':'Binding lessicale verificato dal compilatore.',
   '',probe?'Contesto con segnaposto':'Scope lessicale verificato','variable'));
}
async function lookupAt(state,pos){
 const w=wordAt(state,pos),site=fieldContext(state.doc.toString(),w.to);
 if(!site){
   if(w.name){const line=state.doc.lineAt(w.from);const report=await queryScope(state.doc.toString(),line.number,w.from-line.from+1);
     if(report?.found){const local=editor_lookup__from(w.name,localSuggestions(report));if(local.length)return local;}}
   return lookup(w.name);
 }
 const rows=await fieldsFor(site.base);
 return editor_field_lookup__name__from(site.receiver,site.prefix,rows).map(editor_field_tooltip);
}
async function complete(context){
 const before=context.state.doc.lineAt(context.pos).text.slice(0,context.pos-context.state.doc.lineAt(context.pos).from);
 const publicSite=before.match(/^\s*import\s+([^{};]+)\{\s*([^;{}]*)$/);
 if(publicSite&&reference){const group=reference.nativeApi.find(g=>g.name===publicSite[1].trim());if(group){const prefix=publicSite[2].trimStart();const rows=[...group.symbols,...group.types].map(x=>make(x.name,formatSchema(x.schema),group.description,'',group.name,x.kind==='type'?'type':'function'));
  return {from:context.pos-prefix.length,options:editor_catalog__from(prefix,rows).map(item=>({label:item.label,type:item.kind,detail:item.signature,apply:item.label.endsWith(':')?item.label.replaceAll(':',': ')+';':item.label+';',info:()=>renderTooltip(item)})),filter:false};}}
 const path=before.match(/^\s*import\s+([A-Za-z_][A-Za-z_0-9 /]*|)$/);
 if(path){const prefix=path[1]||'',items=Object.keys(allModules()).filter(name=>!name.startsWith('Providers / ')).map(name=>make(name,'','Modulo disponibile','','Workspace','namespace'));
  return {from:context.pos-prefix.length,options:editor_complete__from(prefix,items.map(item=>({...item,first:item.label}))).map(item=>({label:item.label,type:'namespace',apply:item.label})),filter:false};}

 const field=fieldContext(context.state.doc.toString(),context.pos);
 if(field){
   const rows=await fieldsFor(field.base);
   if(context.aborted||editor.state.doc!==context.state.doc)return null;
   const options=editor_fields__prefix__from(field.receiver,field.prefix,rows).map(editor_field_tooltip).map(item=>({label:item.label,type:'property',detail:item.signature,info:()=>renderTooltip(item)}));
   return {from:field.from,options,filter:false};
 }
 const prefix=context.matchBefore(/[A-Za-z_][A-Za-z_0-9]*/);
 if(!prefix&&!context.explicit)return null;
 const from=prefix?.from??context.pos;
 const match=prefix?.text??'';
 // Comments and strings must not offer language completions.
 const line=context.state.doc.lineAt(context.pos);
 const inToken=tokenizeMira(line.text.slice(0,context.pos-line.from)).at(-1);
 if(inToken?.kind==='comment'||inToken?.kind==='string')return null;
 // Ask the real checker first. A numeric probe may make an incomplete
 // identifier parseable; only its binding names, never inferred types, are used.
 let scope=null,probe=false;
 const source=context.state.doc.toString(),lineAt=context.state.doc.lineAt(from),column=from-lineAt.from+1;
 const end=wordAt(context.state,context.pos).to;
 if(match&&end>=context.pos)scope=await queryScope(source,lineAt.number,column);
 if(!scope?.found){
   const replacement=source.slice(0,from)+'0'+source.slice(end);
   const candidate=replacement.trimEnd().endsWith(';')?replacement:replacement+';';
   scope=await queryScope(candidate,lineAt.number,column);probe=true;
 }
 if(context.aborted||editor.state.doc!==context.state.doc)return null;
 const visible=scope?.found?editor_visible__globals(localSuggestions(scope,probe),candidates()):candidates();
 const items=editor_complete__from(match,visible);
 const options=items.map(item=>{
   const data=lastValid.includes(item)?{...item,origin:provenance()}:item;
   const option={label:item.label,type:item.kind,detail:item.rich?'':item.signature||item.origin,rich:item.rich,info:()=>renderTooltip(data)};
   return item.snippet?snippetCompletion(item.snippet,option):option;
 });
 return {from,options,filter:false};
}
function marks(state){
 const b=new RangeSetBuilder();let pos=0;
 for(const token of tokenizeMira(state.doc.toString())){
  const end=pos+token.text.length;
  if(token.kind!=='plain'&&end>pos)b.add(pos,end,Decoration.mark({class:'mira-syntax-'+token.kind}));
  pos=end;
 }
 return b.finish();
}
const syntax=ViewPlugin.fromClass(class{constructor(view){this.decorations=marks(view.state)}update(u){if(u.docChanged)this.decorations=marks(u.state)}},{decorations:x=>x.decorations});
function analyze(view){
 clearTimeout(timer);revision++;
 const rev=revision,source=view.state.doc.toString();
 inspected=inspected.filter(item=>item.kind!=='property'&&item.origin!=='Scope lessicale verificato'&&item.origin!=='Contesto con segnaposto');
 refreshInspector();
 $('status').textContent='Analisi…';$('status').className='status';
 timer=setTimeout(()=>worker.postMessage({revision:rev,source,...environment()}),220);
}
const extensions=[
 basicSetup,syntax,autocompletion({override:[complete],activateOnTyping:true,addToOptions:[{position:90,render:option=>{if(!option.rich)return null;const span=document.createElement('span');span.className='mira-completion-signature';appendSignature(span,option.rich,true);return span}}]}),keymap.of(completionKeymap),
 hoverTooltip(async(view,pos)=>{const state=view.state,w=wordAt(state,pos),items=await lookupAt(state,pos);return view.state.doc===state.doc&&items.length?{pos:w.from,end:w.to,above:true,create:()=>{const dom=document.createElement('div');dom.append(...items.map(renderTooltip));return {dom}}}:null}),
 EditorView.contentAttributes.of({'aria-label':'Codice sorgente Mira','spellcheck':'false','autocapitalize':'off'}),
 EditorView.updateListener.of(update=>{if(update.docChanged){workspace=updateWorkspaceSource(update.state.doc.toString());saveLocal();fieldCache=null;analyze(update.view)}})
];
function updateWorkspaceSource(source){return update(workspace,workspace.active,source)}
const editor=new EditorView({parent:$('editor'),state:EditorState.create({doc:saved,extensions})});
function position(line,column){if(!Number.isInteger(line)||line<1||line>editor.state.doc.lines||!Number.isInteger(column))return null;const l=editor.state.doc.line(line);return Math.min(l.to,l.from+Math.max(0,column-1))}
worker.onmessage=({data})=>{
 if(data.kind==='scope'){
   const done=pendingScopes.get(data.request);pendingScopes.delete(data.request);
   if(done)done(data.checked.ok?JSON.parse(data.checked.output):null);return;
 }
 if(data.kind==='fields'){
   const done=pendingFields.get(data.request);pendingFields.delete(data.request);
   if(done)done(data.checked.ok?fieldRows(JSON.parse(data.checked.output)):[]);return;
 }
 if(data.revision!==revision)return;
 $('version').textContent='Mira '+data.version;
 const checked=data.checked;
 if(checked.ok){
  const defs=data.ast.ok?JSON.parse(data.ast.output).definitions:[];
  lastValid=JSON.parse(checked.output).filter(x=>!x.file).map(x=>{
   const def=defs.find(d=>d.name===x.name&&d.line===x.line&&d.column===x.column);
   const name=x.module&&x.name.startsWith(x.module+' / ')?x.name.slice(x.module.length+3):x.name;
   const localDef=def?{...def,labels:def.labels?.map((label,i)=>i===0&&x.module&&label.startsWith(x.module+' / ')?label.slice(x.module.length+3):label)}:undefined;
   return namedSignature(make(name,x.type,'Tipo verificato dal compilatore.',snippet(name,localDef?.parameters),'Documento verificato',name.endsWith(':')?'function':'variable'),localDef,x.schema);
  });
  if(data.interfaces?.ok){
   const info=JSON.parse(data.interfaces.output),owner=JSON.parse(checked.output).find(x=>!x.file&&x.module)?.module;
   const rows=JSON.parse(checked.output);
   for(const edge of info.dependencies.filter(e=>e.from===owner&&e.kind==='import'&&e.file==null)){
    const contract=edge.contract||edge.to;
    const surface=info.interfaces.find(m=>m.module===contract)?.surface||info.interfaces.find(m=>m.resolvedModule===edge.to)?.surface;if(!surface)continue;
    const entries=edge.wildcard?surface.symbols.map(s=>({name:s.name,alias:s.name})):edge.names||[];
    for(const imported of entries){const symbol=surface.symbols.find(s=>s.name===imported.name);if(!symbol)continue;
     const name=imported.alias||imported.name;if(lastValid.some(s=>s.label===name))continue;
     const original=rows.find(x=>x.name===edge.to+' / '+symbol.name);const ast=defs.find(d=>d.name===original?.name&&d.file===original?.file);
     const localDef=ast?{...ast,labels:name.endsWith(':')?name.slice(0,-1).split(':'):undefined}:undefined;
     const docs=reference?.nativeApi.find(g=>g.name===contract);
     lastValid.push({...namedSignature(make(name,formatSchema(symbol.schema),'Importato da '+contract+(docs?' · '+docs.description:''), snippet(name,localDef?.parameters),'Documento verificato',symbol.kind==='selector'?'function':'variable'),localDef,symbol.schema),documentation:docs?.name});
    }
   }
  }
  validRevision=revision;
  $('symbols').replaceChildren(...lastValid.map(item=>{
   const b=document.createElement('button');b.textContent=item.label;b.onclick=()=>inspect([item]);return b;
  }));
 }
 refreshInspector();
 const d=checked.diagnostic,from=d&&!d.file?position(d.line,d.column):null,to=d&&!d.file?position(d.endLine,d.endColumn):null;
 editor.dispatch(setDiagnostics(editor.state,from==null?[]:[{from,to:Math.max(from,to??from),severity:'error',message:d.message||checked.message}]));
 $('status').className=checked.ok?'status':'status error';
 $('status').textContent=checked.ok?'✓ Verificato · '+data.elapsed.toFixed(1)+' ms':checked.message+' · '+provenance();
};
$('complete').onclick=()=>{editor.focus();startCompletion(editor)};
$('signature').onclick=async()=>{const state=editor.state,items=await lookupAt(state,state.selection.main.head);if(editor.state.doc===state.doc)inspect(items);};
function renderApi(){
 const prefix=$('api-search').value.trim();
 const items=editor_complete__from(prefix,api).slice(0,40);
 $('api-results').replaceChildren(...items.map(item=>{const b=document.createElement('button');b.textContent=item.label+' · '+item.origin;b.onclick=()=>inspect([item]);return b}));
}
$('api-search').addEventListener('input',renderApi);
Promise.all([fetch('./reference.json').then(r=>r.json()),fetch('./ide-libraries.json').then(r=>r.json())]).then(([data,catalog])=>{
 reference=data;library=catalog;
 api=data.nativeApi.flatMap(group=>[...group.symbols,...group.types].map(x=>namedSignature(make(x.name,signature(x.schema),group.description,'',group.name,x.kind==='type'?'type':'function'),x.kind==='selector'?x:undefined,x.schema)));
 renderApi();renderLibrary();renderExamples();fieldCache=null;scopeCache=null;analyze(editor);
}).catch(error=>{$('api-results').textContent='Catalogo non disponibile: '+error.message;});
function renderLibrary(){
 const list=$('library-list');
 list.replaceChildren(...reference.nativeApi.map(group=>{
  const b=document.createElement('button');b.textContent=group.name;b.onclick=()=>{
   const rows=[...group.symbols,...group.types].map(x=>({...namedSignature(make(x.name,signature(x.schema),group.description,'',group.name,x.kind==='type'?'type':'function'),x,x.schema),documentation:group.name}));
   inspected=[];$('inspect').replaceChildren();
   const header=document.createElement('strong');header.textContent=group.name;$('inspect').append(header);
   const a=document.createElement('a');a.href='./index.html#/guide/native/'+encodeURIComponent(group.name);a.textContent=' · Reference';$('inspect').append(a);
   const binding=JSON.parse(library.bindings)[group.name];const meta=document.createElement('p');meta.textContent=binding?'Provider JS: '+binding.provider:'Modulo o libreria senza provider predefinito';$('inspect').append(meta);
   const pre=document.createElement('pre');pre.className='library-source';pre.textContent=library.modules[group.name]||group.source;$('inspect').append(pre);
   for(const item of rows)$('inspect').append(renderTooltip(item));
  };return b;
 }));
}
function renderExamples(){
 if(!library)return;
 const prefix=$('example-search').value.toLowerCase();
 $('example-list').replaceChildren(...library.examples.filter(e=>e.title.toLowerCase().includes(prefix)).map(e=>{
  const b=document.createElement('button');b.textContent=e.title+(e.execute?' · JS':' · laboratorio');b.onclick=()=>{
   let path='Examples/'+e.id.replace(/[^A-Za-z0-9]+/g,' ').trim().replace(/^[0-9]/,'Example renderFiles();saveLocal();analyze(editor);
$('new-file')')+'.mira';
   if(workspace.files.some(f=>f.path.toLowerCase()===path.toLowerCase())){switchFile(workspace.files.find(f=>f.path.toLowerCase()===path.toLowerCase()).path);return;}
   workspace=update(workspace,path,e.source);switchFile(path);
   $('output-panel').open=true;$('run-output').textContent=e.description+(e.execute?'\nPremi Esegui JS.':'\nUsa il laboratorio specializzato per gli effetti o il rendering.');
   if(e.lab){const a=document.createElement('a');a.href='./'+e.lab;a.textContent='Apri laboratorio';$('run-output').append(document.createTextNode('\n'),a)}
  };return b;
 }));
}
$('example-search').oninput=renderExamples;
let runner=null,runTimer=null;
function execute(target,run){
 if(!library){$('output-panel').open=true;$('run-output').textContent='Catalogo non ancora disponibile.';return;}
 if(runner)runner.terminate();clearTimeout(runTimer);
 $('output-panel').open=true;$('run-output').textContent='Compilazione…';
 const snapshot=editor.state.doc,job=new Worker('./ide-run-worker.js');runner=job;
 const env=environment();
 if(target==='php'){
  const b=JSON.parse(env.bindings);b['Services / Storage']={provider:'Providers / Storage Files'};b['Services / Storage Safe']={provider:'Providers / Storage Safe Files'};env.bindings=JSON.stringify(b);
 }
 function finish(message){if(runner!==job)return;job.terminate();runner=null;clearTimeout(runTimer);$('run-output').textContent=(editor.state.doc!==snapshot?'Risultato di una revisione precedente\n':'')+message;}
 job.onmessage=({data})=>finish(data.ok?'Compilazione '+data.compileMs.toFixed(1)+' ms'+(data.executionMs==null?'':' · esecuzione '+data.executionMs.toFixed(2)+' ms')+'\n'+data.output:data.message);
 job.onerror=e=>finish(e.message||'Worker non disponibile.');
 runTimer=setTimeout(()=>finish('Timeout: esecuzione interrotta.'),3000);
 job.postMessage({source:snapshot.toString(),target,run,...env});
}
$('run-js').onclick=()=>execute('js',true);
$('emit-js').onclick=()=>execute('js',false);
$('emit-php').onclick=()=>execute('php',false);
if(!desktopEnabled&&location.hostname!=='127.0.0.1'&&'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderFiles();saveLocal();analyze(editor);
$('new-file').onclick=()=>{
 const path=prompt('Percorso del nuovo file .mira (es. Music/Intervals.mira)');
 if(!path)return;
 try{const next=newFile(workspace,path.trim());workspace={...next,active:workspace.active};switchFile(next.active)}catch(error){$('persistence').textContent=error.message;}
};
$('open-folder').disabled=desktopEnabled||typeof window.showDirectoryPicker!=='function';
if($('open-folder').disabled)$('open-folder').title='Richiede un browser con File System Access; usa Importa/Esporta progetto.';
$('open-folder').onclick=async()=>{
 try{const handle=await window.showDirectoryPicker({mode:'readwrite'});
  const result=await readFolder(handle);
  if(!confirm('Aprire '+handle.name+' e sostituire il workspace locale? Esporta prima eventuali modifiche da conservare.'))return;
  folder=handle;baseline=new Map(result.workspace.files.map(f=>[f.path,f.source]));$('save-disk').disabled=false;replaceWorkspace(result.workspace);
  if(result.skipped.length)$('persistence').textContent='File ignorati: '+result.skipped.join(', ');
 }catch(error){if(error.name!=='AbortError')$('persistence').textContent=error.message}
};
$('save-disk').onclick=async()=>{
 try{const file=get(workspace,workspace.active);if(desktopEnabled){await saveDesktop(file,baseline.get(file.path)??null);baseline.set(file.path,file.source)}else await saveDisk(folder,file,baseline);$('persistence').textContent='Scritto su disco: '+file.path;}
 catch(error){$('persistence').textContent=error.message}
};
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&(desktopEnabled||folder)){event.preventDefault();if(!$('save-disk').disabled)$('save-disk').click();}});
window.addEventListener('beforeunload',event=>{if(hasUnsavedDisk()){event.preventDefault();event.returnValue='';}});
$('export-project').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(workspace,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mira-workspace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('import-project').onclick=()=>$('project-input').click();
if(desktopEnabled){
 $('editor').inert=true;$('new-file').disabled=true;$('import-project').disabled=true;
 openDesktop().then(data=>{baseline=new Map(Object.entries(data.baseline));replaceWorkspace(data.workspace);$('editor').inert=false;$('new-file').disabled=false;$('save-disk').disabled=false;$('persistence').textContent='Cartella desktop: '+data.name;}).catch(error=>{$('persistence').textContent=error.message;});
}
$('project-input').onchange=async()=>{
 try{const file=$('project-input').files[0];if(!file)return;const next=validate(JSON.parse(await file.text()));
 if(!confirm('Sostituire il workspace locale con il progetto importato?'))return;
 folder=null;baseline=new Map();$('save-disk').disabled=true;replaceWorkspace(next);
 }catch(error){$('persistence').textContent=error.message}finally{$('project-input').value=''}
};

