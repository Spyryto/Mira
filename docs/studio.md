# Mira Studio — PWA

**Mira Studio** is a portrait-first, single-column editor and compiler explorer.
It is intentionally lightweight: no application framework, no runtime CDN, and
no duplicated implementation of the Mira language.

The browser bundle is built from `src/mira/studio/Bridge.hx` using the **same
Haxe compiler code** as the Node CLI. It exposes a minimal boundary:

```javascript
MiraStudioCompiler.compile(source, "js" | "php");
MiraStudioCompiler.tokens(source);
MiraStudioCompiler.ast(source);
```

Each function returns `{ ok: true, output: string }` or
`{ ok: false, message: string }`; there are no thrown Haxe compiler errors
in UI event handlers. These methods can later serve other editors without
coupling parsing to the PWA.

## Guida interlinkata e API

La scheda **Guida** carica `reference.json`, prodotto da
`scripts/generate-reference.mjs` a partire da `catalog/manifest.json`,
`catalog/examples/*.mira` e da tutte le dichiarazioni pubbliche Haxe.

Ogni feature ha almeno due esempi reali, entrambi testati nei backend JS/PHP;
inoltre l'interfaccia offre ricerca, collegamenti feature → esempio → API,
collegamenti al codice sorgente e pulsanti per aprire gli esempi nell'editor.

Le sezioni con più `_` producono funzioni a più parametri: il worker può
invocare le funzioni generate usando gli argomenti predefiniti nel catalogo
perché Mira 0.3 non ha ancora una sintassi per l'applicazione generica n-aria.
La documentazione, incluso il riferimento API, è inclusa nella cache offline.

## Features in the first release

- **Scrivi**: keyboard-friendly editor with line numbers, position indicator,
  native Mira syntax highlighting, selector examples, import/export of local
  `.mira` files and automatic local persistence (browser localStorage).
- **Output**: compile to JavaScript or PHP, copy or download generated code.
- **Esplora**: inspect **real** source tokens with locations and canonical AST
  from the Haxe compiler.
- **Esegui**: explicitly run generated JavaScript in a dedicated Web Worker,
  with a 2-second timeout to prevent ordinary infinite loops from freezing the
  interface. After **Compila** the bottom status bar reports compilation time;
  after **Esegui** it reports JS execution time (measured inside the worker,
  excluding worker startup, message transport, and dynamic JS function parsing).
  The timer measures one run, not a statistical benchmark. For values below
  0.001 ms the bar shows `Esec. < 0.001 ms`. PHP is **generated, not run**
  in the browser.
- **Offline installability**: relative GitHub Pages paths, manifest, service
  worker, offline asset cache and an update notification. Source drafts are
  retained locally before app refresh.

This is a frontend for **Mira 0.3**. It supports keyword-selector sections and left-to-right pipelines. It does not silently implement
multi-statement or multi-parameter blocks, typed records, types, general currying, or HTML/MVU.

### Useful shortcuts

- `Ctrl/Cmd + Enter`: compile.
- `Ctrl/Cmd + Shift + Enter`: run JavaScript if JS is selected.
- `Tab`: insert two spaces in the source editor.

## Build and local preview

Prerequisites: Haxe 4.3.7, Node.js 22+ (and PHP 8+ for the PHP smoke test).

```sh
npm run build:studio
node --test test/studio.test.mjs

# Serve dist/studio; PWA service workers don't work from file://.
python3 -m http.server 8080 --directory dist/studio
```

Then open `http://localhost:8080` in a browser.

`npm run test:studio` performs the build and tests in one command.
`npm test` includes CLI and Studio tests. The static site is ready in
`dist/studio/` and can be hosted from any HTTPS static web server, not only
GitHub Pages.

## GitHub Pages

The workflow `.github/workflows/studio-pages.yml` builds Studio on pull
requests and `main`, publishes a downloadable preview artifact, and attempts
a GitHub Pages deployment after successful builds on `main`.

**One-time repository setup, if Pages has not already been activated:**

1. Open repository **Settings → Pages**.
2. Set **Build and deployment → Source → GitHub Actions**.
3. Trigger or rerun the **Mira Studio PWA** workflow on `main`.

Once the Pages deployment succeeds, the expected URL is:

https://spyryto.github.io/Mira/

Do **not** consider that URL live until GitHub reports a successful deployment.

## Caching and updates

The service worker caches the HTML, compiler, UI code, stylesheet, example
library, worker, manifest and icon for offline use. A changing commit-derived
cache name allows new builds to replace old assets.

When a new version is installed, Studio shows an **Aggiorna** control instead
of silently reloading and interrupting a user who is typing. Source content
is saved locally before a refresh. Browser localStorage is device-specific;
export `.mira` files for portable backups.

## Execution and security limitations

Generated JavaScript is executed only after pressing **Esegui**, in a Web
Worker. A Worker keeps ordinary loops off the main UI thread, but it **is not
a secure sandbox** for untrusted JavaScript and does not remove all possible
network or resource access. Do not paste or execute unknown third-party code.

The worker evaluates the JavaScript emitted by the currently limited Mira
compiler and reads its `result` binding. No PHP engine or server-side code
runs inside the PWA.

## Architecture

