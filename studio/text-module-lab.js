(function(){
  'use strict';
  const data=MiraTextModuleData,compiler=MiraStudioCompiler,by=id=>document.getElementById(id);
  let job=null;
  function stop(){if(job){clearTimeout(job.timer);job.worker.terminate();job=null;}}
  function show(status,output='',code='',error=false){
    by('text-status').textContent=status;by('text-status').className=error?'error':'';
    by('text-output').textContent=output;by('text-code').textContent=code;
  }
  function check(){
    stop();const r=compiler.check(by('text-source').value,data.host,data.modules,data.bindings);
    show(r.ok?'Type check riuscito':'Verifica non riuscita',r.ok?JSON.parse(r.output).filter(x=>x.exported).map(x=>x.name+' : '+x.type).join('\n'):r.message,r.ok?'':JSON.stringify(r.diagnostic??{},null,2),!r.ok);
  }
  function emit(target,run=false){
    stop();const r=compiler.compile(by('text-source').value,target,data.host,false,data.modules,true,true,data.bindings);
    if(!r.ok){show('Compilazione non riuscita',r.message,JSON.stringify(r.diagnostic??{},null,2),true);return;}
    show('Compilazione '+target.toUpperCase()+' riuscita',new TextEncoder().encode(r.output).length+' byte UTF-8',r.output);
    if(!run)return;
    let worker;
    try{worker=new Worker('./host-module-worker.js');}catch(error){show('Worker non disponibile',String(error),r.output,true);return;}
    const timer=setTimeout(()=>{if(job?.worker!==worker)return;stop();show('Timeout','Worker terminato dopo 3 secondi.',r.output,true);},3000);
    job={worker,timer};
    worker.onmessage=event=>{if(job?.worker!==worker)return;stop();const v=event.data;show(v.ok?'Esecuzione JS riuscita':'Errore di esecuzione',v.ok?v.output:v.message,r.output,!v.ok);};
    worker.onerror=event=>{if(job?.worker!==worker)return;stop();show('Errore del worker',event.message,r.output,true);};
    worker.postMessage({code:r.output,service:'text'});
  }
  function reset(){stop();by('text-source').value=data.source;check();}
  by('text-library').textContent=Object.entries(JSON.parse(data.modules)).map(([path,source])=>path+'\n'+source).join('\n\n')+'\n\nManifest\n'+data.host+'\n\nBinding\n'+data.bindings;
  by('text-reset').addEventListener('click',reset);by('text-check').addEventListener('click',check);
  by('text-js').addEventListener('click',()=>emit('js'));by('text-php').addEventListener('click',()=>emit('php'));
  by('text-run').addEventListener('click',()=>emit('js',true));
  by('text-source').addEventListener('input',()=>{stop();show('Sorgente modificato.');});
  reset();
})();
