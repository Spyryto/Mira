// Shared deterministic workloads for browser and CI benchmarks.
// One physical source line per definition, followed by run and result.
export const benchmarks = Object.freeze([
  {id:'small', label:'Piccolo · 5 passi', steps:5},
  {id:'medium', label:'Medio · 50 passi', steps:50},
  {id:'large', label:'Grande · 100 passi', steps:100}
]);

export function benchmarkSource(steps) {
  if (!Number.isInteger(steps) || steps < 1 || steps > 100) {
    throw new RangeError('Benchmark steps must be an integer between 1 and 100');
  }
  const lines = ['step_0: n = n + 1;'];
  for (let n=1; n<steps; n++) {
    lines.push('step_'+n+': n = (step_'+(n-1)+': (n)) + 1;');
  }
  lines.push('run: input = step_'+(steps-1)+': (input);');
  lines.push('result = run: 0;');
  return lines.join('\n')+'\n';
}

export function sourceLines(source) {
  // Metric definition: nonblank, non-comment physical lines of Mira.
  return source.split(/\r\n|\n|\r/).filter(line=>{
    const text=line.trim();
    return text!=='' && !text.startsWith('#');
  }).length;
}

export function median(sorted) {
  if (!sorted.length) throw new RangeError('Samples must not be empty');
  return sorted[Math.floor((sorted.length-1)/2)];
}

export function percentiles(samples) {
  const sorted=[...samples].sort((a,b)=>a-b);
  return {medianMs:median(sorted),
    p95Ms:sorted[Math.ceil(sorted.length*.95)-1]};
}

export function linesPerSecond(lines, medianMs) {
  return medianMs>0 ? lines*1000/medianMs : null;
}
