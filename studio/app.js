import { examples, defaultSource } from './examples.js';
import { mountReference } from './reference-ui.js';
import { createAstInspector } from './ast-inspector.js';
import { mountAtlas } from './atlas-ui.js';
import { mountBenchmark } from './benchmark-ui.js';
import { mountWorkbenchFullscreen } from './workbench-fullscreen.js';
import { mountMiraHighlight, highlightCode } from './syntax-highlight.js';

// Mira Studio's controller concerns browser UX only.
// All language semantics are delegated to the Haxe compiler bridge.
const compiler = globalThis.MiraStudioCompiler;
const catalogExamples = [];
let referenceViewer = null;
let atlasViewer = null;
const $ = id => document.getElementById(id);
$('languageVersion').textContent = 'V ' + compiler.version;
const astInspector = createAstInspector(compiler);
const highlighter = mountMiraHighlight($('source'), $('sourceHighlight'));

const ui = {
  source: $('source'),
  lineNumbers: $('lineNumbers'),
  position: $('position'),
  targetButtons: [...document.querySelectorAll('[data-target]')],
  viewButtons: [...document.querySelectorAll('[data-view]')],
  exampleSelect: $('exampleSelect'),
  structureSelect: $('structureSelect'),
  output: $('output'),
  outputTitle: $('outputTitle'),
  structure: $('structure'),
  status: $('status'),
  statusText: $('statusText'),
  statusDetail: $('statusDetail'),
  saveStatus: $('saveStatus'),
  runOutput: $('runOutput'),
  connection: $('connection'),
  runButton: $('run'),
  previewButton: $('previewUI'),
  uiPreviewPanel: $('uiPreviewPanel'),
  uiPreviewMount: $('uiPreviewMount'),
  fileInput: $('fileInput')
};

const STORAGE_KEY = 'mira-studio:source:v1';
const TARGET_KEY = 'mira-studio:target:v1';
const state = {
  target: 'js',
  view: 'code',
  output: '',
  locations: undefined,
  valid: false,
  exampleInvocation: null,
  uiExample: false,
  uiFrame: null,
  hostJson: undefined,
  debounce: 0,
  worker: null,
  workerTimeout: 0,
  registration: null,
  updateRequested: false
};

