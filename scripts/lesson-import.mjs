import {buildProject} from './project.mjs';

// Compatibility with earlier build scripts; new projects use loadProject.
export function buildLessonImport(compiler,source,decoder,modules,hosts,bindings){
  return buildProject(compiler,{source,decoder,modules,hosts,shared:[],targets:Object.fromEntries(Object.entries(bindings).map(([target,link])=>[target,[link]])),treeShake:true});
}
