(function(){
  'use strict';
  const mount=document.getElementById('mount'),status=document.getElementById('storage-status');
  const reset=document.getElementById('reset-data');
  const key='mira:apps:lesson-ledger';
  const boundedText=v=>typeof v==='string'&&v.length<=120;
  function valid(model){
    if(!model||typeof model!=='object'||!boundedText(model.draft)||
       !Number.isSafeInteger(model['next id'])||model['next id']<1||
       !Array.isArray(model.lessons)||model.lessons.length>100)return false;
    const ids=new Set();
    for(const item of model.lessons){
      if(!item||!Number.isSafeInteger(item.id)||item.id<1||item.id>=model['next id']||
        ids.has(item.id)||!boundedText(item.student)||!item.student.length||
        !Number.isSafeInteger(item.hours)||item.hours<1||item.hours>10000||
        typeof item.paid!=='boolean')return false;
      ids.add(item.id);
    }
    return true;
  }
  function start(){
    let storage;
    try{storage=window.localStorage;}
    catch(error){storage={getItem(){throw error;},setItem(){throw error;},removeItem(){throw error;}};}
    let persistent;
    function display(){status.textContent=persistent.status().message;}
    const ordinary=MiraUiHost.createUiHost(document,mount,message=>{
      status.textContent='Errore: '+message;
    },undefined,next=>{persistent.save(next);display();});
    const host=Object.freeze({render(spec){
      if(persistent||spec?.type!=='state')throw Error('Expected one root state');
      persistent=MiraPersistentState.open(storage,key,1,spec.initial,valid);
      const view=spec.view;
      ordinary.render({...spec,initial:persistent.initial,view:model=>{
        if(!valid(model))throw Error('Registro non valido (max 100 lezioni, nome 120 caratteri, ore 1–10000)');
        return view(model);
      }});
      display();
      return spec;
    }});
    MiraLessonLedgerProgram(host);
    reset.onclick=()=>{
      if(!window.confirm('Cancellare tutte le lezioni salvate su questo dispositivo?'))return;
      if(persistent.reset())start();else display();
    };
  }
  try{start();}catch(error){status.textContent='Errore: '+String(error.message??error);}
})();
