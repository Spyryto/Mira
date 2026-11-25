# Interoperabilità browser: alert, view e contatore

Questa iterazione **non aggiunge keyword o sintassi speciale al linguaggio**.
I programmi Mira usano normali funzioni dell'ambiente host, come `alert` e
`render`, risolte attraverso `studio/host.json`.

Tre programmi completi e modificabili sono nel catalogo, alla feature
**UI web e interoperabilità**. Apri un esempio in Mira Studio, seleziona
**JS** e premi **Esegui** oppure **Anteprima UI**.

## 1. Alert

```mira
render {type: "text", text: "Un messaggio generato da Mira"};
alert "Ciao dal linguaggio Mira!";
```

`alert` è una callable host: nell'anteprima la implementiamo con un
`<dialog>` HTML, così il messaggio rimane nell'iframe isolato e non blocca
la pagina di Studio. Non è un'istruzione speciale del compilatore.

## 2. Una view e un pulsante

```mira
say hello: ignored = alert "Ciao dal pulsante!";

render {
  type: "column",
  children: [
    {type: "title", text: "Interfaccia Mira"},
    {type: "text", text: "Una view costruita con record"},
    {type: "button", label: "Salutami", onClick: (say hello: _)}
  ]
};
```

`render` interpreta un **record**. I tipi di view riconosciuti dal piccolo
host iniziale sono `column`, `title`, `text`, `button` e `state`.
Le proprietà testuali vengono assegnate con `textContent`, non con
`innerHTML`. Una view non è una componente JavaScript arbitraria.

## 3. Un contatore con stato e transizioni Mira

```mira
increment: value = value + 1;
decrement: value = value - 1;

counter view: value = {
  type: "column",
  children: [
    {type: "title", text: "Contatore"},
    {type: "text", text: value},
    {type: "button", label: "+1", update: (increment: _)},
    {type: "button", label: "-1", update: (decrement: _)}
  ]
};

render {type: "state", initial: 0, view: (counter view: _)};
```

Il browser **conserva** il valore corrente e collega gli eventi;
`increment:`, `decrement:` e `counter view:` sono funzioni **Mira**
compilate realmente in JavaScript. Quando arriva il clic, il renderer
chiama `update(oldValue)` e rigenera il sottoalbero con `view(newValue)`.
Il ciclo è un embrione di MVU, ma senza aggiungere ancora una sintassi
dedicata al linguaggio.

## Host Environment e backend

`studio/host.json` registra `render` e `alert` sotto `callables`.
Il compilatore non conosce DOM, eventi o finestre: produce chiamate come
`__miraHost["render"](...)` e `__miraHost["alert"](...)`.

I tre sorgenti sono **traspilabili sia in JS sia in PHP**. L'esecuzione
interattiva, però, richiede un ambiente DOM e viene verificata soltanto
sul browser host JavaScript. PHP non può mostrare la view da solo:
richiederebbe un host PHP specifico, per esempio un renderer server-side.

## Anteprima e limiti

L'anteprima viene eseguita in `studio/ui-preview.html`, inserita come
`iframe sandbox="allow-scripts"` **senza** `allow-same-origin`.
In questo modo il codice non ha accesso alla DOM o allo storage
same-origin della pagina madre. La preview non è un sistema di esecuzione
sicuro per codice sconosciuto, perché uno script nel sandbox mantiene
altre capacità del browser, per esempio richieste di rete consentite
dalle policy applicabili.

L'host usa una whitelist di nodi UI e limiti di dimensione/profondità.
Non sono supportati ancora CSS arbitrario, HTML raw, form completi, diffing,
lifecycle delle componenti, un framework MVU o tipi statici delle view.

Per consultare il codice: `studio/ui-host.js` (capability e renderer),
`studio/ui-preview.js` (avvio isolato), `test/ui-host.test.mjs` (test dei
clic e delle transizioni), `catalog/examples/browser-*.mira` (sorgenti Mira).

## Mira 0.15: libreria GUI e binding

La libreria [lib/gui.mira](../lib/gui.mira) costruisce i record mediante
normali selettori, senza accesso al DOM. Gli esempi nel catalogo dichiarano
esplicitamente la dipendenza `library: "lib/gui.mira"`; il generatore
concatena i due sorgenti prima della compilazione. Non è un sistema di
moduli né un prelude implicito.

