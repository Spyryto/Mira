(function(){
  'use strict';
  const lab=MiraHostModuleLab,compiler=MiraStudioCompiler,by=id=>document.getElementById(id);
  const keys=['source','contract','native','pure','host'];
  let job=null;
  function stop(){if(job){clearTimeout(job.timer);job.worker.terminate();job=null;}}
  function show(status,output='',code='',error=false){
    by('status').textContent=status;by('status').className=error?'error':'';
    by('output').textContent=output;by('code').textContent=code;
  }
  function fields(){return Object.fromEntries(keys.map(k=>[k,by(k).value]));}
  function project(provider=by('provider').value){return lab.project(fields(),provider);}
  function refresh(){
    stop();
    const p=project(),e=lab.fixture(by('example').value),mode=by('provider').value;
    by('contract-label').textContent=lab.service;
    by('provider-label').textContent=mode==='unbound'?'Contratto non collegato':mode==='native'?lab.native:lab.pure;
    by('runtime-label').textContent=mode==='native'?'Host esempio: JS '+e.js+' · PHP '+e.php:mode==='pure'?'Nessuna capability nativa richiesta nell’esempio':'Verifica statica senza emissione';
    by('bindings').textContent=p.bindings||'(nessun binding)';
    show('Configurazione aggiornata. Verifica o compila per vedere il risultato.');
  }
  function reset(){
    const e=lab.fixture(by('example').value);
    for(const key of keys)by(key).value=e[key];
    refresh();check();
  }
  function checkedText(r){
    return r.types.filter(x=>x.exported).map(x=>x.name+' : '+x.type).join('\n')+'\n\n'+r.report.interfaces.map(m=>m.module+' → '+m.resolvedModule+'\n'+m.fingerprint).join('\n\n');
  }
  function check(){
    stop();const r=lab.inspect(compiler,project());
    if(!r.ok){show('Verifica non riuscita',r.message,JSON.stringify(r.diagnostic??{},null,2),true);return;}
    show('Type check riuscito',checkedText(r),JSON.stringify(r.report,null,2));
  }
  function emit(target,run=false){
    stop();const r=lab.compile(compiler,project(),target);
    if(!r.ok){show('Compilazione non riuscita',r.message,JSON.stringify(r.diagnostic??{},null,2),true);return;}
    const bytes=new TextEncoder().encode(r.output).length;
    show('Compilazione '+target.toUpperCase()+' riuscita',bytes+' byte UTF-8',r.output);
    if(!run)return;
    const worker=new Worker('./host-module-worker.js');
    const timer=setTimeout(()=>{if(job?.worker!==worker)return;stop();show('Tempo di esecuzione superato','Worker terminato dopo 3 secondi.',r.output,true);},3000);
    job={worker,timer};
    worker.onmessage=event=>{if(job?.worker!==worker)return;stop();const v=event.data;show(v.ok?'Esecuzione JS riuscita':'Errore di esecuzione',v.ok?v.output:v.message,r.output,!v.ok);};
    worker.onerror=event=>{if(job?.worker!==worker)return;stop();show('Errore del worker',event.message,r.output,true);};
    worker.postMessage({code:r.output});
  }
  function compare(){
    stop();const a=lab.inspect(compiler,project('native')),b=lab.inspect(compiler,project('pure'));
    if(!a.ok||!b.ok){show('Confronto non riuscito',(!a.ok?a:b).message,'',true);return;}
    const x=a.report.interfaces.find(m=>m.module===lab.service),y=b.report.interfaces.find(m=>m.module===lab.service);
    if(!x||!y){show('Contratto non importato','Il confronto richiede Services / Math.','',true);return;}
    const lines=['Interfaccia del contratto: '+(x.canonical===y.canonical?'identica':'diversa'),'Native: '+x.resolvedModule,'Pure: '+y.resolvedModule];
    const code=[];
    for(const target of ['js','php']){
      const n=lab.compile(compiler,project('native'),target),p=lab.compile(compiler,project('pure'),target);
      if(!n.ok||!p.ok){show('Compilazione non riuscita',(!n.ok?n:p).message,'',true);return;}
      lines.push(target.toUpperCase()+' · byte Native / Pure: '+new TextEncoder().encode(n.output).length+' / '+new TextEncoder().encode(p.output).length);
      code.push(target.toUpperCase()+' · Native\n'+n.output+'\n'+target.toUpperCase()+' · Pure\n'+p.output);
    }
    show('Confronto statico completato',lines.join('\n'),code.join('\n\n'));
  }
  by('example').addEventListener('change',reset);by('provider').addEventListener('change',()=>{refresh();check();});
  by('reset').addEventListener('click',reset);by('check').addEventListener('click',check);
  by('compile-js').addEventListener('click',()=>emit('js'));by('compile-php').addEventListener('click',()=>emit('php'));
  by('run').addEventListener('click',()=>emit('js',true));by('compare').addEventListener('click',compare);
  for(const key of keys)by(key).addEventListener('input',refresh);
  reset();
})();
