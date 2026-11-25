(function(){
  'use strict';
  const source=document.getElementById('source'),result=document.getElementById('result');
  const valid='even: n = if (n <= 0) then true else (odd: (n - 1));\nodd: n = if (n <= 0) then false else (even: (n - 1));\nname of: person = person ~ name;\nidentity: x = x;\na = name of: {name: "Ada", age: 37};\nb = name of: {name: 42};\nc = identity: true;';
  function check(){
    const response=MiraStudioCompiler.check(source.value);
    result.textContent=response.ok?JSON.parse(response.output).map(x=>x.name+'  :  '+x.type).join('\n'):response.message;
  }
  document.getElementById('check').addEventListener('click',check);
  document.getElementById('example').addEventListener('click',()=>{source.value=valid;check();});
  document.getElementById('invalid').addEventListener('click',()=>{source.value='name of: person = person ~ name;\na = name of: {age: 37};';check();});
  source.value=valid;check();
})();
