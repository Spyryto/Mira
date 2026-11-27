// Presentation-only scanner for Mira. The Haxe compiler remains authoritative.
// No HTML parsing, regex replacements on HTML, or editor dependency.
const wordStart = c => /[A-Za-z_]/.test(c ?? '') && !!c;
const wordPart = c => /[A-Za-z0-9_]/.test(c ?? '') && !!c;
const digit = c => /[0-9]/.test(c ?? '') && !!c;
const twoCharOperators = new Set(['>>', '==', '!=', '<=', '>=', '&&', '||', '::', '->', '=>', '**']);
const singleOperators = new Set(['=', '+', '-', '*', '/', '%', '~', '<', '>', '!','|']);

export function tokenizeMira(source) {
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
        add(text === 'true' || text === 'false' ? 'boolean'
          : text === '_' ? 'placeholder'
          : ['field','if','then','else','import','use','where','AND','OR','NOT','module','export','extern','type','view','component','match','case'].includes(text) ? 'keyword' : 'plain', text);
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

export function mountMiraHighlight(textarea, mirror, doc = document) {
  let previous = null;
  const syncScroll = () => {
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
  };
  const update = () => {
    const source = textarea.value;
    if (previous === source) { syncScroll(); return; }
    previous = source;
    const fragment = doc.createDocumentFragment();
    for (const token of tokenizeMira(source)) {
      if (token.kind === 'plain') {
        fragment.append(doc.createTextNode(token.text));
      } else {
        const span = doc.createElement('span');
        span.className = 'mira-syntax-' + token.kind;
        span.textContent = token.text;
        fragment.append(span);
      }
    }
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

/* Render as text nodes, never HTML. The scanner is visual, not semantic. */
export function highlightCode(node, source, language='mira') {
  const doc=node.ownerDocument;
  const fragment=doc.createDocumentFragment();
  const tokens=language==='mira'?tokenizeMira(source):tokenizeCode(source,language);
  for(const token of tokens) {
    if(token.kind==='plain') fragment.append(doc.createTextNode(token.text));
    else {const span=doc.createElement('span');span.className='mira-syntax-'+token.kind;span.textContent=token.text;fragment.append(span);}
  }
  node.replaceChildren(fragment);
}
export function tokenizeCode(source, language) {
  if(source.length>50000)return [{kind:'plain',text:source}];
  const pattern=/\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\x60(?:\\.|[^\x60\\])*\x60|\b\d+(?:\.\d+)?\b|\b(?:const|let|var|function|return|class|public|private|static|new|if|else|while|for|import|export|package|enum|typedef|abstract|interface|true|false|null|echo|namespace|use|switch|case|throw|try|catch|final|extends|implements|async|await)\b|[=+*/<>!~%&|:-]+|[{}()[\],;]/g;
  const parts=[];let last=0;
  for(const match of source.matchAll(pattern)){
    const t=match[0];if(match.index>last)parts.push({kind:'plain',text:source.slice(last,match.index)});
    const kind=/^(\/\/|\/\*|#)/.test(t)?'comment':/^["'\x60]/.test(t)?'string':/^\d/.test(t)?'number':/^[a-z]/i.test(t)?'keyword':/^[{}()[\],;]$/.test(t)?'punctuation':'operator';
    parts.push({kind,text:t});last=match.index+t.length;
  }
  if(last<source.length)parts.push({kind:'plain',text:source.slice(last)});
  return parts;
}
