import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, 'dist/studio');
const data = JSON.parse(readFileSync(resolve(root, 'catalog/laboratory/gui-rendering.json'), 'utf8'));
const methods = [['rebuild','Ricostruzione'],['incremental','Incrementale'],['specialized','Specializzato'],['direct','DOM diretto']];
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => value.toLocaleString('it-IT', { maximumFractionDigits: 2 });
if (data.schema !== 2 || data.unit !== 'µs' || data.cases.length !== 2 ||
    data.cases.some(c => methods.some(([key]) => !Number.isFinite(c.values[key]) || c.values[key] < 0)
      || Math.max(...methods.map(([key]) => c.values[key])) <= 0)) throw new Error('Invalid laboratory dataset');

function chart(c) {
  const max = Math.max(...methods.map(([key]) => c.values[key]));
  return '<section class="lab-card"><h2>'+escape(c.label)+'</h2><dl class="lab-chart">'+methods.map(([key,label]) =>
    '<div class="lab-row"><dt>'+escape(label)+'</dt><dd>'+number(c.values[key])+' µs</dd>'+
    '<div class="lab-track" aria-hidden="true"><svg viewBox="0 0 100 8" preserveAspectRatio="none" focusable="false"><rect class="lab-bar '+key+'" width="'+(100*c.values[key]/max).toFixed(3)+'" height="8"/></svg></div></div>'
  ).join('')+'</dl><p class="lab-note">Ricostruzione / specializzato: '+number(c.values.rebuild/c.values.specialized)+'× (dai valori riportati).</p></section>';
}
// Complete archive: no execution or network access needed to read the report.
const allMethods = [['view','Solo view Mira'],...methods,['hybrid','Ibrido'],['content','textContent'],['data','Text.data']];
const scenario = c => (c.content?'Text node · '+(c.density==='sparse'?'1 su 100':'100 su 100'):c.hybrid?'Rendering ibrido':c.density==='sparse'?'1 su 100':c.density==='dense'?'100 su 100':c.density==='styled'?'Record e stile dinamico':'Form reattivo')+
  ' · '+(c.flush?'layout forzato':'scritture sincrone');