| Costruttore Mira | Comportamento |
| --- | --- |
| `column: items` / `row: items` | Layout verticale/orizzontale |
| `title: caption` / `text: content` | Titoli e testi |
| `button: caption, on click: action` | Evento, anche closure nullaria |
| `button: caption, update: transition` | Transizione unaria di stato |
| `text input: caption, value: current, update: transition` | Testo controllato |
| `checkbox: caption, checked: current, update: transition` | Booleano controllato |
| `choose: caption, value: current, options: choices, update: transition` | Scelta tra stringhe |
| `state: initial, view: factory` | Stato e funzione che produce la view |

I controlli richiedono un antenato state e una funzione binaria
`{old, entered | nextState}`. L'host conserva lo stato, legge unicamente
il valore nativo dell'evento e chiama la funzione Mira. La view viene
ricostruita; se la nuova view non è valida, lo stato precedente rimane.
Il testo usa l'evento input e attende la fine della composizione IME.
Focus e selezione sono ripristinati quando il controllo corrispondente
mantiene posizione strutturale, tipo ed etichetta. Non è un diff DOM:
comportamento della tastiera mobile e cambi strutturali richiedono
ulteriore verifica su browser reali. Uno state annidato può essere
ricreato durante un refresh del genitore.

Le funzioni costruttrici funzionano su JS/PHP, ma gli eventi e il
renderer DOM richiedono JS browser. Niente CSS arbitrario, component
lifecycle, moduli, validazione statica delle view o binding mutabile.
La Scheda lezione è un esempio reale nel catalogo; non sostituisce
ancora il controller di Studio.

## Mira 0.16: DOM incrementale

La view è ancora un record Mira. L'host conserva istanze con il nodo DOM
nativo, le callback correnti e, per state, il valore locale. Valida la
nuova descrizione (incluse le view annidate) prima di applicare modifiche.
Il confronto avviene per posizione fra fratelli e tipo: mantiene nodi
compatibili, aggiorna testo e proprietà se diversi, sostituisce i nodi
incompatibili e rimuove quelli in eccesso. Gli input compatibili non
vengono scollegati dal DOM: non serve ripristinare artificialmente focus
e selezione. Non scrive value se è già corretto; protegge la composizione
IME e ignora il secondo evento con un valore identico. Le callback
leggono la descrizione corrente, non quella della creazione.

Lo state figlio conserva il proprio valore durante gli aggiornamenti
del genitore. La sua funzione view viene aggiornata, quindi può catturare
i nuovi valori del genitore. initial vale solo al primo montaggio.
Per forzare un reset si può usare `state: initial, key: identity, view: factory`:
identity è una stringa, e una chiave diversa nella stessa posizione
rimonta quel sottoalbero. Le callback dei nodi rimossi vengono disattivate.
Una chiamata esplicita a render rimonta l'intera view.

Limiti: niente riordino per chiavi, niente lifecycle, niente ottimizzazione
della valutazione delle view Mira. L'identità è posizionale, quindi un
inserimento di fratelli dello stesso tipo può riutilizzare lo stato nella
stessa posizione; usare una chiave per forzare il reset. La validazione
precede le scritture DOM ma non annulla eventuali effetti host durante
la valutazione di view. I test verificano identità, eventi, IME e stato su
DOM simulato; il comportamento della tastiera iPhone resta da verificare.

## Mira 0.17: stili componibili e griglia

`styled: view, with: [base, override]` applica record di stile senza
aggiungere nodi DOM. I record successivi prevalgono; nelle decorazioni
annidate prevale quella esterna. Una decorazione non cambia l'identità
del nodo sottostante. Le proprietà assenti vengono rimosse e quelle
invariate non vengono riscritte.

```mira
panel style = {padding: 16, gap: 8, radius: 14,
  borderWidth: 2, borderColor: "#202629", borderStyle: "solid"};
render (styled: (column: [title: "Mira", text: "Benvenuto"]),
  with: [panel style, {background: "#c1f1dc"}]);
```

| Proprietà | Valori |
| --- | --- |
| background, color, borderColor | esadecimale CSS, transparent, currentColor |
| padding, margin, gap, radius, borderWidth, fontSize | numero non negativo, px |
| width, minWidth, maxWidth | numero in px, fill, auto |
| fontWeight | intero 100–900 |
| borderStyle | solid, none, dashed |
| flex | numero 0–100 (flex-grow) |
| align | start, center, end, stretch, baseline |
| justify | start, center, end, space-between, space-around |
| wrap | wrap, nowrap |
| textAlign | left, center, right |
| shadow | none, hard, soft |

