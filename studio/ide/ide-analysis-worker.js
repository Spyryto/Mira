importScripts('./compiler.js');
self.onmessage=({data:{revision,source,kind,request,line,column,modules}})=>{
 const start=performance.now();
 const compiler=self.MiraStudioCompiler;
 if(kind==='scope'){self.postMessage({kind,request,checked:compiler.scopeAt(source,line,column,null,modules),elapsed:performance.now()-start});return;}
 const checked=compiler.check(source,null,modules);
 if(kind==='fields'){self.postMessage({kind,request,checked,elapsed:performance.now()-start});return;}
 const ast=compiler.ast(source,null,modules);
 const interfaces=checked.ok&&modules?compiler.interfaces(source,null,modules):null;
 self.postMessage({revision,checked,ast,interfaces,elapsed:performance.now()-start,version:compiler.version});
};
