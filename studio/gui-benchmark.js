// A bounded browser benchmark, using the real compiler and DOM host.
// No framework, dependencies, network, or benchmark-specific renderer path.
(function(global) {
  'use strict';
  const rows = 100, updates = 30, rounds = 5, warmup = 5;
  const strategies = ['incremental','rebuild','specialized','direct'];
  const cases = ['sparse','dense','styled'];
  const model=(density,n)=>density==='styled'?{count:n}:n;
  const padding=n=>n%2===0?4:8;
  const stats = samples => {
    const sorted = [...samples].sort((a,b)=>a-b);
    return {medianMs: sorted[Math.floor(sorted.length/2)], p95Ms: sorted[Math.ceil(sorted.length*.95)-1]};
  };

  function source(density) {
    if (!cases.includes(density)) throw new Error('Unknown workload');
    const labels = Array.from({length:rows},(_,i)=>{
      const value = density === 'styled'&&i===0 ? '(n ~ count)' : density === 'dense' || i === 0 ? '(n + '+i+')' : String(i);
      const pad = density==='styled'&&i===0?'(if ((n ~ count) % 2 == 0) then 4 else 8)':'4';
      return '  {type: "styled", view: {type: "text", text: '+value+'}, styles: [{padding: '+pad+'}]}';
    });
    const advance=density==='styled'?'advance: n = {count: (n ~ count + 1)};':'advance: n = n + 1;';
    return advance+'\nbench view: n = {type: "column", children: [\n'+
      labels.join(',\n')+',\n  {type: "button", label: "Next", update: (advance: _)}\n]};\n';
  }

  function compile(compiler,density) {
    const program=compiler.compile(source(density),'js');
    if (!program.ok) throw new Error(program.message);
    return new Function(program.output+'\nreturn {advance: advance, view: bench_view};')();
  }

  function expected(density,n,i) {
    return density==='dense'||i===0 ? n+i : i;
  }

  function verify(mount,density,n) {
    const labels=mount.querySelectorAll('p');
    if (labels.length!==rows || [...labels].some((p,i)=>p.textContent!==String(expected(density,n,i)))) {
      throw new Error('DOM checksum mismatch: '+density+' / '+n);
    }
    if(density==='styled'&&labels[0].style.padding!==padding(n)+'px')throw new Error('Style checksum mismatch');
  }

  function nativeMount(mount,density,program) {
    const doc=mount.ownerDocument;
    const section=doc.createElement('section');
    section.className='mira-ui-state';
    const column=doc.createElement('div');
    column.className='mira-ui-column';
    const labels=Array.from({length:rows},(_,i)=>{
      const p=doc.createElement('p');p.className='mira-ui-text';
      p.style.setProperty('padding','4px');p.textContent=String(i);
      column.append(p);return p;
    });
    let n=model(density,0);
    const button=doc.createElement('button');button.className='mira-ui-button';
    button.type='button';button.textContent='Next';
    button.addEventListener('click',()=>{
      n=program.advance(n);
      const count=density==='dense'?rows:1;
      const number=density==='styled'?n.count:n;
      for(let i=0;i<count;i++) labels[i].textContent=String(number+i);
      if(density==='styled')labels[0].style.setProperty('padding',padding(number)+'px');
    });
    column.append(button);section.append(column);mount.replaceChildren(section);
    return ()=>button.click();
  }

  function setup(mount,density,program,strategy,specialized) {
    if(strategy==='specialized'){
      global.MiraGuiSpecialize.mount(specialized,mount,model(density,0));
      const button=mount.querySelector('button');
      return ()=>button.click();
    }
    if(strategy==='direct') return nativeMount(mount,density,program);
    const host=global.MiraUiHost.createUiHost(mount.ownerDocument,mount,error=>{throw new Error(error);});
    const initial=n=>({type:'state',initial:n,view:program.view});
    host.render(initial(model(density,0)));
    if(strategy==='incremental'){
      const button=mount.querySelector('button');
      return ()=>button.click();
    }
    // Explicit full render of the identical Mira view after the same
    // compiled transition. No incremental state update in this baseline.
    let n=model(density,0);
    return ()=>{ n=program.advance(n);host.render(initial(n)); };
  }

  function layout(mount) {
    // A connected element's geometry forces pending style/layout work.
    return mount.querySelector('p:last-of-type').getBoundingClientRect().bottom;
  }

  function measure(mount,density,program,strategy,flush,specialized) {
    const step=setup(mount,density,program,strategy,specialized);
    for(let i=0;i<warmup;i++)step();
    verify(mount,density,warmup);
    layout(mount);
    let geometry=0;
    const start=performance.now();
    for(let i=0;i<updates;i++){
      step();
      if(flush)geometry+=layout(mount);
    }
    const elapsed=performance.now()-start;
    verify(mount,density,warmup+updates);
    if(!Number.isFinite(geometry))throw new Error('Invalid geometry');
    layout(mount); // outside the timed window in the no-flush case
    return elapsed/updates;
  }

  function measureView(program,density) {
    const samples=[];
    for(let round=0;round<rounds;round++){
      let checksum=0;
      for(let i=0;i<warmup;i++)program.view(model(density,i));
      const start=performance.now();
      for(let i=1;i<=updates;i++){
        const view=program.view(model(density,i));
        checksum+=view.children[0].view.text;
        checksum+=view.children[rows-1].view.text;
      }
      samples.push((performance.now()-start)/updates);
      const sum=updates*(updates+1)/2;
      const expectedSum=sum+updates*(rows-1)+(density==='dense'?sum:0);
      if(checksum!==expectedSum)throw new Error('View checksum mismatch');
    }
    return stats(samples);
  }


  // Stamped with the actual lib/gui.mira at PWA build time.
  const guiLibrary = '__MIRA_GUI_LIBRARY__';
  function formSource(size=100) {
    if(!Number.isInteger(size)||size<1||size>100)throw new Error('Invalid form size');
    const texts=Array.from({length:size-1},(_,i)=>'text: '+i);
    return guiLibrary+'\n'+
      'summary line: value = text: value;\n'+
      'student field: model = text input: "Allievo", value: (model ~ student), update: {old, entered | {student: entered, paid: (old ~ paid), mode: (old ~ mode)}};\n'+
      'form view: model = column: [\n'+[
        'title: "Scheda lezione"',
        'student field: model',
        'checkbox: "Pagato", checked: (model ~ paid), update: {old, checked | {student: (old ~ student), paid: checked, mode: (old ~ mode)}}',
        'choose: "Modalita", value: (model ~ mode), options: ["In presenza", "Online"], update: {old, selected | {student: (old ~ student), paid: (old ~ paid), mode: selected}}',
        'summary line: (model ~ student)',
        'summary line: (if (model ~ paid) then "Saldato" else "Da saldare")',
        'summary line: (model ~ mode)',
        'button: "Reset", update: {old | {student: "Ada", paid: false, mode: "In presenza"}}',
        ...texts
      ].join(',\n')+'\n];';
  }
  const initialForm=()=>({student:'Ada',paid:false,mode:'In presenza'});
  function formSetup(compiler,mount,specialized,size=100){
    const source=formSource(size);
    if(specialized){
      const compiled=global.MiraGuiSpecialize.compile(compiler,source,'form view:');
      return ()=>global.MiraGuiSpecialize.mount(compiled,mount,initialForm());
    }
    const code=compiler.compile(source,'js');
    if(!code.ok)throw new Error(code.message);
    const view=new Function(code.output+'\nreturn form_view;')();
    return ()=>{
      const host=global.MiraUiHost.createUiHost(mount.ownerDocument,mount,error=>{throw new Error(error);});
      host.render({type:'state',initial:initialForm(),view});
    };
  }
  function checkForm(mount){
    const input=mount.querySelector('input[type=text]'),check=mount.querySelector('input[type=checkbox]'),select=mount.querySelector('select');
    const labels=mount.querySelectorAll('p');
    input.focus();input.value='Ada Lovelace';input.setSelectionRange(3,3);
    input.dispatchEvent(new Event('input'));
    if(input!==mount.querySelector('input[type=text]')||mount.ownerDocument.activeElement!==input||
        input.selectionStart!==3||labels[0].textContent!=='Ada Lovelace')throw new Error('Form focus/caret checksum');
    check.checked=true;check.dispatchEvent(new Event('change'));
    select.value='Online';select.dispatchEvent(new Event('change'));
    if(labels[1].textContent!=='Saldato'||labels[2].textContent!=='Online')throw new Error('Form controls checksum');
    mount.querySelector('button').click();
    if(input.value!=='Ada'||check.checked||select.value!=='In presenza'||labels[0].textContent!=='Ada')throw new Error('Form reset checksum');
  }
  function runForm(compiler,mount){
    const setups={incremental:formSetup(compiler,mount,false),specialized:formSetup(compiler,mount,true)};
    for(const setup of Object.values(setups)){setup();checkForm(mount);}
    const results=[];
    for(const flush of [false,true]){
      const samples={incremental:[],specialized:[]};
      for(let round=0;round<rounds;round++){
        const order=round%2===0?['incremental','specialized']:['specialized','incremental'];
        for(const strategy of order){
          setups[strategy]();
          const input=mount.querySelector('input[type=text]'),p=mount.querySelector('p');
          const step=i=>{input.value='Allievo '+i;input.dispatchEvent(new Event('input'));};
          for(let i=0;i<warmup;i++)step(i);
          layout(mount);
          const start=performance.now();
          for(let i=warmup;i<warmup+updates;i++){
            step(i);
            if(flush)layout(mount);
          }
          samples[strategy].push((performance.now()-start)/updates);
          if(p.textContent!=='Allievo '+(warmup+updates-1)||input!==mount.querySelector('input[type=text]'))throw new Error('Form benchmark checksum');
          layout(mount);
        }
      }
      results.push({flush,incremental:stats(samples.incremental),specialized:stats(samples.specialized)});
    }
    mount.replaceChildren();
    return results;
  }

  function run(compiler,mount) {
    if (!mount.isConnected) throw new Error('Benchmark requires connected DOM');
    const results=[];
    for(const density of cases){
      const program=compile(compiler,density);
      const specialized=global.MiraGuiSpecialize.compile(compiler,source(density),'bench view:');
      const view=measureView(program,density);
      for(const flush of [false,true]){
        const samples=Object.fromEntries(strategies.map(s=>[s,[]]));
        // Rotate measurement order to reduce systematic warmup/order bias.
        for(let round=0;round<rounds;round++){
          for(let i=0;i<strategies.length;i++){
            const strategy=strategies[(i+round)%strategies.length];
            samples[strategy].push(measure(mount,density,program,strategy,flush,specialized));
          }
        }
        results.push({density,flush,view,dynamicSlots:specialized.plan.slots.length,...Object.fromEntries(strategies.map(s=>[s,stats(samples[s])]))});
      }
    }
    mount.replaceChildren();
    const form=runForm(compiler,mount);
    return {ok:true,rows,updates,rounds,warmup,form,version:compiler.version,
      userAgent:navigator.userAgent,results};
  }

  global.MiraGuiBench=Object.freeze({source,run,formSource,formSetup});
})(globalThis);
