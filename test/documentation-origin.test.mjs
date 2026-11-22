import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve, relative, join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const config = JSON.parse(read('catalog/documentation-origin.json'));

function markdownPaths(folder) {
  return readdirSync(folder, {withFileTypes:true}).flatMap(entry => {
    const full = join(folder, entry.name);
    if (entry.isDirectory()) return markdownPaths(full);
    if (!entry.isFile() || !entry.name.endsWith('.md')) return [];
    return [relative(root, full).replaceAll('\\', '/')];
  });
}

test('all Markdown pages are declared; unknown historical authorship stays explicit', () => {
  const documents = ['README.md', ...markdownPaths(resolve(root, 'docs'))]
    .filter(path => !config.excluded.includes(path)).sort();
  assert.deepEqual(Object.keys(config.files).sort(), documents);
  for (const [path, entry] of Object.entries(config.files)) {
    assert.ok(['ai_assisted','tool_generated','human_declared','unverified']
      .includes(entry.kind), path);
    assert.ok(entry.note.length > 5, path);
    if (entry.kind === 'tool_generated') assert.ok(entry.generator, path);
  }
  assert.ok(Object.values(config.files).some(e => e.kind === 'unverified'),
    'An unverified category must remain available for uncertain historical files');
});

test('provenance report is byte-for-byte reproducible and current', () => {
  const process = spawnSync('node',
    ['scripts/generate-documentation-origin.mjs', '--check'],
    {cwd:root, encoding:'utf8'});
  assert.equal(process.status, 0, process.stderr);
  const markdown = read('docs/documentation-origin.md');
  for (const label of [
    'Generata automaticamente dal tooling',
    'Redatta con assistenza IA',
    'Provenienza non verificata',
    'catalog/documentation-origin.json',
    'docs/reference/examples.md'
  ]) assert.ok(markdown.includes(label), label);
  assert.match(markdown, /\|\s*\*\*Totale\*\*\s*\|/);
});

test('README generated matrix is accounted separately from editorial content', () => {
  const source = read('README.md');
  const blocks = config.generatedSections['README.md'];
  assert.equal(blocks.length, 1);
  for (const section of blocks) {
    assert.ok(source.includes(section.start));
    assert.ok(source.includes(section.end));
    assert.ok(source.indexOf(section.start) < source.indexOf(section.end));
  }
  const markdown = read('docs/documentation-origin.md');
  assert.match(markdown, /README\.md.+Resto del documento/);
  assert.match(markdown, /README\.md.+Sezione generata/);
});

test('the report excludes itself from the counted pages', () => {
  assert.ok(config.excluded.includes('docs/documentation-origin.md'));
  assert.ok(!Object.hasOwn(config.files, 'docs/documentation-origin.md'));
});
