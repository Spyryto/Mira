(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const compiler=globalThis.MiraStudioCompiler;
  const examples={
    decimal:{source:'digit = character in: "0123456789";\ninteger part = one or more of: digit;\nfraction = all of: [(one: "."), (one or more of: digit)];\ngrammar = all of: [(zero or one of: (one: "-")), integer part, (zero or one of: fraction)];',sample:'-3.14'},
    color:{source:'hex digit = character in: "0123456789abcdefABCDEF";\nhex color = all of: [(one: "#"), (one of: [(exactly: 3, of: hex digit), (exactly: 4, of: hex digit), (exactly: 6, of: hex digit), (exactly: 8, of: hex digit)])];\ngrammar = one of: [hex color, (one: "transparent"), (one: "currentColor")];',sample:'#ff8800'},
    overlap:{source:'prefix = one of: [(one: "a"), (one: "ab")];\ngrammar = all of: [prefix, (one: "c")];',sample:'abc'}
  };
  function tree(node,indent=''){
    const value=node.value;
    if(node.tag==='Literal'||node.tag==='Character Set')return indent+node.tag+' '+JSON.stringify(value);
    if(node.tag==='Repeat')return indent+'Repeat '+value.min+'…'+(value.unbounded?'∞':value.max)+'\n'+tree(value.pattern,indent+'  ');
    return indent+node.tag+(value.length?'\n'+value.map(v=>tree(v,indent+'  ')).join('\n'):' (vuoto)');
  }
  function analyze(){
    const result=compiler.grammarAnalyze($('source').value,$('root').value.trim(),$('sample').value);
    $('path').replaceChildren();$('tree').textContent='';$('metrics').textContent='';
    delete $('status').dataset.accepted;
    if(!result.ok){$('status').textContent=result.message;return;}
    const data=JSON.parse(result.output);
    $('status').dataset.accepted=String(data.accepted);
    $('status').textContent=data.accepted?'✓ Testo riconosciuto integralmente':'✗ Testo non riconosciuto';
    $('metrics').textContent='Stati NFA: '+data.nfaStates+' · Stati DFA: '+data.dfaStates;
    $('tree').textContent=tree(data.grammar);
    data.path.forEach((state,i)=>{
      const cell=document.createElement('span');cell.className='grammar-step';
      cell.textContent=i===0?'q0':JSON.stringify($('sample').value[i-1])+' → '+(state<0?'rifiuto':'q'+state);
      $('path').append(cell);
    });
  }
  function emit(target){
    const result=compiler.grammarEmit($('source').value,$('root').value.trim(),target);
    $('output').textContent=result.ok?result.output:result.message;
    $('output').closest('details').open=true;
  }
  function example(name){
    $('source').value=examples[name].source;$('sample').value=examples[name].sample;$('root').value='grammar';$('output').textContent='';analyze();
  }
  for(const name of Object.keys(examples))$(name).addEventListener('click',()=>example(name));
  $('analyze').addEventListener('click',analyze);
  $('sample').addEventListener('input',analyze);
  $('js').addEventListener('click',()=>emit('js'));
  $('php').addEventListener('click',()=>emit('php'));
  $('refinement').addEventListener('click',()=>{
    const name=$('root').value.trim();
    const sample=JSON.stringify($('sample').value);
    const source='import "lib/grammar.mira";\n'+$('source').value+'\nLab Text :: Text where matches: _, grammar: '+name+';\nlab value (Lab Text) = '+sample+';';
    const result=compiler.check(source);
    $('refinement-output').textContent=source+'\n\n'+(result.ok?'Prova statica riuscita':result.message);
    $('refinement-details').open=true;
  });
  $('library').textContent=compiler.grammarSource();
  example('decimal');
})();