Gli stili si applicano al nodo esterno di un controllo (label per input,
checkbox e select); non sono CSS arbitrario. Gli errori sono rilevati
prima delle modifiche DOM. `grid: count, children: items` accetta
da 1 a 6 colonne uguali. I costruttori sono normali selettori Mira,
eseguibili anche su PHP; il renderer è browser-only.

Il benchmark in test/ui-host.test.mjs usa un DOM simulato e confronta
100 aggiornamenti della stessa view da 103 elementi con 100 render
espliciti completi, registrando allocazioni di elementi e scritture
di stili, più tempi indicativi Node. Non misura layout, paint, latenza
o memoria in un browser reale. Avvio: npm run benchmark:gui
(dopo build di Studio, inclusa nello script).

## Mira 0.18: misure sul DOM reale

Il laboratorio separa la sola costruzione della view Mira dal tempo di aggiornamento. Il codice Mira genera 100 elementi di testo con padding, un pulsante e una transizione numerica; il caso sparso cambia un testo, quello denso tutti. Incrementale usa il normale evento del renderer; ricostruzione usa render esplicito della stessa view; DOM diretto costruisce la stessa struttura e aggiorna solo i testi noti, usando la transizione compilata. Il DOM diretto è un riferimento specializzato, non un'implementazione equivalente del renderer generico.

Cinque campioni di 30 aggiornamenti, cinque warmup per campione; ordine delle strategie ruotato, mediana e P95 della media per aggiornamento. Si misura con e senza lettura forzata della geometria a ogni passo. Compilazione esclusa, checksum su ogni campione. La misura con layout forzato non misura paint o frame rate; quella sincrona può differire il layout. Il test CI usa Chrome headless, non Safari/iPhone. Da Studio: Bench → DOM Performance Lab. In locale: npm run build:studio, poi aprire dist/studio/gui-benchmark.html o eseguire il test con CHROME_BIN.

## Mira 0.19: specializzazione sperimentale di view fisse

Il pass separato studio/gui-specialize.js legge l'AST risolto dal compilatore Mira. Accetta programmi di sole funzioni, una view unaria con record letterali, layout column/row/grid, stili letterali, titoli/testi e pulsanti con sezione unaria di transizione senza catture. Individua espressioni testuali dipendenti dal parametro, ne conserva il percorso strutturale e ricostruisce una funzione Mira che restituisce solo gli slot dinamici. Il compilatore ordinario genera il JavaScript di questa funzione e delle transizioni: niente emitter alternativo. Al montaggio usa il renderer generico per validare e creare la view; agli eventi valuta soltanto gli slot, aggiorna le proprietà textContent cambiate e conserva lo stato primitivo. Il pass rifiuta strutture dinamiche, input, stato annidato, stili dinamici, chiamate nelle espressioni testuali e closure con catture; non è ancora una modalità dell'anteprima generale. Nessuna modifica grammaticale. Il benchmark confronta il pass con i tre metodi esistenti e controlla checksum e numero di slot (1 o 100); compilazione, analisi e montaggio sono esclusi dal timer. Il DOM diretto resta il riferimento scritto a mano. Non misura paint/FPS né memoria.

## Mira 0.20: record e stili dinamici

Il pass accetta accessi a campi, condizioni e stato composto da valori dati. Le decorazioni devono ancora avere liste e record di forma fissa: i valori delle proprietà possono dipendere dal modello. Uno slot stile raccoglie tutte le decorazioni dello stesso nodo, nell'ordine originale interno-esterno. Il validatore CSS è condiviso con l'host generico; anche valori poi sovrascritti vengono validati. Tutti gli slot vengono calcolati e validati prima di scrivere sul DOM; in caso di errore di validazione stato e DOM restano invariati. Non vengono ancora aggiunte/rimosse proprietà dinamicamente, né specializzati input, componenti chiamati o alberi condizionali. Il laboratorio include una demo interattiva e un terzo caso con record count, testo e padding dinamici, confrontato con le stesse quattro strategie. La specializzazione resta opt-in nel laboratorio.

## Mira 0.21: binding specializzato

