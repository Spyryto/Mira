importScripts('./compiler.js');
self.onmessage=({data:{revision,source,kind,request,line,column}})=>{
 const start=performance.now();
 const compiler=self.MiraStudioCompiler;
 if(kind==='scope'){self.postMessage({kind,request,checked:compiler.scopeAt(source,line,column),elapsed:performance.now()-start});return;}
 const checked=compiler.check(source);
 if(kind==='fields'){self.postMessage({kind,request,checked,elapsed:performance.now()-start});return;}
 const ast=compiler.ast(source);
 self.postMessage({revision,checked,ast,elapsed:performance.now()-start,version:compiler.version});
};