function getSaved(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveLocally() {
  try {
    localStorage.setItem(STORAGE_KEY, ui.source.value);
    localStorage.setItem(TARGET_KEY, state.target);
    ui.saveStatus.textContent = 'Salvato sul dispositivo';
  } catch {
    ui.saveStatus.textContent = 'Salvataggio non disponibile';
  }
}

function setStatus(type, message, detail = '') {
  ui.status.className = 'status ' + type;
  ui.statusText.textContent = message;
  ui.statusDetail.textContent = detail;
}

function updateEditorIndicators() {
  const source = ui.source.value;
  const lines = source.split('\n');
  ui.lineNumbers.textContent = lines.map((_, index) => index + 1).join('\n');

  const beforeCursor = source.slice(0, ui.source.selectionStart);
  const positionLines = beforeCursor.split('\n');
  ui.position.textContent = `Riga ${positionLines.length} · Col ${positionLines.at(-1).length + 1}`;
  ui.lineNumbers.scrollTop = ui.source.scrollTop;
}

function setView(view) {
  if (!['code', 'output', 'structure', 'reference', 'atlas', 'benchmark'].includes(view)) return;

  state.view = view;
  $('workbench').dataset.activeView = view;
  for (const button of ui.viewButtons) {
    const selected = button.dataset.view === view;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  }

  for (const name of ['code', 'output', 'structure', 'reference', 'atlas', 'benchmark']) {
    $('view-' + name).hidden = name !== view;
  }

  if (view === 'structure') updateStructure();
  if (view === 'atlas') atlasViewer?.refresh();
  if (view === 'reference') {
    if (!isReferenceRoute(location.hash)) location.hash = '#/guide';
    referenceViewer?.render();
  }
}

function setTarget(target) {
  if (!['js', 'php'].includes(target)) return;

  state.target = target;
  for (const button of ui.targetButtons) {
    const selected = button.dataset.target === target;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }

  ui.outputTitle.textContent = target === 'js' ? 'JavaScript generato' : 'PHP generato';
  ui.runButton.disabled = target !== 'js';
  ui.runButton.title = target === 'js'
    ? 'Esegui il JS generato in un Web Worker'
    : 'L’esecuzione di PHP non è disponibile nel browser';
  stopWorker();
  stopUiPreview();
  ui.previewButton.disabled = target !== 'js';
  ui.runOutput.textContent = target === 'js'
    ? 'Non eseguito.' : 'Per eseguire nel browser, seleziona JS.';
  saveLocally();
  compile(false);
}

function compile(revealOutput = false, withLocations = false) {
  if (!compiler?.compile) {
    state.valid = false;
    setStatus('error', 'Il compilatore Haxe non è stato caricato.');
    return false;
  }

  const begin = performance.now();
  const checked = $('checkedGui')?.checked === true;
  const result = compiler.compile(ui.source.value, state.target, state.hostJson, withLocations, undefined, checked);
  state.locations = result?.locations;
  const elapsed = performance.now() - begin;

  if (!result?.ok) {
    state.valid = false;
    state.output = '';
    ui.output.textContent = result?.message || 'Errore sconosciuto.';
    setStatus('error', result?.message || 'Compilazione non riuscita.', '');
    if (revealOutput) setView('code');
    return false;
  }

  state.valid = true;
  state.output = result.output;
  highlightCode(ui.output, state.output, state.target);
  setStatus('ready', checked ? 'Compilazione verificata' : 'Compilazione riuscita', `${elapsed.toFixed(2)} ms`);
  if (state.view === 'structure') updateStructure();
  if (revealOutput) setView('output');
  return true;
}

function updateStructure() {
  if (!compiler) return;

  if (ui.structureSelect.value === 'inspector') {
    ui.structure.hidden = true;
    $('astInspector').hidden = false;
    // Use the same compile-time host signatures as the editor.
    // The inspector's own Mira program has a separate host manifest.
    astInspector.refresh(ui.source.value, state.hostJson);
    return;
  }

  astInspector.cancel();
  ui.structure.hidden = false;
  $('astInspector').hidden = true;
  const inspector = ui.structureSelect.value === 'tokens'
    ? compiler.tokens : compiler.ast;
  const result = ui.structureSelect.value === 'tokens'
    ? inspector(ui.source.value) : inspector(ui.source.value, state.hostJson);
  ui.structure.textContent = result?.ok
    ? result.output
    : result?.message || 'Impossibile analizzare il sorgente.';
}

function scheduleCompile() {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(() => {
    compile(false);
  }, 350);
}

function sourceChanged() {
  state.exampleInvocation = null;
  stopWorker();
  stopUiPreview();
  ui.runOutput.textContent = 'Non eseguito.';
  updateEditorIndicators();
  highlighter.update();
  saveLocally();
  scheduleCompile();
}

function download(name, body, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveSource() {
  download('programma.mira', ui.source.value);
}

function saveOutput() {
  if (!state.valid && !compile(false)) return;
  const extension = state.target === 'js' ? 'js' : 'php';
  download('programma.' + extension, state.output);
}

async function copyOutput() {
  if (!state.valid && !compile(false)) return;

  try {
    await navigator.clipboard.writeText(state.output);
    setStatus('ready', 'Output copiato negli appunti.');
  } catch {
    setStatus('error', 'Impossibile copiare: seleziona il testo manualmente.');
  }
}

function loadExample(exampleId) {
  const example = [...examples, ...catalogExamples].find(item => item.id === exampleId);
  if (!example) return false;
  if (ui.source.value !== example.source && ui.source.value.trim()) {
    if (!window.confirm('Sostituire il codice corrente con questo esempio?')) {
      ui.exampleSelect.value = '';
      return false;
    }
  }
  ui.source.value = example.source;
  updateEditorIndicators();
  sourceChanged();
  state.uiExample = example.expect?.kind === 'ui';
  state.exampleInvocation = example.expect?.kind === 'invoke'
    ? {name: example.expect.name, args: example.expect.args}
    : null;
  setView('code');
  return true;
}

function stopWorker() {
  if (state.worker) state.worker.terminate();
  clearTimeout(state.workerTimeout);
  state.worker = null;
  state.workerTimeout = 0;
}

function formatExecutionTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  return ms < 0.001 ? 'Esec. < 0.001 ms' : 'Esec. ' + ms.toFixed(3) + ' ms';
}

function runJavaScript() {
  if (state.uiExample) return runUiPreview();
  if (state.target !== 'js') return;
  if (!compile(false, true)) {
    setView('code');
    return;
  }

  stopWorker();
  ui.runOutput.textContent = 'Esecuzione in corso…';
  setStatus('busy', 'Esecuzione JavaScript…');
  setView('output');

  // Isolates accidental infinite loops from the main UI thread.
  // This is not a security boundary for untrusted third-party programs.
  const worker = new Worker('./worker.js');
  state.worker = worker;
  state.workerTimeout = setTimeout(() => {
    if (state.worker !== worker) return;
    stopWorker();
    ui.runOutput.textContent = 'Interrotto: tempo massimo di 2 secondi.';
    setStatus('error', 'Esecuzione interrotta', 'Limite 2 s');
  }, 2000);

  worker.onmessage = event => {
    if (state.worker !== worker) return;
    clearTimeout(state.workerTimeout);
    const location = event.data?.location;
    const context = location
      ? '\nMira: riga ' + location.line + ', colonna ' + location.column +
        (location.file ? ' · ' + location.file : '') +
        ' · ' + location.name + ' (definizione)'
      : '';
    ui.runOutput.textContent = event.data?.ok
      ? event.data.output
      : 'Errore: ' + (event.data?.message ?? 'esecuzione fallita') + context;
    setStatus(event.data?.ok ? 'ready' : 'error',
      event.data?.ok ? 'Esecuzione riuscita' : 'Esecuzione fallita',
      formatExecutionTime(event.data?.executionMs));
    stopWorker();
  };
  worker.onerror = event => {
    if (state.worker !== worker) return;
    ui.runOutput.textContent = 'Errore durante l’esecuzione JavaScript.';
    setStatus('error', 'Errore durante l’esecuzione');
    stopWorker();
  };
  worker.postMessage({ code: state.output, invoke: state.exampleInvocation, locations: state.locations });
}


function stopUiPreview() {
  state.uiFrame = null;
  ui.uiPreviewMount.replaceChildren();
  ui.uiPreviewPanel.hidden = true;
}

function runUiPreview() {
  if (state.target !== 'js') return;
  if (!compile(false)) {
    setView('code');
    return;
  }
  stopWorker();
  stopUiPreview();
  setView('output');
  ui.runOutput.textContent = 'Preparazione della view…';

  const frame = document.createElement('iframe');
  frame.className = 'mira-ui-frame';
  frame.title = 'Anteprima interattiva del programma Mira';
  // No allow-same-origin: the preview has no same-origin access to Studio.
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.src = './ui-preview.html';
  state.uiFrame = frame;
  ui.uiPreviewPanel.hidden = false;
  ui.uiPreviewMount.append(frame);
  frame.addEventListener('load', () => {
    if (state.uiFrame !== frame) return;
    frame.contentWindow.postMessage({
      type: 'mira-ui:run',
      code: state.output,
      source: ui.source.value,
      hostJson: state.hostJson,
      mode: $('previewRenderer').value
    }, '*');
  });
}

function loadFile(file) {
  if (!file) return;
  if (file.size > 200_000) {
    setStatus('error', 'File troppo grande: massimo 200 KB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    ui.source.value = String(reader.result ?? '');
    sourceChanged();
    setView('code');
  };
  reader.onerror = () => setStatus('error', 'Impossibile leggere il file.');
  reader.readAsText(file, 'UTF-8');
}

function updateConnection() {
  if (!navigator.onLine) {
    ui.connection.textContent = '● Offline';
    ui.connection.classList.add('offline');
  } else {
    ui.connection.textContent = navigator.serviceWorker?.controller
      ? '● Pronta offline' : '● Online';
    ui.connection.classList.remove('offline');
  }
}

function showUpdate() {
  $('updateNotice').hidden = false;
}

async function installServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    updateConnection();
    return;
  }

  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    updateConnection();
    if (state.updateRequested) {
      saveLocally();
      window.location.reload();
    } else if (hadController) {
      showUpdate();
    }
  });

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: './'
    });
    state.registration = registration;

    if (registration.waiting && navigator.serviceWorker.controller) showUpdate();

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdate();
        }
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) registration.update().catch(() => {});
    });
  } catch {
    // The editor remains usable online or from a local HTTP server.
  }
  updateConnection();
}

