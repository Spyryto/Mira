(function(global){
  'use strict';
  const KEY=/^[a-z][a-z0-9_-]{0,63}$/;
  const MAX=65536;
  function key(value){
    if(typeof value!=='string'||!KEY.test(value)||/[\r\n]/.test(value))throw Error('invalid_key');
    return value;
  }
  function text(value){
    if(typeof value!=='string'||/[\uD800-\uDFFF]/u.test(value))throw Error('invalid_text');
    if(value.length>MAX||new TextEncoder().encode(value).length>MAX)throw Error('value_too_large');
    return value;
  }
  function browser(storage,namespace){
    if(typeof namespace!=='string'||!namespace.length)throw Error('invalid_namespace');
    const path=k=>'mira:kv:'+namespace+':'+key(k);
    function operation(action){try{return action();}catch{throw Error('storage_failure');}}
    return Object.freeze({
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
    });
  }
  global.MiraStorageHost=Object.freeze({browser});
})(globalThis);
