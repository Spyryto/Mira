(function(){
  'use strict';
  const by=id=>document.getElementById(id);
  let model=null, selected=null;
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
  const append=(parent,tag,text,cls)=>{const n=el(tag,text,cls);parent.append(n);return n;};
  function select(path){selected=path;render();}
  function moduleButton(path,label){
    const node=el('button',label||path);
    node.type='button';
    node.disabled=!model.interfaces.some(m=>m.module===path);
    node.setAttribute('aria-pressed',String(path===selected));
    node.addEventListener('click',()=>select(path));
    return node;
  }
  function render(){
    const nodes=by('nodes'),edges=by('edges');
    nodes.replaceChildren();edges.replaceChildren();
    for(const m of model.interfaces)nodes.append(moduleButton(m.module));
    if(!model.interfaces.length)append(nodes,'p','Nessun modulo dichiarato.','muted');
    for(const d of model.dependencies){
      const edge=append(edges,'div',null,'edge');
      edge.append(moduleButton(d.from,d.from||'Legacy'));
      const middle=append(edge,'span','→');
      append(middle,'small',d.kind+' · '+d.phase);
      edge.append(moduleButton(d.kind==='file'?null:d.to,d.to));
    }
    if(!model.dependencies.length)append(edges,'p','Nessuna dipendenza.','muted');
    renderSymbols();
  }
  function renderSymbols(){
    const m=model?.interfaces.find(x=>x.module===selected);
    by('selected').textContent=m?m.module:'Interfaccia';
    const list=by('symbols'),priv=by('private');
    list.replaceChildren();priv.replaceChildren();
    by('private-title').textContent='Dichiarazioni private ('+(m?.privateDeclarations.length||0)+')';
    if(!m)return;
    const query=by('filter').value.trim().toLowerCase();
    function symbol(name,kind,signature,detail){
      if(query&&![name,kind,signature,detail].join(' ').toLowerCase().includes(query))return;
      const row=append(list,'div',null,'symbol');
      append(row,'strong',name);
      append(row,'span',kind,'tag');
      if(signature)append(row,'code',signature);
      if(detail)append(row,'small',detail);
    }
    for(const t of m.typeIdentities)symbol(t.name,t.opaque?'tipo opaco':'tipo pubblico',null,t.identity+' · arità '+t.arity);
    for(const s of m.exports)symbol(s.name.slice(m.module.length+3),s.signature?.explicitSignature?'firma esplicita':'firma inferita',s.signature?.type,s.name);
    for(const s of m.reexports||[])if(s.kind!=='type')symbol(s.name,'riesportato',s.signature?.type,'Origine: '+s.target);
    if(!list.children.length)append(list,'p','Nessun simbolo pubblico corrispondente.','muted');
    for(const s of m.privateDeclarations){
      const row=append(priv,'div',null,'symbol');
      append(row,'strong',s.name.slice(m.module.length+3));append(row,'code',s.type);
    }
  }
  function analyze(){
    const status=by('status');status.className='';
    const result=MiraStudioCompiler.exploreModules(by('source').value,by('host').value.trim()||null,by('modules').value.trim()||null);
    if(!result.ok){model=null;by('report').hidden=true;status.className='error';status.textContent=result.message;return;}
    model=JSON.parse(result.output);
    if(!model.interfaces.some(m=>m.module===selected))selected=model.interfaces[0]?.module||null;
    status.textContent=model.interfaces.length+' moduli · '+model.dependencies.length+' direttive · type check riuscito';
    by('report').hidden=false;render();
  }
  function example(){
    by('host').value='';
    by('modules').value=JSON.stringify({
      'Data / Box':'module Data / Box;\ninterface\nBox (T);\nbox (T): :: (T) -> Box (T);\nitem (T): :: (Box (T)) -> T;\nimplementation\nBox (T) :: {item: T};\nbox: x = {item: x};\nitem: b = b ~ item;\nprivate constant = 42;',
      'Data / API':'module Data / API;\ninterface\nexport Data / Box {\n  Box => Container;\n  box: ;\n  item: => value of: ;\n};\nimplementation'
    },null,2);
    by('source').value='module App;\ninterface\nresult;\nimport Data / API {\n  Container;\n  box: ;\n  value of: ;\n};\nimplementation\nn (Container (Number)) = box: 7;\nresult = value of: n;';
    selected='App';by('filter').value='';analyze();
  }
  by('analyze').addEventListener('click',analyze);
  by('example').addEventListener('click',example);
  by('filter').addEventListener('input',()=>{if(model)renderSymbols();});
  example();
})();