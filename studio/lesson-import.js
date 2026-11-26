(function(){
  'use strict';
  const by=id=>document.getElementById(id),data=MiraLessonImportData;
  const store=()=>MiraLessonImportProgram({...MiraTextHost,...MiraDateHost,...MiraJsonDecoder.host(data.decoder),...MiraStorageHost.browser(window.localStorage,'lesson-import-v1')});
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
      by('raw').value=response.body;show(result);
    }catch(error){if(id===seq)status('Errore: '+String(error?.message??error));}
  });
  by('save').addEventListener('click',()=>action(()=>{
    invalidate();if(show(store().save(by('raw').value)))status('Salvata su questo browser.');
  }));
  by('restore').addEventListener('click',()=>action(()=>{
    invalidate();const values=store().restore();
    if(!values.length){status('Nessuna lezione salvata.');return;}
    by('raw').value=values[0];if(show(program.inspect(values[0])))status('Recuperata e verificata.');
  }));
  by('remove').addEventListener('click',()=>action(()=>{
    if(!window.confirm('Rimuovere la lezione salvata nel laboratorio?'))return;
    invalidate();store().remove();status('Archivio locale rimosso.');
  }));
  window.addEventListener('pagehide',()=>{seq++;controller?.abort();});
})();
