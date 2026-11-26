(function(){
  'use strict';
  const by=id=>document.getElementById('storage-'+id),data=MiraStorageModuleData;
  by('source').textContent=data.source;
  by('library').textContent=Object.entries(JSON.parse(data.modules)).map(([path,source])=>path+'\n'+source).join('\n\n')+'\n\nManifest\n'+data.host+'\n\nBinding browser\n'+data.browser+'\n\nBinding files\n'+data.files;
  by('js-code').textContent=data.js;by('php-code').textContent=data.php;
  function act(op){
    try{
      const program=MiraStorageProgram(MiraStorageHost.browser(window.localStorage,'studio-lab-v1'));
      const key=by('key').value;
      if(op==='read'){
        const values=program.read(key);
        by('value').value=values.length?values[0]:'';
        by('status').textContent=values.length?'Valore recuperato (anche se vuoto).':'Chiave assente.';
      }else if(op==='save'){
        program.save(by('value').value,key);by('status').textContent='Salvato su questo browser.';
      }else{
        program.remove(key);by('value').value='';by('status').textContent='Chiave rimossa (anche se già assente).';
      }
      by('status').className='';
    }catch(error){by('status').textContent='Errore: '+String(error?.message??error);by('status').className='error';}
  }
  for(const op of ['read','save','remove'])by(op).addEventListener('click',()=>act(op));
})();
