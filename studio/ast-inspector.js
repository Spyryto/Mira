import { childrenOf } from './inspector-host.js';

const metricLabels = Object.freeze({
  total: 'Nodi totali',
  functions: 'Funzioni',
  values: 'Valori',
  calls: 'Chiamate',
  binary: 'Operatori',
  sections: 'Sezioni',
  applies: 'Applicazioni'
});

// A stored v1 inspector may not define the new structured report.
const STORAGE_KEY = 'mira-studio:inspector-program:v2';

function labelOf(node) {
  switch (node.kind) {
    case 'Program': return 'Program · ' + (node.definitions?.length ?? 0) + ' definizioni';
    case 'Function': return 'Function · ' + node.selector;
    case 'Value': return 'Value · ' + node.name;
    case 'HostRef': return 'Host · ' + node.name;
    case 'ExpressionStatement': return 'Expression statement';
    case 'Name':
    case 'Text':
    case 'Number': return node.kind + ' · ' + JSON.stringify(node.value);
    case 'Binary': return 'Binary · ' + node.symbol;
    case 'Boolean': return 'Boolean · ' + String(node.value);
    case 'FieldAccessor': return 'Accessor · ' + node.key;
    case 'FieldGet': return 'Campo ~ ' + node.key;
    case 'FieldSection': return 'Sezione campo · ' + node.key;
    case 'Conditional': return 'Conditional · if/then/else';
    case 'Call':
    case 'Section':
    case 'HostCall':
    case 'HostSection': return node.kind + ' · ' + node.selector;
    case 'Apply': return node.argument == null ? 'Apply · 0 argomenti' : 'Apply';
    case 'Placeholder': return 'Placeholder · _';
    case 'Sequence': return 'Sequence · ' + (node.items?.length ?? 0) + ' elementi';
    case 'Record': return 'Record · ' + (node.fields?.length ?? 0) + ' campi';
    case 'Block': return 'Blocco · ' + (node.parameters?.length ? node.parameters.join(', ') : '0 parametri');
    case 'Steps': return 'Espressioni · ' + (node.expressions?.length ?? 0);
    case 'Local': return 'Valore locale · ' + node.name;
    default: return String(node.kind ?? '?');
  }
}

function renderTree(parent, ast) {
  parent.replaceChildren();
  let rendered = 0;
  function visit(node, target) {
    if (rendered++ > 4000) {
      target.append(document.createTextNode('Albero troppo grande da visualizzare.'));
      return;
    }
    const descendants = childrenOf(node);
    const label = labelOf(node);
    if (descendants.length === 0) {
      const leaf = document.createElement('div');
      leaf.className = 'ast-leaf';
      leaf.textContent = label;
      target.append(leaf);
      return;
    }
    const details = document.createElement('details');
    details.className = 'ast-branch';
    // Expand the top two levels; deeper nodes remain interactive.
    details.open = node.kind === 'Program' ||
      node.kind === 'Function' || node.kind === 'Value';
    const summary = document.createElement('summary');
    summary.textContent = label;
    details.append(summary);
    const children = document.createElement('div');
    children.className = 'ast-children';
    for (const child of descendants) visit(child, children);
    details.append(children);
    target.append(details);
  }
  visit(ast, parent);
}

function renderDefinitions(parent, items) {
  parent.replaceChildren();
  for (const item of items ?? []) {
    const row = document.createElement('div');
    row.className = 'inspector-definition';
    const label = document.createElement('strong');
    label.textContent = item.name;
    const info = document.createElement('span');
    info.textContent = item.kind + ' · ' + item.nodes + ' nodi · ' + item.calls + ' chiamate';
    row.append(label, info);
    parent.append(row);
  }
}

function renderMetrics(parent, metrics) {
  parent.replaceChildren();
  for (const [key, label] of Object.entries(metricLabels)) {
    const tile = document.createElement('div');
    tile.className = 'inspector-metric';
    const number = document.createElement('strong');
    number.textContent = String(metrics[key]);
    const name = document.createElement('span');
    name.textContent = label;
    tile.append(number, name);
    parent.append(tile);
  }
}

