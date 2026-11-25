// Experimental fixed-shape UI pass. Reads the real resolved Mira AST.
// The ordinary Mira compiler compiles all expressions and transitions.
// The generic DOM host validates and mounts the initial tree once.
(function(global){
  'use strict';
  const fail=message=>{throw new Error('Unsupported specialized view: '+message);};
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
    if(node?.kind==='FieldGet'&&identifier(node.key)&&!node.key.includes(' ')){
      const receiver=expression(node.record,parameter);
      return {source:'('+receiver.source+' ~ '+node.key+')',dynamic:receiver.dynamic};
    }
    if(node?.kind==='Conditional'){
      const test=expression(node.condition,parameter),yes=expression(node.whenTrue,parameter),no=expression(node.whenFalse,parameter);
      return {source:'(if ('+test.source+') then '+yes.source+' else '+no.source+')',
        dynamic:test.dynamic||yes.dynamic||no.dynamic};
    }
    fail('slot expression '+String(node?.kind));
  }
  function styleLayer(node,parameter){
    if(node?.kind!=='Sequence'||node.items.length>32)fail('literal style list');
    let dynamic=false;
    const records=node.items.map(item=>{
      if(item.kind!=='Record')fail('literal style record');
      return '{'+item.fields.map(f=>{
        if(!identifier(f.key)||f.key.includes(' '))fail('style key');
        const expr=expression(f.value,parameter);
        dynamic ||= expr.dynamic;
        return f.key+': '+expr.source;
      }).join(', ')+'}';
    });
    return {source:'['+records.join(', ')+']',dynamic};
  }
  // Conservative proof that a transition block captures no view parameter.
  // Ordinary compiler still owns its semantics and code generation.
  function closed(node,parameters){
    switch(node?.kind){
      case 'Name':return parameters.includes(node.value);
      case 'Number':case 'Text':case 'Boolean':return true;
      case 'FieldGet':return closed(node.record,parameters);
      case 'Binary':return closed(node.left,parameters)&&closed(node.right,parameters);
      case 'Conditional':return [node.condition,node.whenTrue,node.whenFalse].every(x=>closed(x,parameters));
      case 'Record':return node.fields.every(f=>closed(f.value,parameters));
      case 'Sequence':return node.items.every(x=>closed(x,parameters));
      default:return false;
    }
  }
  function transition(node,arity){
    return node?.kind==='Section'&&node.arguments.length===arity&&node.arguments.every(a=>a.kind==='Placeholder') ||
      node?.kind==='Block'&&node.parameters.length===arity&&closed(node.body,node.parameters);
  }
  // Expand only a side-effect-free, finite subset of ordinary selectors.
  // Substitutions use the callee's lexical environment, never the caller's.
  function literalData(node){
    switch(node?.kind){
      case 'Number':case 'Text':case 'Boolean':return true;
      case 'Record':return node.fields.every(f=>literalData(f.value));
      case 'Sequence':return node.items.every(literalData);
      default:return false;
    }
  }
  // Preserve eager argument evaluation: every formal must occur outside
  // deferred blocks or conditional branches (unless the actual is literal).
  function strictNames(node,names=new Set()){
    switch(node?.kind){
      case 'Name':names.add(node.value);break;
      case 'Record':node.fields.forEach(f=>strictNames(f.value,names));break;
      case 'Sequence':node.items.forEach(x=>strictNames(x,names));break;
      case 'Call':node.arguments.forEach(x=>strictNames(x,names));break;
      case 'FieldGet':strictNames(node.record,names);break;
      case 'Binary':strictNames(node.left,names);strictNames(node.right,names);break;
      case 'Conditional':strictNames(node.condition,names);break;
    }
    return names;
  }
  function expandView(ast,definition){
    const functions=new Map(ast.definitions.filter(d=>d.kind==='Function').map(d=>[d.selector,d]));
    const constants=new Map(ast.definitions.filter(d=>d.kind==='Value').map(d=>[d.name,d.body]));
    if([...constants.values()].some(value=>!literalData(value)))fail('only literal global data');
    let work=0,calls=0;
    function expand(node,env,stack,depth){
      if(++work>20000||depth>64)fail('component expansion limit');
      const child=x=>expand(x,env,stack,depth+1);
      switch(node?.kind){
        case 'Name':
          if(env.has(node.value))return env.get(node.value);
          if(constants.has(node.value))return constants.get(node.value);
          fail('unbound component name '+node.value);break;
        case 'Number':case 'Text':case 'Boolean':return node;
        case 'Record':return {...node,fields:node.fields.map(f=>({...f,value:child(f.value)}))};
        case 'Sequence':return {...node,items:node.items.map(child)};
        case 'FieldGet':return {...node,record:child(node.record)};
        case 'Binary':return {...node,left:child(node.left),right:child(node.right)};
        case 'Conditional':return {...node,condition:child(node.condition),whenTrue:child(node.whenTrue),whenFalse:child(node.whenFalse)};
        case 'Block':
          if(!closed(node.body,node.parameters))fail('captured or unsupported component block');
          return node;
        case 'Section':
          if(node.arguments.some(a=>a.kind!=='Placeholder'))fail('captured component section');
          return node;
        case 'Call':{
          const target=functions.get(node.selector);
          if(!target||stack.includes(node.selector)||target.parameters.length!==node.arguments.length)
            fail('recursive or unresolved component '+node.selector);
          const args=node.arguments.map(child);
          const strict=strictNames(target.body);
          if(target.parameters.some((name,i)=>!strict.has(name)&&!literalData(args[i])))
            fail('non-strict component argument '+node.selector);
          calls++;
          const local=new Map(target.parameters.map((name,i)=>[name,args[i]]));
          return expand(target.body,local,[...stack,node.selector],depth+1);
        }
        default:fail('component expression '+String(node?.kind));
      }
    }
    const parameter=definition.parameters[0];
    const body=expand(definition.body,new Map([[parameter,{kind:'Name',value:parameter}]]),[definition.selector],0);
    // Bound the fully expanded tree, including repeated substitutions.
    let nodes=0;
    function check(node,depth=0){
      if(++nodes>20000||depth>64)fail('expanded component size/depth limit');
      for(const value of Object.values(node)){
        if(value&&typeof value==='object'){
          if(Array.isArray(value))for(const item of value){if(item&&typeof item==='object')check(item,depth+1);}
          else check(value,depth+1);
        }
      }
    }
    check(body);
    return {body,calls};
  }
  function analyze(ast,selector){
    if(ast?.kind!=='Program'||ast.definitions.some(d=>!['Function','Value'].includes(d.kind)))fail('only functions and literal data definitions');
    const definition=ast.definitions.find(d=>d.selector===selector);
    if(!definition||definition.parameters.length!==1||!identifier(definition.parameters[0])||
        !definition.labels.every(identifier))fail('unary view selector');
    const parameter=definition.parameters[0],slots=[],buttons=[];
    let count=0;
    function visit(node,path,depth,layers=[]){
      if(++count>1000||depth>24)fail('size/depth limit');
      if(node?.kind!=='Record')fail('fixed record tree');
      const type=node.fields.find(f=>f.key==='type')?.value;
      if(type?.kind!=='Text')fail('literal node type');
      if(type.value!=='styled'&&layers.some(layer=>layer.dynamic)){
        slots.push({kind:'style',path,source:'['+[...layers].reverse().map(layer=>layer.source).join(', ')+']'});
      }
      switch(type.value){
        case 'styled':{
          const f=fields(node,['type','view','styles']);
          visit(f.get('view'),path,depth+1,[...layers,styleLayer(f.get('styles'),parameter)]);break;
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
          if(expr.dynamic)slots.push({kind:'text',path,source:expr.source});break;
        }
        case 'button':{
          const f=fields(node,['type','label','update']);
          const action=f.get('update');
          if(f.get('label').kind!=='Text'||!transition(action,1))fail('static unary transition');
          buttons.push(path);break;
        }
        case 'input':case 'checkbox':case 'select':{
          const property=type.value==='checkbox'?'checked':'value';
          const f=fields(node,['type','label',property,'update',...(type.value==='select'?['options']:[])]);
          if(f.get('label').kind!=='Text'||!transition(f.get('update'),2))fail('static label and closed binary transition');
          let options;
          if(type.value==='select'){
            const list=f.get('options');
            if(list.kind!=='Sequence'||list.items.some(item=>item.kind!=='Text'))fail('static select options');
            options=list.items.map(item=>item.value);
          }
          const expr=expression(f.get(property),parameter);
          // Include even constant controlled values: a rejected edit must be restored.
          slots.push({kind:'control',type:type.value,path,source:expr.source,options});
          break;
        }
        default:fail('node type '+type.value);
      }
    }
    const expanded=expandView(ast,definition);
    visit(expanded.body,[],0);
    return {parameter,slots,buttons,expandedCalls:expanded.calls,viewName:definition.labels.map(s=>s.replaceAll(' ','_')).join('__')};
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
  function data(value,depth=0){
    if(value===null||['number','string','boolean'].includes(typeof value))return true;
    return depth<24&&value!==null&&typeof value==='object'&&
      Object.values(value).every(child=>data(child,depth+1));
  }
  const slotValue=(slot,value)=>slot.kind==='style'
    ? global.MiraUiHost.resolveStyles(value) : slot.kind==='control'
      ? global.MiraUiHost.controlValue(slot.type,value,slot.options) : String(value??'');
  function mount(compiled,target,initial,onError=error=>{throw new Error(error);}){
    if(!data(initial))fail('data state');
    const {plan,program}=compiled;
    let state=initial,bindings=[],mountedRoot=null;
    const controls=new Map();
    const active=()=>mountedRoot!==null&&target.children[0]===mountedRoot;
    function update(transition){
      if(!active())return;
      const next=transition(state);
      if(!data(next))fail('data next state');
      const values=program.values(next).map((value,i)=>slotValue(plan.slots[i],value));
      for(let i=0;i<bindings.length;i++){
        const binding=bindings[i],value=values[i];
        if(plan.slots[i].kind==='style'){
          for(const [key,css] of Object.entries(value)){
            if(binding.value[key]!==css)binding.node.style.setProperty(key,css);
          }
        }else if(plan.slots[i].kind==='control'){
          binding.control.sync(value);
        }else if(binding.value!==value){
          binding.node.textContent=value;
        }
        binding.value=value;
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
    const values=program.values(initial).map((value,i)=>slotValue(plan.slots[i],value));
    const host=global.MiraUiHost.createUiHost(target.ownerDocument,target,onError,
      (control,type,binding,report)=>{
        const item={slot:null};
        item.sync=global.MiraUiHost.connectControl(control,type,{
          active:()=>active()&&binding.active(),
          read:()=>item.slot.value,
          apply:value=>update(old=>binding.transition()(old,value))
        },report);
        controls.set(control,item);
        return item.sync;
      });
    host.render({type:'state',initial,view:()=>tree});
    mountedRoot=target.children[0];
    const root=mountedRoot.children[0];
    bindings=plan.slots.map((slot,i)=>{
      let node=root;
      for(const index of slot.path)node=node.children[index];
      const binding={node,value:values[i]};
      if(slot.kind==='control'){
        binding.control=controls.get(node.children[1]);
        binding.control.slot=binding;
      }
      return binding;
    });
    return {dynamicSlots:bindings.length,getState:()=>state};
  }
  function compileHybrid(compiler,source,selectors){
    if(!Array.isArray(selectors)||!selectors.length||selectors.length>100)
      fail('bounded nonempty region list');
    const astResult=compiler.ast(source);
    if(!astResult.ok)throw new Error(astResult.message);
    const ast=JSON.parse(astResult.output);
    if(ast.definitions.some(d=>!['Function','Value'].includes(d.kind)))fail('no top-level statements');
    const names=selectors.map(selector=>{
      const def=ast.definitions.find(d=>d.selector===selector);
      if(!def||def.parameters.length!==1||!def.labels.every(identifier))fail('unary region selector');
      return def.labels.map(label=>label.replaceAll(' ','_')).join('__');
    });
    const code=compiler.compile(source,'js');
    if(!code.ok)throw new Error(code.message);
    const views=new Function(code.output+'\nreturn ['+names.join(',')+'];')();
    const cache=new Map();
    const regions=selectors.map((selector,index)=>{
      if(!cache.has(selector)){
        try{
          const result=compile(compiler,source,selector);
          cache.set(selector,{specialized:{slots:result.plan.slots,values:result.program.values},reason:null});
        }catch(error){
          if(!String(error.message).startsWith('Unsupported specialized view: '))throw error;
          cache.set(selector,{specialized:null,reason:String(error.message)});
        }
      }
      return {selector,view:views[index],...cache.get(selector)};
    });
    return {regions};
  }
  function mountHybrid(compiled,target,initial,onError=error=>{throw new Error(error);}){
    const host=global.MiraUiHost.createUiHost(target.ownerDocument,target,onError);
    return host.renderHybrid(compiled.regions,initial,value=>{
      if(!data(value))fail('data state');
    },slotValue);
  }
  global.MiraGuiSpecialize=Object.freeze({analyze,compile,mount,compileHybrid,mountHybrid});
})(globalThis);
