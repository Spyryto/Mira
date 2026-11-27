// Consume the real compiler AST, not a second parser or a regex over code.
// Names are canonical selector references, not a whole-program call graph.
export function collectExampleCalls(ast,libraryLines=0){
  if(ast.kind!=='Program'||!Array.isArray(ast.definitions))throw Error('Invalid example AST');
  const calls=new Set(), sections=new Set();
  function visit(node){
    if(!node||typeof node!=='object')return;
    if(Array.isArray(node)){for(const child of node)visit(child);return;}
    if(typeof node.selector==='string'){
      if(node.kind==='Call'||node.kind==='HostCall')calls.add(node.selector);
      if(node.kind==='Section'||node.kind==='HostSection')sections.add(node.selector);
    }
    for(const child of Object.values(node))if(child&&typeof child==='object')visit(child);
  }
  for(const definition of ast.definitions){
    if(libraryLines&&definition.line<=libraryLines)continue;
    visit(definition.body);
  }
  return {calls:[...calls].sort(),sections:[...sections].sort()};
}

export function analyzeExampleCalls(compiler,example,hostJson,libraryLines){
  const result=compiler.ast(example.source,hostJson);
  if(!result.ok)return {status:example.expect.kind==='error'?'expected-invalid':'unavailable',calls:[],sections:[]};
  return {status:'parsed',...collectExampleCalls(JSON.parse(result.output),libraryLines)};
}
