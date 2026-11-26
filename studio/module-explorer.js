(function(){
  'use strict';
  const by=id=>document.getElementById(id);
  let model=null, selected=null;
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
  const append=(parent,tag,text,cls)=>{const n=el(tag,text,cls);parent.append(n);return n;};
  function select(path){selected=path;by('contract-report').textContent='';render();}
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
      append(middle,'small',d.kind+' · '+d.phase+(d.contract?' · '+d.contract:''));
      edge.append(moduleButton(d.kind==='file'?null:d.to,d.to));
    }
    if(!model.dependencies.length)append(edges,'p','Nessuna dipendenza.','muted');
    renderSymbols();
  }
  function renderSymbols(){
    const m=model?.interfaces.find(x=>x.module===selected);
    by('selected').textContent=m?m.module+(m.abstractContract?' · contratto non collegato':''):'Interfaccia';
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
    const status=by('status');status.className='';by('contract-report').textContent='';
    const result=MiraStudioCompiler.exploreModules(by('source').value,by('host').value.trim()||null,by('modules').value.trim()||null,by('bindings').value.trim()||null);
    if(!result.ok){model=null;by('report').hidden=true;status.className='error';status.textContent=result.message;return;}
    model=JSON.parse(result.output);
    if(!model.interfaces.some(m=>m.module===selected))selected=model.interfaces[0]?.module||null;
    status.textContent=model.interfaces.length+' moduli · '+model.dependencies.length+' direttive · type check riuscito'+(model.interfaces.some(m=>m.abstractContract)?' · provider non selezionato':'');
    by('report').hidden=false;render();
  }
  function example(){
    by('host').value='';
    by('bindings').value='';by('provider-output').textContent='';
    by('modules').value=JSON.stringify({
      'Data / Box':'module Data / Box;\ninterface\nBox (T);\nbox (T): :: (T) -> Box (T);\nitem (T): :: (Box (T)) -> T;\nimplementation\nBox (T) :: {item: T};\nbox: x = {item: x};\nitem: b = b ~ item;\nprivate constant = 42;',
      'Data / API':'module Data / API;\ninterface\nexport Data / Box {\n  Box => Container;\n  box: ;\n  item: => value of: ;\n};\nimplementation'
    },null,2);
    by('source').value='module App;\ninterface\nresult;\nimport Data / API {\n  Container;\n  box: ;\n  value of: ;\n};\nimplementation\nn (Container (Number)) = box: 7;\nresult = value of: n;';
    selected='App';by('filter').value='';analyze();
  }
  async function benchmark(){
    const button=by('benchmark'),out=by('benchmark-report');
    const bench=globalThis.MiraModuleBenchmark;
    button.disabled=true;out.textContent='';
    try{
      for(const count of [4,16,64]){
        const fixture=bench.project(count);
        for(const target of ['js','php']){
          const samples=[[],[]];
          for(let i=0;i<3;i++)for(const mode of (i%2?[1,0]:[0,1])){
            await new Promise(resolve=>setTimeout(resolve,0));
            samples[mode].push(bench.measure(MiraStudioCompiler,fixture,target,mode===1));
          }
          const a=samples[0][2],b=samples[1][2];
          const line=[(count+2)+' moduli · '+target.toUpperCase(),
            'Checked: '+bench.median(samples[0]).toFixed(2)+' ms',
            'Ottimizzata: '+bench.median(samples[1]).toFixed(2)+' ms',
            'Byte UTF-8: '+a.bytes+' → '+b.bytes,
            'Dichiarazioni: '+b.optimization.before+' → '+b.optimization.after].join('\n');
          out.textContent+=(out.textContent?'\n\n':'')+line;
        }
      }
    }catch(error){out.textContent+='\n'+String(error);}
    finally{button.disabled=false;}
  }
  by('verify-contract').addEventListener('click',()=>{
    const out=by('contract-report');
    if(by('bindings').value.trim()){out.textContent='Il verificatore autonomo della 0.72 richiede un progetto senza binding; usa Compila JS/PHP per verificare i binding.';return;}
    if(!selected){out.textContent='Seleziona un modulo dopo aver analizzato il progetto.';return;}
    const response=MiraStudioCompiler.verifyContract(by('source').value,selected,by('contract').value,by('host').value.trim()||null,by('modules').value.trim()||null);
    if(!response.ok){out.textContent=response.message;return;}
    const data=JSON.parse(response.output);
    out.textContent='Contratto verificato: '+data.provider+'\n'+data.verified.map(s=>s.name+'  :  '+s.signature.type).join('\n');
  });
  function providerExample(){
    by('host').value='';
    by('modules').value=JSON.stringify({
      'Providers / Memory':'module Providers / Memory;\ninterface\nread: ;\nimplementation\nread: x = x + 2;',
      'Providers / Native':'module Providers / Native;\ninterface\nread: ;\nimplementation\nread: x = x * 2;'
    },null,2);
    by('source').value='module App;\n\nimport Services / Storage {\n  read: ;\n};\n\nresult = read: 5;';
    by('bindings').value=JSON.stringify({'Services / Storage':{provider:'Providers / Memory',contract:'read: :: (Number) -> Number;'}},null,2);
    by('provider-settings').open=true;by('provider-output').textContent='';selected='App';analyze();
  }
  function compileProvider(target){
    const r=MiraStudioCompiler.compile(by('source').value,target,by('host').value.trim()||null,false,by('modules').value.trim()||null,true,true,by('bindings').value.trim()||null);
    by('provider-output').textContent=r.ok?r.output:r.message;
  }
  function contractModuleExample(){
    by('host').value='';
    by('modules').value=JSON.stringify({
      'Services / Storage':'module Services / Storage;\ninterface\nStorage;\nopen: :: (Text) -> Storage;\nread: key: :: (Storage, Text) -> Text;\nclose: :: (Storage) -> Boolean;',
      'Providers / Memory':'module Providers / Memory;\nimplements Services / Storage;\nimplementation\nStorage :: {name: Text};\nopen: name = {name: name};\nread: store, key: k = store ~ name;\nclose: store = true;',
      'Providers / Native':'module Providers / Native;\nimplements Services / Storage;\nimplementation\nStorage :: Text;\nopen: name = name;\nread: store, key: k = k;\nclose: store = true;'
    },null,2);
    by('source').value='module App;\n\nimport Services / Storage {\n  Storage;\n  open: ;\n  read: key: ;\n  close: ;\n};\n\nstore (Storage) = open: "memory";\nresult = read: store, key: "native";\ndone = close: store;';
    by('bindings').value=JSON.stringify({'Services / Storage':{provider:'Providers / Memory'}},null,2);
    by('provider-settings').open=true;by('provider-output').textContent='';selected='App';analyze();
  }
  by('contract-module-example').addEventListener('click',contractModuleExample);
  by('contract-unbind').addEventListener('click',()=>{by('bindings').value='';by('provider-output').textContent='';analyze();});
  by('provider-example').addEventListener('click',providerExample);
  by('provider-swap').addEventListener('click',()=>{
    try {
      const bindings=JSON.parse(by('bindings').value);
      const example=bindings['Services / Storage'];
      if(!example)throw Error('Carica prima l’esempio con due provider.');
      example.provider=example.provider==='Providers / Memory'?'Providers / Native':'Providers / Memory';
      by('bindings').value=JSON.stringify(bindings,null,2);
      by('provider-output').textContent='';analyze();
    }catch(error){by('provider-output').textContent=String(error);}
  });
  by('provider-js').addEventListener('click',()=>compileProvider('js'));
  by('provider-php').addEventListener('click',()=>compileProvider('php'));
  by('benchmark').addEventListener('click',benchmark);
  by('analyze').addEventListener('click',analyze);
  by('example').addEventListener('click',example);
  by('filter').addEventListener('input',()=>{if(model)renderSymbols();});
  example();
})();