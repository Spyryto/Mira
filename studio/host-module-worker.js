// Explicit execution of user-owned code, not a security sandbox.
self.onmessage=event=>{
  try{
    const code=event.data?.code;
    if(typeof code!=='string')throw Error('Codice JS mancante');
    const host=Object.freeze({'native magnitude':Math.abs,'native maximum:and:':Math.max});
    const value=new Function('__miraHost','"use strict";\n'+code+'\nreturn __miraModule_v_417070202F20726573756C74;')(host);
    self.postMessage({ok:true,output:typeof value==='string'?value:JSON.stringify(value)??String(value)});
  }catch(error){self.postMessage({ok:false,message:String(error?.message??error)});}
};