const time = v => v.toLocaleString('it-IT',{minimumFractionDigits:3,maximumFractionDigits:3});
function validMetric(m) {
  return m && Number.isFinite(m.medianMs) && m.medianMs>=0 && Number.isFinite(m.p95Ms) && m.p95Ms>=m.medianMs;
}
function validateRows(rows,keys) {
  if(!Array.isArray(rows)||!rows.length||rows.some(row=>typeof row.flush!=='boolean'||keys.some(k=>!validMetric(row[k]))))
    throw new Error('Invalid archived benchmark metrics');
}
if(data.ci.length<9||data.devices.length!==2||data.timeline.length<11)throw new Error('Incomplete GUI archive');
for(const run of data.ci){
  if(run.browser){
    if(run.version!==run.browser.version)throw new Error('Version mismatch');
    validateRows(run.browser.results,run.version==='0.18.0'?['view','rebuild','incremental','direct']:['view','rebuild','incremental','specialized','direct']);
    if(run.browser.form)validateRows(run.browser.form,['incremental','specialized']);
    if(run.browser.hybrid)validateRows(run.browser.hybrid,['incremental','hybrid']);
    if(run.browser.textExperiment)validateRows(run.browser.textExperiment.results,['content','data']);
  }
}
for(const run of data.devices)validateRows(run.results,['view','rebuild','incremental','specialized','direct']);
function table(row){
  return '<div class="lab-table-wrap"><table class="lab-table"><caption>'+escape(scenario(row))+'</caption><thead><tr><th scope="col">Metodo</th><th scope="col">Mediana ms</th><th scope="col">P95 ms</th></tr></thead><tbody>'+
    allMethods.filter(([key])=>row[key]).map(([key,label])=>'<tr><th scope="row">'+escape(label)+'</th><td>'+time(row[key].medianMs)+'</td><td>'+time(row[key].p95Ms)+'</td></tr>').join('')+
    '</tbody></table></div>';
}
function archivedChart(row,title){
  const entries=allMethods.filter(([key])=>key!=='view'&&row[key]);
  const max=Math.max(...entries.map(([key])=>row[key].medianMs));
  return '<section class="lab-card"><h3>'+escape(title)+'</h3><dl class="lab-chart">'+entries.map(([key,label])=>
    '<div class="lab-row"><dt>'+escape(label)+'</dt><dd>'+time(row[key].medianMs)+' ms</dd><div class="lab-track" aria-hidden="true"><svg viewBox="0 0 100 8" preserveAspectRatio="none" focusable="false"><rect class="lab-bar '+key+'" width="'+(max?100*row[key].medianMs/max:0).toFixed(3)+'" height="8"/></svg></div></div>'
  ).join('')+'</dl></section>';
}
function ciReport(run){
  const rows=run.browser?[...run.browser.results,...(run.browser.form??[]),...(run.browser.hybrid??[]),...(run.browser.textExperiment?.results??[])]:[];
  const s=run.synthetic;
  return '<details class="lab-card"><summary><strong>Mira '+escape(run.version)+'</strong> · CI · '+rows.length+' scenari browser</summary>'+
    '<p>25 novembre 2026 · '+run.studioTests+' test Studio · '+run.documentedChecks+' verifiche degli esempi · <a href="'+escape(run.source)+'">Log del job '+run.jobId+'</a> · <a href="https://github.com/Spyryto/Mira/pull/'+run.pr+'">PR #'+run.pr+'</a></p>'+
    (s?'<p>DOM simulato: '+s.updates+' aggiornamenti, '+s.viewNodes+' elementi; allocazioni '+s.full+' → '+s.incremental+', scritture CSS '+s.fullStyleWrites+' → '+s.incrementalStyleWrites+'. Tempo totale ricostruzione '+time(s.fullMs)+' ms; incrementale '+time(s.incrementalMs)+' ms.</p>':'')+
    rows.map(table).join('')+'</details>';
}

function batchReport(run){
  if(!run.batch)return '';
  const keys=['immediate','microtask','frame'];
  return '<section class="lab-card"><h3>Raggruppamento · '+escape(run.version)+'</h3><p>'+run.batch.bursts+' raffiche per strategia, conteggi totali. Mediana/P95 in ms per raffica; non paint.</p>'+
    run.batch.results.map(row=>'<div class="lab-table-wrap"><table class="lab-table"><caption>'+escape(row.density==='sparse'?'Sparso':'Denso')+' · '+row.events+' eventi</caption><thead><tr><th>Metodo</th><th>Commit</th><th>Scritture</th><th>Primo→commit</th><th>P95</th><th>Ultimo→commit</th><th>P95</th><th>Invio</th><th>P95</th><th>Totale</th><th>P95</th></tr></thead><tbody>'+
      keys.map(key=>{const m=row.modes[key];return '<tr><th>'+escape(key)+'</th><td>'+m.commits+'</td><td>'+m.writes+'</td>'+['first','last','submit','total'].map(k=>'<td>'+time(m[k].medianMs)+'</td><td>'+time(m[k].p95Ms)+'</td>').join('')+'</tr>';}).join('')+
    '</tbody></table></div>').join('')+'</section>';
}

