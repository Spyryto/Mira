import {
  benchmarks, benchmarkSource, sourceLines, percentiles, linesPerSecond
} from './benchmark-cases.js';

// All measurements are local to the device. JS executes in a dedicated worker;
// PHP can be transpiled in the browser but cannot be executed there.
const el=(tag,classname,text)=>{
  const n=document.createElement(tag);
  if(classname)n.className=classname;
  if(text!==undefined)n.textContent=String(text);
  return n;
};
const format=(value,digits=2)=>Number.isFinite(value)
  ?value.toLocaleString('it-IT',{maximumFractionDigits:digits,minimumFractionDigits:digits})
  :'—';
const count=value=>Number.isFinite(value)?Math.round(value).toLocaleString('it-IT'):'—';
const runtimeTime=ms=>ms<0.001
  ?format(ms*1000000,1)+' ns':format(ms*1000,3)+' µs';

function compilation(compiler,source,target) {
  for(let i=0;i<5;i++){
    const warmup=compiler.compile(source,target);
    if(!warmup?.ok)throw new Error(warmup?.message??'Compilazione fallita');
  }
  const samples=[];
  let generated;
  for(let i=0;i<25;i++){
    const start=performance.now();
    const compiled=compiler.compile(source,target);
    const elapsed=performance.now()-start;
    if(!compiled?.ok)throw new Error(compiled?.message??'Compilazione fallita');
    samples.push(elapsed);
    generated=compiled.output;
  }
  return {...percentiles(samples),generated,samples:samples.length};
}

function runtime(code, expected, id) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker('./benchmark-worker.js');
    const deadline=setTimeout(()=>{
      worker.terminate();
      reject(new Error('Timeout del benchmark runtime'));
    },25000);
    const done=(error,result)=>{
      clearTimeout(deadline);
      worker.terminate();
      error?reject(error):resolve(result);
    };
    worker.onmessage=event=>{
      const message=event.data;
      if(message?.id!==id || !message?.ok) {
        done(new Error(message?.message??'Risposta del worker non valida'));
      }else done(null,message);
    };
    worker.onerror=()=>done(new Error('Errore nel worker di esecuzione'));
    worker.postMessage({code,expected,id});
  });
}

function metric(label,value,unit,small=false) {
  const box=el('div','bench-metric'+(small?' bench-metric-small':''));
  box.append(el('span','bench-metric-label',label));
  const number=el('strong','bench-metric-value',value);
  if(unit)number.append(el('small','',unit));
  box.append(number);
  return box;
}

