// Fixed code inside a sandboxed iframe. All execution, including the
// experimental optimizer's generated functions, stays inside the iframe.
(function () {
  'use strict';
  const root = document.getElementById('mira-root');
  const errors = document.getElementById('errors');
  const heading = document.getElementById('renderer-status');
  const inspector = document.getElementById('renderer-plan');
  const notify = (kind, message) => window.parent.postMessage({
    type: 'mira-ui:' + kind, message
  }, '*');
  const now=()=>performance.now();
  const ms=value=>Number.isFinite(value)?value.toFixed(3)+' ms':'—';
  function inspect(plan,planningMs,mountMs) {
    const info=globalThis.MiraGuiSpecialize.describe(plan);
    const names={generic:'Generico',specialized:'Specializzato',hybrid:'Ibrido'};
    heading.textContent='Renderer: '+names[info.mode];
    const lines=['Analisi e preparazione: '+ms(planningMs),'Montaggio: '+ms(mountMs)];
    if(info.selector)lines.push('View: '+info.selector);
    if(info.reason)lines.push('Motivo: '+info.reason);
    for(const region of info.regions){
      lines.push('', '├ '+(region.path.length?region.path.map(i=>i+1).join('.'):'radice')+
        ' · '+region.selector+' · '+names[region.mode]);
      if(region.reason)lines.push('  '+region.reason);
      if(Number.isInteger(region.expandedCalls))lines.push('  Chiamate espanse: '+region.expandedCalls);
      lines.push('  Slot dinamici: '+region.slots.length);
      for(const slot of region.slots){
        lines.push('  └ '+(slot.path.length?slot.path.map(i=>i+1).join('.'):'radice')+
          ' · '+slot.kind+' · '+slot.source);
      }
    }
    inspector.textContent=lines.join('\n');
  }
  function run(message) {
    root.replaceChildren();
    errors.textContent = '';
    heading.textContent='Renderer: preparazione';
    inspector.textContent='';
    const report = message => {
      errors.textContent = message;
      notify('error', message);
    };
    const ordinary=globalThis.MiraUiHost.createUiHost(document,root,report);
    const host=Object.assign(Object.create(null),ordinary);
    host.log = message => notify('log', String(message));
    const started=now();
    let plan={mode:'generic',regions:[],reason:'Modalità generica selezionata.'};
    if(message.mode!=='generic'){
      if(typeof message.source==='string'&&message.source.length<=200000&&globalThis.MiraStudioCompiler)
        plan=globalThis.MiraGuiSpecialize.previewPlan(globalThis.MiraStudioCompiler,message.source,message.hostJson);
      else plan.reason='Sorgente o compilatore non disponibile.';
    }
    const planningMs=now()-started;
    let mountMs=0;
    let rendered=false;
    host.render=spec=>{
      const time=now();
      // The original program evaluates the initial state and calls render
      // exactly once for eligible sources. Never retry a failing mount.
      if(plan.mode!=='generic'&&!rendered&&spec?.type==='state'){
        globalThis.MiraGuiSpecialize.mountAuto(plan,root,spec.initial,report);
      }else{
        if(plan.mode!=='generic')plan={mode:'generic',regions:[],reason:'Forma effettiva del render non riconosciuta.'};
        ordinary.render(spec);
      }
      rendered=true;
      mountMs+=now()-time;
      inspect(plan,planningMs,mountMs);
      return spec;
    };
    try {
      new Function('__miraHost', '"use strict";\n' + message.code)(Object.freeze(host));
      if(!rendered)inspect(plan,planningMs,0);
      notify('ready', 'Anteprima UI avviata');
    } catch (error) {
      report(String(error?.message ?? error));
    }
  }

  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.type !== 'mira-ui:run'
        || typeof event.data.code !== 'string') return;
    run(event.data);
  });
  notify('loaded', 'Host UI pronto');
})();
