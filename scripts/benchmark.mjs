import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchmarks, benchmarkSource, sourceLines, percentiles, linesPerSecond }
  from '../studio/benchmark-cases.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const compiler = resolve(root, 'dist/mira.cjs');
const outputFile = resolve(root, 'dist/benchmark-results.json');
const sourceFile = resolve(root, 'examples/arithmetic.mira');

function command(executable,args) {
  const result=spawnSync(executable,args,{encoding:'utf8',maxBuffer:2*1024*1024});
  if(result.error||result.status!==0){
    throw new Error(executable+' '+args.join(' ')+': '+
      (result.error?.message??result.stderr));
  }
  return result.stdout;
}

function compileBenchmark(input,target) {
  const report=JSON.parse(command('node',[
    compiler,'--benchmark',input,target,'100'
  ]));
  for(const metric of ['medianMs','p95Ms','linesPerSecond']){
    if(!Number.isFinite(report[metric])||report[metric]<0){
      throw new Error('Invalid '+metric+' for Mira '+target);
    }
  }
  const source=readFileSync(input,'utf8');
  if(report.sourceLines!==sourceLines(source))throw new Error('Line count mismatch');
  return report;
}

function mediumSource(definitions) {
  const lines=['add: left, and: right = left + right;','value_0 = 0;'];
  for(let i=1;i<=definitions;i++){
    lines.push('value_'+i+' = add: value_'+(i-1)+', and: 1;');
  }
  lines.push('result = value_'+definitions+';');
  return lines.join('\n')+'\n';
}

function timedRunner(run,expected,clock) {
  if(run(7)!==expected)throw new Error('Runtime result is wrong');
  for(let i=0;i<200;i++)run(i);
  // Inputs change each call and all results contribute to a checksum.
  // Otherwise optimizing JITs can eliminate the computation entirely.
  const batch=count=>{
    let sum=0;
    for(let i=0;i<count;i++)sum+=run(i);
    if(sum!==count*(count-1)/2+count*(expected-7)){
      throw new Error('Runtime checksum mismatch');
    }
  };
  let repetitions=1;
  while(repetitions<100000){
    const start=clock();
    batch(repetitions);
    if(clock()-start>=8)break;
    repetitions=Math.min(100000,repetitions*2);
  }
  const samples=[];
  for(let sample=0;sample<21;sample++){
    const start=clock();
    batch(repetitions);
    samples.push((clock()-start)/repetitions);
  }
  return {...percentiles(samples),repetitions,samples:samples.length};
}

function runJs(code,expected) {
  // Compile the generated JavaScript once; exclude new Function parsing,
  // Haxe, file I/O and process startup from each runtime sample.
  const fn=new Function('__miraHost','"use strict";\n'+code+'\nreturn run;')({});
  return timedRunner(fn,expected,()=>performance.now());
}

function runPhp(code,expected,path) {
  // PHP function declarations are loaded once. Repeated invocations are timed
  // in the same PHP process using hrtime; process startup is excluded.
  const footer=String.raw`
$expected = EXPECTED;
if (run(7) !== $expected) { fwrite(STDERR, "Wrong runtime result"); exit(2); }
for ($i = 0; $i < 200; $i++) run($i);
$batch = static function(int $count) use ($expected): void {
    $sum = 0;
    for ($i = 0; $i < $count; $i++) $sum += run($i);
    $expectedSum = $count * ($count - 1) / 2 + $count * ($expected - 7);
    if ($sum != $expectedSum) { fwrite(STDERR, "Runtime checksum mismatch"); exit(3); }
};
$repetitions = 1;
while ($repetitions < 100000) {
    $start = hrtime(true);
    $batch($repetitions);
    if ((hrtime(true) - $start) / 1000000 >= 8) break;
    $repetitions = min(100000, $repetitions * 2);
}
$samples = [];
for ($sample = 0; $sample < 21; $sample++) {
    $start = hrtime(true);
    $batch($repetitions);
    $samples[] = (hrtime(true) - $start) / 1000000 / $repetitions;
}
sort($samples, SORT_NUMERIC);
echo json_encode([
    'medianMs' => $samples[10],
    'p95Ms' => $samples[19],
    'repetitions' => $repetitions,
    'samples' => count($samples)
]), "\n";
`;
  writeFileSync(path,code+'\n'+footer.replace('EXPECTED',String(expected)));
  const report=JSON.parse(command('php',[path]));
  if(!(report.medianMs>0)||!Number.isFinite(report.p95Ms)){
    throw new Error('Invalid PHP runtime timings');
  }
  return report;
}

