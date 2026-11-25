import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, 'dist/studio');
const data = JSON.parse(readFileSync(resolve(root, 'catalog/laboratory/gui-rendering.json'), 'utf8'));
const methods = [['rebuild','Ricostruzione'],['incremental','Incrementale'],['specialized','Specializzato'],['direct','DOM diretto']];
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => value.toLocaleString('it-IT', { maximumFractionDigits: 2 });
if (data.schema !== 1 || data.unit !== 'µs' || data.cases.length !== 2 ||
    data.cases.some(c => methods.some(([key]) => !Number.isFinite(c.values[key]) || c.values[key] < 0)
      || Math.max(...methods.map(([key]) => c.values[key])) <= 0)) throw new Error('Invalid laboratory dataset');

function chart(c) {
  const max = Math.max(...methods.map(([key]) => c.values[key]));
  return '<section class="lab-card"><h2>'+escape(c.label)+'</h2><dl class="lab-chart">'+methods.map(([key,label]) =>
    '<div class="lab-row"><dt>'+escape(label)+'</dt><dd>'+number(c.values[key])+' µs</dd>'+
    '<div class="lab-track" aria-hidden="true"><svg viewBox="0 0 100 8" preserveAspectRatio="none" focusable="false"><rect class="lab-bar '+key+'" width="'+(100*c.values[key]/max).toFixed(3)+'" height="8"/></svg></div></div>'
  ).join('')+'</dl><p class="lab-note">Ricostruzione / specializzato: '+number(c.values.rebuild/c.values.specialized)+'× (dai valori riportati).</p></section>';
}
const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#f4f0e6"><title>Mira Studio · Laboratory</title><link rel="stylesheet" href="./styles.css"><link rel="icon" href="./icon.svg"></head>
<body><main class="app lab-page">
<header class="masthead"><a href="./">← Mira Studio</a><span class="connection">Archivio sperimentale</span></header>
<p class="eyebrow">LABORATORY / GUI / 001</p>
<h1>${escape(data.title)}</h1>
<p>${escape(data.environment)} · ${data.rows} elementi · ${escape(data.workload)}</p>
<p>Quattro strategie a confronto. Tempi riportati per aggiornamento: meno è meglio.</p>
${data.cases.map(chart).join('')}
<section class="lab-card"><h2>Che cosa emerge?</h2><p>In entrambi i casi il rendering specializzato e il DOM diretto hanno gli stessi tempi riportati. Non dimostra un overhead esattamente nullo: una differenza può essere inferiore alla risoluzione della misura.</p><p>Forzare una lettura geometrica include lavoro di layout del browser. Senza layout forzato non si misura il costo completo del frame. Non sono misure di FPS, paint o memoria.</p></section>
<section class="lab-card"><h2>Riproduci l'esperimento</h2><p>Il benchmark attuale usa il compilatore e il DOM reale del dispositivo. I nuovi risultati sono distinti dal rapporto storico.</p><p><a class="lab-link" href="./gui-benchmark.html">Apri il benchmark GUI →</a></p><p><a href="./lab-gui-rendering.json">Dati originali trascritti (JSON)</a></p><p class="lab-note">${escape(data.source)} I numeri non sono stati rieseguiti per questa pubblicazione.</p></section>
<footer class="footer"><a href="./">Mira Studio</a><span>Rapporto statico · nessun compilatore caricato</span></footer>
</main></body></html>\n`;
mkdirSync(destination,{recursive:true});
writeFileSync(resolve(destination,'laboratory.html'),html);
writeFileSync(resolve(destination,'lab-gui-rendering.json'),JSON.stringify(data,null,2)+'\n');
console.log('Laboratory static report generated');
