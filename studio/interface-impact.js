(function(){
  'use strict';
  // Diagnostic only: no cache keys, no claims of safe reuse.
  function sourceDelta(before,after){
    if(!before?.sourceInputs||!after?.sourceInputs)return null;
    const group=inputs=>{
      const result=new Map();
      for(const item of inputs.reads){
        if(!result.has(item.path))result.set(item.path,[]);
        result.get(item.path).push(item.fingerprint);
      }
      return result;
    };
    const prior=group(before.sourceInputs),next=group(after.sourceInputs);
    const changed=[],added=[],removed=[];
    for(const [path,digests] of next){
      if(!prior.has(path))added.push(path);
      else if(JSON.stringify(prior.get(path))!==JSON.stringify(digests))changed.push(path);
    }
    for(const path of prior.keys())if(!next.has(path))removed.push(path);
    return {entryChanged:before.sourceInputs.entry!==after.sourceInputs.entry,
      changed:changed.sort(),added:added.sort(),removed:removed.sort()};
  }
  function linkDelta(before,after){
    if(!Array.isArray(before?.dependencies)||!Array.isArray(after?.dependencies))return null;
    const selections=report=>{
      const result=new Map();
      for(const d of report.dependencies)if(d.contract){
        if(!result.has(d.contract))result.set(d.contract,new Set());
        result.get(d.contract).add(d.to);
      }
      return result;
    };
    const a=selections(before),b=selections(after),changed=[];
    const signature=values=>JSON.stringify([...values||[]].sort());
    for(const name of new Set([...a.keys(),...b.keys()]))
      if(signature(a.get(name))!==signature(b.get(name)))changed.push(name);
    return changed.sort();
  }
  function compare(before,after,previousConfig,nextConfig){
    const prior=new Map((before?.interfaces||[]).map(m=>[m.module,m]));
    const next=new Map(after.interfaces.map(m=>[m.module,m]));
    const changed=[],added=[],removed=[],providers=[],unchanged=[];
    for(const [name,m] of next){
      const p=prior.get(name);
      if(!p){added.push(name);continue;}
      if(p.canonical!==m.canonical)changed.push(name);
      else unchanged.push(name);
      if(p.resolvedModule!==m.resolvedModule)providers.push(name);
    }
    for(const name of prior.keys())if(!next.has(name))removed.push(name);
    const reverse=new Map();
    let incomplete=false;
    for(const report of [before,after]){
      if(!report)continue;
      if(!Array.isArray(report.dependencies)){incomplete=true;continue;}
      const logical=new Map(report.interfaces.map(m=>[m.resolvedModule,m.module]));
      const names=new Set(report.interfaces.map(m=>m.module));
      const normalize=name=>logical.get(name)||name;
      for(const d of report.dependencies){
        if(d.kind==='implements')continue;
        if(d.kind==='file'||!d.from){incomplete=true;continue;}
        const from=normalize(d.from),to=normalize(d.to);
        if(!names.has(from)||!names.has(to)){incomplete=true;continue;}
        if(from===to)continue;
        if(!reverse.has(to))reverse.set(to,new Set());
        reverse.get(to).add(from);
      }
    }
    const roots=new Set([...changed,...added,...removed]);
    const visited=new Set(roots),queue=[...roots],affected=[];
    for(let i=0;i<queue.length;i++)for(const name of reverse.get(queue[i])||[]){
      if(visited.has(name))continue;
      visited.add(name);queue.push(name);
      if(next.has(name))affected.push(name);
    }
    const sorted=a=>a.sort();
    return {initial:!before,changed:sorted(changed),added:sorted(added),removed:sorted(removed),
      unchanged:sorted(unchanged),providers:sorted(providers),affected:before?sorted(affected):[],incomplete,
      sources:sourceDelta(before,after),linking:linkDelta(before,after),
      hostChanged:previousConfig&&nextConfig?previousConfig.host!==nextConfig.host:null,
      bindingsChanged:previousConfig&&nextConfig?previousConfig.bindings!==nextConfig.bindings:null};
  }
  globalThis.MiraInterfaceImpact={compare};
})();
