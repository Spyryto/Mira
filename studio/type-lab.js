(function(){
  'use strict';
  const source=document.getElementById('source'),result=document.getElementById('result');
  const valid='same: a, as: b = a == b;\nsame number = same: 2, as: 2;\nsame text = same: "Ada", as: "Mira";\nrename: r = update: r, with: {name: "Ada"};\nupdated = rename: {name: 42, age: 37};\nlocal = () >> {| id = {x | x}; {number: (1 >> id), text: ("ok" >> id)}};\neven: n = if (n <= 0) then true else (odd: (n - 1));\nodd: n = if (n <= 0) then false else (even: (n - 1));\nname of: person = person ~ name;\nidentity: x = x;\na = name of: {name: "Ada", age: 37};\nb = name of: {name: 42};\nc = identity: true;';
  function offset(line,column){
    const lines=source.value.split('\n');
    return lines.slice(0,line-1).reduce((n,text)=>n+text.length+1,0)+column-1;
  }
  function check(highlight=false){
    const response=MiraStudioCompiler.check(source.value);
    result.textContent=response.ok?JSON.parse(response.output).map(x=>x.name+'  :  '+x.type).join('\n'):response.message;
    const d=response.diagnostic;
    if(highlight && !response.ok && d && !d.file && d.line!=null && d.column!=null){
      source.focus();
      const start=offset(d.line,d.column);
      source.setSelectionRange(start,Math.max(start,offset(d.endLine,d.endColumn)));
    }
  }
  document.getElementById('check').addEventListener('click',()=>check(true));
  document.getElementById('example').addEventListener('click',()=>{source.value=valid;check();});
  document.getElementById('invalid').addEventListener('click',()=>{source.value='same: a, as: b = a == b;\na = same: [1], as: [2];';check(true);});
  source.value=valid;check();
})();
