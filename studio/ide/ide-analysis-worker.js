importScripts('./compiler.js');
self.onmessage=({data:{revision,source,kind,request}})=>{
 const start=performance.now();
 const compiler=self.MiraStudioCompiler;
 const checked=compiler.check(source);
 if(kind==='fields'){self.postMessage({kind,request,checked,elapsed:performance.now()-start});return;}
 const ast=compiler.ast(source);
 self.postMessage({revision,checked,ast,elapsed:performance.now()-start,version:compiler.version});
};
