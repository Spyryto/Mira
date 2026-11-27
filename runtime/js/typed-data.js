// Portable checked data only. No DOM, networking or effect scheduler.
(function(global){
  'use strict';
  const MAX=16384, scalarText=v=>typeof v==='string'&&!/[\uD800-\uDFFF]/u.test(v);
  const number=v=>typeof v==='number'&&Number.isFinite(v)&&(!Number.isInteger(v)||Number.isSafeInteger(v));
  const record=v=>{
    if(v===null||typeof v!=='object'||Array.isArray(v))return false;
    const proto=Object.getPrototypeOf(v);
    return proto===null||Object.getPrototypeOf(proto)===null;
  };
  const key=v=>scalarText(v)&&! /^-?\d+$/.test(v);
  function matchesType(value,type,depth=0){
    if(!type||depth>30)return false;
    switch(type.kind){
      case 'Number':return number(value);
      case 'Text':return scalarText(value);
      case 'Boolean':return typeof value==='boolean';
      case 'List':
        if(!Array.isArray(value)||Object.keys(value).length!==value.length)return false;
        for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i)||!matchesType(value[i],type.item,depth+1))return false;
        return true;
      case 'Record':
        return record(value)&&type.tail===null&&type.fields.length>0&&Object.keys(value).length===type.fields.length&&
          type.fields.every(field=>key(field.name)&&Object.hasOwn(value,field.name)&&matchesType(value[field.name],field.type,depth+1));
      default:return false;
    }
  }
  class DataFault extends Error {}
  const invalid=()=>new DataFault('invalid_json_data');
  function bounded(source){
    return scalarText(source)&&source.length<=MAX&&new TextEncoder().encode(source).length<=MAX;
  }
  function decodeJson(source,schema){
    if(!bounded(source))throw invalid();
    let value;
    try{value=JSON.parse(source);}catch{throw invalid();}
    if(!matchesType(value,schema))throw invalid();
    return value;
  }
  // Copy only checked schema fields, ignoring prototype methods such as toJSON.
  // Values at this API are trusted in-process data, not adversarial JS objects.
  function data(value,schema){
    switch(schema.kind){
      case 'List':return Array.from(value,item=>data(item,schema.item));
      case 'Record':return Object.fromEntries(schema.fields.map(field=>[field.name,data(value[field.name],field.type)]));
      default:return value;
    }
  }
  function encodeJson(value,schema){
    if(!matchesType(value,schema))throw invalid();
    const source=JSON.stringify(data(value,schema));
    if(!bounded(source))throw invalid();
    return source;
  }
  global.MiraTypedData=Object.freeze({matchesType,decodeJson,encodeJson,DataFault});
})(globalThis);
