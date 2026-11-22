import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, 'dist/studio');
mkdirSync(destination, { recursive: true });

const assets = [
  'index.html',
  'styles.css',
  'app.js',
  'reference-ui.js',
  'ast-inspector.js',
  'inspector-host.js',
  'inspector-worker.js',
  'examples.js',
  'worker.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png'
];

copyFileSync(resolve(root, 'studio/dogfood/inspector.mira'),
  resolve(destination, 'inspector.mira'));

for (const filename of assets) {
  copyFileSync(resolve(root, 'studio', filename), resolve(destination, filename));
}

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
// Generate the offline reference from feature fixtures and Haxe signatures.
const documentation = spawnSync('node', ['scripts/generate-reference.mjs'], {
  cwd: root, stdio: 'inherit'
});
if (documentation.error || documentation.status !== 0) {
  console.error(documentation.error?.message ?? 'Documentation generation failed');
  process.exit(documentation.status ?? 1);
}
console.log('Mira Studio static assets ready in dist/studio (cache ' + buildId + ')');
