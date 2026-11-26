(function(global){
  'use strict';
  // Only host configuration supplies the URL. The effect carries no path.
  function textService(url,options={}){
    const endpoint=new URL(url);
    if(!['http:','https:'].includes(endpoint.protocol)||endpoint.username||endpoint.password||endpoint.hash)
      throw Error('invalid_endpoint');
    const maxBytes=options.maxBytes??65536, timeoutMs=options.timeoutMs??10000;
    if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>262144||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)
      throw Error('invalid_http_limits');
    const fetcher=options.fetcher??global.fetch.bind(global);
    return async(payload,signal)=>{
      if(payload!==true)throw Error('invalid_http_payload');
      const controller=new AbortController();
      let timedOut=false;
      const abort=()=>controller.abort();
      if(signal?.aborted)abort();
      else signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(()=>{timedOut=true;abort();},timeoutMs);
      let reader;
      try{
        let response;
        try{response=await fetcher(endpoint.href,{method:'GET',credentials:'omit',redirect:'manual',cache:'no-store',signal:controller.signal});}
        catch{throw Error('http_transport');}
        if(response.type==='opaqueredirect'||(response.status>=300&&response.status<400))throw Error('http_redirect');
        if(!Number.isInteger(response.status)||response.status<200||response.status>599)throw Error('http_transport');
        if(!response.body)return {status:response.status,body:''};
        reader=response.body.getReader();
        const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
        let size=0,body='';
        for(;;){
          let chunk;
          try{chunk=await reader.read();}catch{throw Error('http_transport');}
          if(chunk.done)break;
          size+=chunk.value.byteLength;
          if(size>maxBytes)throw Error('http_too_large');
          try{body+=decoder.decode(chunk.value,{stream:true});}catch{throw Error('http_invalid_text');}
        }
        try{body+=decoder.decode();}catch{throw Error('http_invalid_text');}
        return {status:response.status,body};
      }catch(error){
        if(timedOut)throw Error('http_timeout');
        if(signal?.aborted)throw Error('http_cancelled');
        throw error;
      }finally{
        clearTimeout(timer);
        signal?.removeEventListener('abort',abort);
        if(reader){try{reader.cancel().catch(()=>{});}catch{}reader.releaseLock();}
        // Terminate even unread redirect/error bodies, not just the reader.
        abort();
      }
    };
  }
  global.MiraHttpHost=Object.freeze({textService});
})(globalThis);
