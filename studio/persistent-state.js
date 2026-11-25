// A small explicit adapter. No implicit global storage in Mira or preview.
// A damaged/unknown schema is preserved until the user explicitly resets it.
(function(global){
  'use strict';
  const MAX_BYTES=262144;
  function open(storage,key,version,initial,validate){
    if(typeof key!=='string'||!key||!Number.isSafeInteger(version)||version<1||!validate(initial))
      throw Error('Invalid persistence configuration');
    let value=initial, blocked=false, message='Nessun dato salvato';
    try{
      const raw=storage.getItem(key);
      if(raw!==null){
        if(raw.length>MAX_BYTES)throw Error('Archivio troppo grande');
        const envelope=JSON.parse(raw);
        if(!envelope||envelope.version!==version||!validate(envelope.data))
          throw Error('Formato o versione non riconosciuti');
        value=envelope.data;message='Dati ripristinati';
      }
    }catch(error){blocked=true;message='Archivio non leggibile: '+String(error.message??error);}
    return Object.freeze({
      initial:value,
      status:()=>({blocked,message}),
      save(next){
        if(blocked)return false;
        try{
          if(!validate(next))throw Error('Dati non validi');
          const raw=JSON.stringify({version,data:next});
          if(raw.length>MAX_BYTES)throw Error('Archivio troppo grande');
          storage.setItem(key,raw);
          message='Salvato su questo dispositivo';return true;
        }catch(error){message='Non salvato: '+String(error.message??error);return false;}
      },
      reset(){
        try{storage.removeItem(key);blocked=false;message='Archivio cancellato';return true;}
        catch(error){message='Cancellazione non riuscita: '+String(error.message??error);return false;}
      }
    });
  }
  global.MiraPersistentState=Object.freeze({open});
})(globalThis);
