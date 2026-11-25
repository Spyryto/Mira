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


  function hybridSource(size=100){
    if(!Number.isInteger(size)||size<2||size>100)throw new Error('Invalid hybrid size');
    return guiLibrary+'\n'+
      'fixed panel: n = column: [text: n, '+Array.from({length:size-1},(_,i)=>'text: '+(i+1)).join(', ')+'];\n'+
      'changing panel: n = column: [button: "Avanti", update: {old | old + 1}, (if (n % 2 == 0) then (title: "Pari") else (text: "Dispari"))];\n'+
      'hybrid view: n = column: [fixed panel: n, changing panel: n];';
  }
  function hybridSetup(compiler,mount,hybrid,size=100){
    const source=hybridSource(size);
    if(hybrid){
      const compiled=global.MiraGuiSpecialize.compileAuto(compiler,source,'hybrid view:');
      if(compiled.mode!=='hybrid'||!compiled.regions[0].specialized||compiled.regions[1].specialized)throw new Error('Hybrid region classification');
      return ()=>global.MiraGuiSpecialize.mountAuto(compiled,mount,0);
    }
    const code=compiler.compile(source,'js');
    if(!code.ok)throw new Error(code.message);
    const view=new Function(code.output+'\nreturn hybrid_view;')();
    return ()=>global.MiraUiHost.createUiHost(mount.ownerDocument,mount,error=>{throw new Error(error);})
      .render({type:'state',initial:0,view});
  }
  function runHybrid(compiler,mount){
    const setups={incremental:hybridSetup(compiler,mount,false),hybrid:hybridSetup(compiler,mount,true)};
    const results=[];
    for(const flush of [false,true]){
      const samples={incremental:[],hybrid:[]};
      for(let round=0;round<rounds;round++){
        for(const strategy of round%2?['hybrid','incremental']:['incremental','hybrid']){
          setups[strategy]();
          const label=mount.querySelector('p'),button=mount.querySelector('button');
          for(let i=0;i<warmup;i++)button.click();
          layout(mount);
          const start=performance.now();
          for(let i=0;i<updates;i++){
            button.click();
            if(flush)layout(mount);
          }
          samples[strategy].push((performance.now()-start)/updates);
          const n=warmup+updates;
          const changing=mount.children[0].children[0].children[1];
          if(label.textContent!==String(n)||label!==mount.querySelector('p')||
             changing.children[1].textContent!==(n%2?'Dispari':'Pari')||
             changing.children[1].tagName!==(n%2?'P':'H2')||button!==mount.querySelector('button'))
            throw new Error('Hybrid DOM checksum');
          layout(mount);
        }
      }
      results.push({flush,incremental:stats(samples.incremental),hybrid:stats(samples.hybrid)});
    }
    mount.replaceChildren();
    return results;
  }


  // Isolate the text-writing strategy: same compiled view, state transition,
  // renderer, events, DOM structure, warmup and checks. Only Text.data varies.
  function runTextExperiment(compiler,mount){
    const samplesPerCase=9,steps=120;
    const results=[];
    for(const density of ['sparse','dense']){
      const compiled=global.MiraGuiSpecialize.compile(compiler,source(density),'bench view:');
      for(const flush of [false,true]){
        const samples={content:[],data:[]};
        for(let round=0;round<samplesPerCase;round++){
          for(const mode of round%2?['data','content']:['content','data']){
            global.MiraGuiSpecialize.mount(compiled,mount,0,error=>{throw new Error(error);},mode);
            const button=mount.querySelector('button');
            const labels=[...mount.querySelectorAll('p')];
            const first=labels[0].firstChild;
            for(let i=0;i<warmup;i++)button.click();
            layout(mount);
            const start=performance.now();
            for(let i=0;i<steps;i++){
              button.click();
              if(flush)layout(mount);
            }
            samples[mode].push((performance.now()-start)/steps);
            verify(mount,density,warmup+steps);
            if(labels[0]!==mount.querySelector('p'))throw new Error('Text element identity');
            if((labels[0].firstChild===first)!==(mode==='data'))throw new Error('Text node identity');
            layout(mount);
          }
        }
        results.push({density,flush,content:stats(samples.content),data:stats(samples.data)});
      }
    }
    // Empty -> literal markup -> empty, all with the same text node.
    const special=global.MiraGuiSpecialize.compile(compiler,
      'view: n = {type: "column", children: [{type: "text", text: (if (n % 2 == 0) then "" else "<b>test</b>")}, {type: "button", label: "Next", update: {old | old + 1}}]};','view:');
    global.MiraGuiSpecialize.mount(special,mount,0,error=>{throw new Error(error);},'data');
    const p=mount.querySelector('p'),text=p.firstChild,button=mount.querySelector('button');
    if(!text||text.nodeType!==3||p.textContent!=='')throw new Error('Empty text node');
    button.click();
    if(p.firstChild!==text||p.textContent!=='<b>test</b>'||p.children.length)throw new Error('Literal text safety');
    button.click();
    if(p.firstChild!==text||p.textContent!=='')throw new Error('Empty text identity');
    mount.replaceChildren();
    return {samples:samplesPerCase,steps,results};
  }


  // Real event-loop experiment, intentionally separate from the synchronous
  // benchmark. Each burst is one JS task; no layout read in the burst.
  async function runBatchExperiment(compiler,mount){
    if(!mount.isConnected||document.visibilityState==='hidden')throw new Error('Serve una pagina visibile e collegata');
    const bursts=7,modes=['immediate','microtask','frame'],results=[];
    for(const density of ['sparse','dense']){
      const compiled=global.MiraGuiSpecialize.compile(compiler,source(density),'bench view:');
      for(const events of [1,10]){
        const samples=Object.fromEntries(modes.map(mode=>[mode,{submit:[],first:[],last:[],total:[],commits:0,writes:0}]));
        for(let round=0;round<bursts;round++){
          for(let j=0;j<modes.length;j++){
            const mode=modes[(j+round)%modes.length],sample=samples[mode];
            let committedAt=0,commits=0,writes=0;
            const app=global.MiraGuiSpecialize.mount(compiled,mount,0,
              error=>{throw new Error(error);},'content',{mode,onCommit:n=>{
                committedAt=performance.now();commits++;writes+=n;
              }});
            const button=mount.querySelector('button'),label=mount.querySelector('p');
            // Warm up with one burst, then allow layout to settle outside timer.
            button.click();await app.whenIdle();layout(mount);
            commits=0;writes=0;
            // Separate bursts from the previous microtask/frame.
            await new Promise(resolve=>setTimeout(resolve,0));
            if(document.visibilityState==='hidden')throw new Error('Pagina non visibile durante la misura');
            const start=performance.now();
            let last=start;
            for(let i=0;i<events;i++){last=performance.now();button.click();}
            const submitted=performance.now();
            if(app.getState()!==events+1)throw new Error('Lost transition');
            if(mode!=='immediate'&&label.textContent!=='1')throw new Error('Unexpected early DOM commit');
            await app.whenIdle();
            const end=performance.now();
            verify(mount,density,events+1);
            if(label!==mount.querySelector('p')||commits!==(mode==='immediate'?events:1)||
               writes!==commits*(density==='dense'?rows:1))throw new Error('Batch commit checksum');
            sample.submit.push(submitted-start);
            sample.first.push(Math.max(0,committedAt-start));
            sample.last.push(Math.max(0,committedAt-last));
            sample.total.push(end-start);
            sample.commits+=commits;sample.writes+=writes;
            layout(mount);
          }
        }
        results.push({density,events,modes:Object.fromEntries(modes.map(mode=>{
          const s=samples[mode];return [mode,{submit:stats(s.submit),first:stats(s.first),last:stats(s.last),
            total:stats(s.total),commits:s.commits,writes:s.writes}];
        }))});
      }
    }
    mount.replaceChildren();
    return {ok:true,version:compiler.version,bursts,results};
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
    const hybrid=runHybrid(compiler,mount);
    const textExperiment=runTextExperiment(compiler,mount);
    return {ok:true,rows,updates,rounds,warmup,form,hybrid,textExperiment,version:compiler.version,
      userAgent:navigator.userAgent,results};
  }

  global.MiraGuiBench=Object.freeze({source,run,formSource,formSetup,hybridSource,hybridSetup,runBatchExperiment});
})(globalThis);