function wireEvents() {
  for (const button of ui.viewButtons) {
    button.addEventListener('click', () => setView(button.dataset.view));
  }
  for (const button of ui.targetButtons) {
    button.addEventListener('click', () => setTarget(button.dataset.target));
  }

  ui.source.addEventListener('input', sourceChanged);
  ui.source.addEventListener('click', updateEditorIndicators);
  ui.source.addEventListener('keyup', updateEditorIndicators);
  ui.source.addEventListener('scroll', updateEditorIndicators);

  ui.source.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = ui.source.selectionStart;
      const end = ui.source.selectionEnd;
      ui.source.setRangeText('  ', start, end, 'end');
      sourceChanged();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) runJavaScript();
      else compile(true);
    }
  });

  $('compile').addEventListener('click', () => compile(true));
  ui.previewButton.addEventListener('click', runUiPreview);
  $('checkedGui')?.addEventListener('change', () => { stopUiPreview(); compile(false); });
  $('previewRenderer').addEventListener('change', () => { if (state.uiFrame) runUiPreview(); });
  ui.runButton.addEventListener('click', runJavaScript);
  $('saveSource').addEventListener('click', saveSource);
  $('saveOutput').addEventListener('click', saveOutput);
  $('copyOutput').addEventListener('click', copyOutput);
  $('openFile').addEventListener('click', () => ui.fileInput.click());
  ui.fileInput.addEventListener('change', () => {
    loadFile(ui.fileInput.files?.[0]);
    ui.fileInput.value = '';
  });
  ui.structureSelect.addEventListener('change', updateStructure);
  ui.exampleSelect.addEventListener('change', () => loadExample(ui.exampleSelect.value));
  window.addEventListener('hashchange', () => {
    if (location.hash === '#/atlas') setView('atlas');
    if (location.hash === '#/benchmark') setView('benchmark');
    if (isReferenceRoute(location.hash) && referenceViewer) {
      setView('reference');
    }
  });
  $('updateNow').addEventListener('click', () => {
    state.updateRequested = true;
    saveLocally();
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  });
  window.addEventListener('message', event => {
    if (!state.uiFrame || event.source !== state.uiFrame.contentWindow ||
        typeof event.data?.type !== 'string' ||
        !event.data.type.startsWith('mira-ui:')) return;

    if (event.data.type === 'mira-ui:error') {
      ui.runOutput.textContent = 'Errore UI: ' + String(event.data.message);
    } else if (event.data.type === 'mira-ui:ready') {
      ui.runOutput.textContent = 'View pronta. Puoi interagire con i pulsanti.';
    } else if (event.data.type === 'mira-ui:log') {
      ui.runOutput.textContent = String(event.data.message);
    }
  });
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
}