export function createAstInspector(compiler) {
  const status = document.getElementById('inspectorStatus');
  const stats = document.getElementById('inspectorStats');
  const definitions = document.getElementById('inspectorDefinitions');
  const tree = document.getElementById('inspectorTree');
  const editor = document.getElementById('inspectorProgram');
  const recalculate = document.getElementById('inspectorRecalculate');
  const reset = document.getElementById('inspectorReset');
  let programPromise = null;
  let defaultProgram = '';
  let inspectorHostJson = '';
  let latestSource = '';
  let latestSourceHostJson = undefined;
  let requestId = 0;
  let worker = null;
  let deadline = null;

  async function loadDefaultProgram() {
    if (!programPromise) {
      programPromise = Promise.all([
        fetch('./inspector.mira').then(response => {
          if (!response.ok) throw new Error('Inspector Mira not found: ' + response.status);
          return response.text();
        }),
        fetch('./inspector-host.json').then(response => {
          if (!response.ok) throw new Error('Inspector host manifest not found');
          return response.text();
        })
      ]).then(([source, hostJson]) => {
        inspectorHostJson = hostJson;
        defaultProgram = source;
        try {
          editor.value = localStorage.getItem(STORAGE_KEY) ?? source;
        } catch {
          editor.value = source;
        }
        return source;
      }).catch(error => {
        programPromise = null;
        throw error;
      });
    }
    return programPromise;
  }

  function cancel() {
    requestId++;
    if (deadline !== null) clearTimeout(deadline);
    deadline = null;
    if (worker) worker.terminate();
    worker = null;
  }

  async function refresh(source, sourceHostJson = undefined) {
    cancel();
    latestSource = source;
    latestSourceHostJson = sourceHostJson;
    const id = requestId;
    status.textContent = 'Analisi e trasformazione in Mira…';
    stats.replaceChildren();
    definitions.replaceChildren();
    tree.replaceChildren();

    try {
      await loadDefaultProgram();
      if (id !== requestId) return;

      // Match editor resolution: parse the user's program with its host
      // environment, not with the different inspector-program environment.
      const parsed = compiler.ast(source, sourceHostJson);
      if (!parsed?.ok) {
        throw new Error('AST del programma: ' +
          (parsed?.message ?? 'Impossibile ottenere l’AST'));
      }
      const ast = JSON.parse(parsed.output);

      // The canonical AST does not depend on successful execution of the
      // editable Mira inspector. Keep the tree usable if its reducer fails.
      renderTree(tree, ast);

      const compiled = compiler.compile(editor.value, 'js', inspectorHostJson);
      if (!compiled?.ok) {
        throw new Error('Programma Mira dell’inspector: ' + compiled.message);
      }

      worker = new Worker('./inspector-worker.js', {type: 'module'});
      worker.onmessage = event => {
        if (id !== requestId) return;
        if (deadline !== null) clearTimeout(deadline);
        deadline = null;
        if (!event.data?.ok) {
          status.textContent = 'Errore nell’inspector Mira: ' +
            (event.data?.message ?? 'esecuzione fallita');
          if (worker) worker.terminate();
          worker = null;
          return;
        }
        renderMetrics(stats, event.data.stats);
        renderDefinitions(definitions, event.data.stats.definitions);
        status.textContent = 'Statistiche calcolate da Mira · ' +
          event.data.stats.total + ' nodi attraversati';
        if (worker) worker.terminate();
        worker = null;
      };
      worker.onerror = () => {
        if (id !== requestId) return;
        status.textContent = 'Errore durante l’esecuzione dell’inspector.';
        cancel();
      };
      worker.postMessage({code: compiled.output, ast});
      deadline = setTimeout(() => {
        if (id !== requestId) return;
        status.textContent = 'Esecuzione Mira interrotta: tempo massimo di 2 secondi.';
        cancel();
      }, 2000);
    } catch (error) {
      if (id === requestId) {
        status.textContent = String(error?.message ?? error);
      }
    }
  }

  recalculate.addEventListener('click', () => {
    try { localStorage.setItem(STORAGE_KEY, editor.value); } catch {}
    refresh(latestSource, latestSourceHostJson);
  });

  reset.addEventListener('click', () => {
    editor.value = defaultProgram;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    refresh(latestSource);
  });

  return {refresh, cancel};
}
