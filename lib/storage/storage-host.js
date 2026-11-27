(function(global){
  'use strict';
  const KEY=/^[a-z][a-z0-9_-]{0,63}$/;
  const MAX=65536;
  class StorageFault extends Error {}
  function key(value){
    if(typeof value!=='string'||!KEY.test(value)||/[\r\n]/.test(value))throw new StorageFault('invalid_key');
    return value;
  }
  function text(value){
    if(typeof value!=='string'||/[\uD800-\uDFFF]/u.test(value))throw new StorageFault('invalid_text');
    if(value.length>MAX||new TextEncoder().encode(value).length>MAX)throw new StorageFault('value_too_large');
    return value;
  }
  function browser(storage,namespace){
    if(typeof namespace!=='string'||!namespace.length)throw Error('invalid_namespace');
    const path=k=>'mira:kv:'+namespace+':'+key(k);
    function operation(action){try{return action();}catch{throw new StorageFault('storage_failure');}}
    const legacy={
      'browser read text':k=>{
        const id=path(k),v=operation(()=>storage.getItem(id));
        return v===null?[]:[text(v)];
      },
      'browser save text:for:':(v,k)=>{
        const id=path(k),value=text(v);
        operation(()=>storage.setItem(id,value));return true;
      },
      'browser remove text':k=>{
        const id=path(k);operation(()=>storage.removeItem(id));return true;
      }
    };
    function attempt(action,read){
      try{const value=action();return {values:read?value:[value],error:''};}
      catch(e){if(!(e instanceof StorageFault))throw e;return {values:[],error:e.message};}
    }
    return Object.freeze({...legacy,
      'browser try read text':k=>attempt(()=>legacy['browser read text'](k),true),
      'browser try save text:for:':(v,k)=>attempt(()=>legacy['browser save text:for:'](v,k),false),
      'browser try remove text':k=>attempt(()=>legacy['browser remove text'](k),false)
    });
  }
  global.MiraStorageHost=Object.freeze({browser});
})(globalThis);
