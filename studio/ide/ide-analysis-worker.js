importScripts('./compiler.js');
self.onmessage=({data:{revision,source,kind,request,line,column,modules,host,bindings}})=>{
 const start=performance.now();
 const compiler=self.MiraStudioCompiler;
 if(kind==='scope'){self.postMessage({kind,request,checked:compiler.scopeAt(source,line,column,host,modules),elapsed:performance.now()-start});return;}
 const checked=compiler.check(source,host,modules,bindings);
 if(kind==='fields'){self.postMessage({kind,request,checked,elapsed:performance.now()-start});return;}
 const ast=compiler.ast(source,host,modules);
 const interfaces=checked.ok&&modules?compiler.interfaces(source,host,modules,bindings):null;
 self.postMessage({revision,checked,ast,interfaces,elapsed:performance.now()-start,version:compiler.version});
};