```text
                  Mira source
                       |
                Haxe compiler core
                       |
             +---------+---------+
             |                   |
       Node CLI main         Browser Bridge
             |                   |
        JS/PHP files        JS/PHP + AST + tokens
                                 |
                         Static Studio UI
                        (no language parser)
                                 |
                      optional JS Worker run
```

The UI can evolve independently of Mira's semantics. Future work might add
structured diagnostics with source spans or source/AST cross-references. Mira
syntax highlighting is implemented by a lightweight, presentation-only scanner;
the Haxe lexer/parser remain the only authority for program meaning.

## Interoperabilità UI

Dalla Guida scegli **Alert dall'host**, **View e pulsante** o
**Pulsante con contatore**. Premi **Esegui** o **Anteprima UI** con
JavaScript selezionato. L'anteprima compare nella scheda Output;
il pulsante aggiorna lo stato facendo eseguire funzioni Mira, non
implementazioni nascoste in JavaScript.

Le API `alert` e `render` sono funzioni dell'Host Environment.
Le view sono record di tipo `column`, `title`, `text`, `button`
e `state`. L'iframe è isolato tramite `sandbox="allow-scripts"`
senza `allow-same-origin`. Le view non possono essere eseguite
direttamente su PHP, anche se il sorgente Mira traspila in PHP.

