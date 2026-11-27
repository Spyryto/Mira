import {highlightCode} from './syntax-highlight.js';

const previous=new WeakMap();
const tagged='pre[data-code-language], code[data-code-language]';
function paint(node){
  if(!node||node.dataset.codeLanguage==='text')return;
  const source=node.textContent;
  if(previous.get(node)===source)return;
  previous.set(node,source);
  highlightCode(node,source,node.dataset.codeLanguage);
}
for(const node of document.querySelectorAll(tagged))paint(node);
// Labs replace textContent with new generated source. Restrict updates to
// explicitly tagged blocks; never transform compiler diagnostics or live UI.
const observer=new MutationObserver(records=>{
  const nodes=new Set();
  for(const record of records){
    const target=record.target.nodeType===1?record.target:record.target.parentElement;
    const block=target?.closest(tagged);if(block)nodes.add(block);
    for(const added of record.addedNodes)if(added.nodeType===1){
      if(added.matches(tagged))nodes.add(added);
      for(const child of added.querySelectorAll(tagged))nodes.add(child);
    }
  }
  for(const node of nodes)paint(node);
});
observer.observe(document.body,{subtree:true,childList:true,characterData:true});

function editor(textarea){
  const language=textarea.dataset.codeLanguage;
  const container=document.createElement('div');container.className='lab-code-editor';
  const mirror=document.createElement('pre');mirror.className='lab-code-mirror';mirror.setAttribute('aria-hidden','true');
  textarea.before(container);container.append(mirror,textarea);
  textarea.wrap='off';
  const sync=()=>{mirror.scrollTop=textarea.scrollTop;mirror.scrollLeft=textarea.scrollLeft;};
  let last;
  const update=()=>{
    if(last!==textarea.value){last=textarea.value;highlightCode(mirror,last,language);if(last.endsWith('\n'))mirror.append(document.createTextNode('\u200b'));}
    sync();
  };
  const layout=()=>{
    const style=getComputedStyle(textarea);
    for(const key of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderRadius'])
      mirror.style[key]=style[key];
    mirror.style.width=textarea.offsetWidth+'px';mirror.style.height=textarea.offsetHeight+'px';
    sync();
  };
  const native=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
  // Only this editor instance is adapted, not the platform prototype.
  Object.defineProperty(textarea,'value',{configurable:true,get(){return native.get.call(this)},set(value){native.set.call(this,value);update();}});
  textarea.addEventListener('input',update);textarea.addEventListener('scroll',sync);
  textarea.classList.add('lab-source-highlighted');
  new ResizeObserver(layout).observe(textarea);
  layout();update();
}
for(const textarea of document.querySelectorAll('textarea[data-code-language]'))editor(textarea);
