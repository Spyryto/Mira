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
placeholder `_`, selettori come `collect:` / `if:` e operatori come
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
applicata con `>>` o passata come callback a `collect:if:`.
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
