import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(readFileSync(join(root, 'catalog/documentation-origin.json'), 'utf8'));
const reportPath = 'docs/documentation-origin.md';
const checking = process.argv.includes('--check');
const categories = ['tool_generated', 'ai_assisted', 'human_declared', 'unverified'];
const labels = {
  tool_generated: 'Generata automaticamente dal tooling',
  ai_assisted: 'Redatta con assistenza IA (dichiarata)',
  human_declared: 'Redazione umana dichiarata',
  unverified: 'Provenienza non verificata'
};
const read = path => readFileSync(join(root, path), 'utf8');

function docsIn(folder) {
  const paths = [];
  for (const entry of readdirSync(folder, {withFileTypes: true})) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) paths.push(...docsIn(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) {
      paths.push(relative(root, path).replaceAll('\\', '/'));
    }
  }
  return paths;
}

if (config.schemaVersion !== 1 || !config.excluded.includes(reportPath)) {
  throw new Error('Origin manifest must exclude its own generated report');
}
const markdownPaths = ['README.md', ...docsIn(join(root, 'docs'))]
  .filter(path => !config.excluded.includes(path)).sort();
const undeclared = markdownPaths.filter(path => !(path in config.files));
const removed = Object.keys(config.files).filter(path => !markdownPaths.includes(path));
if (undeclared.length || removed.length) {
  throw new Error('Documentation provenance declaration is incomplete: ' +
    JSON.stringify({undeclared, removed}));
}

