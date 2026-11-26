(function(){
  'use strict';
  const source=document.getElementById('source'),result=document.getElementById('result'),host=document.getElementById('host');
  const valid='Retry Count :: Integer where _ >= 0 AND _ <= 3;\nretry (Retry Count) = 2;\nnext retry (Integer) = retry + 1;\nPercentage :: Number where _ >= 0 AND _ <= 100;\nnormalize percentage: x (Number) -> Percentage = if (x >= 0 AND x <= 100) then x else 0;\nnormalized = normalize percentage: 120;\nSmall Percentage :: Percentage where _ <= 10;\nhalf of: p (Percentage) -> Percentage = p / 2;\nvolume (Percentage) = 50 + 30;\nhalf volume = half of: volume;\nsmall volume (Small Percentage) = 5;\nvalid volume = volume > 0 AND volume <= 100;\nlogical = NOT false AND true OR false;\noperator sum = fold: [1, 2, 3], with: (+), from: 0;\nSize :: {width: Number, height: Number};\nWindow :: {width: Number, height: Number, title: Text};\nwindow (Window) = {width: 12, height: 10, title: "Mira"};\narea of: size (~ Size) = size ~ width * size ~ height;\nwindow area = area of: window;\nStudent Id :: Number;\nRequest Id :: Number;\nstudent (Student Id) = 42;\nrequest (Request Id) = 7;\nread student: id (Student Id) = id;\nselected student = read student: student;\nlocal quote = 2 >> {hours (Number) | unit rate (Number) = 30; hours * unit rate};\nrate (Number) = 30;\nquote: p ({hours: Number}) -> {total: Number} = {total: (p ~ hours * rate)};\nquoted = quote: {hours: 2};\nempty ([Text]) = [];\nsame: a, as: b = a == b;\nsame number = same: 2, as: 2;\nsame text = same: "Ada", as: "Mira";\nrename: r = update: r, with: {name: "Ada"};\nupdated = rename: {name: 42, age: 37};\nlocal = () >> {| id = {x | x}; {number: (1 >> id), text: ("ok" >> id)}};\neven: n = if (n <= 0) then true else (odd: (n - 1));\nodd: n = if (n <= 0) then false else (even: (n - 1));\nname of: person = person ~ name;\nidentity: x = x;\na = name of: {name: "Ada", age: 37};\nb = name of: {name: 42};\nc = identity: true;';
  function offset(line,column){
    const lines=source.value.split('\n');
    return lines.slice(0,line-1).reduce((n,text)=>n+text.length+1,0)+column-1;
  }
  function check(highlight=false){
    const response=MiraStudioCompiler.check(source.value,host.value.trim()||null);
    result.textContent=response.ok?(document.getElementById('structured').checked?response.output:JSON.parse(response.output).map(x=>x.name+'  :  '+x.type).join('\n')):response.message;
    const d=response.diagnostic;
    if(!response.ok && d?.proof){
      const label=d.proof==='violated'?'Vincolo certamente violato':'Vincolo non dimostrato';
      result.textContent=label+'\n'+response.message+(document.getElementById('structured').checked?'\n'+JSON.stringify(d,null,2):'');
    }
    if(highlight && !response.ok && d && !d.file && d.line!=null && d.column!=null){
      source.focus();
      const start=offset(d.line,d.column);
      source.setSelectionRange(start,Math.max(start,offset(d.endLine,d.endColumn)));
    }
  }
  document.getElementById('check').addEventListener('click',()=>check(true));
  document.getElementById('example').addEventListener('click',()=>{host.value='';source.value=valid;check();});
  document.getElementById('invalid').addEventListener('click',()=>{host.value='';source.value='same: a, as: b = a == b;\na = same: [1], as: [2];';check(true);});
  document.getElementById('overflow').addEventListener('click',()=>{host.value='';source.value='x (Integer) = 9007199254740991 + 1;';check(true);});
  document.getElementById('unknown').addEventListener('click',()=>{host.value='';source.value='increment: x (Integer) -> Integer = x + 1;';check(true);});
  function compileChecked(target){
    const response=MiraStudioCompiler.compile(source.value,target,host.value.trim()||null,false,null,true);
    result.textContent=response.ok?response.output:response.message;
  }
  document.getElementById('checked-js').addEventListener('click',()=>compileChecked('js'));
  document.getElementById('checked-php').addEventListener('click',()=>compileChecked('php'));
  document.getElementById('generic-sum-example').addEventListener('click',()=>{
    host.value='';
    source.value='Result (Success Type, Failure Type) :: Ok (Success Type) | Err (Failure Type);\nOption (element type) :: Some (element type) | None;\na (Result (Number, Text)) = Ok: 42;\nb (Result (Text, Number)) = Ok: "Ada";\nnone number (Option (Number)) = None;\nresult = match: a {ok: {n | n}, err: {e | 0}};';
    check();
  });
  document.getElementById('match-example').addEventListener('click',()=>{
    host.value='';
    source.value='Connection :: Disconnected | Connecting | Connected (Text) | Failed (Text);\nconnection = Connected: "Ada";\nresult = match: connection {\n  disconnected: {| "offline"},\n  connecting: {| "waiting"},\n  connected: {name | name},\n  failed: {error | error}\n};';
    check();
  });
  document.getElementById('sum-example').addEventListener('click',()=>{
    host.value='';
    source.value='Session :: {user: Text};\nConnection :: Disconnected | Connecting | Connected (Session) | Failed (Text);\nsession (Session) = {user: "Ada"};\ninitial = Disconnected;\nactive connection = Connected: session;\nfailure = Failed: "Timeout";\nstates = [initial, active connection, failure];';
    check();
  });
  document.getElementById('validation-example').addEventListener('click',()=>{
    host.value='';
    source.value='Percentage :: Number where _ >= 0 AND _ <= 100;\nuse percent: p (Percentage) = p + 0;\nresult = validate: (120), as: (Percentage), then: {p | use percent: p}, else: {error | 0};';
    check();
  });
  document.getElementById('host-example').addEventListener('click',()=>{
    host.value=JSON.stringify({values:['rate'],callables:['format'],types:{rate:'Number',format:{parameters:['Number'],result:'Text'}}},null,2);
    host.closest('details').open=true;
    source.value='quote: hours = format (hours * rate);\nresult = quote: 2;';
    check();
  });
  document.getElementById('structured').addEventListener('change',()=>check());
  source.value=valid;check();
})();
