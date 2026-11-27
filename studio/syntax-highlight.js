// Presentation-only scanner for Mira. The Haxe compiler remains authoritative.
// No HTML parsing, regex replacements on HTML, or editor dependency.
const wordStart = c => /[A-Za-z_]/.test(c ?? '') && !!c;
const wordPart = c => /[A-Za-z0-9_]/.test(c ?? '') && !!c;
const digit = c => /[0-9]/.test(c ?? '') && !!c;
const twoCharOperators = new Set(['>>', '==', '!=', '<=', '>=', '&&', '||', '::', '->', '=>', '~?']);
const singleOperators = new Set(['=', '+', '-', '*', '/', '%', '~', '<', '>', '!','|']);

function lexical(source) {
  if (source.length > 50000) return [{kind: 'plain', text: source}];
  const parts = [];
  const add = (kind, text) => parts.push({kind, text});
  let i = 0;
  while (i < source.length) {
    const start = i;
    const char = source[i];
    if (/\s/.test(char)) {
      do { i++; } while (i < source.length && /\s/.test(source[i]));
      add('plain', source.slice(start, i));
    } else if (char === '#') {
      while (i < source.length && source[i] !== '\n') i++;
      add('comment', source.slice(start, i));
    } else if (char === '"') {
      i++;
      while (i < source.length) {
        if (source[i] === '\\') { i += Math.min(2, source.length - i); continue; }
        if (source[i++] === '"') break;
      }
      add('string', source.slice(start, i));
    } else if (digit(char)) {
      while (digit(source[i])) i++;
      if (source[i] === '.' && digit(source[i+1])) {
        i++;
        while (digit(source[i])) i++;
      }
      add('number', source.slice(start, i));
    } else if (wordStart(char)) {
      while (wordPart(source[i])) i++;
      const text = source.slice(start, i);
      if (source[i] === ':' && text !== '_') {
        i++;
        add('selector', source.slice(start, i));
      } else {
        add(['AND','OR','NOT'].includes(text) ? 'operator' : text === 'true' || text === 'false' ? 'boolean'
          : text === '_' ? 'placeholder'
          : ['field','if','then','else','import'].includes(text) ? 'keyword' : 'plain', text);
      }
    } else if (twoCharOperators.has(source.slice(i, i+2))) {
      i += 2;
      add('operator', source.slice(start, i));
    } else if (singleOperators.has(char)) {
      i++;
      add('operator', char);
    } else if ('{}[]():,;'.includes(char)) {
      i++;
      add('punctuation', char);
    } else {
      i++;
      add('plain', char);
    }
  }
  return parts;
}

// Apply source-coordinate spans only to the exact source being rendered.
// Preserve comments, whitespace, strings and invalid input verbatim.
export function tokenizeMira(source, compiler = globalThis.MiraStudioCompiler, hostJson, modulesJson) {
  const tokens = lexical(source);
  if (!compiler?.highlight || source.length > 50000) return tokens;
  let report;
  try { report=compiler.highlight(source,hostJson,modulesJson); } catch { return tokens; }
  if (!Array.isArray(report?.spans)) return tokens;
  const lines=[0];
  for(let i=0;i<source.length;i++) if(source[i]==='\n') lines.push(i+1);
  const offset=(line,col)=>lines[line-1]+col-1;
  const spans=report.spans.map(s=>({kind:s.kind,start:offset(s.line,s.column),end:offset(s.endLine,s.endColumn)}))
    .filter(s=>['selector','parameter','field'].includes(s.kind)&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.end<=source.length&&s.end>s.start)
    .sort((a,b)=>a.start-b.start||b.end-a.end);
  const result=[];let pos=0,si=0,lastSpan=null;
  for(const token of tokens){
    const end=pos+token.text.length;
    while(si<spans.length&&spans[si].end<=pos)si++;
    const span=spans[si];
    const applies=span&&span.start<=pos&&span.end>=end&&token.kind!=='comment'&&(token.kind!=='string'||span.kind==='field');
    if(applies&&lastSpan===span)result[result.length-1].text+=token.text;
    else result.push(applies?{kind:span.kind,text:token.text}:token);
    lastSpan=applies?span:null;pos=end;
  }
  return result;
}
export function highlightFragment(source, doc=document, compiler=globalThis.MiraStudioCompiler, hostJson, modulesJson) {
  const fragment=doc.createDocumentFragment();
  for(const token of tokenizeMira(source,compiler,hostJson,modulesJson)){
    if(token.kind==='plain') fragment.append(doc.createTextNode(token.text));
    else {const span=doc.createElement('span');span.className='mira-syntax-'+token.kind;span.textContent=token.text;fragment.append(span);}
  }
  return fragment;
}
export function highlightHtml(source, compiler, hostJson) {
  const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return tokenizeMira(source,compiler,hostJson).map(t=>t.kind==='plain'?escape(t.text):'<span class="mira-syntax-'+t.kind+'">'+escape(t.text)+'</span>').join('');
}
export function mountMiraHighlight(textarea, mirror, doc = document, context = () => ({})) {
  let previous = null, previousHost, previousModules;
  const syncScroll = () => {
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
  };
  const update = () => {
    const source = textarea.value;
    const {compiler=globalThis.MiraStudioCompiler,hostJson,modulesJson}=context();
    if (previous === source && previousHost===hostJson && previousModules===modulesJson) { syncScroll(); return; }
    previous = source;previousHost=hostJson;previousModules=modulesJson;
    const fragment=highlightFragment(source,doc,compiler,hostJson,modulesJson);
    // Keep the final empty line measurable after a trailing newline.
    if (source.endsWith('\n')) fragment.append(doc.createTextNode('\u200b'));
    mirror.replaceChildren(fragment);
    syncScroll();
  };
  const onScroll = () => syncScroll();
  textarea.addEventListener('input', update);
  textarea.addEventListener('scroll', onScroll);
  update();
  doc.body.classList.add('mira-highlight-ready');
  return {
    update,
    syncScroll,
    dispose() {
      textarea.removeEventListener('input', update);
      textarea.removeEventListener('scroll', onScroll);
      doc.body.classList.remove('mira-highlight-ready');
    }
  };
}
