import {highlightCode} from './syntax-highlight.js';
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
      meta(example), element('div', 'reference-expected', expected(example))
    );

    const actions = element('div', 'reference-actions');
    const open = element('button', 'reference-try', 'Prova nell’editor');
    open.type = 'button';
    open.addEventListener('click', () => onOpenExample(example));
    actions.append(open);
    card.append(actions);
    return card;
  }

  function meta(example) {
    const box=element('div','reference-meta');
    const info=example.index || {};
    for(const value of [info.category, info.since && 'Feature da '+info.since, example.expect.kind, ...(info.ast?.calls || []).slice(0,5)].filter(Boolean))
      box.append(element('span','',value));
    return box;
  }

  function overview() {
    root.append(heading(location.hash.includes('/examples')?'Esempi Mira':location.hash.includes('/capabilities')?'Funzionalità di Mira':'Guida a Mira', dataset.features.length +
      ' feature · ' + dataset.examples.length + ' esempi verificati su JS e PHP'));
    const controls = element('div', 'reference-controls');
    controls.append(link('Linguaggio', 'guide', 'reference-active'),
      link('Esempi', 'guide/examples'), link('API Haxe', 'api'), link('Funzionalità', 'guide/capabilities'));
    root.append(controls);

    const search = element('input', 'reference-search');
    search.type = 'search';
    search.placeholder = 'Cerca feature, esempi o API…';
    search.setAttribute('aria-label', 'Cerca nella documentazione');
    const results = element('div', 'reference-list');

    const [route,query=''] = location.hash.split('?');
    const mode = route.endsWith('/examples') ? 'examples' : route.endsWith('/capabilities') ? 'capabilities' : 'all';
    for(const anchor of controls.children){const active=anchor.getAttribute('href')===(mode==='examples'?'#/guide/examples':mode==='capabilities'?'#/guide/capabilities':'#/guide');anchor.classList.toggle('reference-active',active);if(active)anchor.setAttribute('aria-current','page');}
    const filters=element('div','reference-filters');
    const addFilter=(label,values)=>{
      const wrapper=element('label','',label);const select=element('select');
      const all=element('option','','Tutti');all.value='';select.append(all);
      for(const value of values){const option=element('option','',value);option.value=value;select.append(option);}
      wrapper.append(select);filters.append(wrapper);return select;
    };
    const unique=items=>[...new Set(items.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it',{numeric:true}));
    const category=addFilter('Categoria',unique(dataset.examples.map(x=>x.index?.category)));
    const version=addFilter('Feature introdotta in',unique(dataset.examples.map(x=>x.index?.since)));
    const featureFilter=addFilter('Feature',unique(dataset.features.map(x=>x.title)));
    const selector=addFilter('Funzione chiamata (AST)',unique(dataset.examples.flatMap(x=>x.index?.ast?.calls||[])));
    selector.value=new URLSearchParams(query).get('call')||'';
    const count=element('p','reference-count');count.setAttribute('role','status');
    const more=element('button','reference-try','Mostra altri');more.type='button';
    let limit=40;
    const normalize=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('it');
    const update = () => {
      results.replaceChildren();
      const terms=normalize(search.value).trim().split(/\s+/).filter(Boolean);
      const matches=values=>{const hay=normalize(values.join(' '));return terms.every(t=>hay.includes(t));};
      const narrowed=!!(category.value||version.value||featureFilter.value||selector.value);
      const entries=[];
      if(mode==='all'&&!narrowed) for(const feature of dataset.features) {
        if(matches([feature.title,feature.id,feature.since,feature.summary,feature.details])) entries.push(()=> {
          const card=element('section','reference-list-item');
          card.append(link(feature.title,'feature/'+feature.id,'reference-item-link'),element('p','',feature.summary),element('small','',feature.examples.length+' esempi · da '+feature.since));return card;
        });
      }
      if(mode!=='capabilities'&&(mode==='examples'||terms.length||narrowed)) for(const example of dataset.examples) {
        const f=features.get(example.feature);const info=example.index||{};
        if(category.value&&info.category!==category.value||version.value&&info.since!==version.value||featureFilter.value&&f?.title!==featureFilter.value||selector.value&&!info.ast?.calls?.includes(selector.value))continue;
        if(matches([example.id,example.title,example.description,example.source,f?.title,f?.id,info.category,info.since,...(info.selectors||[]),...(info.ast?.calls||[]),...(info.ast?.sections||[])])) entries.push(()=>exampleCard(example));
      }
      if(mode==='all'&&terms.length&&!narrowed) for(const item of dataset.api) {
        if(matches([item.id,item.description,item.signature])) entries.push(()=>{
          const card=element('section','reference-list-item');card.append(link('API: '+item.id,'api/'+encodeURIComponent(item.id),'reference-item-link'),element('p','',item.description));return card;
        });
      }
      if(!narrowed&&(mode==='capabilities'||(mode==='all'&&terms.length))) for(const item of dataset.capabilities||[]) {
        if(matches([item.id,item.title,item.since,item.doc])) entries.push(()=>{
          const card=element('section','reference-list-item');
          const anchor=element('a','reference-item-link',item.title);
          anchor.href='https://github.com/Spyryto/Mira/blob/main/'+item.doc;anchor.target='_blank';anchor.rel='noopener noreferrer';
          card.append(anchor,element('small','','Disponibile da '+item.since+' · documentazione sorgente'));return card;
        });
      }
      count.textContent=entries.length+' risultati · '+Math.min(limit,entries.length)+' mostrati';
      for(const create of entries.slice(0,limit))results.append(create());
      if(!entries.length)results.append(element('p','','Nessun risultato. Prova a rimuovere un filtro.'));
      more.hidden=entries.length<=limit;
    };
    const reset=()=>{limit=40;update();};
    search.addEventListener('input',reset);
    for(const control of [category,version,featureFilter,selector])control.addEventListener('change',reset);
    more.addEventListener('click',()=>{limit+=40;update();});
    root.append(search);
    if(mode!=='capabilities'){
      const filterPanel=element('details','reference-filter-panel');
      filterPanel.open=matchMedia('(min-width: 621px)').matches||!!selector.value;
      filterPanel.append(element('summary','','Filtri di ricerca'),filters);
      root.append(filterPanel);
    }
    root.append(count,results,more);
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

    const code = element('pre', 'reference-code', example.source);
    code.setAttribute('tabindex', '0');
    const result = element('p', 'reference-expected', expected(example.expect ?
      example : { expect: { kind: 'error', contains: 'Nessun risultato' } }));
    highlightCode(code, example.source);
    root.append(meta(example));
    const ast=example.index?.ast;
    if(ast?.status==='parsed'){
      const functions=element('div','reference-meta');
      for(const call of ast.calls)functions.append(link(call,'guide/examples?call='+encodeURIComponent(call)));
      if(ast.calls.length)root.append(element('h3','','Funzioni chiamate'),functions);
      if(ast.sections.length)root.append(element('p','reference-note','Sezioni funzionali: '+ast.sections.join(', ')));
    }else if(ast)root.append(element('p','reference-note','Indice AST non disponibile per questo esempio.'));
    root.append(code, result);

    if (example.expect.kind === 'invoke') {
      root.append(element('p', 'reference-note',
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
      link('Esempi', 'guide/examples'), link('API Haxe', 'api', 'reference-active'), link('Funzionalità', 'guide/capabilities'));
    root.append(controls, element('p', 'reference-note',
      'Firme e coordinate vengono lette automaticamente dai sorgenti Haxe. ' +
      'Le descrizioni sono mantenute nel catalogo, con link al codice reale.'));

    const search = element('input', 'reference-search');
    search.type = 'search';
    search.placeholder = 'Cerca per modulo, metodo o tipo…';
    search.setAttribute('aria-label', 'Cerca API');
    const list = element('div', 'reference-list');
    const count=element('p','reference-count');count.setAttribute('role','status');
    const more=element('button','reference-try','Mostra altre API');more.type='button';
    let limit=40;
    const update = () => {
      list.replaceChildren();
      const needle = search.value.toLocaleLowerCase('it').trim();
      const items = dataset.api.filter(item =>
        [item.id, item.signature, item.description].join(' ')
          .toLocaleLowerCase('it').includes(needle));
      count.textContent=items.length+' simboli · '+Math.min(items.length,limit)+' mostrati';
      more.hidden=items.length<=limit;
      for (const item of items.slice(0,limit)) {
        const card = element('section', 'reference-list-item');
        card.append(link(item.id, 'api/' + encodeURIComponent(item.id),
          'reference-item-link'), element('p', '', item.description));
        list.append(card);
      }
      if (!items.length) list.append(element('p', '', 'Nessun simbolo trovato.'));
    };
    search.addEventListener('input',()=>{limit=40;update();});
    more.addEventListener('click',()=>{limit+=40;update();});
    root.append(search,count,list,more);
    update();
  }

  function apiPage(item) {
    root.append(link('← Tutte le API', 'api', 'reference-back'),
      heading(item.id, item.description));
    root.append(element('div', 'reference-expected', 'Haxe · ' + item.kind),
      element('pre', 'reference-code', item.signature));
    highlightCode(root.lastElementChild, item.signature, 'haxe');
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
