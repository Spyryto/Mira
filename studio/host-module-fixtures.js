(function(){
  'use strict';
  const service='Services / Math',native='Providers / Native',pure='Providers / Pure';
  const resultName='__miraModule_v_417070202F20726573756C74';
  const examples={
    magnitude:{label:'Valore assoluto',capability:'native magnitude',parameters:['Number'],selector:'magnitude:',call:'magnitude: (0 - 81)',nativeBody:'magnitude: x = native magnitude x;',pureBody:'magnitude: x = if (x < 0) then (0 - x) else x;',expected:81,js:'Math.abs',php:'abs(...)'},
    maximum:{label:'Massimo',capability:'native maximum',parameters:['Number','Number'],selector:'maximum:and:',call:'maximum: 12, and: 27',nativeBody:'maximum: x, and: y = native maximum: x, and: y;',pureBody:'maximum: x, and: y = if (x > y) then x else y;',expected:27,js:'Math.max',php:'max(...)'}
  };
  function fixture(id){
    const e=examples[id];if(!e)throw Error('Esperimento sconosciuto');
    const selector=e.selector.split(':').slice(0,-1).join(': ')+':';
    const capability=e.parameters.length===1?e.capability:e.capability+':and:';
    const host={types:{[capability]:{parameters:e.parameters.slice(),result:'Number'}},scopes:{[capability]:[native]}};
    host[e.parameters.length===1?'callables':'selectors']=[capability];
    return {source:'module App;\ninterface\nresult;\nimport '+service+' { '+selector+' ; };\nimplementation\nresult = '+e.call+';',
      contract:'module '+service+';\ninterface\n'+selector+' :: ('+e.parameters.join(', ')+') -> Number;',
      native:'module '+native+';\nimplements '+service+';\nimplementation\n'+e.nativeBody,
      pure:'module '+pure+';\nimplements '+service+';\nimplementation\n'+e.pureBody,
      host:JSON.stringify(host,null,2),expected:e.expected,js:e.js,php:e.php,capability};
  }
  function project(fields,provider){
    if(!['native','pure','unbound'].includes(provider))throw Error('Provider sconosciuto');
    return {source:fields.source,host:fields.host.trim()||null,
      modules:JSON.stringify({[service]:fields.contract,[native]:fields.native,[pure]:fields.pure}),
      bindings:provider==='unbound'?null:JSON.stringify({[service]:{provider:provider==='native'?native:pure}},null,2)};
  }
  function inspect(compiler,p){
    const checked=compiler.check(p.source,p.host,p.modules,p.bindings);
    if(!checked.ok)return checked;
    const report=compiler.interfaces(p.source,p.host,p.modules,p.bindings);
    if(!report.ok)return report;
    return {ok:true,types:JSON.parse(checked.output),report:JSON.parse(report.output)};
  }
  function compile(compiler,p,target){
    return compiler.compile(p.source,target,p.host,false,p.modules,true,true,p.bindings);
  }
  globalThis.MiraHostModuleLab={fixture,project,inspect,compile,resultName,service,native,pure};
})();