const temp=mkdtempSync(join(tmpdir(),'mira-benchmark-'));
try {
  const generated=join(temp,'medium.mira');
  writeFileSync(generated,mediumSource(100));

  const samples=[];
  for(const [label,path] of [['small',sourceFile],['medium-100',generated]]){
    for(const target of ['js','php']){
      samples.push({workload:label,...compileBenchmark(path,target)});
    }
  }

  const runtime=[];
  for(const workload of benchmarks){
    const path=join(temp,workload.id+'.mira');
    writeFileSync(path,benchmarkSource(workload.steps));
    const expected=7+workload.steps;
    const lines=sourceLines(benchmarkSource(workload.steps));
    const [js,php]=['js','php'].map(target=>command('node',[
      compiler,path,target
    ]));
    for(const [target,code] of [['js',js],['php',php]]){
      const timing=target==='js'?runJs(code,expected):
        runPhp(code,expected,join(temp,workload.id+'.php'));
      runtime.push({
        workload:workload.id,target,sourceLines:lines,
        ...timing,operationsPerSecond:1000/timing.medianMs
      });
    }
  }

  const build=JSON.parse(readFileSync(resolve(root,'dist/build-metrics.json'),'utf8'));
  const report={
    haxeBuildMs:build.haxeBuildMs,nodeVersion:process.version,
    sourceLinesDefinition:'Nonempty, non-comment physical lines of Mira source',
    samples,runtime
  };
  mkdirSync(resolve(root,'dist'),{recursive:true});
  writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');

  const lines=[
    '## Mira: compile and runtime benchmarks',
    '',
    '**Haxe → CLI build:** '+build.haxeBuildMs.toFixed(2)+' ms',
    '',
    '### Transpilation: Mira → JS / PHP',
    '',
    '| Workload | Target | Mira lines | Median (ms) | p95 (ms) | Lines/s |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...samples.map(s=>'| '+s.workload+' | '+s.target.toUpperCase()+
      ' | '+s.sourceLines+' | '+s.medianMs.toFixed(3)+
      ' | '+s.p95Ms.toFixed(3)+' | '+Math.round(s.linesPerSecond).toLocaleString('en-US')+' |'),
    '',
    '### Runtime: compiled Mira functions',
    '',
    '| Workload | Target | Median per call (µs) | p95 (µs) | Calls/s |',
    '| --- | --- | ---: | ---: | ---: |',
    ...runtime.map(s=>'| '+s.workload+' | '+s.target.toUpperCase()+
      ' | '+(s.medianMs*1000).toFixed(3)+' | '+(s.p95Ms*1000).toFixed(3)+
      ' | '+Math.round(s.operationsPerSecond).toLocaleString('en-US')+' |'),
    '',
    'Source lines: nonempty, non-comment physical lines of Mira.',
    'Compilation: 10 warmups, 100 iterations inside one Node/Haxe compiler process.',
    'Runtime: 200 warmups, 21 calibrated batches, varying input and checked sums.',
    'Excludes process start, emitted-code parsing, browser DOM, and I/O.',
    'Different backend runtimes and CI machines are not directly equivalent.',
    'No regression thresholds are imposed.',
    ''
  ];
  const summary=lines.join('\n');
  console.log(summary);
  if(process.env.GITHUB_STEP_SUMMARY){
    const {appendFileSync}=await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
  }
} finally {
  rmSync(temp,{recursive:true,force:true});
}
