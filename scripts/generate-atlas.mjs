// Produces static, cacheable architecture data and precompiled Mira view models.
// Architecture dependencies are extracted from actual imports, never guessed.
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist/studio');
const read = path => readFileSync(join(root, path), 'utf8');
const run = (command, args) => {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8'});
  if (result.error || result.status !== 0) {
    throw new Error(command + ' ' + args.join(' ') + ': ' +
      (result.error?.message ?? result.stderr));
  }
  return result.stdout;
};
function walk(path) {
  return readdirSync(path, {withFileTypes:true}).flatMap(item => {
    const full = join(path, item.name);
    return item.isDirectory() ? walk(full) : item.isFile() ? [full] : [];
  });
}
const haxe = walk(join(root, 'src')).filter(path => path.endsWith('.hx'))
  .map(path => relative(root, path).replaceAll('\\', '/'));
const studio = [
  'studio/app.js', 'studio/reference-ui.js', 'studio/ast-inspector.js',
  'studio/inspector-host.js', 'studio/collection-host.js',
  'studio/ui-host.js', 'studio/ui-preview.js', 'studio/atlas-ui.js'
];
const tooling = [
  'scripts/build-studio.mjs', 'scripts/generate-reference.mjs',
  'scripts/generate-documentation-origin.mjs', 'scripts/generate-atlas.mjs'
];
const sources = [...new Set([...haxe, ...studio, ...tooling])].sort();
for (const path of sources) {
  if (!existsSync(join(root, path))) throw new Error('Atlas source is missing: ' + path);
}
function group(path) {
  if (path.startsWith('scripts/')) return 'Tooling';
  if (path.startsWith('studio/')) return 'Studio';
  if (path.includes('/lex/')) return 'Lexer';
  if (path.includes('/syntax/')) return 'Parser';
  if (path.includes('/resolve/')) return 'Resolver';
  if (path.includes('/emit/')) return 'Emitter';
  if (path.includes('/studio/')) return 'Studio';
  return 'Core';
}
const haxeId = path => path.slice('src/'.length, -'.hx'.length).replaceAll('/', '.');
const idByPath = new Map(sources.map(path => [path, path.endsWith('.hx') ? haxeId(path) : path]));
const pathById = new Map([...idByPath].map(([p, id]) => [id, p]));
const modules = [];
const edges = [];
for (const path of sources) {
  const text = read(path);
  const imports = new Set();
  if (path.endsWith('.hx')) {
    for (const match of text.matchAll(/^\s*import\s+([\w.]+)\s*;/gm)) {
      // Haxe can import a nested enum or type: resolve its real owning module.
      let name = match[1];
      while (name && !pathById.has(name)) name = name.slice(0, name.lastIndexOf('.'));
      if (name && pathById.has(name) && pathById.get(name) !== path) {
        imports.add(name);
      }
    }
  } else {
    for (const match of text.matchAll(/\b(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
      const relativeImport = match[1];
      const file = resolve(root, dirname(path), relativeImport);
      const targetPath = relative(root, file).replaceAll('\\', '/');
      if (idByPath.has(targetPath) && targetPath !== path) {
        imports.add(idByPath.get(targetPath));
      }
    }
  }
  const id = idByPath.get(path);
  const title = path.split('/').at(-1);
  const dependencies = [...imports].sort();
  modules.push({
    id, title, path, group: group(path),
    language: path.endsWith('.hx') ? 'Haxe' : 'JavaScript',
    lines: text.split('\n').length,
    imports: dependencies,
    url: 'https://github.com/Spyryto/Mira/blob/main/' + path
  });
  for (const dep of dependencies) edges.push({from: id, to: dep});
}
edges.sort((a,b) => (a.from + a.to).localeCompare(b.from + b.to));
const phases = JSON.parse(read('studio/atlas/phases.json'));
for (const phase of phases) {
  if (!Array.isArray(phase.sourceFiles) ||
      phase.sourceFiles.some(path => !existsSync(join(root, path)))) {
    throw new Error('Undocumented or missing phase source: ' + phase.id);
  }
}
const data = {version:1, modules, edges, phases,
  provenance:{
    phases:'studio/atlas/phases.json (editorial descriptions, verified file paths)',
    graph:'Source imports extracted by scripts/generate-atlas.mjs',
    mira:'studio/atlas/atlas.mira (view models and summaries)',
    runtime:'src/mira/studio/Bridge.hx (lexer, declarations, symbols, AST, emitters)'
  }};
mkdirSync(dist, {recursive:true});
writeFileSync(join(dist, 'atlas-data.json'), JSON.stringify(data,null,2)+'\n');

// Build both compiler and Atlas program from checked-in Mira source. The JS is
// not handwritten or recompiled on every Studio navigation.
run('haxe', ['build.hxml']);
const compiled = run('node', [
  'dist/mira.cjs', 'studio/atlas/atlas.mira', 'js',
  '--host', 'studio/atlas/host.json'
]);
const exports = ['atlas_stages','atlas_modules','atlas_declarations','atlas_ast','atlas_overview','atlas_select_modules__group'];
for (const symbol of exports) {
  if (!compiled.includes('function ' + symbol + '(')) {
    throw new Error('Missing compiled Mira Atlas export: ' + symbol);
  }
}
const prefix = [
  '// Generated from studio/atlas/atlas.mira by scripts/generate-atlas.mjs.',
  '// The only host capabilities are map, filter and count.',
  "import {collectionHost} from './collection-host.js';",
  'const __miraHost = Object.freeze(Object.assign(Object.create(null), collectionHost(), {',
  '  "count:": values => {',
  '    if (!Array.isArray(values)) throw new Error("count: expects a sequence");',
  '    return values.length;',
  '  }',
  '}));',
  ''
].join('\n');
writeFileSync(join(dist, 'atlas-program.js'),
  prefix + compiled + '\nexport {' + exports.map(name =>
    name === 'atlas_select_modules__group'
      ? 'atlas_select_modules__group as atlas_select_modules' : name
  ).join(', ') + '};\n');
console.log('Mira Atlas generated: '+modules.length+' source modules, '+
  edges.length+' verified imports, '+phases.length+' compiler stages; '+
  compiled.length+' bytes of generated Mira→JS.');
