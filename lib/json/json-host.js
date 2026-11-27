(function(global){
  'use strict';
  function host(binding){
    const schema=JSON.parse(JSON.stringify(binding.schema));
    const data=global.MiraTypedData;
    const decode=source=>data.decodeJson(source,schema);
    const capabilities={[binding.capability]:decode};
    if(binding.fallibleCapability)capabilities[binding.fallibleCapability]=source=>{
      try{return {values:[decode(source)],error:''};}
      catch(error){if(!(error instanceof data.DataFault))throw error;return {values:[],error:'invalid_json_data'};}
    };
    return Object.freeze(capabilities);
  }
  global.MiraJsonDecoder=Object.freeze({host});
})(globalThis);
