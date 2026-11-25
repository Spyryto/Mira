import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'catalog/manifest.json'), 'utf8'));
const notes = JSON.parse(readFileSync(join(root, 'catalog/api-notes.json'), 'utf8'));
const sourceBase = 'https://github.com/Spyryto/Mira/blob/main/';
const tick = String.fromCharCode(96);

function filesUnder(directory, extension) {
  const files = [];
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, item.name);
    if (item.isDirectory()) files.push(...filesUnder(file, extension));
    else if (file.endsWith(extension)) files.push(file);
  }
  return files.sort();
}

function asId(id) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function location(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function extractApi() {
  const api = [];
  for (const file of filesUnder(join(root, 'src'), '.hx')) {
    const text = readFileSync(file, 'utf8');
    const path = relative(root, file).replaceAll('\\', '/');
    const packageName = text.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1] ?? '';
    const moduleName = basename(path, '.hx');
    const types = [...text.matchAll(/(?:^|\n)\s*(class|enum)\s+([A-Z]\w*)/g)];

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const end = i + 1 < types.length ? types[i + 1].index : text.length;
      const block = text.slice(type.index, end);
      const id = packageName + '.' +
        (type[2] === moduleName ? type[2] : moduleName + '.' + type[2]);
      const baseLine = location(text, type.index);
      api.push({
        id, kind: type[1], signature: type[1] + ' ' + type[2],
        description: notes[id] ?? 'Tipo dichiarato nel compilatore Haxe.',
        path, line: baseLine, sourceUrl: sourceBase + path + '#L' + baseLine
      });

      function addMembers(regex, factory) {
        let match;
        while ((match = regex.exec(block)) !== null) {
          const entry = factory(match);
          const line = location(text, type.index + match.index);
          const key = id + '.' + entry.name;
          api.push({
            id: key, kind: entry.kind, signature: entry.signature,
            description: notes[key] ?? notes[id] ?? 'Membro pubblico di ' + id + '.',
            path, line, sourceUrl: sourceBase + path + '#L' + line,
            parent: id
          });
        }
      }

      if (type[1] === 'enum') {
        addMembers(/^\s*([A-Z]\w*)\s*(?:\(([^;]*)\))?\s*;/gm,
          match => ({
            name: match[1], kind: 'variant',
            signature: match[1] + (match[2] === undefined ? '' : '(' + match[2].trim() + ')')
          }));
        continue;
      }

      addMembers(/\bpublic\s+(static\s+)?function\s+(\w+)\s*\(([\s\S]*?)\)\s*(?::\s*([^{]+?))?\s*\{/g,
        match => ({
          name: match[2], kind: match[2] === 'new' ? 'constructor' : 'method',
          signature: 'public ' + (match[1] ?? '') + 'function ' + match[2] + '(' +
            match[3].replace(/\s+/g, ' ').trim() + ')' +
            (match[4] ? ':' + match[4].replace(/\s+/g, ' ').trim() : '')
        }));
      addMembers(/\bpublic\s+(final|var)\s+(\w+)\s*:\s*([^;=\n]+)/g,
        match => ({
          name: match[2], kind: 'field',
          signature: 'public ' + match[1] + ' ' + match[2] + ':' + match[3].trim()
        }));
    }
  }
  api.sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Set();
  for (const entry of api) {
    if (seen.has(entry.id)) throw new Error('Duplicate extracted API identifier: ' + entry.id);
    seen.add(entry.id);
  }
  return api;
}

function validateCatalog(api) {
  const currentMinor = Number(manifest.version.split('.')[1]);
  const checkVersion = (item, label) => {
    if (typeof item.since !== 'string' || !/^0\.[0-9]+$/.test(item.since) ||
        Number(item.since.split('.')[1]) > currentMinor) {
      throw new Error('Invalid or missing first implementation version for ' + label);
    }
  };
  for (const item of manifest.additionalCapabilities ?? []) {
    checkVersion(item, item.id);
    if (!/^docs\/[a-zA-Z0-9/_-]+\.md(#[a-z0-9-]+)?$/.test(item.doc)) {
      throw new Error('Invalid documentation link for ' + item.id);
    }
    readFileSync(join(root, item.doc.split('#')[0]), 'utf8');
  }
  const featureIds = new Set();
  const exampleIds = new Set();
  const examples = [];

  for (const feature of manifest.features) {
    if (featureIds.has(feature.id)) throw new Error('Duplicate feature ' + feature.id);
    checkVersion(feature, feature.id);
    featureIds.add(feature.id);
    if (!Array.isArray(feature.examples) || feature.examples.length < 2) {
      throw new Error('Feature needs >=2 examples: ' + feature.id);
    }
  }

  for (const example of manifest.examples) {
    if (exampleIds.has(example.id)) throw new Error('Duplicate example ' + example.id);
    exampleIds.add(example.id);
    if (!featureIds.has(example.feature)) throw new Error('Unknown feature ' + example.feature);
    if (!example.path.startsWith('catalog/examples/') || !example.path.endsWith('.mira')) {
      throw new Error('Unsafe example path ' + example.path);
    }
    if (!['result', 'invoke', 'error', 'ui'].includes(example.expect?.kind)) {
      throw new Error('Unsupported expected result for ' + example.id);
    }
    // Explicit build-time composition, not a Mira import or implicit prelude.
    if (example.library !== undefined && example.library !== 'lib/gui.mira') {
      throw new Error('Unknown example library: ' + example.library);
    }
    const library = example.library ? readFileSync(join(root, example.library), 'utf8') + '\n' : '';
    examples.push({ ...example, source: library + readFileSync(join(root, example.path), 'utf8') });
  }

  const index = new Map(examples.map(example => [example.id, example]));
  const apiIndex = new Set(api.map(item => item.id));
  for (const feature of manifest.features) {
    if (!apiIndex.has(feature.api)) throw new Error('Missing API link ' + feature.api);
    for (const id of feature.examples) {
      const example = index.get(id);
      if (!example || example.feature !== feature.id) {
        throw new Error('Broken feature → example link: ' + feature.id + ' / ' + id);
      }
    }
    const actual = examples.filter(item => item.feature === feature.id);
    if (actual.length !== feature.examples.length) {
      throw new Error('Orphan or mismatched examples for ' + feature.id);
    }
  }
  return examples;
}

function resultText(expected) {
  if (expected.kind === 'error') return 'Errore atteso: ' + expected.contains;
  if (expected.kind === 'ui') return 'Anteprima interattiva (browser JS; PHP compilato soltanto)';
  if (expected.kind === 'invoke') {
    return expected.name + '(' + expected.args.join(', ') + ') = ' + JSON.stringify(expected.value);
  }
  return 'result = ' + JSON.stringify(expected.value);
}

function languageMarkdown(examples) {
  const lines = [
    '# Guida a Mira ' + manifest.version,
    '',
    'Generata automaticamente da catalog/manifest.json e dai programmi di catalog/examples/.',
    'Le firme API sono estratte dal sorgente Haxe, non ricopiate manualmente.',
    '',
    'Apri [Mira Studio](https://spyryto.github.io/Mira/#/guide) per consultare gli esempi e provarli.',
    ''
  ];
  for (const feature of manifest.features) {
    lines.push('<a id="feature-' + asId(feature.id) + '"></a>');
    lines.push('## ' + feature.title, '',
      '**Disponibile dalla versione ' + feature.since + '**', '',
      feature.summary, '', feature.details, '');
    lines.push('API collegata: ['
      + tick + feature.api + tick + '](api.md#api-' + asId(feature.api) + ')', '');
    for (const id of feature.examples) {
      const example = examples.find(item => item.id === id);
      lines.push('- [' + example.title + '](examples.md#example-' + asId(id) + ') — '
        + resultText(example.expect));
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

function examplesMarkdown(examples) {
  const lines = [
    '# Esempi eseguibili Mira',
    '',
    'Catalogo generato e validato in CI. Gli esempi numerici vengono eseguiti su JS/PHP; gli esempi UI sono compilati su entrambi i target ed eseguiti con il DOM host JS.',
    ''
  ];
  for (const example of examples) {
    const feature = manifest.features.find(item => item.id === example.feature);
    lines.push('<a id="example-' + asId(example.id) + '"></a>');
    lines.push('## ' + example.title, '', example.description, '');
    lines.push('Feature: [' + feature.title + '](language.md#feature-' + asId(feature.id) + ')', '');
    lines.push(tick.repeat(3) + 'mira', example.source.trimEnd(), tick.repeat(3), '');
    lines.push('**Risultato:** ' + resultText(example.expect), '');
    lines.push('[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/' + example.id + ')', '');
  }
  return lines.join('\n') + '\n';
}

function apiMarkdown(api) {
  const lines = [
    '# Riferimento API Haxe di Mira',
    '',
    'Firme, tipi, enum e campi pubblici estratti automaticamente da src/**/*.hx.',
    'Le descrizioni sono conservate in catalog/api-notes.json; i link al codice sorgente sono generati.',
    'Il riferimento non include i membri privati o una specifica semantica del runtime JavaScript/PHP.',
    '',
    '## API esterne',
    '',
    '- Browser: ' + tick + 'MiraStudioCompiler.compile(source, "js"|"php")' + tick +
    ', ' + tick + 'tokens(source)' + tick + ' e ' + tick + 'ast(source)' + tick +
    ' restituiscono ' + tick + '{ok, output}' + tick + ' o ' + tick + '{ok:false, message}' + tick + '.',
    '- CLI: ' + tick + 'node dist/mira.cjs <file.mira> <js|php|--tokens> [output]' + tick + '.',
    '- Benchmark: ' + tick + 'node dist/mira.cjs --benchmark <file.mira> <js|php> <iterations>' + tick + '.',
    '',
    '## API pubbliche',
    ''
  ];
  for (const item of api) {
    lines.push('<a id="api-' + asId(item.id) + '"></a>');
    lines.push('### ' + tick + item.id + tick, '',
      '**' + item.kind + '** · ' + item.description, '',
      tick.repeat(3) + 'haxe', item.signature, tick.repeat(3), '',
      '[Sorgente Haxe](' + item.sourceUrl + ')', '');
    const related = manifest.features.filter(feature => feature.api === item.id);
    if (related.length) {
      lines.push('Feature: ' + related.map(feature =>
        '[' + feature.title + '](language.md#feature-' + asId(feature.id) + ')'
      ).join(', '), '');
    }
  }
  return lines.join('\n') + '\n';
}

// The README feature matrix is kept in sync with the canonical catalog.
// Everything outside the two markers remains hand-edited Markdown.
function updateReadmeFeatureMatrix() {
  const readmePath = join(root, 'README.md');
  const start = '<!-- START GENERATED FEATURE MATRIX -->';
  const end = '<!-- END GENERATED FEATURE MATRIX -->';
  const original = readFileSync(readmePath, 'utf8');
  const begin = original.indexOf(start);
  const finish = original.indexOf(end);
  if (begin < 0 || finish <= begin || original.indexOf(start, begin + 1) !== -1 ||
      original.indexOf(end, finish + 1) !== -1) {
    throw new Error('Missing or duplicated README feature matrix markers');
  }

  const features = [
    ...manifest.features.map(item => ({
      name: item.title,
      since: item.since,
      doc: 'docs/reference/language.md#feature-' + asId(item.id)
    })),
    ...(manifest.additionalCapabilities ?? []).map(item => ({
      name: item.title, since: item.since, doc: item.doc
    }))
  ];

  features.sort((a, b) =>
    Number(a.since.split('.')[1]) - Number(b.since.split('.')[1])
  );

  const rows = [
    '| Stato | Funzionalità | Prima versione | Documentazione |',
    '| :---: | --- | :---: | --- |',
    ...features.map(item =>
      '| ✅ | ' + item.name + ' | ' + tick + item.since + tick +
      ' | [Dettagli](' + item.doc + ') |'
    )
  ];
  const rewritten = original.slice(0, begin + start.length) + '\n' +
    rows.join('\n') + '\n' + original.slice(finish);
  if (rewritten !== original) writeFileSync(readmePath, rewritten);
}

const api = extractApi();
const examples = validateCatalog(api);
updateReadmeFeatureMatrix();
const dataset = {
  version: manifest.version,
  generatedFrom: ['catalog/manifest.json', 'catalog/api-notes.json', 'src/**/*.hx'],
  features: manifest.features,
  examples,
  api
};
const referenceDir = join(root, 'docs/reference');
const studioDir = join(root, 'dist/studio');
mkdirSync(referenceDir, {recursive: true});
mkdirSync(studioDir, {recursive: true});
writeFileSync(join(referenceDir, 'language.md'), languageMarkdown(examples));
writeFileSync(join(referenceDir, 'examples.md'), examplesMarkdown(examples));
writeFileSync(join(referenceDir, 'api.md'), apiMarkdown(api));
writeFileSync(join(studioDir, 'reference.json'), JSON.stringify(dataset, null, 2) + '\n');

console.log('Mira reference: ' + manifest.features.length + ' features, ' +
  examples.length + ' examples, ' + api.length + ' public Haxe symbols.');