function containmentReport(run){
  if(!run.containment)return '';
  const c=run.containment;
  return '<section class="lab-card"><h3>CSS containment · '+escape(run.version)+'</h3><p>'+c.panels+' pannelli × '+c.rows+' testi; '+c.samples+' campioni da '+c.steps+' aggiornamenti. Mediana/P95 in ms, reveal = scroll e lettura geometrica, non paint.</p>'+
    c.results.map(row=>'<div class="lab-table-wrap"><table class="lab-table"><caption>'+escape(row.workload==='all'?'Tutti i testi':'Pannello lontano')+'</caption><thead><tr><th>CSS</th><th>Update</th><th>P95</th><th>Reveal</th><th>P95</th><th>Skip</th></tr></thead><tbody>'+
      Object.entries(row.modes).map(([key,m])=>'<tr><th>'+escape(key)+'</th><td>'+time(m.update.medianMs)+'</td><td>'+time(m.update.p95Ms)+'</td><td>'+time(m.reveal.medianMs)+'</td><td>'+time(m.reveal.p95Ms)+'</td><td>'+escape(m.skippedSamples??'n/d')+'</td></tr>').join('')+
      '</tbody></table></div>').join('')+'</section>';
}
const latest=data.ci.find(run=>run.version==='0.22.0');
const synthetic=data.ci[0].synthetic;
const arch=[
 ['Sorgente','Selettori Mira e record; nessuna sintassi GUI speciale.'],
 ['AST risolto','Espansione conservativa dei componenti con ambiente lessicale.'],
 ['Slot dinamici','Testi, stili e valori controllati; il compilatore ordinario emette le espressioni e le transizioni.'],
 ['Montaggio','Renderer generico: validazione, creazione dei nodi e collegamento degli eventi.'],
 ['Aggiornamento','Transizione immutabile → validazione degli slot → patch DOM, senza attraversare la view.']
];
const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#f4f0e6"><title>Mira Studio · Laboratory</title><link rel="stylesheet" href="./styles.css"><link rel="icon" href="./icon.svg"><style>.lab-table-wrap{overflow-x:auto;margin:1rem 0}.lab-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:.9rem}.lab-table caption{text-align:left;font-weight:700;padding:.5rem 0}.lab-table th,.lab-table td{padding:.5rem .25rem;border-bottom:1px solid #8885;text-align:right}.lab-table th:first-child{text-align:left}.lab-card summary{cursor:pointer;font-weight:600}.lab-page h2{margin-top:1.2rem}.lab-page nav{display:flex;gap:.7rem;flex-wrap:wrap}.lab-flow{padding-left:1.5rem}.lab-flow li{margin:.75rem 0}</style></head>
<body><main class="app lab-page">
<header class="masthead"><a href="./">← Mira Studio</a><span class="connection">Archivio sperimentale</span></header>
<p class="eyebrow">LABORATORY / GUI / 001–014</p>
<h1>${escape(data.title)}</h1>
<p>${escape(data.environment)} · ${data.rows} elementi · ${escape(data.workload)}</p>
<p>Archivio 0.15–0.28. Dati CI recuperati dai log, misure dell'autore su iPhone e smart TV, architettura e prossimi esperimenti. Tempi per aggiornamento: meno è meglio.</p>
<nav aria-label="Indice"><a href="#evolution">Evoluzione</a><a href="#architecture">Architettura</a><a href="#devices">Dispositivi</a><a href="#ci">Archivio CI</a><a href="#roadmap">Roadmap</a></nav>
<input id="lab-render-normal" class="lab-render-toggle" type="checkbox"><label class="lab-render-label" for="lab-render-normal">Layout ordinario (disattiva il rendering differito)</label>
<p class="lab-render-label lab-note">Esperimento 0.29: le schede lontane possono differire il layout; il browser ricorda l'altezza reale dopo la prima visualizzazione. Il primo salto può cambiare la stima dello scroll. I dettagli e le ancore restano ordinari. Browser senza supporto: layout normale.</p>
<h2>Il punto di svolta · Mira 0.19</h2><p>Quattro strategie a confronto, caso sparso in Chromium CI. Il rapporto introduttivo conserva i valori arrotondati originali.</p>
${data.cases.map(chart).join('')}
<section class="lab-card"><h2>Che cosa emerge?</h2><p>In entrambi i casi il rendering specializzato e il DOM diretto hanno gli stessi tempi riportati. Non dimostra un overhead esattamente nullo: una differenza può essere inferiore alla risoluzione della misura.</p><p>Forzare una lettura geometrica include lavoro di layout del browser. Senza layout forzato non si misura il costo completo del frame. Non sono misure di FPS, paint o memoria.</p></section>
<h2 id="evolution">Evoluzione 0.15–0.28</h2>
${data.timeline.map(item=>'<section class="lab-card"><h3>'+escape(item.version)+' · '+escape(item.title)+'</h3><p>'+escape(item.detail)+'</p><a href="https://github.com/Spyryto/Mira/pull/'+item.pr+'">PR #'+item.pr+'</a></section>').join('')}
<section class="lab-card lab-always"><h2 id="architecture">Architettura</h2><ol class="lab-flow">${arch.map(([title,description])=>'<li><strong>'+escape(title)+'</strong> — '+escape(description)+'</li>').join('')}</ol><p>Il renderer generico mantiene identità posizionale e stato annidato; il renderer automatico nella 0.25 sceglie specializzato, ibrido o generico per i render finali riconoscibili. PHP compila i costruttori e le transizioni, ma il DOM è JavaScript. Le view con ricorsione, catture, struttura dinamica, stato annidato o opzioni dinamiche non sono ancora specializzate.</p></section>
<section class="lab-card"><h2>0.17 · Allocazioni e CSS</h2><p>DOM simulato: ${synthetic.updates} aggiornamenti, ${synthetic.viewNodes} elementi.</p><table class="lab-table"><thead><tr><th>Metrica</th><th>Ricostruzione</th><th>Incrementale</th></tr></thead><tbody><tr><th>Elementi allocati</th><td>${synthetic.full}</td><td>${synthetic.incremental}</td></tr><tr><th>Scritture CSS</th><td>${synthetic.fullStyleWrites}</td><td>${synthetic.incrementalStyleWrites}</td></tr><tr><th>Tempo totale ms</th><td>${time(synthetic.fullMs)}</td><td>${time(synthetic.incrementalMs)}</td></tr></tbody></table><p>Il costo dell'algoritmo può superare quello del DOM simulato: non è una misura di layout reale.</p></section>
<h2 id="devices">0.19 · Dispositivi reali</h2>
<p>Risultati forniti dall'autore: solo i due scenari densi visibili nelle immagini. Modelli e browser non documentati. Nessuna interpolazione dei dati mancanti.</p>
${data.devices.map(run=>'<h3>'+escape(run.device)+'</h3>'+run.results.map(row=>archivedChart(row,scenario(row))).join('')+'<details class="lab-card"><summary>Mediane, P95 e provenienza</summary>'+run.results.map(table).join('')+'<p>'+escape(run.source)+'</p></details>').join('')}
<section class="lab-card"><h3>Cosa ci dice la TV?</h3><p>Scritture sincrone: 3,130 ms specializzato contro 2,713 ms diretto (+15,4%). Con layout forzato: 26,290 contro 25,967 ms (+1,24%). Su iPhone: 0,033 ms per entrambi senza layout; 1,233 contro 1,267 ms con layout. Le piccole differenze non dimostrano superiorità statistica. Il layout forzato sulla TV supera il budget teorico di 16,7 ms a 60 Hz già nel DOM diretto: non è una misura FPS.</p></section>
<h2>0.22 · Form con componenti reali</h2>
${latest.browser.form.map(row=>archivedChart(row,scenario(row))).join('')}
<p>Il form usa lib/gui.mira e selettori riutilizzabili. Nella CI 0.22, circa 6× più veloce dell'incrementale senza layout forzato; 1,33× con layout. Espansione e montaggio non sono inclusi.</p>
<h2>0.23–0.25 · Rendering ibrido</h2>
${data.ci.filter(run=>run.browser?.hybrid&&['0.23.0','0.24.0','0.25.0'].includes(run.version)).map(run=>'<h3>Mira '+escape(run.version)+'</h3>'+run.browser.hybrid.map(row=>archivedChart(row,scenario(row))).join('')).join('')}
<p>Una regione di 100 testi, uno dinamico, e un ramo generico che alterna titolo/paragrafo. Unico modello radice. La 0.24 riconosce il confine automaticamente; la 0.25 aggiunge l'ispettore nell'anteprima. Il costo di preparazione non è incluso nei tempi qui riportati.</p>
<h2>0.26–0.27 · Text node persistenti</h2>
${data.ci.filter(run=>run.browser?.textExperiment).map(run=>'<h3>Mira '+escape(run.version)+'</h3>'+run.browser.textExperiment.results.map(row=>archivedChart(row,scenario(row))).join('')).join('')}
<p>9 campioni da 120 aggiornamenti; stesso renderer specializzato, nessuna adozione predefinita.</p>
<h2>0.27 · Raggruppamento</h2>
${data.ci.filter(run=>run.version==='0.27.0'||run.version==='0.28.0').map(batchReport).join('')}
<p>Nel caso denso da dieci eventi, i commit accorpati riducono del 90% le scritture DOM. Microtask completa la raffica prima di rAF in questo esperimento; non sono eventi umani distribuiti nel tempo.</p>
<h2>0.28 · CSS containment</h2>
${data.ci.map(containmentReport).join('')}
<p>Le scatole del benchmark avevano altezza fissa; la stima di altezza variabile nella pagina reale è un esperimento distinto.</p>
<h2 id="ci">Archivio completo CI · 0.17–0.28</h2><p>Espandi ciascuna versione per tutte le mediane, i P95, i log e le misure sintetiche. Un valore 0,000 indica il limite del timer, non costo nullo. Non confrontare versioni diverse come una regressione controllata.</p>
${data.ci.map(ciReport).join('')}
<section class="lab-card"><h2>Metodo e limiti</h2><p>5 campioni da 30 aggiornamenti, 5 warmup per campione. Mediana e P95 delle medie per campione; con cinque campioni P95 coincide con il massimo. La sola view è misurata separatamente, non è additiva ai tempi DOM. La lettura geometrica forza layout, non paint. Compilazione, espansione e montaggio sono esclusi. Gli eventi del form sono sintetici; IME simulato, focus verificato in Chromium. Nessuna misura di memoria o frame rate. I risultati non sono soglie di CI.</p></section>
<h2 id="roadmap">Roadmap · proposte, non implementazioni</h2>
${data.roadmap.map(item=>'<section class="lab-card"><h3>'+escape(item.title)+'</h3><p><strong>'+escape(item.status)+'</strong> — '+escape(item.detail)+'</p></section>').join('')}
<section class="lab-card"><h2>Riproduci l'esperimento</h2><p>Il benchmark attuale usa il compilatore e il DOM reale del dispositivo. I nuovi risultati sono distinti dal rapporto storico.</p><p><a class="lab-link" href="./gui-benchmark.html">Apri il benchmark GUI →</a></p><p><a href="./lab-gui-rendering.json">Archivio completo dei risultati (JSON)</a></p><p class="lab-note">${escape(data.source)} I numeri non sono stati rieseguiti per questa pubblicazione. I rapporti CI sono conservati come output strutturati, i dispositivi come trascrizioni.</p></section>
<footer class="footer"><a href="./">Mira Studio</a><span>Rapporto statico · nessun compilatore caricato</span></footer>
</main></body></html>\n`;
mkdirSync(destination,{recursive:true});
writeFileSync(resolve(destination,'laboratory.html'),html);
writeFileSync(resolve(destination,'lab-gui-rendering.json'),JSON.stringify(data,null,2)+'\n');
console.log('Laboratory static report generated');