Il pass sperimentale supporta input testuale, checkbox e select con lista statica di opzioni, etichette statiche e valori controllati dal modello. Le transizioni binarie sono sezioni di selettori con due placeholder o blocchi chiusi di due parametri, con espressioni semplici, record e condizioni; un blocco che cattura il parametro della view viene rifiutato. Anche i pulsanti possono usare blocchi unari chiusi. La grammatica Mira non cambia.

Al montaggio si usa ancora il renderer generico. Il codice comune di binding gestisce gli eventi nativi, la composizione IME, il confronto dei valori e il ripristino dei controlli dopo un errore. Il pass specializzato calcola e valida tutti gli slot prima di modificare il DOM, quindi aggiorna proprietà value/checked, stili e testi, senza ricostruire i nodi. Non riscrive il valore di un input quando coincide con quello già inserito, evitando di spostare il cursore. Durante una composizione non sovrascrive il testo provvisorio. Le vecchie callback non agiscono dopo il rimontaggio del form.

Nel DOM Performance Lab, Monta form apre una scheda lezione con allievo, pagamento, modalita e Reset. Il benchmark form confronta incrementale e specializzato usando lo stesso sorgente Mira: tre controlli, tre testi dinamici, un titolo, un pulsante e 99 testi statici. Misura eventi input sintetici, 5 campioni da 30 aggiornamenti, con e senza layout forzato. Il test Chromium verifica anche focus, selezione, checkbox, select e reset. Il DOM simulato verifica composizione IME e rollback su valori invalidi. Non è un test di tastiera mobile reale; non misura paint. Il pass rimane opt-in nel laboratorio: non supporta ancora componenti chiamati, opzioni dinamiche, stato annidato o struttura dinamica.

## Mira 0.22: componenti componibili

Il pass legge le definizioni risolte e sostituisce gli argomenti dei normali selettori Mira nel corpo delle funzioni, con ambiente lessicale del chiamato. Non conosce nomi privilegiati come column, text o styled: legge le loro definizioni in lib/gui.mira. Accetta anche costanti globali di dati letterali, per esempio record di stile. Le chiamate sono espanse prima del montaggio, mai durante gli aggiornamenti specializzati. Il compilatore ordinario continua a emettere le espressioni degli slot e le transizioni.

Il sottoinsieme è conservativo: chiamate finite, espressioni senza effetti, record/sequenze, letture di campo, operatori e condizioni, blocchi chiusi e sezioni senza catture. Per preservare la valutazione anticipata degli argomenti, un parametro non usato in posizione stretta è ammesso soltanto con argomento di dati letterali. L'ordine preciso di diagnostica di più errori simultanei non è garantito. Sono rifiutati ricorsione, riferimenti non risolti, blocchi con catture, istruzioni top-level, struttura dinamica e stato annidato. L'espansione ha limiti di profondità e dimensione. Non è un ottimizzatore generale del linguaggio né un sostituto automatico del renderer generico.

Il form del Performance Lab ora usa la libreria reale inclusa dal build e due selettori riutilizzabili (student field e summary line); la pagina mostra il sorgente. I test verificano anche le view originali del catalogo gui-dashboard e gui-lesson, senza riscriverle come record: viene separata soltanto la chiamata finale a render per montare il modello iniziale nel laboratorio. I benchmark continuano a escludere compilazione, espansione e montaggio.

## Rapporto sperimentale e roadmap

