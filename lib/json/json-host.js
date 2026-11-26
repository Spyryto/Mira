(function(global){
  'use strict';
  // JSON.parse accepts lone escaped UTF-16 surrogates; PHP rejects them.
  // Check scalar Unicode and depth before returning a checked data value.
  function validText(value,depth=0){
    if(depth>30)return false;
    if(typeof value==='string')return !/[\uD800-\uDFFF]/u.test(value);
    if(value!==null&&typeof value==='object')
      return Object.entries(value).every(([k,v])=>! /[\uD800-\uDFFF]/u.test(k)&&validText(v,depth+1));
    return true;
  }
  function host(binding){
    const schema=JSON.parse(JSON.stringify(binding.schema));
    const matches=global.MiraEffects.matchesType;
    return Object.freeze({[binding.capability]:source=>{
      if(typeof source!=='string'||source.length>16384||new TextEncoder().encode(source).length>16384||/[\uD800-\uDFFF]/u.test(source))throw Error('invalid_json_data');
      let value;
      try{value=JSON.parse(source);}catch{throw Error('invalid_json_data');}
      if(!validText(value)||!matches(value,schema))throw Error('invalid_json_data');
      return value;
    }});
  }
  global.MiraJsonDecoder=Object.freeze({host});
})(globalThis);