[Descrizione dell'esperimento e sorgenti](browser-interop.md).

## Workbench a schermo intero

Il pulsante **⛶ Espandi** nella barra gialla di Workbench porta l'intero
laboratorio a occupare la finestra: editor, schede, compilazione, esecuzione,
anteprima UI e stato rimangono disponibili. Il pannello **Scrivi** fa crescere
automaticamente l'area del codice e mantiene visibili i comandi. **✕ Riduci**
ripristina l'impaginazione normale; da tastiera si può usare anche `Esc`.
La scheda **Bench** usa questo stesso controllo, senza un secondo pulsante fullscreen.

Non viene usata la Fullscreen API, che non è disponibile uniformemente su
iPhone: è un layout CSS con `position: fixed` e `100dvh` per il viewport
dinamico. Il sorgente e il pannello selezionato restano invariati. `Esc`
riduce il Workbench da qualsiasi scheda, inclusa **Bench**.

Il controllo è implementato in `studio/workbench-fullscreen.js`, copiato
nella build e incluso nella cache offline del service worker.

## Colori nell'editor Mira

La syntax highlighting riconosce i commenti `#`, stringhe, numeri, booleani,
placeholder `_`, selettori come `select:` / `if:` e operatori come
`~` e `>>`. È un overlay DOM non editabile sincronizzato con il `textarea`:
tastiera mobile, selezione, undo e inserimento restano nativi. Il sorgente
viene inserito come nodi di testo, non come HTML; non ci sono dipendenze CDN.
La PWA lo rende disponibile offline. Per sorgenti oltre 50 KB la
colorazione viene disabilitata per mantenere fluido l'editor.

Il modulo `studio/syntax-highlight.js` riconosce soltanto le forme lessicali
per colorare: sintassi incompleta e diagnostica sono responsabilità del
compilatore Haxe, non del coloratore.

## Blocchi di espressione in Mira 0.8

Il preset **Blocchi · 0.8** mostra una funzione unaria con parametro
`_` esplicito, utilizzato più volte:
`fee = {_ | (_ ~ hours) * (_ ~ rate)};`. La funzione può essere
applicata con `>>` o passata come callback a `select:if:`.
L'Inspector mostra il nodo AST `Block` con parametro e corpo.

Dalla versione 0.9 i blocchi possono avere più parametri, pur mantenendo
la semantica di blocco espressione. Dalla 0.11
è possibile separare più espressioni con `;` e osservare
il nodo `Steps` nell'Inspector. Il preset **Blocchi · più espressioni 0.11**
mostra anche una chiamata host di log prima del valore finale.
Il preset **Fold · blocchi 0.9**
mostra un riduttore con due argomenti e il relativo risultato. L'AST
espone `parameters` come lista. Dalla 0.10, `with: {total, item | ...}`
funziona senza parentesi tonde aggiuntive. L'esempio
**Fold · compensi 0.10** mostra la nuova sintassi.

## Mira 0.12: valori locali immutabili

Il preset **Valori locali · 0.12** mostra un blocco che definisce
`doubled` con `=` e lo rende disponibile a un blocco annidato.
Il compilatore risolve i valori locali in ordine: un nome non è
visibile prima dell'inizializzazione e non può essere ridefinito.

L'Inspector rappresenta la dichiarazione come `Local` dentro `Steps`,
con un sottoalbero `value` per l'inizializzatore. La compilazione JS
usa `const`, quella PHP variabili locali con cattura lessicale
delle closure annidate.

## Diagnostica dei valori locali (Mira 0.12.1)

La **Guida → Diagnostica e ambiguità** contiene due esempi negativi:
uso di un valore locale prima della dichiarazione e collisione di un
parametro con un nome esterno diverso dopo il mangling. I messaggi
riportano il nome e la posizione nel sorgente.

Il preset **Shadowing lessicale · 0.12.1** mostra invece un caso valido:
un parametro interno ombreggia un parametro esterno dallo stesso nome.
Compilatore CLI e Studio usano lo stesso controllo Haxe.


## Diagnostica runtime (Mira 0.13)

Con **Esegui**, il controller richiede al compilatore Haxe le posizioni
delle definizioni e le passa al Web Worker insieme al JavaScript.
In caso di errore durante l'esecuzione il worker cerca uno stack frame
del codice generato; calibra l'offset di `new Function` soltanto in caso
di errore. Quando può collegare lo stack alla mappa, Studio mostra ad
esempio:

```text
Errore: Missing record field: missing
Mira: riga 2, colonna 1 · read: (definizione)
```

Prova il preset **Errore runtime · 0.13**. Non è un errore di compilazione:
il campo mancante viene individuato durante l'esecuzione.

L'API opzionale `MiraStudioCompiler.compile(source, target, hostJson, true)`
aggiunge `locations` al risultato positivo; senza il quarto parametro il
contratto originale rimane invariato. Il CLI espone gli stessi dati con
`--locations`, come JSON con `output` e `locations`. Ogni voce indica
`generatedStartLine` e `generatedEndLine` (inclusivi e a base 1),
`line`, `column` e `name` della definizione Mira. Le posizioni PHP
valgono per il file generato senza aggiungere righe all'inizio.

Limiti: mappa a livello di definizione, non Source Map v3; nessuna
posizione inventata quando lo stack del browser non è interpretabile.
L'anteprima UI nell'iframe, i timeout, gli errori di sintassi JS e
l'esecuzione PHP nel browser non sono coperti. PHP resta eseguibile
esternamente: si può confrontare la riga indicata dal suo stack con
la mappa CLI. Il codice emesso con e senza mappa è identico.


## Blocchi senza parametri (Mira 0.14)

Il preset **Blocchi senza parametri · 0.14** crea una closure che
registra un messaggio solo al momento di `() >> action`, poi restituisce
42. L'Inspector mostra **Blocco · 0 parametri** e **Apply · 0 argomenti**.
I blocchi possono contenere più espressioni e valori locali; il compilatore
emette chiamate native JS/PHP, senza parametri fittizi o runtime aggiuntivo.

## GUI componibili e form (Mira 0.15)

La Guida contiene la feature **Libreria GUI Mira e binding**, con due
esempi interattivi, Salutami e Scheda lezione. Il codice completo include
i costruttori di lib/gui.mira, ed è modificabile offline. Seleziona JS
e premi Anteprima UI. I controlli usano stato immutabile e transizioni
Mira; il renderer browser non implementa la logica dell'applicazione.

## GUI incrementali (Mira 0.16)

La Guida presenta due esempi di stato indipendente e reset con chiave.
L'anteprima aggiorna il DOM compatibile in place; i form non perdono il nodo
input a ogni carattere. I test simulano il DOM, non una tastiera mobile reale.

## Stili GUI (Mira 0.17)

Guida → Stili GUI componibili e griglia: Dashboard musicale e Tema dinamico. Le view usano record di stile validati e aggiornamenti incrementali. Il benchmark GUI usa un DOM simulato, non un browser reale.

## DOM Performance Lab (Mira 0.18)

Da Bench apri **DOM Performance Lab**. Il benchmark gira sul DOM reale del dispositivo, non nel Worker: 100 testi, aggiornamenti sparsi/densi, confronto incrementale, render completo e DOM diretto. Il test headless Chrome/Chromium esegue lo stesso file in CI. Nessuna soglia prestazionale assoluta; si verificano checksum e tempi finiti. La navigazione offline conserva la pagina separata.

## Specializzazione GUI (Mira 0.19)

DOM Performance Lab include Mira specializzato: pass sperimentale su AST risolto per view fisse. Mostra numero di slot dinamici e tempi insieme agli altri tre renderer. Non cambia il renderer dell'anteprima generale; per limiti e metodo vedi browser-interop.md.

## Record e stili specializzati (0.20)

DOM Performance Lab include una demo da montare e il caso benchmark record/stile dinamico. Il renderer ordinario resta invariato nell'anteprima. Il validatore CSS è condiviso.

## Binding specializzato (0.21)

Bench → DOM Performance Lab → Monta form: scheda lezione con input, checkbox, select, riepilogo e reset. Il benchmark confronta due renderer sullo stesso form compilato da Mira; l'anteprima UI ordinaria continua a usare il renderer generico. Focus e selezione sono verificati in Chromium; IME è simulato nei test.

## Componenti specializzati (0.22)

Bench → DOM Performance Lab → Monta form usa la libreria reale gui.mira e selettori riutilizzabili. Apri Sorgente Mira del form per vedere il codice. I test specializzano anche le view canoniche Dashboard musicale e Scheda lezione. Il renderer ordinario dell'anteprima rimane invariato.

## Archivio Laboratory · evoluzione GUI

La pagina Laboratory è un rapporto statico offline, generato al build da catalog/laboratory/gui-rendering.json, senza caricare il compilatore. Contiene cronologia 0.15–0.22, grafici, tutti i risultati storici CI recuperati (mediana/P95), prove iPhone/TV trascritte dall'autore, limiti e roadmap. Il DOM Performance Lab resta separato e misura il dispositivo corrente. Vedi [rapporto tecnico](gui-rendering.md).

## Rendering ibrido (0.23)

Bench → DOM Performance Lab → Monta demo ibrida. Due regioni condividono il modello; Avanti modifica un testo specializzato e cambia la struttura di una regione generica. La pagina include sorgente e confronto incrementale/ibrido. I confini sono espliciti nell'API browser, non una partizione automatica. Vedi browser-interop.md.

## Selezione automatica (0.24)

Bench → DOM Performance Lab → Monta demo ibrida automatica. Il laboratorio passa un singolo selettore e il pass riconosce le regioni della colonna radice. Se la view non è riconoscibile usa il renderer generico senza cambiarne la struttura. Nessuna modifica all'anteprima ordinaria.

## Anteprima e ispettore (0.25)

Anteprima UI → Renderer Automatico/Generico. Il riepilogo nel frame è espandibile: piano statico, slot, motivi e tempi di preparazione e montaggio. Cambiare modalità resetta lo stato. Il pass è eseguito nel frame sandboxed; sorgenti non riconosciuti continuano a usare il renderer ordinario. Gli esempi del DOM Performance Lab restano disponibili per misure ripetibili.

L'archivio Laboratory ora comprende anche 0.23–0.25, inclusi tutti i casi ibridi e la storia dell'ispettore. I costi iniziali sono visibili nella preview, non ancora archiviati come misure ripetibili.

## Esperimento Text.data (0.26)

Nel DOM Performance Lab, quattro nuove tabelle Text node confrontano textContent e Text.data sullo stesso renderer specializzato. 9 campioni da 120 aggiornamenti; il renderer predefinito resta invariato. Nessuna modifica al sorgente Mira necessaria.

## Raggruppamento dei commit (0.27)

DOM Performance Lab → Benchmark aggiornamenti raggruppati. Confronta immediato, microtask e requestAnimationFrame con raffiche di 1 o 10 eventi e carichi sparsi/densi. Mantieni la pagina visibile; non è un test FPS. Preview predefinita invariata.

## CSS containment (0.28)

DOM Performance Lab → Benchmark CSS containment. Confronto su pannelli lunghi, con aggiornamenti in viewport e fuori viewport; reveal misurato separatamente. Supporto CSS rilevato nel browser. Renderer predefinito invariato. Laboratory conserva anche i dati 0.26–0.27.

## Laboratory: layout differito (0.29)

Le schede statiche del rapporto lungo possono usare content-visibility: auto e contain-intrinsic-block-size: auto 240px. Il valore iniziale è una stima, non un'altezza fissa: il browser può ricordare il block size effettivo dopo il rendering. Prima di visitare una scheda lo scroll extent può essere stimato e cambiare; non si promette uno scroll perfettamente stabile. L'ottimizzazione è circoscritta alle section.lab-card, con eccezione della sezione contenente il target architecture; i details/summary rimangono ordinari, così come le altre ancore. Le schede con focus interno sono forzate visibili. Nessun JS aggiunto al rapporto e nessun cambiamento a runtime o altre pagine. CSS @supports richiede entrambe le proprietà, altrimenti il layout resta ordinario e il checkbox non appare. Il checkbox nativo "Layout ordinario" disattiva l'esperimento senza ricaricare la pagina.

Test Chromium sulla pagina realmente generata: navigazione dei link interni, apertura/chiusura dei dettagli, geometria delle schede dopo reveal, confronto dell'estensione dello scroll dopo aver visitato tutte le schede, disattivazione/riattivazione. Confronto esplorativo dei costi di invalidazione della larghezza (dieci cambi per campione, sette campioni) con lettura geometrica in cima e reveal finale separato. Non misura primo caricamento, paint, FPS, memoria, interazioni reali o scroll fluido; nessuna soglia prestazionale. Le stime possono dipendere da larghezza, zoom, font e browser. Verificare su iPhone, Firefox e smart TV prima di estendere ad altre parti di Studio.

Il primo test Chromium ha mostrato che disattivare e riattivare la proprietà può invalidare le dimensioni ricordate. La verifica richiede quindi convergenza dopo una nuova visita delle schede, non la conservazione delle altezze al cambio modalità. Il confronto espone anche l'altezza immediatamente dopo la riattivazione.

## Import di librerie (0.30)

Seleziona **Import GUI · 0.30** nell'editor e avvia l'anteprima. La libreria canonica è incorporata nel compilatore Haxe, quindi funziona senza fetch anche offline. Le API compile(source,target,hostJson,withLocations,modulesJson), ast(source,hostJson,modulesJson) e trace(source,hostJson,modulesJson) accettano anche una mappa JSON di percorsi relativi e stringhe sorgente per integrazioni. L'editor non è ancora un workspace multifile e l'anteprima automatica riconosce solo librerie incluse nel bundle. L'analisi token mostra il file di ingresso; AST e posizioni generate includono anche i file importati. Vedi [grammatica](grammar.md#mira-030-import-statici).

## Record update (0.31)

Apri dalla Guida **Registro lezioni · modifica immutabile**: i binding modificano un solo campo con `update:with:`. Il renderer automatico può specializzare le transizioni chiuse. Gli esempi di calcolo sono eseguibili anche senza host.

## Collezioni native (0.32)

Guida → Registro lezioni · lista dinamica. Il renderer generico visualizza una lista costruita con collect, aggiunge con append e rimuove con remove. Non serve una capability host di collezione. L'ispettore AST conserva il proprio manifest e fold su alberi. L'esempio 0.32 resta posizionale; dalla 0.33 è disponibile l'identità esplicita.

## Identità delle liste (0.33)

Guida → Registro allievi · identità stabile. Scrivi note diverse e incrementa i contatori, poi Inverti: ciascuna riga conserva il proprio stato. Mostra/nascondi Ada rimuove il suo widget, e al reinserimento il suo stato locale riparte dall'iniziale. La chiave è dichiarata con each:identified by:view:, nessun ID DOM automatico. L'anteprima usa il renderer generico. [Semantica](browser-interop.md#mira-033-identità-delle-liste-gui).

## Registro lezioni persistente (0.34)

Dalla home, apri Registro lezioni. Inserisci un nome, aggiungi una lezione, incrementa le ore o cambia lo stato di pagamento. Il totale usa una tariffa dimostrativa di 30 €/ora. I record e il contatore next id vengono salvati in LocalStorage dopo il commit riuscito; anche la bozza viene conservata. Ricarica la pagina per ritrovare i dati. Il controllo Cancella dati locali chiede conferma. Limite del pilota: 100 lezioni, nomi/bozze fino a 120 caratteri, ore intere da 1 a 10000. La pagina segnala salvataggio o errore. Il servizio è locale al browser/origine e profilo, non sincronizzato, non cifrato e non un backup. Non usare dati personali reali per il test.

Gli asset sono nel cache PWA e la navigazione offline ha la propria chiave. Per installazione offline occorre che Studio abbia completato l'installazione del service worker. Non si gestiscono conflitti fra schede aperte, sincronizzazione o migrazioni di schema. La pagina non è l'editor sandboxed e non esegue codice arbitrario.

## Consultare la storia fino alla 0.34

Il [Laboratory](https://spyryto.github.io/Mira/laboratory.html) espone 20 tappe, 18 report CI, 244 scenari e le misure su dispositivi già fornite. Le ripetizioni dei test prestazionali in versioni successive sono nell'archivio espandibile. [Decisioni e roadmap applicativa](decisions.md#stato-e-direzione-034). La documentazione non certifica il deploy pubblico né il comportamento su browser non verificati.

## Laboratorio effetti asincroni (0.35)

Dalla home apri Laboratorio effetti. Invia una richiesta, incrementa il
contatore mentre attendi, oppure invia subito una seconda richiesta.
Le richieste dispari richiedono 1500 ms e le pari 300 ms: il caso di risposta
fuori ordine è riproducibile. Una richiesta può fallire e il suo errore
diventa un normale messaggio. Il programma è compilato in build su JS e PHP;
solo JS monta la pagina. Sorgente Mira consultabile dalla pagina, asset
offline. Il servizio è simulato e non utilizza la rete. L'editor non
riceve nuove capability. Vedi [semantica](browser-interop.md#mira-035-effetti-asincroni-pilota).

## Registro full-stack (0.36)

Il pilota separato in [examples/fullstack](../examples/fullstack) usa il
renderer generico e il runtime degli effetti 0.35. Il frontend descrive
richieste JSON e mostra soltanto snapshot confermati dal server; il backend
Mira applica aggiunta, incremento ore, pagamento e rimozione a un modello
immutabile. L'adapter PHP valida richieste, gestisce HTTP e salva lo snapshot
JSON in una singola riga SQLite dentro una transazione BEGIN IMMEDIATE.
Ogni modifica porta la revisione attesa; una richiesta obsoleta riceve 409.
Gli ID sono assegnati dal server e non riutilizzati. Nessuna modifica alla
grammatica, ai renderer specializzati o al registro locale 0.34.

```sh
npm run build:fullstack
php -S 127.0.0.1:8080 -t dist/fullstack/public
```

Aprire http://127.0.0.1:8080/; servire esclusivamente public, mai private.
La cartella private contiene il programma PHP generato e il database.
Per il test occorrono Haxe 4.3.7, Node 22+, PHP 8.3 con PDO SQLite e
Chrome/Chromium (CHROME_BIN se necessario): npm run test:fullstack.

Una sola operazione in volo per frontend; input e mutazioni sospesi mentre
attende. Errore HTTP o timeout (10 s) blocca le mutazioni fino a ricarica:
non si ritenta automaticamente un'operazione che potrebbe essere stata
confermata dal server. La revisione protegge da scritture perse, non è
autenticazione o un meccanismo generale di idempotenza. Una singola tabella
snapshot è una scelta deliberata per il pilota (100 lezioni, nomi fino a
120 byte, 10000 ore); non è un database relazionale di produzione. Non usare
dati personali reali. Nessun CORS, utenti, backup o deploy pubblico.

Il workflow Mira full-stack integration avvia PHP e Chromium su loopback,
compila i due programmi, verifica DOM, CRUD, errore di rete, riavvio server,
conflitti di revisione e validazione. Produce screenshot e campioni di
latenza HTTP di lettura sequenziale (30 dopo 5 warmup), non throughput
concorrente o prestazioni del browser; nessuna soglia prestazionale.
Il sito Pages resta statico: il bundle server non viene pubblicato.

## Servizi del registro (0.37)

Il comando di avvio locale è invariato. L'endpoint ledger.php ora usa
l'adapter RPC condiviso e accetta ledger.command e ledger.quote.
Il primo conserva il contratto di revisione e persistenza del registro;
il secondo è un calcolo stateless. Non occorre un nuovo endpoint PHP
per ciascun metodo. Vedi [protocollo e limiti](browser-interop.md#mira-037-rpc-json).

## Dichiarazione dei servizi (0.38)

Il registro full-stack usa `examples/fullstack/services.mira` come unica
fonte delle registrazioni RPC. `npm run build:fullstack` genera
`public/rpc-bindings.js` e `private/rpc-methods.php`. Il pulsante
Calcola preventivo usa il secondo servizio direttamente da Mira, senza
modificare il modello persistente. La CI verifica anche i contratti
invalidi e la determinazione dell'output.
Vedi [contratti RPC](browser-interop.md#mira-038-contratti-di-servizio).

## Laboratorio tipi (0.39)

Il laboratorio `type-lab.html` è accessibile dalla homepage e funziona
offline. Il sorgente è analizzato dall'API `MiraStudioCompiler.check`;
mostra tipi delle dichiarazioni o il primo errore, senza eseguire codice.
Vedi [nucleo e limiti dell'inferenza](type-checker.md).

## Mira 0.82: Host Module Lab

Il laboratorio [Host Module Lab](https://spyryto.github.io/Mira/host-module-lab.html) è accessibile da Studio e Module Explorer, con asset nella cache offline PWA. Due esempi (valore assoluto, massimo) condividono il normale contratto Services / Math e due provider. Sono editabili App, contratto, entrambi i provider e manifest host. Il binding è generato dalla selezione Native, Pure o senza provider. I percorsi logici e il risultato App / result sono fissi per il laboratorio, non per il linguaggio.

Verifica e confronto usano check e interfaces del compilatore reale. Compila JS e PHP usa checked e tree shaking; il confronto mostra impronte e byte UTF-8, non equivalenza semantica. Esegui JS usa un worker dedicato con timeout di tre secondi e due capability fisse Math.abs e Math.max. Non è una sandbox per codice sconosciuto. Non esegue PHP nel browser: la CI esegue l'output PHP con abs e max reali e controlla gli stessi risultati. Manifest e sorgenti modificati non aggiungono capability runtime. Nessun server o libreria nuova, nessuna modifica alla grammatica. La pagina non conserva gli edit tra sessioni.

## Mira 0.83: servizio Text

Il laboratorio Host Module aggiunge una sezione Text, con sorgente App editabile, contratto, provider, manifest e binding consultabili. I file canonici sono in lib/text: la build li incorpora senza duplicarne le definizioni. Verifica tipi e compila JS/PHP; esecuzione JS nel worker esistente con le sole capability Text, PHP nei test. Il risultato atteso di App.mira è {points: 7, contains: true, starts: true, ends: true} per "Caffè 🎸".

Il servizio espone code points:, contains:in:, starts with:in:, ends with:in:. Conta punti di codice Unicode, non unità UTF-16, byte o grafemi. Ricerca esatta case-sensitive senza normalizzazione, ago vuoto sempre vero. Le funzioni native rifiutano stringhe non Unicode valide (surrogati isolati JS, UTF-8 malformato PHP) e valori non stringa; non estendono questa garanzia a tutto il tipo Text nel linguaggio. JS usa iterazione di stringa, includes, startsWith, endsWith; PHP usa PCRE Unicode per contare e str_contains, str_starts_with, str_ends_with, senza mbstring. Il tipo di ritorno del conteggio è Number perché il manifest host non espone ancora Integer. Non ci sono normalizzazione, case folding, slicing o indicizzazione, né un provider puro artificiale. Vedi lib/text/README.md.

## Mira 0.84: JSON tipizzato

Host Module Lab include un decoder JSON concreto con contratto Services / Json. La build ricava schema chiuso e firma host dal report canonico del compilatore sul contratto non collegato; non ripete a mano i campi. Il provider Mira usa una capability scoped. L'applicazione può accedere a name, hours, paid e tags con i tipi verificati. Studio mostra schema e manifest generati, compila JS/PHP ed esegue JS con il worker esistente. L'input JSON si modifica nel sorgente.

Riutilizzati i validatori di schema RPC 0.46: nessun secondo type checker. Ammessi Number finito con interi sicuri, Text Unicode scalare, Boolean, liste, record chiusi non vuoti con chiavi non numeriche; campi mancanti o extra, null, tipo incompatibile e JSON malformato rifiutati. Nessuna coercizione. Limite 16 KiB UTF-8 e profondità dello schema 30. Le API native JSON.parse / json_decode hanno semantica last-key-wins per chiavi duplicate; questa versione non le rifiuta e non è un parser JSON lossless. Il decoder solleva invalid_json_data in caso di errore; non espone ancora Result tipizzato, né un tipo Json dinamico, nominali, refinement o decoder polimorfici. Il parsing e il controllo del valore sono necessariamente runtime, la costruzione dello schema avviene a build time. Vedi lib/json/README.md.

## Mira 0.85: JSON fallibile

Il contratto Services / Json espone anche try decode lesson: con Result (record della lezione, Text). Il decoder diretto della 0.84 resta invariato. Il generatore verifica che la variante Ok abbia esattamente il tipo del decoder diretto e Err sia Text. Riusa il medesimo schema. I due adapter eseguono il decoder una sola volta; per errori di dati restituiscono una lista vuota e il messaggio, per successo una lista singleton e un errore vuoto. Il provider ordinario Mira usa fold per costruire il vero valore nominale Ok o Err; nessun tipo nominale fabbricato dall'host e nessun payload fittizio. Il manifest host rimane strutturale. Le eccezioni inattese non sono intenzionalmente catturate. Il formato intermedio è privato al provider, non una nuova convenzione generale di Mira.

Il laboratorio ha un pulsante Decoder con Result che carica lib/json/Fallible.mira: tre ingressi, uno valido, uno con tipo errato e uno malformato, gestiti con match esaustivo. I limiti del decoder (schema chiuso, 16 KiB, Unicode, numeri sicuri, chiavi duplicate last-wins) restano invariati. Nessuna modifica alla grammatica, checker o emitter. Il costo aggiuntivo di envelope, lista e fold non è stato misurato; un eventuale ABI nominale diretto richiede una decisione separata.

## Mira 0.86: date civili

Host Module Lab include lib/date/App.mira e gli stessi contratti/provider/manifest del CLI. Date è un tipo opaco del contratto Services / Date; la rappresentazione privata del provider è un record con stringa ISO. Validazione esatta YYYY-MM-DD, calendario gregoriano prolettico, anni 0001–9999, niente ora o fuso. Si riusano Date JS in UTC e DateTimeImmutable PHP in UTC, non l'ora locale. Somma di giorni interi (negativi ammessi), differenza orientata in giorni (last - first), giorno della settimana ISO 1–7, conversione ISO. valid date: restituisce Boolean; date from: rifiuta input malformato con invalid_date. add days:to: rifiuta conteggi non interi o oltre 3652058 e risultati fuori intervallo; errori ancora eccezioni al confine. Il manifest usa Number, non Integer. Non c'è aritmetica dei mesi, istanti, clock, durata o timezone; non si modellano transizioni storiche di calendario. Vedi lib/date/README.md. Test CLI e browser, differenziali tra target su bisestili, date limite, anni 1–99, settimane e differenze negative. La UI riusa il controller di Text e JSON.

## Mira 0.87: persistenza chiave-valore

Il servizio lib/storage con contratto Services / Storage e provider Browser/Files selezionabili staticamente consente lettura, scrittura e cancellazione di testo. La lettura ritorna [] se assente e [testo] se presente (anche testo vuoto); scrittura e cancellazione idempotente ritornano true al successo, errori espliciti al confine. Chiavi ASCII da 1 a 64 caratteri, prima lettera minuscola, poi a-z/cifre/_/-. Testo Unicode scalare, massimo 65536 byte UTF-8 per valore. Browser usa localStorage in namespace dedicato; PHP usa directory privata preesistente decisa dall'host, file per chiave, scrittura temporanea e rename. Non sono promessi fsync/durabilità a crash, isolamento tra writer, sincronizzazione, backup, transazioni o cifratura. La directory deve essere privata e non modificabile da processi non fidati; controllo symlink non è sandbox né protezione da race con attaccanti locali.

Il laboratorio usa il vero localStorage del browser: salva, ricarica, leggi, rimuovi. Il programma Mira è fisso, compilato checked a build time, senza esecuzione di testo editabile sul thread UI. Il codice JS e PHP dei due provider è ispezionabile. Non tocca il namespace del registro lezioni. I test verificano sostituzione statica, firme, esecuzione CLI JS e PHP, errori e persistenza PHP tra processi; il test JS usa uno Storage in memoria conforme all'interfaccia, non un browser reale. Vedi lib/storage/README.md.

## Mira 0.88: HTTP testuale

Host Module Lab usa Services / Http, modulo puro checked, e App.mira compilata a build time in JS e PHP. get text: produce un descrittore compatibile con gli effetti 0.35; successful: classifica 2xx. Il laboratorio invoca la capability registrata direttamente dal controller con AbortController e id per scartare risposte obsolete, mostra descrittore e risposta testuale. Il file http-example.txt è same-origin e precache offline; nessun URL editabile, nessun backend pubblico. Il runtime riutilizzabile è in lib/http; fetch JS streaming e stream HTTP PHP, risposta status/body, limite default 64 KiB e massimo 256 KiB, UTF-8 rigoroso, redirect rifiutati, nessuna credenziale JS. 4xx/5xx sono risposte normali. PHP ha timeout di inattività e non deadline totale; è sincrono, non un runtime effetti PHP. Test con server HTTP loopback reale e moduli compilati JS/PHP. Non ancora POST generico, binary, auth, header o URL dinamici. Il contratto non tipizza ancora tutti gli effetti, non cambia createApp né il protocollo RPC. Vedi lib/http/README.md.

## Mira 0.89: importa una lezione

Nuova pagina indipendente, raggiungibile dalla home e precache offline, non modifica il registro precedente. examples/lesson-import/App.mira usa Text, Date, Storage, Http e un decoder applicativo generato dal contratto Services / Lesson Import (include date). Build checked JS/PHP con gli stessi sorgenti e selezione storage diversa. L'host JS usa fetch same-origin, localStorage in namespace lesson-import-v1, adattatori già disponibili. UI HTML/JS sottile: presenta il risultato e ordina esplicitamente gli effetti, senza valutare codice editabile. Mira decide validazione (nome 1–120 code point, ore >0 e <=24, data civile valida), calcolo (30 euro/ora dimostrativi), accettazione HTTP 2xx e scrittura solo dopo validazione. La lettura restituisce testo e viene nuovamente validata prima della visualizzazione. Singolo slot, non archivio di produzione; nessuna migrazione, sincronizzazione o backup. I tag sono verificati dal decoder, ma non visualizzati. Il JSON originale è conservato senza ricodifica. La pagina espone sorgente, schema e codice generato. Test build, adapter, UI simulata e PHP filesystem. La variante PHP è verificata in CI, non pubblicata come applicazione server.

## Mira 0.89.1: consolidamento dei servizi

Revisione 0.83–0.89. Correzioni: un GET PHP con Content-Length dichiarato e corpo troncato non può più risultare un successo; caso riprodotto su socket locale e aggiunto alla matrice HTTP differenziale. L'importazione fallita non sostituisce il JSON inserito; fallimenti I/O lasciano il riepilogo verificato e il pulsante di salvataggio utilizzabile, per riprovare. Rimuovere lo slot non cancella il draft. Il build del pilota rifiuta binding duplicati anche per il decoder generato. La suite full-stack visita la pagina 0.89 in Chromium reale, importa, salva, ricarica, recupera, rifiuta una modifica invalida e recupera nuovamente. Non è ancora un test di service worker/offline o di Safari fisico.

Risultati della revisione, da non confondere con garanzie già implementate: Number PHP usa int/float e l'emitter mappa ==/!= in ===/!==; verificare e correggere la divergenza 1 vs 1.0 in espressioni e sezioni, incluse funzioni polimorfiche. JSON dipende ancora dal modulo effetti/RPC per la validazione; estrarre il nucleo condiviso solo quando serve. Le API Storage usano lista zero/uno e Date eccezioni, non errori nominali uniformi; convergere su Result/Option con una proposta comune, non aggiungere altri envelope ad hoc. La tariffa del pilota resta dimostrativa; non promettere aritmetica monetaria esatta, transazioni o deploy di produzione. Priorità prima della 0.90: correggere la semantica numerica, poi composizione di manifest e progetti multifile; non introdurre un package manager.

## Stato dopo la 0.89.3

L'uguaglianza scalare e il resto frazionario sono stati corretti in 0.89.2 e 0.89.3, entrambe integrate con CI verde. La voce precedente conserva l'esito storico della revisione 0.89.1. Il [rapporto di consolidamento](consolidation-089.md) raccoglie risultati e limiti ed è incluso in design-notes.html, consultabile offline con la cache di Studio. Non è un nuovo runtime o una nuova feature del linguaggio.

## Mira 0.89.4: Option e Result comuni nel pilota

La pagina Importa una lezione usa Data / Outcome tramite il contratto del decoder, la facciata Date Safe e Storage Optional. Il JSON non viene duplicato né il suo schema modificato, il dato salvato rimane testo originale. Il modello resta checked su entrambi i target, la UI riconosce Some/None alla lettura. Date invalida è Err; un errore I/O non è assenza, resta eccezione gestita dal controller. Test di identità nominale, fingerprint, compilazione ed esecuzione JS/PHP e regressione dell'app. I contratti lib/json, lib/date e lib/storage originari non vengono rimossi o modificati. Migrazione ulteriore e tooling multifile sono incrementi successivi.

## Mira 0.89.5: persistenza fallibile

Importa una lezione usa il contratto Storage Safe con provider Browser/Files, Result e Option condivisi, errori nominali e conversione in testo al confine UI. Ok(None) indica assenza, Ok(Some("")) testo vuoto presente, Err(StorageFailure) impossibilità di accedere all'archivio. Il salvataggio continua a validare il JSON e non modifica il dato persistito se non valido; su errori I/O conserva la bozza e consente retry. La UI non mostra una cancellazione riuscita se l'operazione è fallita. I test nuovi distinguono le tre situazioni, errori di chiave/testo/dimensione, errori I/O, symlink PHP e directory scomparsa dopo setup, entrambi i target. Continuano i test del vecchio Storage e il flusso Chromium del pilota. Non equivale a transazioni, backup o protezione da processi locali ostili.

## Mira 0.89.6: costruzione e aritmetica Date fallibili

Il pilota Importa una lezione usa try date from: dal contratto Date Safe con provider selezionato staticamente. Il tipo Date è quello opaco di Services / Date, non una copia. I fallimenti previsti sono Date Error e vengono convertiti in messaggi al confine UI. Test differenziali del compilato JS/PHP: anni iniziali, anni bisestili, date invalide e non canoniche, giorni negativi, limiti 0001–9999, frazioni, NaN, Infinity, verifica di identità del tipo e rifiuto di costruzione arbitraria/capability fuori scope. Le API originali e il formato persistito restano invariati. L'aritmetica fallibile è esercitata dai test, non è un nuovo controllo interattivo della pagina. Il doppio parsing di successo è conservativo e non misurato.

## Mira 0.89.7: decoder JSON consolidati

Il laboratorio JSON e Importa una lezione caricano lo stesso sorgente di Data / Outcome e Data / Decoder Outcome. Il helper generico converte l'envelope dei decoder in Result, evitando codice duplicato nei provider. Test checked con più tipi di payload e JS/PHP; test generator rifiuta identità errata. Nessun cambio ai dati salvati o al comportamento JSON. Il comando build:json e i test CLI usano --module-root lib/common, primo incremento del tooling multifile. Restano da estrarre il validatore puro e da progettare encoder/codec più ricchi; nessuna misurazione prestazionale nuova.
