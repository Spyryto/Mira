(function(){
  'use strict';
  const by=id=>document.getElementById(id),data=MiraLessonImportData;
  const store=()=>MiraLessonImportProgram({...MiraTextHost,...MiraDateHost,...MiraJsonDecoder.host(data.decoder),...MiraStorageHost.browser({getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value),removeItem:key=>window.localStorage.removeItem(key)},'lesson-import-v1')});
  // Inspection and HTTP remain available when localStorage access is denied.
  const program=MiraLessonImportProgram({...MiraTextHost,...MiraDateHost,...MiraJsonDecoder.host(data.decoder)});
  const http=MiraHttpHost.textService(new URL('./lesson-import-sample.json',window.location.href).href);
  let seq=0,controller;
  by('source').textContent=data.source;by('schema').textContent=JSON.stringify(data.decoder.schema,null,2);
  by('js').textContent=data.js;by('php').textContent=data.php;
  const status=message=>{by('status').textContent=message;};
  function invalidate(){seq++;controller?.abort();by('save').disabled=true;by('summary').hidden=true;}
  function show(result){
    by('save').disabled=!result.accepted;by('summary').hidden=!result.accepted;
    if(!result.accepted){status('Non valida: '+result.error);return false;}
    by('student').textContent=result.student;
    by('day').textContent=result.day+' · '+['','lun','mar','mer','gio','ven','sab','dom'][result.weekday];
    by('hours').textContent=String(result.hours);
    by('total').textContent=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(result.total);
    by('paid').textContent=result.paid?'Saldato':'Da saldare';status('Lezione verificata.');return true;
  }
  function action(fn){try{fn();}catch(error){status('Errore: '+String(error?.message??error));}}
  by('raw').addEventListener('input',()=>{invalidate();status('Modificato: verifica prima di salvare.');});
  by('inspect').addEventListener('click',()=>action(()=>{invalidate();show(program.inspect(by('raw').value));}));
  by('load').addEventListener('click',async()=>{
    invalidate();const id=seq;controller=new AbortController();status('Caricamento…');
    try{
      const effect=program.request(id),response=await http(effect.payload,controller.signal);
      if(id!==seq)return;
      const result=program.accept(response);
      // Failed imports must never overwrite a user's draft.
      if(result.accepted){by('raw').value=response.body;show(result);}
      else {show(result);}
    }catch(error){if(id===seq)status('Errore: '+String(error?.message??error));}
  });
  by('save').addEventListener('click',()=>action(()=>{
    // Keep a valid draft and its preview on an I/O failure, so retry is possible.
    seq++;controller?.abort();
    const raw=by('raw').value;
    if(!show(program.inspect(raw)))return;
    const saved=store().save(raw);
    if(saved.accepted)status('Salvata su questo browser.');
    else status('Errore: '+saved.error);
  }));
  by('restore').addEventListener('click',()=>action(()=>{
    seq++;controller?.abort();const restored=store().restore();
    if(restored.tag==='Err'){status('Errore: '+program.errorCode(restored.value));return;}
    if(restored.tag!=='Ok')throw Error('invalid_storage_outcome');
    const found=restored.value;
    if(found.tag==='None'){status('Nessuna lezione salvata.');return;}
    if(found.tag!=='Some')throw Error('invalid_storage_outcome');
    invalidate();by('raw').value=found.value;if(show(program.inspect(found.value)))status('Recuperata e verificata.');
  }));
  by('remove').addEventListener('click',()=>action(()=>{
    if(!window.confirm('Rimuovere la lezione salvata nel laboratorio?'))return;
    seq++;controller?.abort();const removed=store().remove();
    if(removed.tag==='Err'){status('Errore: '+program.errorCode(removed.value));return;}
    if(removed.tag!=='Ok'||removed.value!==true)throw Error('invalid_storage_outcome');
    status('Archivio locale rimosso.');
  }));
  window.addEventListener('pagehide',()=>{seq++;controller?.abort();});
})();
