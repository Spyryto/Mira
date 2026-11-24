// Presentation-only scanner for Mira. The Haxe compiler remains authoritative.
// No HTML parsing, regex replacements on HTML, or editor dependency.
const wordStart = c => /[A-Za-z_]/.test(c ?? '') && !!c;
const wordPart = c => /[A-Za-z0-9_]/.test(c ?? '') && !!c;
const digit = c => /[0-9]/.test(c ?? '') && !!c;
const twoCharOperators = new Set(['>>', '==', '!=', '<=', '>=', '&&', '||']);
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
          : text === 'field' ? 'keyword' : 'plain', text);
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
