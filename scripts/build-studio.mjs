import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, 'dist/studio');
mkdirSync(destination, { recursive: true });

const assets = [
  'index.html',
  'styles.css',
  'app.js',
  'workbench-fullscreen.js',
  'syntax-highlight.js',
  'reference-ui.js',
  'atlas-ui.js',
  'benchmark-ui.js',
  'benchmark-cases.js',
  'benchmark-worker.js',
  'gui-benchmark.js',
  'gui-specialize.js',
  'gui-benchmark.html',
  'ast-inspector.js',
  'inspector-host.js',
  'collection-host.js',
  'inspector-worker.js',
  'examples.js',
  'host.json',
  'worker.js',
  'ui-preview.html',
  'ui-host.js',
  'persistent-state.js',
  'persistent-ledger.html',
  'persistent-ledger.css',
  'persistent-ledger.js',
  'persistent-ledger.mira',
  'effects.js',
  'type-lab.html',
  'type-lab.js',
  'module-explorer.html',
  'module-explorer.js',
  'effects-demo.mira',
  'effects-demo.js',
  'effects-demo.html',
  'ui-preview.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png'
];

copyFileSync(resolve(root, 'studio/dogfood/inspector.mira'),
  resolve(destination, 'inspector.mira'));
copyFileSync(resolve(root, 'studio/dogfood/host.json'),
  resolve(destination, 'inspector-host.json'));

for (const filename of assets) {
  copyFileSync(resolve(root, 'studio', filename), resolve(destination, filename));
}

// Publish the design notebook from its single Markdown source. It uses a
// deliberately small, escaped subset: headings, paragraphs and fenced code.
const notebook = ['docs/design-notes.md', 'docs/module-design.md']
  .map(path => readFileSync(resolve(root, path), 'utf8')).join('\n\n');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const sections = [];
let paragraph = [];
let code = null;
function flushParagraph() {
  if (paragraph.length) sections.push('<p>' + escape(paragraph.join(' ')) + '</p>');
  paragraph = [];
}
for (const line of notebook.split('\n')) {
  if (line.startsWith('```')) {
    if (code === null) { flushParagraph(); code = []; }
    else { sections.push('<pre><code>' + escape(code.join('\n')) + '</code></pre>'); code = null; }
  } else if (code !== null) code.push(line);
  else if (line.startsWith('# ') || line.startsWith('## ')) {
    flushParagraph();
    const tag = line.startsWith('## ') ? 'h2' : 'h1';
    sections.push('<' + tag + '>' + escape(line.replace(/^#+ /, '')) + '</' + tag + '>');
  } else if (!line.trim()) flushParagraph();
  else paragraph.push(line);
}
if (code !== null) throw Error('Unclosed code fence in design notebook');
flushParagraph();
writeFileSync(resolve(destination, 'design-notes.html'), '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mira · Quaderno di progettazione</title><link rel="stylesheet" href="styles.css"><style>.notebook{max-width:800px;margin:auto;padding:1rem;line-height:1.65}.notebook h2{margin-top:2rem;border-top:1px solid #718096;padding-top:1rem}.notebook pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:1rem;border:1px solid #718096;border-radius:.6rem}</style></head><body><main class="notebook"><a href="./index.html">← Mira Studio</a>' + sections.join('\n') + '</main></body></html>');

// Bundle the canonical GUI library in the benchmark source generator.
// No separate fetch: the lab works offline and from a local file URL.
const guiBenchmark = resolve(destination, 'gui-benchmark.js');
writeFileSync(guiBenchmark, readFileSync(guiBenchmark, 'utf8').replace(
  "'__MIRA_GUI_LIBRARY__'", () => JSON.stringify(readFileSync(resolve(root, 'lib/gui.mira'), 'utf8'))
));

// The unique build marker invalidates the service-worker cache on deployments.
let buildId = process.env.GITHUB_SHA?.slice(0, 12);
if (!buildId) {
  const git = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    cwd: root, encoding: 'utf8'
  });
  buildId = git.status === 0 ? git.stdout.trim() : 'local-dev';
}
const worker = readFileSync(resolve(root, 'studio/sw.js'), 'utf8');
writeFileSync(resolve(destination, 'sw.js'),
  worker.replaceAll('__CACHE_VERSION__', buildId));

const started = performance.now();
const result = spawnSync('haxe', ['studio.hxml'], {
  cwd: root, stdio: 'inherit'
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
console.log(`Mira Studio Haxe browser bundle built in ${(performance.now() - started).toFixed(1)} ms`);
// Compile the fixed, repository-owned pilot; no evaluation of editor code here.
const context={};
runInNewContext(readFileSync(resolve(destination,'compiler.js'),'utf8'),context);
const ledger=context.MiraStudioCompiler.compile(
  readFileSync(resolve(root,'studio/persistent-ledger.mira'),'utf8'),'js',
  JSON.stringify({callables:['render']}));
if(!ledger.ok)throw Error('Persistent ledger compilation: '+ledger.message);
writeFileSync(resolve(destination,'persistent-ledger-program.js'),
  'globalThis.MiraLessonLedgerProgram = function(__miraHost) {\n'+ledger.output+'\n};\n');
const effectsSource = readFileSync(resolve(root,'studio/effects-demo.mira'),'utf8');
const effectsManifest = JSON.stringify({callables:['start','send']});
const effects = context.MiraStudioCompiler.compile(effectsSource,'js',effectsManifest);
const effectsPhp = context.MiraStudioCompiler.compile(effectsSource,'php',effectsManifest);
if(!effects.ok || !effectsPhp.ok)throw Error('Effects pilot compilation: '+(effects.message || effectsPhp.message));
writeFileSync(resolve(destination,'effects-demo-program.js'),
  'globalThis.MiraEffectsDemoProgram = function(__miraHost) {\n'+effects.output+'\n};\n');
// Compile Mira Atlas to JS and extract real source import dependencies.
const atlas = spawnSync('node', ['scripts/generate-atlas.mjs'], {
  cwd: root, stdio: 'inherit'
});
if (atlas.error || atlas.status !== 0) {
  console.error(atlas.error?.message ?? 'Mira Atlas generation failed');
  process.exit(atlas.status ?? 1);
}
// Generate the offline reference from feature fixtures and Haxe signatures.
const documentation = spawnSync('npm', ['run', 'docs'], {
  cwd: root, stdio: 'inherit'
});
if (documentation.error || documentation.status !== 0) {
  console.error(documentation.error?.message ?? 'Documentation provenance/reference generation failed');
  process.exit(documentation.status ?? 1);
}
const lab = spawnSync('node', ['scripts/generate-laboratory.mjs'], { cwd: root, stdio: 'inherit' });
if (lab.error || lab.status !== 0) {
  console.error(lab.error?.message ?? 'Laboratory generation failed');
  process.exit(lab.status ?? 1);
}
console.log('Mira Studio static assets ready in dist/studio (cache ' + buildId + ')');
