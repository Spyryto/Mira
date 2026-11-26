(function(){
  'use strict';
  // Scalar Unicode strings only; reject lone UTF-16 surrogates at this boundary.
  function text(value){
    if(typeof value!=='string'||/[\uD800-\uDFFF]/u.test(value))
      throw new TypeError('Expected valid Unicode Text');
    return value;
  }
  const host=Object.freeze({
    'native code points':value=>{let n=0;for(const _ of text(value))n++;return n;},
    'native contains:in:':(needle,value)=>text(value).includes(text(needle)),
    'native starts with:in:':(prefix,value)=>text(value).startsWith(text(prefix)),
    'native ends with:in:':(suffix,value)=>text(value).endsWith(text(suffix))
  });
  globalThis.MiraTextHost=host;
})();
