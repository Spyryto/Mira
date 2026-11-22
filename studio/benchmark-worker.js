// Runtime execution measured off the UI thread.
// Only preselected deterministic workloads are passed by benchmark-ui.js.
// Excludes JavaScript parsing/new Function creation and worker startup.
// The workload is supplied as compiled JavaScript from the Haxe compiler.
self.onmessage=event=>{
  const {code, expected, id}=event.data??{};
  try {
    if(typeof code!=='string' || code.length>100000 ||
       !Number.isInteger(expected) || !['small','medium','large'].includes(id)){
      throw new Error('Invalid benchmark request');
    }
    const run=new Function('__miraHost',
      '"use strict";\n'+code+'\nreturn run;')(Object.freeze({}));
    if(typeof run!=='function' || run(7)!==expected){
      throw new Error('Il codice generato ha restituito un risultato errato');
    }
    for(let i=0;i<200;i++)run(i);
    // Vary the input and consume every output to avoid constant folding
    // or elimination of pure calls by the JS engine.
    const batch=count=>{
      let checksum=0;
      for(let i=0;i<count;i++)checksum+=run(i);
      const expectedSum=count*(count-1)/2 + count*(expected-7);
      if(checksum!==expectedSum)throw new Error('Checksum runtime non valido');
    };
    // Calibrate to a measurable batch to avoid sub-millisecond timer noise.
    let repetitions=1;
    while(repetitions<100000){
      const started=performance.now();
      batch(repetitions);
      if(performance.now()-started>=8)break;
      repetitions=Math.min(100000,repetitions*2);
    }
    const samples=[];
    for(let sample=0;sample<21;sample++){
      const started=performance.now();
      batch(repetitions);
      samples.push((performance.now()-started)/repetitions);
    }
    samples.sort((a,b)=>a-b);
    const medianMs=samples[10];
    const p95Ms=samples[19];
    self.postMessage({ok:true,id,medianMs,p95Ms,
      operationsPerSecond:medianMs>0?1000/medianMs:null,
      repetitions,samples:samples.length});
  }catch(error){
    self.postMessage({ok:false,id,message:String(error?.message??error)});
  }
};