export function mountBenchmark(root,compiler) {
  const header=el('header','bench-header');
  const marker=el('span','bench-eyebrow','PERFORMANCE LAB · MIRA 0.4');
  const title=el('h2','', 'Quanto corre Mira?');
  const description=el('p','','Misura compilazione ed esecuzione direttamente su questo dispositivo.');
  const actions=el('div','bench-actions');
  const runButton=el('button','bench-run','▶ Avvia benchmark');
  runButton.type='button';
  const fullButton=el('button','bench-expand','⛶ Schermo intero');
  fullButton.type='button';
  fullButton.setAttribute('aria-pressed','false');
  fullButton.setAttribute('aria-label','Espandi il benchmark a schermo intero');
  actions.append(runButton,fullButton);
  header.append(marker,title,description,actions);

  const status=el('p','bench-status','Pronto. Tre programmi Mira: 5, 50 e 100 passi.');
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  const highlights=el('div','bench-highlights');
  highlights.append(
    metric('Compilazione JS','—','righe/s'),
    metric('Compilazione PHP','—','righe/s'),
    metric('Esecuzione JS','—','esecuzioni/s')
  );
  const grid=el('div','bench-grid');
  const note=el('p','bench-note',
    'Compilazione: 5 warmup + 25 misure, frontend Haxe già caricato (lexer → emitter), senza I/O. '+
    'Righe/s: righe fisiche non vuote e non commentate ÷ tempo mediano. '+
    'Esecuzione: funzione Mira run: con ingressi variabili e checksum nel Worker, esclusa la compilazione JavaScript. '+
    'PHP si compila sul dispositivo, ma l’esecuzione PHP viene misurata nella CI, non nel browser.');
  const ci=el('a','bench-ci','Benchmark JS/PHP della CI ↗');
  ci.href='https://github.com/Spyryto/Mira/actions/workflows/ci.yml';
  ci.target='_blank';ci.rel='noopener noreferrer';
  root.replaceChildren(header,status,highlights,grid,note,ci);

  function toggleFullscreen(force) {
    const open=typeof force==='boolean'?force:!root.classList.contains('bench-fullscreen');
    root.classList.toggle('bench-fullscreen',open);
    document.body.classList.toggle('bench-fullscreen-open',open);
    fullButton.setAttribute('aria-pressed',String(open));
    fullButton.textContent=open?'✕ Chiudi schermo intero':'⛶ Schermo intero';
    fullButton.setAttribute('aria-label',open?'Chiudi il benchmark a schermo intero':
      'Espandi il benchmark a schermo intero');
    if(open)fullButton.focus();
  }
  fullButton.addEventListener('click',()=>toggleFullscreen());
  const onKey=event=>{
    if(event.key==='Escape' && root.classList.contains('bench-fullscreen')){
      toggleFullscreen(false);
    }
  };
  document.addEventListener('keydown',onKey);

  function resultCard(workload,rows,lines) {
    const panel=el('article','bench-result-card');
    const head=el('div','bench-card-head');
    head.append(el('strong','',workload.label),el('span','',lines+' righe Mira'));
    panel.append(head);
    const table=el('div','bench-result-table');
    for(const [label,value,extra] of rows) {
      const row=el('div','bench-result-row');
      row.append(el('span','',label),el('strong','',value),el('small','',extra));
      table.append(row);
    }
    panel.append(table);
    return panel;
  }

  let running=false;
  async function run() {
    if(running)return;
    running=true;runButton.disabled=true;
    runButton.textContent='Misurazione…';
    grid.replaceChildren();
    highlights.replaceChildren(
      metric('Compilazione JS','—','righe/s'),
      metric('Compilazione PHP','—','righe/s'),
      metric('Esecuzione JS','—','esecuzioni/s')
    );
    const measured=[];
    try {
      for(const workload of benchmarks) {
        status.textContent='Misuro '+workload.label+'…';
        // Allow the UI to paint before synchronous compilation batches.
        await new Promise(resolve=>setTimeout(resolve,0));
        const source=benchmarkSource(workload.steps);
        const lines=sourceLines(source);
        const js=compilation(compiler,source,'js');
        const php=compilation(compiler,source,'php');
        const executed=await runtime(js.generated,7+workload.steps,workload.id);
        const row={id:workload.id,lines,js,php,executed};
        measured.push(row);
        grid.append(resultCard(workload,[
          ['JS · compilazione',format(js.medianMs,3)+' ms',
            count(linesPerSecond(lines,js.medianMs))+' righe/s'],
          ['PHP · compilazione',format(php.medianMs,3)+' ms',
            count(linesPerSecond(lines,php.medianMs))+' righe/s'],
          ['JS · esecuzione',runtimeTime(executed.medianMs),
            count(executed.operationsPerSecond)+' esecuzioni/s']
        ],lines));
      }
      const middle=measured[1];
      highlights.replaceChildren(
        metric('Compilazione JS',count(linesPerSecond(middle.lines,middle.js.medianMs)),'righe/s'),
        metric('Compilazione PHP',count(linesPerSecond(middle.lines,middle.php.medianMs)),'righe/s'),
        metric('Esecuzione JS',count(middle.executed.operationsPerSecond),'esecuzioni/s')
      );
      status.textContent='Misure completate sul dispositivo · mediana · 25 compilazioni, 21 campioni di esecuzione.';
    } catch(error) {
      status.textContent='Benchmark interrotto: '+String(error?.message??error);
    } finally {
      running=false;runButton.disabled=false;runButton.textContent='↻ Ripeti benchmark';
    }
  }
  runButton.addEventListener('click',run);
  return {run,toggleFullscreen,dispose:()=>{
    document.removeEventListener('keydown',onKey);
    toggleFullscreen(false);
  }};
}
