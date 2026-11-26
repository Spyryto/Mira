(function(){
  'use strict';
  const by=id=>document.getElementById('http-'+id),data=MiraHttpModuleData,program=MiraHttpProgram();
  by('source').textContent=data.source+'\n\n'+JSON.parse(data.modules)['Services / Http'];
  by('js-code').textContent=data.js;by('php-code').textContent=data.php;
  let sequence=0,controller=null;
  const service=MiraHttpHost.textService(new URL('./http-example.txt',window.location.href).href);
  by('load').addEventListener('click',async()=>{
    controller?.abort();const id=++sequence;controller=new AbortController();
    const effect=program.request(id);
    by('request').textContent=JSON.stringify(effect,null,2);
    by('status').textContent='Caricamento…';by('output').textContent='';
    try{
      const response=await service(effect.payload,controller.signal);
      if(id!==sequence)return;
      by('status').textContent='HTTP '+response.status+(program.successful(response)?' · successo':' · risposta non 2xx');
      by('output').textContent=response.body;
    }catch(error){if(id===sequence)by('status').textContent=String(error?.message??error);}
  });
  by('cancel').addEventListener('click',()=>controller?.abort());
  window.addEventListener('pagehide',()=>controller?.abort());
})();