Vedi [Evoluzione del rendering GUI 0.15–0.22](gui-rendering.md) e [Laboratory di Mira Studio](https://spyryto.github.io/Mira/laboratory.html) per cronologia, misure CI, prove dell'autore su iPhone e smart TV, decisioni e roadmap. Il dataset completo è in [catalog/laboratory/gui-rendering.json](../catalog/laboratory/gui-rendering.json). Il prossimo esperimento proposto è il rendering ibrido; non è ancora implementato.

## Mira 0.23: rendering ibrido

Primo esperimento opt-in a regioni sorelle. L'host riceve una lista esplicita di selettori unari che descrivono le regioni di una colonna fissa. compileHybrid usa il compilatore ordinario per tutte le view e prova il pass di specializzazione per ogni selettore; soltanto un rifiuto esplicito del sottoinsieme specializzabile produce una regione generica. Errori di compilazione non vengono nascosti. Non c'è nuova sintassi Mira né partizione automatica di alberi arbitrari.

Un unico owner mantiene lo stato radice e riceve le transizioni da tutte le regioni. Il montaggio iniziale usa l'host ordinario. Agli aggiornamenti, le regioni specializzate conservano riferimenti alle istanze e valutano soltanto gli slot; quelle generiche preparano la nuova view con la riconciliazione esistente. Tutte le regioni vengono validate prima delle scritture DOM, con budget condiviso. Una transizione rifiutata per errore di validazione lascia stato e view invariati; non si garantisce rollback di effetti esterni o di errori DOM inattesi durante il commit. I controlli usano gli stessi handler e i componenti state annidati nelle regioni generiche mantengono la loro identità e il proprio stato. Non sono specializzati gli state annidati.

Il benchmark ibrido usa una regione fissa di 100 testi (uno dinamico) e una regione generica con pulsante e ramo alternato tra titolo e testo. Confronta il medesimo sorgente Mira compilato, in modalità incrementale e ibrida; verifica risultato, tipo del ramo e identità dei nodi persistenti in Chromium. Compilazione e montaggio esclusi. I test DOM simulato controllano transizioni da entrambe le regioni, stato annidato, binding e rollback. Il renderer dell'anteprima ordinaria non cambia.

## Mira 0.24: selezione automatica del renderer

compileAuto(compiler, source, selector) riceve un solo selettore unario normale, non una lista di regioni. Compila e valida il sorgente ordinario prima di tentare la specializzazione. Prima prova la specializzazione completa; se il sottoinsieme viene esplicitamente rifiutato, cerca una colonna radice di forma fissa, letterale oppure costruita da un selettore la cui definizione restituisce esattamente il record column con children pari al parametro. Ogni figlio deve essere una chiamata unaria diretta con lo stesso parametro del modello. Non ci sono nomi privilegiati: anche un costruttore utente equivalente viene riconosciuto. Se almeno una regione è specializzabile, il piano ibrido riutilizza l'owner e le regioni della 0.23. Altrimenti resta l'intera view generica originale. Non aggiunge wrapper alla struttura. Gli errori di compilazione non sono fallback.

Limiti deliberati: una sola partizione alla radice, colonne non decorate, argomenti identici al modello; figli inline, row/grid come confine ibrido, argomenti trasformati, strutture condizionali alla radice e partizioni ricorsive non sono ancora riconosciuti (possono comunque usare la specializzazione completa o il fallback generico). Stato annidato resta gestito dal generico. La modalità è opt-in nel Performance Lab, non ancora nell'anteprima ordinaria. Il benchmark ibrido ora passa soltanto hybrid view: a compileAuto; verifica identità e risultato, mentre i test confrontano la struttura con il renderer ordinario e verificano fallback senza alterare la semantica del costruttore.

## Mira 0.25: anteprima e ispettore

L'anteprima ordinaria offre Renderer Automatico (predefinito) / Generico. Cambiare modalità rimonta l'app, ripartendo dallo stato iniziale. La selezione automatica opera dentro lo stesso iframe sandboxed senza allow-same-origin; il compilatore, il pass e il codice generato sono caricati nella preview. Il compilatore principale continua a validare il programma prima di avviarlo. Il protocollo invia anche sorgente, manifest host e modalità.

Il riconoscimento è conservativo: un solo render finale di uno state semplice, iniziale letterale e sezione unaria come view; definizioni precedenti di sole funzioni o dati letterali. Il costruttore state viene riconosciuto dalla sua definizione effettiva. Il prefisso viene isolato usando la posizione del render nell'AST; se non compila senza host, se il piano non è disponibile o se la forma non è supportata, resta il programma compilato ordinario. Non vengono ripetute istruzioni top-level o effetti per ottenere il piano. Un mount specializzato fallito viene segnalato, non ritentato automaticamente. La preview non è un confine di sicurezza per codice arbitrario rispetto al consumo di risorse.

Il pannello Renderer mostra modalità, selettore, regioni riconosciute con percorsi, motivi di fallback, numero e sorgente degli slot dinamici. Non è un albero DOM completo: descrive il piano statico. Mostra tempo di analisi/preparazione (compilazioni aggiuntive incluse) e montaggio sincrono nel frame; la compilazione originale del parent, caricamento del frame e paint non sono inclusi. Tempi separati, non misura FPS. Il renderer generico rimane disponibile per confronto. Stato annidato, alberi dinamici e costruttori non riconosciuti restano generici. I test verificano dashboard e scheda lezione canoniche, fallback, isolamento degli effetti e protocollo di preview; il comportamento effettivo su Safari mobile resta da verificare.
