import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

mkdirSync('dist', { recursive: true });

const start = performance.now();
const result = spawnSync('haxe', ['build.hxml'], { stdio: 'inherit' });
const elapsedMs = performance.now() - start;

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const metrics = { haxeBuildMs: elapsedMs };
writeFileSync('dist/build-metrics.json', JSON.stringify(metrics, null, 2) + '\n');
console.log(`Haxe compiler build: ${elapsedMs.toFixed(2)} ms`);
