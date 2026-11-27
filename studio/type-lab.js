(function(){
  'use strict';
  const source=document.getElementById('source'),result=document.getElementById('result'),host=document.getElementById('host'),modules=document.getElementById('modules');
  const valid='Retry Count :: Integer where _ >= 0 AND _ <= 3;\nretry (Retry Count) = 2;\nnext retry (Integer) = retry + 1;\nPercentage :: Number where _ >= 0 AND _ <= 100;\nnormalize percentage: x (Number) -> Percentage = if (x >= 0 AND x <= 100) then x else 0;\nnormalized = normalize percentage: 120;\nSmall Percentage :: Percentage where _ <= 10;\nhalf of: p (Percentage) -> Percentage = p / 2;\nvolume (Percentage) = 50 + 30;\nhalf volume = half of: volume;\nsmall volume (Small Percentage) = 5;\nvalid volume = volume > 0 AND volume <= 100;\nlogical = NOT false AND true OR false;\noperator sum = fold: [1, 2, 3], with: (+), from: 0;\nSize :: {width: Number, height: Number};\nWindow :: {width: Number, height: Number, title: Text};\nwindow (Window) = {width: 12, height: 10, title: "Mira"};\narea of: size (~ Size) = size ~ width * size ~ height;\nwindow area = area of: window;\nStudent Id :: Number;\nRequest Id :: Number;\nstudent (Student Id) = 42;\nrequest (Request Id) = 7;\nread student: id (Student Id) = id;\nselected student = read student: student;\nlocal quote = 2 >> {hours (Number) | unit rate (Number) = 30; hours * unit rate};\nrate (Number) = 30;\nquote: p ({hours: Number}) -> {total: Number} = {total: (p ~ hours * rate)};\nquoted = quote: {hours: 2};\nempty ([Text]) = [];\nsame: a, as: b = a == b;\nsame number = same: 2, as: 2;\nsame text = same: "Ada", as: "Mira";\nrename: r = update: r, with: {name: "Ada"};\nupdated = rename: {name: 42, age: 37};\nlocal = () >> {| id = {x | x}; {number: (1 >> id), text: ("ok" >> id)}};\neven: n = if (n <= 0) then true else (odd: (n - 1));\nodd: n = if (n <= 0) then false else (even: (n - 1));\nname of: person = person ~ name;\nidentity: x = x;\na = name of: {name: "Ada", age: 37};\nb = name of: {name: 42};\nc = identity: true;';
  function offset(line,column){
    const lines=source.value.split('\n');
    return lines.slice(0,line-1).reduce((n,text)=>n+text.length+1,0)+column-1;
  }
  function check(highlight=false){
    const response=MiraStudioCompiler.check(source.value,host.value.trim()||null,modules.value.trim()||null);
    result.textContent=response.ok?(document.getElementById('structured').checked?response.output:JSON.parse(response.output).map(x=>(x.module?(x.exported?(x.explicitSignature?'[pubblico · esplicito] ':'[pubblico · inferito] '):'[privato] '):'')+x.name+'  :  '+x.type).join('\n')):response.message;
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
  document.getElementById('scalar-variant-example').addEventListener('click',()=>{
    host.value='';
    modules.value='';
    source.value='Alignment :: Start = "start" | Center = "center" | End = "end";\nlabel: x (Alignment) = match: x {start: {| "S"}, center: {| "C"}, end: {| "E"}};\nresult = {value: Center, label: (label: Center)};\n# Prova Compila checked JS o PHP; prova anche bad (Alignment) = "center";';
    check();
  });
  document.getElementById('cardinality-example').addEventListener('click',()=>{
    host.value='';
    modules.value='';
    source.value='Result (T,E) :: Ok (T) | Err (E);\nSmall :: [Number] where (length of: _) >= 1 AND (length of: _) <= 3;\nraw = [1, 2];\nfirst (Small) = raw;\nexpanded = append: 3, to: first;\nnext (Small) = expanded;\nparse: xs ([Number]) = validate: (xs), as: (Small);\nresult = [(parse: [1]), (parse: [1, 2, 3, 4])];\n# Prova bad (Small) = append: 4, to: next;';
    check();
  });
  document.getElementById('typed-style-example').addEventListener('click',()=>{
    host.value='';
    modules.value='';
    source.value='import "lib/gui.mira";\nimport "lib/gui-typed-styles.mira";\npx (GUI Pixels) = 12;\nink (GUI Color) = "#234";\npaper (GUI Color) = "#ffeedd";\npanel (GUI Style) = {padding: px, width: Style Fill, align: Align Center, color: ink, background: paper, borderColor: ink};\nlayers (Style Layers) = [panel];\nresult = styled: (text: "Mira"), with styles: layers;\n# Compila checked JS/PHP; prova una proprietà errata o un valore fuori intervallo.';
    check();
  });
  document.getElementById('text-refinement-example').addEventListener('click',()=>{
    host.value='';
    modules.value='';
    source.value='Result (T, E) :: Ok (T) | Err (E);\nAlignment :: Text where _ == "start" OR _ == "center" OR _ == "end";\na (Alignment) = "center";\nparse: x (Text) = validate: (x), as: (Alignment);\nresult = [(parse: "start"), (parse: "bad")];\n# Prova bad (Alignment) = "middle"; oppure bad: x (Text) -> Alignment = x;';
    check();
  });
  document.getElementById('static-presence-example').addEventListener('click',()=>{
    host.value='';
    modules.value='';
    source.value='Option (T) :: Some (T) | None;\nStyle :: {padding?: Number};\noriginal (Style) = {};\npadded = update: original, with: {padding: 0};\nresult = padded ~ padding;\nchosen = match: (padded ~? padding) {some: {p | p}, none: {| 12}};\n# Compila checked JS/PHP: nessun controllo di presenza. Prova original ~ padding.';
    check();
  });
  document.getElementById('safe-optional-example').addEventListener('click',()=>{
    host.value='';
    modules.value='';
    source.value='Option (T) :: Some (T) | None;\nStyle :: {padding?: Number};\na (Style) = {};\nb (Style) = {padding: 0};\nx = a ~? padding;\nresolve: s (Style) -> Number = match: (s ~? padding) {some: {p | p}, none: {| 12}};\nresult = [(resolve: a), (resolve: b)];\n# Compila checked JS/PHP: il match diretto non costruisce Option.';
    check();
  });
  document.getElementById('optional-record-example').addEventListener('click',()=>{
    host.value='';
    modules.value='';
    source.value='Style :: {name: Text, padding?: Number, color?: Text};\noriginal (Style) = {name: "base"};\nchanged = update: original, with: {padding: 12};\nresult = {original: original, changed: changed, title: (changed ~ name)};\n# Prova Compila checked JS o PHP. Aggiungi bad = original ~ padding; per vedere la diagnostica.';
    check();
  });
  document.getElementById('native-variant-example').addEventListener('click',()=>{
    host.value='';
    modules.value='';
    source.value='Pixels :: Number where _ >= 0 AND _ <= 4096;\nSize :: Fixed (Pixels) = _ | Fill = "fill" | Auto = "auto";\nn (Pixels) = 12.5;\nresolve: s (Size) -> Number = match: s {fixed: {p | p + 0}, fill: {| 100}, auto: {| 0}};\nsizes = [(Fixed: n), Fill, Auto];\nresult = {sizes: sizes, values: (collect: sizes, with: (resolve: _))};\n# Prova Compila checked JS o PHP. Cambia Fixed (Pixels) in Fixed (Text) per vedere il conflitto.';
    check();
  });
  document.getElementById('modular-scalar-example').addEventListener('click',()=>{
    host.value='';
    modules.value=JSON.stringify({Layout:'module Layout; interface Alignment :: Start = 0 | Center = "0" | End = 2; implementation'},null,2);
    source.value='module App;\nimport Layout {Alignment => Position; Center => Middle;};\nlabel: x (Position) = match: x {start: {| "S"}, center: {| "C"}, end: {| "E"}};\nresult = {value: Middle, label: (label: Middle)};';
    check();
  });
  document.getElementById('style-contract-example').addEventListener('click',()=>{
    host.value='';
    modules.value='';
    source.value='Rule :: Choices ([Text]) | Either ([Rule]);\nmode = Choices: ["manual", "auto"];\nconfig = {mode: mode, fallback: (Either: [mode])};';
    document.getElementById('constant-root').value='config';
    check();
  });
  document.getElementById('constant-data').addEventListener('click',()=>{
    const response=MiraStudioCompiler.constantData(source.value,document.getElementById('constant-root').value.trim());
    result.textContent=response.ok?JSON.stringify(JSON.parse(response.output),null,2):response.message;
  });
  document.getElementById('example').addEventListener('click',()=>{host.value='';source.value=valid;check();});
  document.getElementById('invalid').addEventListener('click',()=>{host.value='';source.value='same: a, as: b = a == b;\na = same: [1], as: [2];';check(true);});
  document.getElementById('overflow').addEventListener('click',()=>{host.value='';source.value='x (Integer) = 9007199254740991 + 1;';check(true);});
  document.getElementById('unknown').addEventListener('click',()=>{host.value='';source.value='increment: x (Integer) -> Integer = x + 1;';check(true);});
  function compileChecked(target){
    const response=MiraStudioCompiler.compile(source.value,target,host.value.trim()||null,false,modules.value.trim()||null,true);
    result.textContent=response.ok?response.output:response.message;
  }
  document.getElementById('checked-js').addEventListener('click',()=>compileChecked('js'));
  document.getElementById('checked-php').addEventListener('click',()=>compileChecked('php'));
  function compareTreeShaking(target){
    const args=[source.value,target,host.value.trim()||null,false,modules.value.trim()||null,true];
    const times=[[],[]];
    let a,b;
    // Alternate order to reduce warm-up bias. Report medians, not guarantees.
    for(let i=0;i<7;i++){
      for(const mode of (i%2?[1,0]:[0,1])){
        const start=performance.now();
        const response=MiraStudioCompiler.compile(...args,mode===1);
        times[mode].push(performance.now()-start);
        if(!response.ok){result.textContent=response.message;return;}
        if(mode===0)a=response;else b=response;
      }
    }
    const median=xs=>xs.slice().sort((x,y)=>x-y)[3];
    const bytes=s=>new TextEncoder().encode(s).length;
    const before=bytes(a.output),after=bytes(b.output);
    const stats=b.optimization;
    result.textContent=[
      'Tree shaking · '+target.toUpperCase(),
      'Dichiarazioni: '+stats.before+' → '+stats.after+' (−'+stats.removed.length+')',
      'UTF-8: '+before+' → '+after+' byte (−'+(100*(before-after)/before).toFixed(1)+'%)',
      'Compilazione checked, mediana 7 iterazioni: '+median(times[0]).toFixed(3)+' → '+median(times[1]).toFixed(3)+' ms',
      'Passaggio di pruning, ultima iterazione: '+stats.optimizationMs.toFixed(3)+' ms',
      'Eliminate: '+stats.removed.join(', '),
      '',b.output
    ].join('\n');
  }
  document.getElementById('tree-shake-js').addEventListener('click',()=>compareTreeShaking('js'));
  document.getElementById('tree-shake-php').addEventListener('click',()=>compareTreeShaking('php'));
  document.getElementById('tree-shake-example').addEventListener('click',()=>{
    host.value='';
    // Discursive names contain words, not standalone numeric tokens.
    const names=Array.from({length:40},(_,i)=>'unused value '+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26)+' = '+i+';').join('\n');
    modules.value=JSON.stringify({'Math / Library':'module Math / Library;\ninterface\nsquare: ;\nunused: ;\nimplementation\nfactor = 2;\nsquare: x = x * factor;\nunused: x = x * 42;\n'+names},null,2);
    modules.closest('details').open=true;
    source.value='module App;\n\nimport Math / Library {\n  square: ;\n  unused: ;\n};\n\nresult = square: 5;';
    compareTreeShaking('js');
  });
  document.getElementById('reexport-example').addEventListener('click',()=>{
    host.value='';
    modules.value=JSON.stringify({
      'Math / Integer Math':'module Math / Integer Math;\ninterface\nsquare: ;\nadd: by: ;\nimplementation\nsquare: x = x * x;\nadd: x, by: y = x + y;',
      'Math / API':'module Math / API;\ninterface\nexport Math / Integer Math {\n  square: ;\n  add: by: => somma: a: ;\n};\nimplementation'
    },null,2);
    modules.closest('details').open=true;
    source.value='module App;\n\nimport Math / API {\n  square: ;\n  somma: a: ;\n};\n\nresult = somma: (square: 3), a: 2;';
    check();
  });
  document.getElementById('parametric-opaque-example').addEventListener('click',()=>{
    host.value='';
    modules.value=JSON.stringify({'Data / Box':'module Data / Box;\ninterface\nBox (Element Type);\nEnvelope (T) :: {box: Box (T)};\nbox (T): :: (T) -> Box (T);\nitem (T): :: (Box (T)) -> T;\nimplementation\nBox (U) :: {item: U};\nbox: x = {item: x};\nitem: b = b ~ item;'},null,2);
    modules.closest('details').open=true;
    source.value='module App;\n\nimport Data / Box {\n  Box => Container;\n  Envelope;\n  box: ;\n  item: ;\n};\n\nn (Container (Number)) = box: 7;\ne (Envelope (Number)) = {box: n};\nresult = item: (e ~ box);\n# Prova: bad = (e ~ box) ~ item;';
    check();
  });
  document.getElementById('opaque-type-example').addEventListener('click',()=>{
    host.value='';
    modules.value=JSON.stringify({'Music / Theory':'module Music / Theory;\ninterface\nNote;\nnote: :: (Number) -> Note;\npitch of: :: (Note) -> Number;\nimplementation\nNote :: {pitch: Number};\nnote: n = {pitch: n};\npitch of: n = n ~ pitch;'},null,2);
    modules.closest('details').open=true;
    source.value='module App;\n\nimport Music / Theory {\n  Note;\n  note: ;\n  pitch of: ;\n};\n\nn (Note) = note: 7;\nresult = pitch of: n;\n# Prova: leaked = n ~ pitch;';
    check();
  });
  document.getElementById('public-signature-example').addEventListener('click',()=>{
    host.value='';
    modules.value='';
    source.value='module Math / Example;\n\ninterface\n\nrate (Number);\nsquare: :: (Number) -> Number;\nidentity (Value Type): :: (Value Type) -> Value Type;\ndouble: ;\n\nimplementation\n\nrate = 2;\nsquare: x = x * x;\nidentity: x = x;\ndouble: x = x + x;\na = identity: 42;\nb = identity: "Mira";\nresult = square: rate;';
    check();
  });
  document.getElementById('selective-import-example').addEventListener('click',()=>{
    host.value='';
    modules.value=JSON.stringify({'Math / Integer Math':'module Math / Integer Math;\ninterface\nsquare: ;\nadd: by: ;\nimplementation\nsquare: x = x * x;\nadd: x, by: y = x + y;'},null,2);
    modules.closest('details').open=true;
    source.value='module App;\ninterface\nresult;\nimport Math / Integer Math {\n  square: ;\n  add: by: => somma: a: ;\n};\nimplementation\nresult = somma: (square: 3), a: 2;';
    check();
  });
  document.getElementById('flat-interface-example').addEventListener('click',()=>{
    host.value='';
    source.value='module Math / Integer Math;\n\ninterface\n\nOption (T) :: Some (T) | None;\nrate;\nsquare:;\nadd: by: ;\n\nimplementation\n\nrate = 2;\nsquare: x = x * x;\nadd: x, by: y = x + y;\nprivate constant = 42;\nresult = add: (square: rate), by: private constant;';
    check();
  });
  document.getElementById('isolated-module-example').addEventListener('click',()=>{
    host.value='';
    source.value='module Music / Jazz Harmony;\nPitch :: Number;\nrate = 2;\nscale: x = x * rate;\na (Pitch) = 42;\nresult = scale: 5;';
    check();
  });
  document.getElementById('recursive-sum-example').addEventListener('click',()=>{
    host.value='';
    source.value='Tree (Element Type) :: Leaf (Element Type) | Branch ([Tree (Element Type)]);\nsum tree: tree (Tree (Number)) -> Number = match: tree {leaf: {n | n}, branch: {children | fold: children, with: {acc, child | acc + (sum tree: child)}, from: 0}};\na = Branch: [(Leaf: 2), (Branch: [(Leaf: 3), (Leaf: 4)])];\nresult = sum tree: a;';
    check();
  });
  document.getElementById('parametric-data-example').addEventListener('click',()=>{
    host.value='';
    source.value='Pair (First Type, Second Type) :: {first: First Type, second: Second Type};\nBag (Element Type) :: [Element Type];\nmake pair (A, B): x (A), with: y (B) -> Pair (A, B) = {first: x, second: y};\na = make pair: 42, with: "Ada";\nb (Bag (Number)) = [1, 2];\nresult = a ~ first;';
    check();
  });
  document.getElementById('generic-sum-example').addEventListener('click',()=>{
    host.value='';
    source.value='Result (Success Type, Failure Type) :: Ok (Success Type) | Err (Failure Type);\nidentity (Value Type): x (Value Type) -> Value Type = x;\nOption (element type) :: Some (element type) | None;\na (Result (Number, Text)) = Ok: (identity: 42);\nb (Result (Text, Number)) = Ok: "Ada";\nnone number (Option (Number)) = None;\nresult = match: a {ok: {n | n}, err: {e | 0}};';
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
  document.getElementById('validation-result-example').addEventListener('click',()=>{
    host.value='';
    source.value='Result (Value Type, Failure Type) :: Ok (Value Type) | Err (Failure Type);\nPercentage :: Number where _ >= 0 AND _ <= 100;\na = validate: (42), as: (Percentage);\nb = validate: (120), as: (Percentage);\nresult = match: a {ok: {p | p + 0}, err: {message | 0}};';
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
