importScripts('./compiler.js');
self.onmessage=({data:{revision,source}})=>{
 const start=performance.now();
 const compiler=self.MiraStudioCompiler;
 const checked=compiler.check(source);
 const ast=compiler.ast(source);
 self.postMessage({revision,checked,ast,elapsed:performance.now()-start,version:compiler.version});
};
