(function(){
  'use strict';
  const source=document.getElementById('source'),result=document.getElementById('result'),host=document.getElementById('host');
  const valid='rate (Number) = 30;\nquote: p ({hours: Number}) -> {total: Number} = {total: (p ~ hours * rate)};\nquoted = quote: {hours: 2};\nempty ([Text]) = [];\nsame: a, as: b = a == b;\nsame number = same: 2, as: 2;\nsame text = same: "Ada", as: "Mira";\nrename: r = update: r, with: {name: "Ada"};\nupdated = rename: {name: 42, age: 37};\nlocal = () >> {| id = {x | x}; {number: (1 >> id), text: ("ok" >> id)}};\neven: n = if (n <= 0) then true else (odd: (n - 1));\nodd: n = if (n <= 0) then false else (even: (n - 1));\nname of: person = person ~ name;\nidentity: x = x;\na = name of: {name: "Ada", age: 37};\nb = name of: {name: 42};\nc = identity: true;';
  function offset(line,column){
    const lines=source.value.split('\n');
    return lines.slice(0,line-1).reduce((n,text)=>n+text.length+1,0)+column-1;
  }
  function check(highlight=false){
    const response=MiraStudioCompiler.check(source.value,host.value.trim()||null);
    result.textContent=response.ok?(document.getElementById('structured').checked?response.output:JSON.parse(response.output).map(x=>x.name+'  :  '+x.type).join('\n')):response.message;
    const d=response.diagnostic;
    if(highlight && !response.ok && d && !d.file && d.line!=null && d.column!=null){
      source.focus();
      const start=offset(d.line,d.column);
      source.setSelectionRange(start,Math.max(start,offset(d.endLine,d.endColumn)));
    }
  }
  document.getElementById('check').addEventListener('click',()=>check(true));
  document.getElementById('example').addEventListener('click',()=>{host.value='';source.value=valid;check();});
  document.getElementById('invalid').addEventListener('click',()=>{host.value='';source.value='same: a, as: b = a == b;\na = same: [1], as: [2];';check(true);});
  document.getElementById('host-example').addEventListener('click',()=>{
    host.value=JSON.stringify({values:['rate'],callables:['format'],types:{rate:'Number',format:{parameters:['Number'],result:'Text'}}},null,2);
    host.closest('details').open=true;
    source.value='quote: hours = format (hours * rate);\nresult = quote: 2;';
    check();
  });
  document.getElementById('structured').addEventListener('change',()=>check());
  source.value=valid;check();
})();
