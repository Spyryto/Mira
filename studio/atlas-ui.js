// Mira Atlas: browser rendering, navigation and interactive diagrams.
// Data projections come from precompiled studio/atlas/atlas.mira, not JS clones.
import {
  atlas_stages, atlas_modules, atlas_declarations, atlas_ast, atlas_overview,
  atlas_select_modules
} from './atlas-program.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const order = ['Lexer', 'Parser', 'Resolver', 'Core', 'Emitter', 'Studio', 'Tooling'];
const safeText = value => String(value ?? '');
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = safeText(text);
  return element;
}
function action(text, callback, className = '') {
  const button = node('button', className, text);
  button.type = 'button';
  button.addEventListener('click', callback);
  return button;
}
function svgElement(tag, attributes = {}, value) {
  const item = document.createElementNS(SVG_NS, tag);
  for (const [key, val] of Object.entries(attributes)) {
    item.setAttribute(key, String(val));
  }
  if (value !== undefined) item.textContent = safeText(value);
  return item;
}
function codeBlock(value) {
  const pre = node('pre', 'atlas-code', value);
  pre.tabIndex = 0;
  return pre;
}
function card(title, sub, body) {
  const item = node('article', 'atlas-card');
  item.append(node('strong', '', title));
  if (sub) item.append(node('small', '', sub));
  if (body) item.append(node('p', '', body));
  return item;
}
function githubFiles(parent, files) {
  if (!files?.length) return;
  const box = node('div', 'atlas-files');
  box.append(node('span', '', 'Codice sorgente →'));
  for (const path of files) {
    const link = node('a', '', path.split('/').at(-1));
    link.href = 'https://github.com/Spyryto/Mira/blob/main/' + path;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = path;
    box.append(link);
  }
  parent.append(box);
}
function expressionTree(root, value, limit = {count:0}, depth = 0) {
  if (++limit.count > 1200 || depth > 18) {
    root.append(node('span', 'atlas-tree-leaf', '… limite di visualizzazione'));
    return;
  }
  if (value === null || typeof value !== 'object') {
    root.append(node('span', 'atlas-tree-leaf', JSON.stringify(value)));
    return;
  }
  if (Array.isArray(value)) {
    const details = node('details', 'atlas-tree-branch');
    if (depth <= 1) details.open = true;
    details.append(node('summary', '', 'Lista · ' + value.length + ' elementi'));
    const inner = node('div', 'atlas-tree-children');
    value.forEach((child, i) => {
      const box = node('div');
      box.append(node('span', 'atlas-tree-key', '#' + (i + 1) + ' '));
      expressionTree(box, child, limit, depth + 1);
      inner.append(box);
    });
    details.append(inner);
    root.append(details);
    return;
  }
  const title = safeText(value.kind ?? value.name ?? 'Record');
  const details = node('details', 'atlas-tree-branch');
  details.open = depth < 2;
  details.append(node('summary', '', title));
  const children = node('div', 'atlas-tree-children');
  for (const [key, child] of Object.entries(value)) {
    const line = node('div');
    line.append(node('span', 'atlas-tree-key', key + ': '));
    expressionTree(line, child, limit, depth + 1);
    children.append(line);
  }
  details.append(children);
  root.append(details);
}

