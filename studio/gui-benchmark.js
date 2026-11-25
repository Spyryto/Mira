// A bounded browser benchmark, using the real compiler and DOM host.
// No framework, dependencies, network, or benchmark-specific renderer path.
(function(global) {
  'use strict';
  const rows = 100, updates = 30, rounds = 5, warmup = 5;
  const strategies = ['incremental','rebuild','specialized','direct'];
  const cases = ['sparse','dense'];
  const stats = samples => {
    const sorted = [...samples].sort((a,b)=>a-b);
    return {medianMs: sorted[Math.floor(sorted.length/2)], p95Ms: sorted[Math.ceil(sorted.length*.95)-1]};
  };

  function source(density) {
    if (!cases.includes(density)) throw new Error('Unknown workload');
    const labels = Array.from({length:rows},(_,i)=>{
      const value = density === 'dense' || i === 0 ? '(n + '+i+')' : String(i);
      return '  {type: "styled", view: {type: "text", text: '+value+'}, styles: [{padding: 4}]}';
    });
    return 'advance: n = n + 1;\nbench view: n = {type: "column", children: [\n'+
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
    let n=0;
    const button=doc.createElement('button');button.className='mira-ui-button';
    button.type='button';button.textContent='Next';
    button.addEventListener('click',()=>{
      n=program.advance(n);
      const count=density==='dense'?rows:1;
      for(let i=0;i<count;i++) labels[i].textContent=String(n+i);
    });
    column.append(button);section.append(column);mount.replaceChildren(section);
    return ()=>button.click();
  }

  function setup(mount,density,program,strategy,specialized) {
    if(strategy==='specialized'){
      global.MiraGuiSpecialize.mount(specialized,mount,0);
      const button=mount.querySelector('button');
      return ()=>button.click();
    }
    if(strategy==='direct') return nativeMount(mount,density,program);
    const host=global.MiraUiHost.createUiHost(mount.ownerDocument,mount,error=>{throw new Error(error);});
    const initial=n=>({type:'state',initial:n,view:program.view});
    host.render(initial(0));
    if(strategy==='incremental'){
      const button=mount.querySelector('button');
      return ()=>button.click();
    }
    // Explicit full render of the identical Mira view after the same
    // compiled transition. No incremental state update in this baseline.
    let n=0;
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
      for(let i=0;i<warmup;i++)program.view(i);
      const start=performance.now();
      for(let i=1;i<=updates;i++){
        const view=program.view(i);
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
    return {ok:true,rows,updates,rounds,warmup,version:compiler.version,
      userAgent:navigator.userAgent,results};
  }

  global.MiraGuiBench=Object.freeze({source,run});
})(globalThis);
