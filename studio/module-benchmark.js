(function(){
  'use strict';
  // Same deterministic fixture for Studio and CI. A shared Core creates
  // a diamond-shaped dependency graph, while each leaf has unused values.
  function project(count){
    if(!Number.isInteger(count)||count<1||count>120)throw Error('Expected 1–120 modules');
    const files={'Core':'module Core; interface rate; implementation rate = 2;'};
    const imports=[],calls=[];
    for(let i=0;i<count;i++){
      const path='Library / Part'+i;
      const dead=Array.from({length:6},(_,j)=>'unused value'+j+' = '+j+';').join('\n');
      files[path]='module '+path+';\ninterface\nmeasure: ;\nimplementation\nimport Core {rate;};\nmeasure: x = x + rate;\n'+dead;
      imports.push('import '+path+' {measure: => measure part'+i+': ;};');
      calls.push('(measure part'+i+': 1)');
    }
    const source='module App;\ninterface\nresult;\nimplementation\n'+imports.join('\n')+'\nresult = '+calls.join(' + ')+';';
    return {source,modules:JSON.stringify(files),count,expected:3*count};
  }
  function measure(compiler,fixture,target,optimized,clock=()=>performance.now()){
    const start=clock();
    const r=compiler.compile(fixture.source,target,null,false,fixture.modules,true,optimized);
    const ms=clock()-start;
    if(!r.ok)throw Error(r.message);
    return {ms,bytes:new TextEncoder().encode(r.output).length,optimization:r.optimization||null,output:r.output};
  }
  function median(samples){
    const values=samples.map(x=>x.ms).sort((a,b)=>a-b);
    const i=Math.floor(values.length/2);
    return values.length%2?values[i]:(values[i-1]+values[i])/2;
  }
  globalThis.MiraModuleBenchmark={project,measure,median};
})();