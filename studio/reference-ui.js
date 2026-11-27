import {highlightFragment} from './syntax-highlight.js';
// Searchable, offline documentation viewer. All content comes from the
// generated reference.json catalog; nothing here parses Mira source.
export function mountReference(root, dataset, onOpenExample) {
  const examples = new Map(dataset.examples.map(item => [item.id, item]));
  const api = new Map(dataset.api.map(item => [item.id, item]));
  const features = new Map(dataset.features.map(item => [item.id, item]));

  const element = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  function link(label, route, className = '') {
    const anchor = element('a', className, label);
    anchor.href = '#/' + route;
    return anchor;
  }

  function heading(title, subtitle) {
    const box = element('div', 'reference-heading');
    box.append(element('h2', '', title), element('p', '', subtitle));
    return box;
  }

  function back(label = '← Indice della guida') {
    return link(label, 'guide', 'reference-back');
  }

  function expected(example) {
    const result = example.expect;
    if (result.kind === 'error') return 'Errore atteso: ' + result.contains;
    if (result.kind === 'ui') return 'UI interattiva · Esegui con Anteprima UI';
    if (result.kind === 'invoke') {
      return result.name + '(' + result.args.join(', ') + ') → ' +
        JSON.stringify(result.value) + ' (invocazione dal backend)';
    }
    return 'result → ' + JSON.stringify(result.value);
  }

  function exampleCard(example) {
    const card = element('section', 'reference-example-card');
    card.append(
      link(example.title, 'example/' + example.id, 'reference-item-link'),
      element('p', '', example.description),
      element('div', 'reference-expected', expected(example))
    );

    const actions = element('div', 'reference-actions');
    const open = element('button', 'reference-try', 'Prova nell’editor');
    open.type = 'button';
    open.addEventListener('click', () => onOpenExample(example));
    actions.append(open);
    card.append(actions);
    return card;
  }

  function overview() {
    root.append(heading('Guida a Mira', dataset.features.length +
      ' feature · ' + dataset.examples.length + ' esempi verificati su JS e PHP'));
    const controls = element('div', 'reference-controls');
    controls.append(link('Linguaggio', 'guide', 'reference-active'),
      link('API Haxe', 'api'));
    root.append(controls);

    const search = element('input', 'reference-search');
    search.type = 'search';
    search.placeholder = 'Cerca feature, esempi o API…';
    search.setAttribute('aria-label', 'Cerca nella documentazione');
    const results = element('div', 'reference-list');

    const update = () => {
      results.replaceChildren();
      const query = search.value.trim().toLocaleLowerCase('it');
      const filteredFeatures = dataset.features.filter(item =>
        [item.title, item.summary, item.details].join(' ')
          .toLocaleLowerCase('it').includes(query));
      const filteredExamples = query ? dataset.examples.filter(item =>
        [item.title, item.description, item.source].join(' ')
          .toLocaleLowerCase('it').includes(query)) : [];
      const filteredApi = query ? dataset.api.filter(item =>
        [item.id, item.description, item.signature].join(' ')
          .toLocaleLowerCase('it').includes(query)) : [];

      if (!filteredFeatures.length && !filteredExamples.length && !filteredApi.length) {
        results.append(element('p', '', 'Nessun risultato.'));
      }

      for (const feature of filteredFeatures) {
        const card = element('section', 'reference-list-item');
        card.append(
          link(feature.title, 'feature/' + feature.id, 'reference-item-link'),
          element('p', '', feature.summary),
          element('small', '', feature.examples.length + ' esempi')
        );
        results.append(card);
      }
      for (const example of filteredExamples) {
        const card = element('section', 'reference-list-item');
        card.append(link('Esempio: ' + example.title,
          'example/' + example.id, 'reference-item-link'),
          element('p', '', example.description));
        results.append(card);
      }
      for (const item of filteredApi) {
        const card = element('section', 'reference-list-item');
        card.append(link('API: ' + item.id,
          'api/' + encodeURIComponent(item.id), 'reference-item-link'),
          element('p', '', item.description));
        results.append(card);
      }
    };

    search.addEventListener('input', update);
    root.append(search, results);
    update();
  }

  function featurePage(feature) {
    root.append(back(), heading(feature.title, feature.summary),
      element('p', 'reference-description', feature.details));

    const related = api.get(feature.api);
    if (related) {
      const line = element('p', 'reference-related', 'API correlata: ');
      line.append(link(related.id, 'api/' + encodeURIComponent(related.id)));
      root.append(line);
    }

    root.append(element('h3', '', 'Esempi eseguibili'));
    for (const id of feature.examples) {
      const example = examples.get(id);
      if (example) root.append(exampleCard(example));
    }
  }

  function examplePage(example) {
    const feature = features.get(example.feature);
    root.append(back(), heading(example.title, example.description));
    const line = element('p', 'reference-related', 'Feature: ');
    if (feature) line.append(link(feature.title, 'feature/' + feature.id));
    root.append(line);

    const code = element('pre', 'reference-code mira-code');
    code.append(highlightFragment(example.source,document,globalThis.MiraStudioCompiler,example.host ? JSON.stringify(example.host) : undefined));
    code.setAttribute('tabindex', '0');
    const result = element('p', 'reference-expected', expected(example.expect ?
      example : { expect: { kind: 'error', contains: 'Nessun risultato' } }));
    root.append(code, result);

    if (example.expect.kind === 'invoke') {
      root.append(element('p', 'reference-note',
        'Nota: Mira 0.2 può creare funzioni con più segnaposto, ma non le ' +
        'può ancora richiamare direttamente con una sintassi generale. ' +
        'La CI invoca la funzione generata in JS e PHP e controlla il risultato.'));
    }
    if (example.expect.kind === 'error') {
      root.append(element('p', 'reference-note',
        'Questo esempio è volutamente errato: caricalo per osservare la diagnostica.'));
    }
    if (example.expect.kind === 'ui') {
      root.append(element('p', 'reference-note',
        'Apri nell’editor, scegli JS e premi Esegui oppure Anteprima UI. ' +
        'La UI gira in un iframe isolato e usa soltanto le capability host ' +
        'alert e render. Il backend PHP è verificato solo in compilazione.'));
    }
    const open = element('button', 'reference-try', 'Apri nell’editor');
    open.type = 'button';
    open.addEventListener('click', () => onOpenExample(example));
    root.append(open);
  }

  function apiIndex() {
    root.append(heading('API di Mira', dataset.api.length +
      ' simboli pubblici estratti dal codice Haxe'));
    const controls = element('div', 'reference-controls');
    controls.append(link('Linguaggio', 'guide'),
      link('API Haxe', 'api', 'reference-active'));
    root.append(controls, element('p', 'reference-note',
      'Firme e coordinate vengono lette automaticamente dai sorgenti Haxe. ' +
      'Le descrizioni sono mantenute nel catalogo, con link al codice reale.'));

    const search = element('input', 'reference-search');
    search.type = 'search';
    search.placeholder = 'Cerca per modulo, metodo o tipo…';
    search.setAttribute('aria-label', 'Cerca API');
    const list = element('div', 'reference-list');
    const update = () => {
      list.replaceChildren();
      const needle = search.value.toLocaleLowerCase('it').trim();
      const items = dataset.api.filter(item =>
        [item.id, item.signature, item.description].join(' ')
          .toLocaleLowerCase('it').includes(needle));
      for (const item of items) {
        const card = element('section', 'reference-list-item');
        card.append(link(item.id, 'api/' + encodeURIComponent(item.id),
          'reference-item-link'), element('p', '', item.description));
        list.append(card);
      }
      if (!items.length) list.append(element('p', '', 'Nessun simbolo trovato.'));
    };
    search.addEventListener('input', update);
    root.append(search, list);
    update();
  }

  function apiPage(item) {
    root.append(link('← Tutte le API', 'api', 'reference-back'),
      heading(item.id, item.description));
    root.append(element('div', 'reference-expected', 'Haxe · ' + item.kind),
      element('pre', 'reference-code', item.signature));
    const source = element('a', 'reference-source', 'Apri il sorgente Haxe');
    source.href = item.sourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    root.append(source);

    if (item.parent) {
      const line = element('p', 'reference-related', 'Tipo: ');
      line.append(link(item.parent, 'api/' + encodeURIComponent(item.parent)));
      root.append(line);
    }
    const related = dataset.features.filter(feature => feature.api === item.id);
    if (related.length) {
      root.append(element('h3', '', 'Feature correlate'));
      for (const feature of related) {
        root.append(link(feature.title, 'feature/' + feature.id,
          'reference-item-link'));
      }
    }
  }

  function render() {
    root.replaceChildren();
    const route = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const [type, ...parts] = route.split('/');
    const id = parts.join('/');

    if (type === 'feature' && features.has(id)) featurePage(features.get(id));
    else if (type === 'example' && examples.has(id)) examplePage(examples.get(id));
    else if (type === 'api' && api.has(id)) apiPage(api.get(id));
    else if (type === 'api') apiIndex();
    else overview();
  }

  return { render };
}
