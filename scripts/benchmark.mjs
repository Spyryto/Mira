import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const compiler = resolve(root, 'dist/mira.cjs');
const buildMetrics = resolve(root, 'dist/build-metrics.json');
const outputFile = resolve(root, 'dist/benchmark-results.json');
const sourceFile = resolve(root, 'examples/arithmetic.mira');
const iterations = 100;

function benchmark(input, target) {
  const result = spawnSync('node', [
    compiler, '--benchmark', input, target, String(iterations)
  ], { encoding: 'utf8' });

  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message ?? result.stderr ?? 'Mira benchmark failed');
  }

  const report = JSON.parse(result.stdout);
  for (const field of ['medianMs', 'p95Ms', 'meanMs']) {
    if (!Number.isFinite(report[field]) || report[field] < 0) {
      throw new Error(`Invalid ${field} from Mira ${target} benchmark`);
    }
  }
  return report;
}

function mediumSource(definitions) {
  const lines = [
    'add: left, and: right = left + right;',
    'value_0 = 0;'
  ];
  for (let i = 1; i <= definitions; i++) {
    lines.push(`value_${i} = add: value_${i - 1}, and: 1;`);
  }
  lines.push(`result = value_${definitions};`);
  return lines.join('\n') + '\n';
}

const temp = mkdtempSync(join(tmpdir(), 'mira-benchmark-'));
try {
  const generated = join(temp, 'medium.mira');
  writeFileSync(generated, mediumSource(100));

  const samples = [];
  for (const [label, path] of [['small', sourceFile], ['medium-100', generated]]) {
    for (const target of ['js', 'php']) {
      samples.push({ workload: label, ...benchmark(path, target) });
    }
  }

  const build = JSON.parse(readFileSync(buildMetrics, 'utf8'));
  const report = {
    haxeBuildMs: build.haxeBuildMs,
    nodeVersion: process.version,
    samples
  };

  mkdirSync(resolve(root, 'dist'), { recursive: true });
  writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n');

  const lines = [
    '## Mira compilation and transpilation timings',
    '',
    `**Haxe → Mira CLI build:** ${build.haxeBuildMs.toFixed(2)} ms`,
    '',
    '| Mira input | Backend | Source bytes | Median (ms) | p95 (ms) | Runs |',
    '|:--|:--|--:|--:|--:|--:|',
    ...samples.map(s =>
      `| ${s.workload} | ${s.target.toUpperCase()} | ${s.sourceBytes} | ${s.medianMs.toFixed(3)} | ${s.p95Ms.toFixed(3)} | ${s.iterations} |`
    ),
    '',
    'Mira timings measure only the warmed-up, in-process lexer → parser → emit path.',
    'Node startup, file I/O and Haxe compilation are excluded from those per-run values.',
    'These are informational measurements, not regression thresholds: GitHub-hosted runner timings vary.',
    ''
  ];
  const summary = lines.join('\n');
  console.log(summary);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
