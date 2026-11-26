(function(){
  'use strict';
  function mount(service,data){
  const compiler=MiraStudioCompiler,by=id=>document.getElementById(service+'-'+id);
  let job=null;
  function stop(){if(job){clearTimeout(job.timer);job.worker.terminate();job=null;}}
  function show(status,output='',code='',error=false){
    by('status').textContent=status;by('status').className=error?'error':'';
    by('output').textContent=output;by('code').textContent=code;
  }
  function check(){
    stop();const r=compiler.check(by('source').value,data.host,data.modules,data.bindings);
    show(r.ok?'Type check riuscito':'Verifica non riuscita',r.ok?JSON.parse(r.output).filter(x=>x.exported).map(x=>x.name+' : '+x.type).join('\n'):r.message,r.ok?'':JSON.stringify(r.diagnostic??{},null,2),!r.ok);
  }
  function emit(target,run=false){
    stop();const r=compiler.compile(by('source').value,target,data.host,false,data.modules,true,true,data.bindings);
    if(!r.ok){show('Compilazione non riuscita',r.message,JSON.stringify(r.diagnostic??{},null,2),true);return;}
    show('Compilazione '+target.toUpperCase()+' riuscita',new TextEncoder().encode(r.output).length+' byte UTF-8',r.output);
    if(!run)return;
    let worker;
    try{worker=new Worker('./host-module-worker.js');}catch(error){show('Worker non disponibile',String(error),r.output,true);return;}
    const timer=setTimeout(()=>{if(job?.worker!==worker)return;stop();show('Timeout','Worker terminato dopo 3 secondi.',r.output,true);},3000);
    job={worker,timer};
    worker.onmessage=event=>{if(job?.worker!==worker)return;stop();const v=event.data;show(v.ok?'Esecuzione JS riuscita':'Errore di esecuzione',v.ok?v.output:v.message,r.output,!v.ok);};
    worker.onerror=event=>{if(job?.worker!==worker)return;stop();show('Errore del worker',event.message,r.output,true);};
    worker.postMessage({code:r.output,service});
  }
  function reset(){stop();by('source').value=data.source;check();}
  by('library').textContent=Object.entries(JSON.parse(data.modules)).map(([path,source])=>path+'\n'+source).join('\n\n')+'\n\nManifest\n'+data.host+'\n\nBinding\n'+data.bindings+(data.decoder?'\n\nSchema generato\n'+JSON.stringify(data.decoder.schema,null,2):'');
  if(data.fallibleSource)by('fallible').addEventListener('click',()=>{stop();by('source').value=data.fallibleSource;check();});
  by('reset').addEventListener('click',reset);by('check').addEventListener('click',check);
  by('js').addEventListener('click',()=>emit('js'));by('php').addEventListener('click',()=>emit('php'));
  by('run').addEventListener('click',()=>emit('js',true));
  by('source').addEventListener('input',()=>{stop();show('Sorgente modificato.');});
  reset();
  }
  mount('text',MiraTextModuleData);
  if(globalThis.MiraJsonModuleData)mount('json',MiraJsonModuleData);
})();
