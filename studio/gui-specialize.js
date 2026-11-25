// Experimental fixed-shape UI pass. Reads the real resolved Mira AST.
// The ordinary Mira compiler compiles all expressions and transitions.
// The generic DOM host validates and mounts the initial tree once.
(function(global){
  'use strict';
  const fail=message=>{throw new Error('Unsupported specialized view: '+message);};
  const literal=node=>['Number','Text','Boolean'].includes(node?.kind);
  const identifier=name=>typeof name==='string'&&/^[A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*$/.test(name);
  function fields(node,required){
    if(node?.kind!=='Record')fail('expected a literal record');
    const map=new Map(node.fields.map(f=>[f.key,f.value]));
    if(map.size!==node.fields.length||map.size!==required.length||required.some(k=>!map.has(k)))fail('record fields');
    return map;
  }
  function expression(node,parameter){
    if(node?.kind==='Name'&&node.value===parameter)return {source:parameter,dynamic:true};
    if(node?.kind==='Number'&&/^\d+(?:\.\d+)?$/.test(String(node.value)))return {source:String(node.value),dynamic:false};
    if(node?.kind==='Text')return {source:JSON.stringify(node.value),dynamic:false};
    if(node?.kind==='Boolean')return {source:String(node.value),dynamic:false};
    if(node?.kind==='Binary'&&['+','-','*','/','%','==','!=','<','>','<=','>='].includes(node.symbol)){
      const left=expression(node.left,parameter),right=expression(node.right,parameter);
      return {source:'('+left.source+' '+node.symbol+' '+right.source+')',dynamic:left.dynamic||right.dynamic};
    }
    fail('text expression '+String(node?.kind));
  }
  function staticStyles(node){
    if(node?.kind!=='Sequence'||node.items.length>32)fail('literal style list');
    for(const item of node.items){
      if(item.kind!=='Record'||item.fields.some(f=>!literal(f.value)))fail('static style record');
    }
  }
  function analyze(ast,selector){
    if(ast?.kind!=='Program'||ast.definitions.some(d=>d.kind!=='Function'))fail('only function definitions');
    const definition=ast.definitions.find(d=>d.selector===selector);
    if(!definition||definition.parameters.length!==1||!identifier(definition.parameters[0])||
        !definition.labels.every(identifier))fail('unary view selector');
    const parameter=definition.parameters[0],slots=[],buttons=[];
    let count=0;
    function visit(node,path,depth){
      if(++count>1000||depth>24)fail('size/depth limit');
      if(node?.kind!=='Record')fail('fixed record tree');
      const type=node.fields.find(f=>f.key==='type')?.value;
      if(type?.kind!=='Text')fail('literal node type');
      switch(type.value){
        case 'styled':{
          const f=fields(node,['type','view','styles']);
          staticStyles(f.get('styles'));visit(f.get('view'),path,depth+1);break;
        }
        case 'column':case 'row':case 'grid':{
          const f=fields(node,type.value==='grid'?['type','columns','children']:['type','children']);
          if(type.value==='grid'&&f.get('columns').kind!=='Number')fail('static grid columns');
          const children=f.get('children');
          if(children.kind!=='Sequence')fail('static children');
          children.items.forEach((child,i)=>visit(child,[...path,i],depth+1));break;
        }
        case 'title':case 'text':{
          const f=fields(node,['type','text']);
          const expr=expression(f.get('text'),parameter);
          // Even constant expressions are evaluated by the regular compiler
          // at mount; only state-dependent expressions enter the hot path.
          if(expr.dynamic)slots.push({path,source:expr.source});break;
        }
        case 'button':{
          const f=fields(node,['type','label','update']);
          const action=f.get('update');
          if(f.get('label').kind!=='Text'||action.kind!=='Section'||action.arguments.length!==1||
             action.arguments[0].kind!=='Placeholder')fail('static unary transition section');
          buttons.push(path);break;
        }
        default:fail('node type '+type.value);
      }
    }
    visit(definition.body,[],0);
    return {parameter,slots,buttons,viewName:definition.labels.map(s=>s.replaceAll(' ','_')).join('__')};
  }
  function compile(compiler,source,selector){
    const ast=compiler.ast(source);
    if(!ast.ok)throw new Error(ast.message);
    const plan=analyze(JSON.parse(ast.output),selector);
    // No JS expression emitter here. Reconstruct the restricted expression
    // subset as Mira source, and ask the ordinary compiler to emit it.
    const generated=source+'\ngui specialization values: '+plan.parameter+' = ['+
      plan.slots.map(slot=>slot.source).join(', ')+'];\n';
    const compiled=compiler.compile(generated,'js');
    if(!compiled.ok)throw new Error(compiled.message);
    const program=new Function(compiled.output+'\nreturn {view:'+plan.viewName+
      ', values:gui_specialization_values};')();
    return {plan,program};
  }
  const primitive=value=>value===null||['number','string','boolean'].includes(typeof value);
  function mount(compiled,target,initial,onError=error=>{throw new Error(error);}){
    if(!primitive(initial))fail('primitive state');
    const {plan,program}=compiled;
    let state=initial,bindings=[];
    function update(transition){
      const next=transition(state);
      if(!primitive(next))fail('primitive next state');
      // Compute every dynamic value before writing anything to the DOM.
      const values=program.values(next).map(value=>String(value??''));
      for(let i=0;i<bindings.length;i++){
        if(bindings[i].value!==values[i]){
          bindings[i].node.textContent=values[i];
          bindings[i].value=values[i];
        }
      }
      state=next;
    }
    function staticTree(spec){
      switch(spec.type){
        case 'styled':return {...spec,view:staticTree(spec.view)};
        case 'row':case 'column':case 'grid':return {...spec,children:spec.children.map(staticTree)};
        case 'button':return {type:'button',label:spec.label,onClick:()=>update(spec.update)};
        default:return spec;
      }
    }
    const tree=staticTree(program.view(initial));
    const host=global.MiraUiHost.createUiHost(target.ownerDocument,target,onError);
    host.render({type:'state',initial,view:()=>tree});
    const root=target.children[0].children[0];
    bindings=plan.slots.map(slot=>{
      let node=root;
      for(const index of slot.path)node=node.children[index];
      return {node,value:node.textContent};
    });
    return {dynamicSlots:bindings.length,getState:()=>state};
  }
  global.MiraGuiSpecialize=Object.freeze({analyze,compile,mount});
})(globalThis);
