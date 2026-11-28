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
      meta(example), element('div', 'reference-expected'+(example.expect.kind==='error'?' reference-expected-error':''), expected(example))
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
      link('Esempi', 'guide/examples'), link('API Mira', 'guide/native'), link('API Haxe', 'api'), link('Funzionalità', 'guide/capabilities'));
    if(dataset.quickstart) controls.append(link('Quickstart','guide/quickstart'));
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
      const exampleEntries=[];
      if(mode==='all'&&!narrowed) for(const feature of dataset.features) {
        if(matches([feature.title,feature.id,feature.since,feature.summary,feature.details])) entries.push(()=> {
          const card=element('section','reference-list-item');
          card.append(link(feature.title,'feature/'+feature.id,'reference-item-link'),element('p','',feature.summary),element('small','',feature.examples.length+' esempi · da '+feature.since));return card;
        });
      }
      if(mode!=='capabilities'&&(mode==='examples'||terms.length||narrowed)) for(const example of dataset.examples) {
        const f=features.get(example.feature);const info=example.index||{};
        if(category.value&&info.category!==category.value||version.value&&info.since!==version.value||featureFilter.value&&f?.title!==featureFilter.value||selector.value&&!info.ast?.calls?.includes(selector.value))continue;
        if(matches([example.id,example.title,example.description,example.source,f?.title,f?.id,info.category,info.since,...(info.selectors||[]),...(info.ast?.calls||[]),...(info.ast?.sections||[])])){
          // Rank direct semantic matches ahead of incidental source mentions.
          const score=terms.reduce((sum,term)=>sum+
            (normalize(info.category)===term?16:0)+
            (normalize([f?.id,f?.title].join(' ')).includes(term)?8:0)+
            (normalize(example.title).includes(term)?6:0)+
            (normalize([...(info.ast?.calls||[]),...(info.ast?.sections||[])].join(' ')).includes(term)?5:0)+
            (normalize(example.description).includes(term)?3:0)+
            (normalize(example.id).includes(term)?2:0),0);
          exampleEntries.push({score,create:()=>exampleCard(example)});
        }
      }
      exampleEntries.sort((a,b)=>b.score-a.score);
      for(const entry of exampleEntries)entries.push(entry.create);
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
    const result = element('p', 'reference-expected'+(example.expect?.kind==='error'?' reference-expected-error':''), expected(example.expect ?
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

  function nativeApiPage(id) {
    const groups=dataset.nativeApi||[];
    const selected=groups.find(group=>group.name===id);
    root.append(heading(selected?selected.name:'API native Mira',selected?selected.description:
      groups.length+' librerie e contratti · generati durante la build'));
    const controls=element('div','reference-controls');
    controls.append(link('Linguaggio','guide'),link('Esempi','guide/examples'),link('API Mira','guide/native','reference-active'),link('API Haxe','api'));
    root.append(controls);
    if(selected){
      root.append(link('← Tutte le librerie','guide/native','reference-back'));
      root.append(element('p','reference-note', selected.kind==='interface'?'Interfaccia pubblica verificata dal compilatore.':'Libreria senza interfaccia modulare: dichiarazioni dal sorgente, non firme inferite.'));
      const source=element('pre','reference-code');highlightCode(source,selected.source);source.tabIndex=0;root.append(source);
      root.append(element('h3','','Simboli'));
      for(const item of [...selected.symbols,...selected.types]){
        const card=element('section','reference-list-item');
        card.append(element('strong','',item.name),element('p','',item.kind));
        if(item.schema){
          const details=element('details');details.append(element('summary','','Schema del tipo'));
          const code=element('pre','reference-code');highlightCode(code,JSON.stringify(item.schema,null,2),'json');details.append(code);card.append(details);
        }
        if(item.kind==='selector'&&dataset.examples.some(e=>e.index?.ast?.calls?.includes(item.name)))
          card.append(link('Esempi che chiamano questo selettore','guide/examples?call='+encodeURIComponent(item.name)));
        root.append(card);
      }
      const lab=element('a','reference-source','Apri il laboratorio');lab.href=selected.lab;
      const repo=element('a','reference-source','Sorgente nel repository');repo.href='https://github.com/Spyryto/Mira/blob/main/'+selected.path.split('/').map(encodeURIComponent).join('/');repo.target='_blank';repo.rel='noopener noreferrer';
      const actions=element('div','reference-controls');actions.append(lab,repo);root.append(actions);
      return;
    }
    root.append(element('p','reference-note','Contratti Services e Data estratti dal compilatore; GUI, Grammar e GUI Styles consultabili dal sorgente. I provider sono implementazioni, non API pubbliche.'));
    const search=element('input','reference-search');search.type='search';search.placeholder='Cerca libreria, funzione o tipo…';search.setAttribute('aria-label','Cerca API Mira');
    const list=element('div','reference-list');
    const update=()=>{
      list.replaceChildren();
      const terms=search.value.toLocaleLowerCase('it').trim().split(/\s+/).filter(Boolean);
      for(const group of groups){
        const hay=[group.name,group.category,group.description,group.source,...group.symbols.map(x=>x.name),...group.types.map(x=>x.name)].join(' ').toLocaleLowerCase('it');
        if(!terms.every(t=>hay.includes(t)))continue;
        const card=element('section','reference-list-item');
        card.append(link(group.name,'guide/native/'+encodeURIComponent(group.name),'reference-item-link'),element('p','',group.description),element('small','',group.symbols.length+' simboli · '+group.types.length+' tipi di interfaccia'));
        list.append(card);
      }
      if(!list.children.length)list.append(element('p','','Nessuna libreria trovata.'));
    };
    search.addEventListener('input',update);root.append(search,list);update();
  }

  function apiIndex() {
    root.append(heading('API interne Haxe', dataset.api.length +
      ' simboli pubblici estratti dal codice Haxe'));
    const controls = element('div', 'reference-controls');
    controls.append(link('Linguaggio', 'guide'),
      link('Esempi', 'guide/examples'), link('API Mira', 'guide/native'), link('API Haxe', 'api', 'reference-active'), link('Funzionalità', 'guide/capabilities'));
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

  function quickstart(){
    const q=dataset.quickstart;
    root.append(back(),heading('Quickstart · Dal codice all’app','Giro 0 · Impara, esegui, esporta e pubblica con Mira '+q.version));
    const section=(title,paragraphs)=>{
      const s=element('section','reference-list-item');
      s.append(element('h3','',title));
      for(const p of paragraphs)s.append(element('p','',p));
      root.append(s);return s;
    };
    const code=(s,source,language='mira')=>{
      const p=element('pre','reference-code');
      if(language==='mira')highlightCode(p,source);else p.textContent=source;
      s.append(p);
      const copy=element('button','reference-try','Copia');copy.type='button';
      copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(source);copy.textContent='Copiato';}catch{copy.textContent='Seleziona il testo e copialo';}});s.append(copy);
    };
    const open=(s,id)=>{
      const b=element('button','reference-try','Prova nell’editor');b.type='button';b.addEventListener('click',()=>onOpenExample({id}));s.append(b);
    };
    let s=section('1. Il tuo primo script',[
      'hours e rate sono nomi di valori. Il segno = li associa a un’espressione; il punto e virgola termina la dichiarazione.',
      'result moltiplica ore e tariffa. log invia il risultato all’host. Premi Prova, poi Esegui: il risultato atteso è 150. Modifica rate a 60: otterrai 180. Usa Salva file nell’editor per scaricare il sorgente e rinominalo hello.mira.'
    ]);
    code(s,q.hello);open(s,'sdk-hello');
    s.append(link('Valori','feature/values'),element('span','',' · '),link('Operatori aritmetici','feature/arithmetic'));
    s=section('2. Installa il bootstrap sul PC',[
      'Scegli Node 22+ oppure PHP CLI 8.3+ con OpenSSL e HTTPS streams. Non servono Haxe, npm o Composer. Il download usa una release versionata e verifica SHA-256. Dopo l’installazione puoi lavorare offline.',
      'Scarica uno dei due script e conservalo in una cartella. Apri il terminale in quella cartella.'
    ]);
    const release='https://github.com/Spyryto/Mira/releases/tag/sdk-v'+q.version;
    const a=element('a','reference-source','Release SDK '+q.version);a.href=release;s.append(a);
    code(s,'node mira.js install\nphp mira.php install','shell');
    s.append(element('p','','Esegui uno solo dei due comandi. Copia la cartella quickstart dalla cache indicata da info in una cartella scrivibile. Contiene hello.mira, counter.mira e lib/gui.mira. Porta con te anche il bootstrap o usa il suo percorso assoluto. Sostituisci hello.mira con il file salvato da Cozy se hai modificato l’esempio.'));
    code(s,'node mira.js info\nphp mira.php info','shell');
    s=section('3. Esegui e compila fuori da Cozy',[
      'Apri il terminale nella cartella quickstart. Negli esempi il bootstrap è nella stessa cartella. run compila e avvia il risultato; build salva il programma generato. Il target di default è quello dell’host.',
      'Per eseguire il codice PHP serve PHP; per eseguire il JavaScript console serve Node. Entrambi i compilatori possono generare entrambi i target.'
    ]);
    code(s,'node mira.js run hello.mira\nnode mira.js build hello.mira php\nphp hello.php','shell');
    code(s,'php mira.php run hello.mira\nphp mira.php build hello.mira js\nnode hello.mjs','shell');
    s=section('4. Una GUI reattiva',[
      'counter è una funzione che riceve n e costruisce una colonna con titolo, testo e pulsante. update riceve il vecchio stato e ne restituisce uno nuovo. state inizializza il contatore a zero; render lo mostra.',
      'Prova nell’editor e usa Anteprima UI: premi +1 più volte. Poi modifica il blocco in old + 2.'
    ]);
    code(s,q.counter);open(s,'sdk-counter');
    s.append(link('API GUI','guide/native/GUI'));
    s=section('5. Da dove arriva lib/gui.mira?',[
      'È un file di normali funzioni Mira, non una parola magica. Cozy incorpora una copia nel compilatore; nella CLI l’import fisico è relativo al file di ingresso. Il quickstart installato contiene il vero file nella directory lib. Ecco il suo contenuto, generato dal sorgente della stessa build.'
    ]);
    const details=element('details','');details.append(element('summary','','Apri lib/gui.mira'));code(details,q.gui);s.append(details);
    s=section('6. Avvia e pubblica la GUI',[
      'Usa uno dei due server locali e apri nel browser http://127.0.0.1:8765/. Non serve Cozy. Premi Ctrl+C nel terminale per terminare. Per ritrovare la tua GUI fuori da Cozy, salva il sorgente come counter.mira nella cartella quickstart, accanto a lib.',
      'web genera una cartella con index.html, app.js e ui-host.js. Pubblica questi tre file insieme su un hosting statico. Non è necessario un backend per questo contatore.'
    ]);
    code(s,'node mira.js serve counter.mira\nphp mira.php serve counter.mira','shell');
    code(s,'node mira.js web counter.mira site\n# oppure: php mira.php web counter.mira site','shell');
    s.append(element('p','','Esercizio: modifica il titolo, aggiungi un secondo pulsante e ripubblica in una nuova cartella. Hai chiuso il primo giro della spirale.'));
    root.append(element('p','reference-note','Limiti: questo SDK iniziale supporta log e GUI base. Filesystem, HTTP, progetti checked e packaging desktop generico non sono ancora integrati nel bootstrap.'));
  }

  function render() {
    root.replaceChildren();
    const route = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const [type, ...parts] = route.split('/');
    const id = parts.join('/');

    if(type==='guide' && id==='quickstart' && dataset.quickstart) quickstart();
    else if (type === 'guide' && (id==='native'||id.startsWith('native/'))) nativeApiPage(id.slice(7));
    else if (type === 'feature' && features.has(id)) featurePage(features.get(id));
    else if (type === 'example' && examples.has(id)) examplePage(examples.get(id));
    else if (type === 'api' && api.has(id)) apiPage(api.get(id));
    else if (type === 'api') apiIndex();
    else overview();
  }

  return { render };
}
