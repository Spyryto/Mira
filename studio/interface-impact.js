(function(){
  'use strict';
  // Diagnostic only: no cache keys, no claims of safe reuse.
  function compare(before,after){
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
      unchanged:sorted(unchanged),providers:sorted(providers),affected:before?sorted(affected):[],incomplete};
  }
  globalThis.MiraInterfaceImpact={compare};
})();