export function mountAtlas(root, compiler, getSource, getHostJson) {
  let data = null;
  let stages = [];
  let modules = [];
  let program = null;
  let selectedStage = 'tokens';
  let selectedModule = null;
  let mode = 'journey';
  let traceCache = null;
  let cachedSource = null;
  let cachedHost = null;

  const title = node('div', 'atlas-heading');
  title.append(node('h2', '', 'Mira Atlas'),
    node('p', '', 'Esplora il compilatore e le dipendenze reali del progetto.'));
  const switcher = node('div', 'atlas-switcher');
  const content = node('section', 'atlas-content');
  const message = node('div', 'atlas-message', 'Caricamento dei dati del progetto…');
  root.replaceChildren(title, switcher, message, content);

  function chooseMode(next) {
    mode = next;
    render();
  }
  function drawModes() {
    switcher.replaceChildren();
    for (const [id, label] of [
      ['journey', 'Viaggio del codice'], ['graph', 'Mappa architetturale']
    ]) {
      const button = action(label, () => chooseMode(id),
        'atlas-mode' + (mode === id ? ' selected' : ''));
      button.setAttribute('aria-pressed', String(mode === id));
      switcher.append(button);
    }
  }
  function checked(call, label) {
    const result = call();
    if (!result?.ok) throw new Error(label + ': ' +
      (result?.message ?? 'operazione non riuscita'));
    return result.output;
  }
  function trace() {
    const source = getSource();
    const host = getHostJson();
    // Stage switching reuses one compilation snapshot. Editing the source or
    // changing the declared host invalidates the snapshot.
    if (traceCache && source === cachedSource && host === cachedHost) {
      return traceCache;
    }
    const result = {
      source,
      tokens: null,
      declarations: null,
      symbols: null,
      ast: null,
      js: null,
      php: null,
      errors: {}
    };
    for (const [key, call] of [
      ['tokens', () => compiler.tokens(source)],
      ['trace', () => compiler.trace(source, host)],
      ['ast', () => compiler.ast(source, host)],
      ['js', () => compiler.compile(source, 'js', host)],
      ['php', () => compiler.compile(source, 'php', host)]
    ]) {
      try {
        const text = checked(call, key);
        if (key === 'trace') {
          const parsed = JSON.parse(text);
          result.declarations = parsed.declarations;
          result.symbols = parsed.symbols;
        } else {
          result[key] = ['tokens','ast'].includes(key) ? JSON.parse(text) : text;
        }
      } catch (error) {
        if (key === 'trace') {
          result.errors.declarations = safeText(error.message);
          result.errors.symbols = safeText(error.message);
        } else result.errors[key] = safeText(error.message);
      }
    }
    traceCache = result;
    cachedSource = source;
    cachedHost = host;
    return result;
  }

  function renderStage(phase, diagnostic) {
    const area = node('div', 'atlas-stage');
    area.append(node('h3', '', phase.title),
      node('p', 'atlas-explain', phase.purpose),
      node('p', 'atlas-produced', 'Produce → ' + phase.produces));
    githubFiles(area, phase.sourceFiles);
    if (diagnostic.errors[phase.id]) {
      area.append(node('p', 'atlas-error', diagnostic.errors[phase.id]));
      return area;
    }
    const value = diagnostic[phase.id];
    if (phase.id === 'source' || phase.id === 'js' || phase.id === 'php') {
      area.append(codeBlock(value));
      return area;
    }
    if (phase.id === 'tokens') {
      const tokens = node('div', 'atlas-tokens');
      const detail = node('p', 'atlas-token-detail',
        'Tocca un token per vedere tipo, valore e posizione nel sorgente.');
      for (const token of value ?? []) {
        if (token.kind === 'End') continue;
        const label = token.value || token.kind;
        tokens.append(action(label, () => {
          detail.textContent = token.kind + ' · ' + JSON.stringify(token.value) +
            ' · riga ' + token.line + ', colonna ' + token.column;
        }, 'atlas-token atlas-token-' + token.kind.toLowerCase()));
      }
      area.append(tokens, detail);
    } else if (phase.id === 'declarations') {
      const cards = atlas_declarations(value ?? []);
      area.append(node('p', 'atlas-count', cards.length + ' definizioni riconosciute.'));
      for (const item of cards) {
        area.append(card(item.name, item.kind + ' · riga ' + item.line,
          item.tokens + ' token nel corpo · ' + item.parameters.length + ' parametri'));
      }
    } else if (phase.id === 'symbols') {
      area.append(node('p', 'atlas-count', (value ?? []).length +
        ' firme e riferimenti conosciuti dal resolver.'));
      for (const item of value ?? []) {
        area.append(card(item.name, item.kind,
          (item.parameters?.length ?? 0) + ' parametri'));
      }
    } else if (phase.id === 'ast') {
      const cards = atlas_ast(value?.definitions ?? []);
      area.append(node('p', 'atlas-count', cards.length +
        ' definizioni trasformate in un AST canonico.'));
      for (const item of cards) {
        area.append(card(item.name, item.kind, 'Riga ' + item.line));
      }
      const tree = node('div', 'atlas-tree');
      expressionTree(tree, value);
      area.append(tree);
    }
    const raw = node('details', 'atlas-raw');
    raw.append(node('summary', '', 'Mostra JSON reale della fase'),
      codeBlock(JSON.stringify(value, null, 2)));
    area.append(raw);
    return area;
  }

  function journey() {
    const result = trace();
    const overview = atlas_overview(data);
    const metrics = node('div', 'atlas-metrics');
    for (const [label, value] of [
      ['Fasi documentate',overview.stages],
      ['Moduli nel grafo',overview.modules],
      ['Import espliciti',overview.dependencies]
    ]) {
      metrics.append(card(String(value), label));
    }
    content.append(metrics);
    const options = node('div', 'atlas-phase-picker');
    for (const phase of stages) {
      const button = action(phase.title, () => {
        selectedStage = phase.id;
        render();
      }, 'atlas-phase-tab' + (selectedStage === phase.id ? ' selected' : ''));
      button.setAttribute('aria-pressed', String(selectedStage === phase.id));
      options.append(button);
    }
    content.append(node('p', 'atlas-explain',
      'Analisi del sorgente attualmente aperto in Scrivi. ' +
      'Modificalo e torna qui per osservare il cambiamento.'));
    content.append(options);
    const refresh = action('Aggiorna dal sorgente', () => render(), 'atlas-refresh');
    content.append(refresh);
    const stage = stages.find(item => item.id === selectedStage) ?? stages[0];
    if (stage) content.append(renderStage(stage, result));
  }
  function drawGraph(available) {
    const groups = order.filter(group => available.some(item => item.group === group));
    const byGroup = new Map(groups.map(group => [group,
      available.filter(item => item.group === group)
        .sort((a,b) => a.title.localeCompare(b.title))]));
    const positions = new Map();
    const colWidth = 210;
    const nodeHeight = 40;
    const rowHeight = 51;
    const width = Math.max(groups.length * colWidth + 24, 400);
    const height = Math.max(...groups.map(group => byGroup.get(group).length), 1) *
      rowHeight + 84;
    const svg = svgElement('svg', {
      viewBox:'0 0 ' + width + ' ' + height, width, height,
      role:'img', 'aria-label':'Grafo degli import espliciti tra moduli'
    });
    const defs = svgElement('defs');
    const arrow = svgElement('marker', {
      id:'atlas-arrow', markerWidth:7, markerHeight:7,
      refX:6, refY:3, orient:'auto'
    });
    arrow.append(svgElement('path', {d:'M0 0 L6 3 L0 6 z',fill:'#a4b7ac'}));
    defs.append(arrow);svg.append(defs);
    groups.forEach((group, col) => {
      const x = col * colWidth + 14;
      svg.append(svgElement('text', {x:x+4,y:20,
        'font-weight':800,'font-size':12,fill:'#334640'},group));
      byGroup.get(group).forEach((mod,row) => positions.set(mod.id, {
        x,y:34+row*rowHeight
      }));
    });
    for (const edge of data.edges) {
      const from = positions.get(edge.from), to = positions.get(edge.to);
      if (!from || !to) continue;
      const startX = from.x + 176, targetX = to.x;
      const startY = from.y + 20, targetY = to.y + 20;
      const curve = Math.max(35, Math.abs(targetX-startX)*.35);
      svg.append(svgElement('path', {
        d:'M'+startX+' '+startY+' C'+(startX+curve)+' '+startY+
          ' '+(targetX-curve)+' '+targetY+' '+targetX+' '+targetY,
        fill:'none',stroke:'#a4b7ac','stroke-width':1.2,
        'marker-end':'url(#atlas-arrow)',opacity:.72
      }));
    }
    for (const item of available) {
      const pos = positions.get(item.id);
      const selected = item.id === selectedModule;
      const group = svgElement('g', {role:'button',tabindex:0,
        'aria-label':'Esplora modulo '+item.path});
      const open = () => {
        selectedModule = item.id;
        showModuleDetail();
      };
      group.addEventListener('click', open);
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); open();
        }
      });
      group.append(svgElement('rect', {
        x:pos.x,y:pos.y,width:176,height:nodeHeight,rx:7,
        fill:selected?'#ffcd9b':'#e9f4ec',stroke:'#273831',
        'stroke-width':selected?2.5:1
      }));
      group.append(svgElement('text', {
        x:pos.x+8,y:pos.y+17,fill:'#243631',
        'font-size':11,'font-weight':750
      },item.title.length>25?item.title.slice(0,22)+'…':item.title));
      group.append(svgElement('text', {
        x:pos.x+8,y:pos.y+32,fill:'#5e7267','font-size':9
      },item.language + ' · ' + item.dependencies + ' import'));
      svg.append(group);
    }
    return svg;
  }
  let detailContainer = null;
  function showModuleDetail() {
    if (!detailContainer || !data) return;
    detailContainer.replaceChildren();
    const item = modules.find(mod => mod.id === selectedModule);
    if (!item) return;
    const raw = data.modules.find(mod => mod.id === item.id);
    detailContainer.append(card(item.title,
      item.group + ' · ' + item.language + ' · ' + item.lines + ' righe',
      item.dependencies + ' import espliciti verso altri moduli del progetto.'));
    githubFiles(detailContainer, [item.path]);
    if (raw.imports.length) {
      detailContainer.append(node('strong', '', 'Usa questi moduli:'));
      const list = node('div', 'atlas-module-list');
      for (const dependency of raw.imports) {
        list.append(action(dependency, () => {
          selectedModule = dependency;
          render();
        }, 'atlas-module-option'));
      }
      detailContainer.append(list);
    }
  }
  function graph() {
    content.append(node('p', 'atlas-explain',
      'Dipendenze derivate dagli import espliciti dei sorgenti Haxe e JS. ' +
      'Le frecce indicano «usa». Chiamate dinamiche e processi CI non sono dedotti. ' +
      'Scorri lateralmente per esplorare la mappa.'));
    const select = node('select', 'atlas-group-filter');
    select.setAttribute('aria-label','Filtra i gruppi della mappa');
    for(const group of ['Tutti',...order]) {
      if(group!=='Tutti'&&!modules.some(m=>m.group===group)) continue;
      const option = node('option','',group);
      option.value=group;
      select.append(option);
    }
    select.value = graph.filter;
    select.addEventListener('change', () => {
      graph.filter=select.value;
      selectedModule=null;
      render();
    });
    content.append(select);
    const eligible = graph.filter==='Tutti'?modules:
      modules.filter(m=>m.group===graph.filter);
    const graphScroller = node('div', 'atlas-graph-scroll');
    graphScroller.append(drawGraph(eligible));
    content.append(graphScroller);
    detailContainer = node('section', 'atlas-module-detail');
    content.append(detailContainer);
    if (!selectedModule && eligible.length) selectedModule=eligible[0].id;
    showModuleDetail();
  }
  graph.filter='Tutti';
  function render() {
    drawModes();
    content.replaceChildren();
    if (!data || !program) return;
    if (mode==='journey') journey();
    else graph();
  }
  const ready = Promise.all([
    fetch('./atlas-data.json').then(response=>{
      if (!response.ok) throw new Error('Dati architetturali HTTP ' + response.status);
      return response.json();
    }),
    Promise.resolve(true)
  ]).then(([dataset]) => {
    if (dataset.version!==1 || !dataset.phases?.length || !dataset.modules?.length) {
      throw new Error('Dati Atlas incompleti');
    }
    data=dataset;
    stages=atlas_stages(data.phases);
    modules=atlas_modules(data.modules);
    program=true;
    message.hidden=true;
    render();
  }).catch(error=>{
    message.textContent='Atlas non disponibile: '+safeText(error.message);
    content.replaceChildren();
  });
  return {
    ready,
    refresh:()=>{
      traceCache = null;
      if(data) render();
    },
    show:chooseMode
  };
}