function metrics(text) {
  // Includes words in code samples; markup punctuation itself is not a word.
  const words = text.match(/[\p{L}\p{N}]+(?:[-'_’][\p{L}\p{N}]+)*/gu) ?? [];
  return {words: words.length, bytes: Buffer.byteLength(text, 'utf8')};
}
const parts = [];
function add(path, portion, kind, text, generator) {
  parts.push({path, portion, kind, generator, ...metrics(text)});
}

for (const path of markdownPaths) {
  const entry = config.files[path];
  if (!categories.includes(entry.kind) || typeof entry.note !== 'string') {
    throw new Error('Invalid origin declaration for ' + path);
  }
  if (entry.kind === 'tool_generated' &&
      (!entry.generator || !existsSync(join(root, entry.generator)))) {
    throw new Error('Missing generator for ' + path);
  }
  const text = read(path);
  const blocks = config.generatedSections?.[path] ?? [];
  if (blocks.length === 0) {
    add(path, 'Intero documento', entry.kind, text, entry.generator ?? null);
    continue;
  }
  if (entry.kind === 'tool_generated') throw new Error('Overlapping generated file: ' + path);
  let editorial = '';
  let cursor = 0;
  for (const block of blocks) {
    const start = text.indexOf(block.start, cursor);
    if (start < 0 || text.indexOf(block.start, start + block.start.length) >= 0) {
      throw new Error('Missing or duplicated generated section start in ' + path);
    }
    const inside = start + block.start.length;
    const end = text.indexOf(block.end, inside);
    if (end < 0 || text.indexOf(block.end, end + block.end.length) >= 0 ||
        !existsSync(join(root, block.generator))) {
      throw new Error('Missing or duplicated generated section end in ' + path);
    }
    editorial += text.slice(cursor, start);
    add(path, 'Sezione generata', 'tool_generated',
      text.slice(inside, end), block.generator);
    cursor = end + block.end.length;
  }
  editorial += text.slice(cursor);
  add(path, 'Resto del documento', entry.kind, editorial, null);
}

const total = parts.reduce((sum, p) => sum + p.words, 0);
const totalBytes = parts.reduce((sum, p) => sum + p.bytes, 0);
const groups = Object.fromEntries(categories.map(kind => [
  kind, {words: 0, bytes: 0, files: new Set()}
]));
for (const p of parts) {
  const g = groups[p.kind];
  g.words += p.words;
  g.bytes += p.bytes;
  g.files.add(p.path);
}
const fmt = x => x.toLocaleString('it-IT');
const pct = x => total === 0 ? '0,0%' :
  (100 * x / total).toFixed(1).replace('.', ',') + '%';
const lines = [
  '# Provenienza della documentazione di Mira',
  '',
  '> **Documento generato automaticamente** da @BT@scripts/generate-documentation-origin.mjs@BT@.',
  '> Fonte delle attribuzioni: @BT@catalog/documentation-origin.json@BT@.',
  '',
  '## Quanto è generato da IA e quanto dal tooling?',
  '',
  '| Categoria | Parole | Quota | Documenti coinvolti |',
  '| --- | ---: | ---: | ---: |',
  ...categories.map(kind =>
    '| ' + labels[kind] + ' | ' + fmt(groups[kind].words) + ' | ' +
    pct(groups[kind].words) + ' | ' + groups[kind].files.size + ' |'),
  '| **Totale** | **' + fmt(total) + '** | **100%** | **' +
    markdownPaths.length + '** |',
  '',
  'I documenti coinvolti **non sono sommabili**: per esempio il README contiene',
  'una sezione generata dal tooling e altre sezioni editoriali. Le percentuali',
  'invece sono calcolate su segmenti disgiunti e sommano al 100% (salvo',
  'arrotondamenti).',
  '',
  '## Dettaglio per file e sezione',
  '',
  '| Documento | Parte | Categoria | Parole | Generatore |',
  '| --- | --- | --- | ---: | --- |',
  ...parts.sort((a, b) => a.path.localeCompare(b.path) ||
    a.portion.localeCompare(b.portion)).map(p =>
    '| [@BT@' + p.path + '@BT@](../' + p.path + ') | ' + p.portion +
    ' | ' + labels[p.kind] + ' | ' + fmt(p.words) + ' | ' +
    (p.generator ? '@BT@' + p.generator + '@BT@' : '—') + ' |'),
  '',
  '## Come interpretare le cifre',
  '',
  '- **Tooling** significa che uno script compone materialmente il Markdown',
  '  pubblicato: guide, esempi, API e la tabella delle feature nel README.',
  '  Le fonti che alimentano questi documenti possono essere state scritte',
  '  con l’aiuto dell’IA: le due dimensioni quindi non sono equivalenti.',
  '- **IA assistita/dichiarata** significa testo editoriale preparato o',
  '  rielaborato durante lo sviluppo con un assistente IA. Non stima quanti',
  '  singoli token siano stati digitati da una persona o generati dal modello.',
  '- **Umana dichiarata** è una classificazione esplicita, non dedotta',
  '  automaticamente dal nome dell’autore del commit.',
  '- **Non verificata** è la documentazione storica di cui non si può',
  '  attribuire responsabilmente la redazione. Git non rivela se un testo',
  '  sia stato scritto con l’aiuto dell’IA.',
  '',
  'Questa è una **misura riproducibile dei meccanismi di produzione**, non',
  'una prova forense della paternità delle frasi. Include il testo dei blocchi',
  'di codice nei Markdown. Per contare le parole si usano gruppi Unicode di',
  'lettere/numeri, inclusi identificatori di codice.',
  '',
  '**Ambito:** README.md e tutti i file Markdown in @BT@docs/@BT@, eccetto',
  'questo stesso report (per evitare un conteggio ricorsivo). Sono esclusi',
  'i file sorgente @BT@catalog/*.json@BT@ e @BT@catalog/examples/*.mira@BT@,',
  'il codice e gli asset generati in @BT@dist/@BT@. Possono essere fonti',
  'della documentazione, ma non vengono ricontati come pagine pubblicate.',
  '',
  '## Mantenimento automatico',
  '',
  'Quando si aggiunge un documento occorre dichiararne l’origine in',
  '[@BT@catalog/documentation-origin.json@BT@](../catalog/documentation-origin.json).',
  'In caso contrario la generazione fallisce invece di inventare un’origine.',
  'La workflow @BT@reference.yml@BT@ rigenera questo report e lo salva in',
  '@BT@main@BT@ insieme al resto della documentazione.',
  '',
  '@BT@@BT@@BT@sh',
  'npm run docs',
  'node scripts/generate-documentation-origin.mjs --check',
  '@BT@@BT@@BT@',
  '',
  'Dimensione totale classificata: **' + fmt(totalBytes) + ' byte UTF-8**,',
  'in **' + markdownPaths.length + ' documenti** e **' + parts.length +
  ' sezioni attribuite**.',
  ''
];
const output = lines.join('\n').replaceAll('@BT@', String.fromCharCode(96));
const filename = join(root, reportPath);
if (checking) {
  if (!existsSync(filename) || read(reportPath) !== output) {
    console.error('Documentation origin report not up-to-date; run npm run docs');
    process.exitCode = 1;
  } else {
    console.log('Documentation origin report verified: ' + fmt(total) + ' words.');
  }
} else {
  writeFileSync(filename, output);
  console.log('Documentation origin: ' + fmt(total) + ' words; tooling ' +
    pct(groups.tool_generated.words) + ', IA ' +
    pct(groups.ai_assisted.words) + ', unverified ' +
    pct(groups.unverified.words));
}