function start() {
  ui.exampleSelect.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Scegli un esempio';
  ui.exampleSelect.appendChild(placeholder);
  for (const example of examples) {
    const option = document.createElement('option');
    option.value = example.id;
    option.textContent = example.name;
    ui.exampleSelect.appendChild(option);
  }
  ui.exampleSelect.value = '';

  ui.source.value = getSaved(STORAGE_KEY, defaultSource);
  state.target = getSaved(TARGET_KEY, 'js') === 'php' ? 'php' : 'js';

  mountWorkbenchFullscreen($('workbench'), $('workbenchFullscreen'), document);
  wireEvents();
  updateEditorIndicators();
  highlighter.update();
  setTarget(state.target);
  initializeHost();
  initializeReference();
  initializeAtlas();
  initializeBenchmark();
  installServiceWorker();
}


function initializeAtlas() {
  atlasViewer = mountAtlas($('atlas'), compiler,
    () => ui.source.value, () => state.hostJson);
  if (location.hash === '#/atlas') setView('atlas');
}

function initializeBenchmark() {
  mountBenchmark($('benchmark'), compiler);
  if (location.hash === '#/benchmark') setView('benchmark');
}

function isReferenceRoute(hash) {
  return /^#\/(guide|feature\/|example\/|api(?:\/|$))/.test(hash);
}

async function initializeReference() {
  const root = $('reference');
  try {
    const response = await fetch('./reference.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!data.features?.length || !data.api?.length) {
      throw new Error('Catalogo incompleto');
    }

    catalogExamples.push(...data.examples.map(item => ({
      id: item.id, name: item.title, source: item.source, expect: item.expect
    })));

    const group = document.createElement('optgroup');
    group.label = 'Catalogo delle feature — ' + data.examples.length + ' esempi';
    for (const example of catalogExamples) {
      const option = document.createElement('option');
      option.value = example.id;
      option.textContent = example.name;
      group.append(option);
    }
    ui.exampleSelect.append(group);

    referenceViewer = mountReference(root, data, example => {
      if (loadExample(example.id)) ui.exampleSelect.value = example.id;
    });
    referenceViewer.render();

    if (isReferenceRoute(location.hash)) {
      setView('reference');
    }
  } catch (error) {
    root.textContent = 'Documentazione non disponibile: ' +
      String(error?.message ?? error);
  }
}

async function initializeHost() {
  try {
    const response = await fetch('./host.json');
    if (!response.ok) throw new Error('Host manifest unavailable');
    state.hostJson = await response.text();
    compile(false);
  } catch {
    // The compiler still works without host functions.
  }
}

start();
