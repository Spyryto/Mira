import {basicSetup} from 'codemirror';
import {EditorState,RangeSetBuilder} from '@codemirror/state';
import {EditorView,Decoration,ViewPlugin,hoverTooltip,keymap} from '@codemirror/view';
import {autocompletion,snippetCompletion,startCompletion,completionKeymap} from '@codemirror/autocomplete';
import {setDiagnostics} from '@codemirror/lint';
import {tokenizeMira} from '../syntax-highlight.js';
import {fieldContext,fieldRows,formatSchema} from './field-context.js';
import {editor_complete__from,editor_lookup__from,editor_tooltip,editor_templates,editor_fields__prefix__from,editor_field_lookup__name__from,editor_field_tooltip} from '../../dist/ide/editor-services.js';

const $=id=>document.getElementById(id);
if(matchMedia('(max-width:850px)').matches)$('workspace-tree').open=false;
const initial='double: x (Number) -> Number = x * 2;\nitems = [1, 2, 3];\nresult = collect: items, with: {x | double: x};';
let saved=initial;try{saved=localStorage.getItem('mira-ide:source:v1')??initial}catch{}
const worker=new Worker('./ide-analysis-worker.js');
let revision=0,lastValid=[],validRevision=-1,timer,api=[],inspected=[];
const first=label=>label.split(':')[0];
const make=(label,signature,summary,snippet,origin,kind)=>({label,signature,summary,snippet,origin,first:first(label),kind});
const signature=formatSchema;
const snippet=(label,params=[])=>label.endsWith(':')?label.slice(0,-1).split(':').map((part,i)=>part+': \x24{'+(params[i]||'arg'+(i+1))+'}').join(', '):'';
const candidates=()=>[...lastValid,...editor_templates.filter(t=>!lastValid.some(s=>s.label===t.label))];
const provenance=()=>validRevision===revision?'Documento verificato':'Ultima analisi valida (non aggiornata)';
function renderTooltip(item){
 const info=editor_tooltip(item),el=document.createElement('div');el.className='mira-tooltip';
 const title=document.createElement('strong');title.textContent=info.title;el.append(title);
 if(info.detail){const pre=document.createElement('pre');pre.textContent=info.detail;el.append(pre)}
 const p=document.createElement('div');p.textContent=info.description;el.append(p);
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
 const promise=new Promise(resolve=>{pendingFields.set(request,resolve);worker.postMessage({kind:'fields',request,source:base});});
 fieldCache={base,promise};return promise;
}
async function lookupAt(state,pos){
 const w=wordAt(state,pos),site=fieldContext(state.doc.toString(),w.to);
 if(!site)return lookup(w.name);
 const rows=await fieldsFor(site.base);
 return editor_field_lookup__name__from(site.receiver,site.prefix,rows).map(editor_field_tooltip);
}
async function complete(context){
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
 const items=editor_complete__from(match,candidates());
 const options=items.map(item=>{
   const data=lastValid.includes(item)?{...item,origin:provenance()}:item;
   const option={label:item.label,type:item.kind,detail:item.signature||item.origin,info:()=>renderTooltip(data)};
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
 inspected=inspected.filter(item=>item.kind!=='property');
 refreshInspector();
 $('status').textContent='Analisi…';$('status').className='status';
 timer=setTimeout(()=>worker.postMessage({revision:rev,source}),220);
}
const editor=new EditorView({parent:$('editor'),state:EditorState.create({doc:saved,extensions:[
 basicSetup,syntax,autocompletion({override:[complete],activateOnTyping:true}),keymap.of(completionKeymap),
 hoverTooltip(async(view,pos)=>{const state=view.state,w=wordAt(state,pos),items=await lookupAt(state,pos);return view.state.doc===state.doc&&items.length?{pos:w.from,end:w.to,above:true,create:()=>{const dom=document.createElement('div');dom.append(...items.map(renderTooltip));return {dom}}}:null}),
 EditorView.contentAttributes.of({'aria-label':'Codice sorgente Mira','spellcheck':'false','autocapitalize':'off'}),
 EditorView.updateListener.of(update=>{if(update.docChanged){try{localStorage.setItem('mira-ide:source:v1',update.state.doc.toString())}catch{}analyze(update.view)}})
]})});
function position(line,column){if(!Number.isInteger(line)||line<1||line>editor.state.doc.lines||!Number.isInteger(column))return null;const l=editor.state.doc.line(line);return Math.min(l.to,l.from+Math.max(0,column-1))}
worker.onmessage=({data})=>{
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
   const def=defs.find(d=>d.name===x.name);
   return make(x.name,x.type,'Tipo verificato dal compilatore.',snippet(x.name,def?.parameters),'Documento verificato',x.name.endsWith(':')?'function':'variable');
  });
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
fetch('./reference.json').then(r=>r.json()).then(data=>{
 api=data.nativeApi.flatMap(group=>[...group.symbols,...group.types].map(x=>make(x.name,signature(x.schema),group.description,'',group.name,x.kind==='type'?'type':'function')));
 renderApi();
}).catch(()=>{$('api-results').textContent='Catalogo non disponibile.'});
analyze(editor);
