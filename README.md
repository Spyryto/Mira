# Mira

**Discursive syntax, readable at a glance.**

Mira is currently a standalone **syntax and transpiler experiment**, not a replacement for NailLang. It explores multiword identifiers and Smalltalk-inspired keyword selectors, with a deliberately small executable core.

## Funzionalità e versioni

La tabella distingue le feature **già implementate** (✅) da quelle
**ancora da progettare** (⬜). La colonna *Prima versione* indica
quando la funzionalità è stata introdotta, sulla base dello storico Git
(`0.1` nucleo discorsivo, `0.2` sezioni e pipeline, `0.3`
dati strutturati e interoperabilità).

La parte ✅ è **generata automaticamente** da
[catalog/manifest.json](catalog/manifest.json), tramite `npm run docs`;
i collegamenti portano alla [guida interlinkata](docs/reference/language.md)
e agli [esempi](docs/reference/examples.md).

<!-- START GENERATED FEATURE MATRIX -->
| Stato | Funzionalità | Prima versione | Documentazione |
| :---: | --- | :---: | --- |
| ✅ | Definizioni di valori | `0.1` | [Dettagli](docs/reference/language.md#feature-values) |
| ✅ | Identificatori composti | `0.1` | [Dettagli](docs/reference/language.md#feature-names) |
| ✅ | Funzioni con parametri | `0.1` | [Dettagli](docs/reference/language.md#feature-functions) |
| ✅ | Selettori con più keyword | `0.1` | [Dettagli](docs/reference/language.md#feature-selectors) |
| ✅ | Chiamate discorsive | `0.1` | [Dettagli](docs/reference/language.md#feature-shorthand) |
| ✅ | Letterali numerici | `0.1` | [Dettagli](docs/reference/language.md#feature-numbers) |
| ✅ | Letterali testuali | `0.1` | [Dettagli](docs/reference/language.md#feature-strings) |
| ✅ | Operatori aritmetici | `0.1` | [Dettagli](docs/reference/language.md#feature-arithmetic) |
| ✅ | Parentesi | `0.1` | [Dettagli](docs/reference/language.md#feature-grouping) |
| ✅ | Dichiarazioni successive | `0.1` | [Dettagli](docs/reference/language.md#feature-forward) |
| ✅ | Diagnostica e ambiguità | `0.1` | [Dettagli](docs/reference/language.md#feature-diagnostics) |
| ✅ | Sezioni unarie | `0.2` | [Dettagli](docs/reference/language.md#feature-sections) |
| ✅ | Sezioni con più `_` | `0.2` | [Dettagli](docs/reference/language.md#feature-multi-sections) |
| ✅ | Pipeline `>>` | `0.2` | [Dettagli](docs/reference/language.md#feature-pipelines) |
| ✅ | Cattura lessicale | `0.2` | [Dettagli](docs/reference/language.md#feature-captures) |
| ✅ | Sequenze e trasformazioni | `0.3` | [Dettagli](docs/reference/language.md#feature-sequences) |
| ✅ | Record e dati strutturati | `0.3` | [Dettagli](docs/reference/language.md#feature-records) |
| ✅ | UI web e interoperabilità | `0.3` | [Dettagli](docs/reference/language.md#feature-browser-ui) |
| ✅ | Applicazione funzionale per giustapposizione (`log "ciao"`) | `0.3` | [Dettagli](docs/dogfooding.md#nuove-regole-sintattiche-sperimentali) |
| ✅ | Istruzioni-espressione terminate da `;` | `0.3` | [Dettagli](docs/dogfooding.md#nuove-regole-sintattiche-sperimentali) |
| ✅ | Interop: riferimenti a funzioni/valori dell'host | `0.3` | [Dettagli](docs/dogfooding.md#che-cosa-contiene-il-manifest) |
| ✅ | Accessor funzionali di record | `0.4` | [Dettagli](docs/reference/language.md#feature-accessors) |
| ✅ | Booleani e confronti | `0.4` | [Dettagli](docs/reference/language.md#feature-comparisons) |
| ✅ | Espressioni condizionali | `0.4` | [Dettagli](docs/reference/language.md#feature-conditionals) |
| ✅ | Filtri con predicati Mira | `0.4` | [Dettagli](docs/reference/language.md#feature-filtering) |
| ✅ | Sezioni di operatori | `0.5` | [Dettagli](docs/reference/language.md#feature-operator-sections) |
| ✅ | Accesso diretto ai campi `~` | `0.6` | [Dettagli](docs/reference/language.md#feature-field-get) |
| ✅ | Blocchi funzione con parametro | `0.8` | [Dettagli](docs/reference/language.md#feature-blocks) |
| ✅ | Blocchi con più parametri | `0.9` | [Dettagli](docs/reference/language.md#feature-block-parameters) |
| ✅ | Accesso `~` prima dell'aritmetica | `0.10` | [Dettagli](docs/reference/language.md#feature-field-precedence) |
| ✅ | Blocchi diretti negli argomenti dei selettori | `0.10` | [Dettagli](docs/reference/language.md#feature-bare-block-arguments) |
| ✅ | Blocchi con espressioni in sequenza | `0.11` | [Dettagli](docs/reference/language.md#feature-block-steps) |
| ✅ | Valori locali immutabili nei blocchi | `0.12` | [Dettagli](docs/reference/language.md#feature-local-values) |
| ✅ | Blocchi senza parametri | `0.14` | [Dettagli](docs/reference/language.md#feature-nullary-blocks) |
| ✅ | Libreria GUI Mira e binding | `0.15` | [Dettagli](docs/reference/language.md#feature-gui-library) |
| ✅ | DOM incrementale e stato indipendente | `0.16` | [Dettagli](docs/reference/language.md#feature-incremental-gui) |
| ✅ | Stili GUI componibili e griglia | `0.17` | [Dettagli](docs/reference/language.md#feature-styled-gui) |
| ✅ | Benchmark GUI sul DOM reale | `0.18` | [Dettagli](docs/browser-interop.md#mira-018-misure-sul-dom-reale) |
| ✅ | Specializzazione sperimentale GUI su AST | `0.19` | [Dettagli](docs/browser-interop.md#mira-019-specializzazione-sperimentale-di-view-fisse) |
| ✅ | Specializzazione GUI con record e stili dinamici | `0.20` | [Dettagli](docs/browser-interop.md#mira-020-record-e-stili-dinamici) |
| ✅ | Binding dei controlli GUI specializzati | `0.21` | [Dettagli](docs/browser-interop.md#mira-021-binding-specializzato) |
| ✅ | Specializzazione di componenti GUI componibili | `0.22` | [Dettagli](docs/browser-interop.md#mira-022-componenti-componibili) |
| ✅ | Rendering ibrido a regioni con stato condiviso | `0.23` | [Dettagli](docs/browser-interop.md#mira-023-rendering-ibrido) |
| ✅ | Riconoscimento automatico delle regioni GUI | `0.24` | [Dettagli](docs/browser-interop.md#mira-024-selezione-automatica-del-renderer) |
| ✅ | Anteprima GUI automatica e ispettore di specializzazione | `0.25` | [Dettagli](docs/browser-interop.md#mira-025-anteprima-e-ispettore) |
| ✅ | Benchmark dei nodi testuali persistenti | `0.26` | [Dettagli](docs/browser-interop.md#mira-026-text-node-persistenti) |
| ✅ | Benchmark del raggruppamento dei commit DOM | `0.27` | [Dettagli](docs/browser-interop.md#mira-027-raggruppamento-dei-commit) |
| ✅ | Benchmark CSS containment e content-visibility | `0.28` | [Dettagli](docs/browser-interop.md#mira-028-css-containment) |
| ✅ | Layout differito delle schede Laboratory | `0.29` | [Dettagli](docs/studio.md#laboratory-layout-differito-029) |
| ✅ | Import statici di file Mira | `0.30` | [Dettagli](docs/grammar.md#mira-030-import-statici) |
| ✅ | Aggiornamento immutabile dei record | `0.31` | [Dettagli](docs/reference/language.md#feature-record-update) |
| ✅ | Operazioni native sulle sequenze | `0.32` | [Dettagli](docs/reference/language.md#feature-native-sequences) |
| ✅ | Identità stabile delle liste GUI | `0.33` | [Dettagli](docs/reference/language.md#feature-gui-keyed) |
| ✅ | Registro lezioni con persistenza locale | `0.34` | [Dettagli](docs/studio.md#registro-lezioni-persistente-034) |
| ✅ | Effetti asincroni e servizio HTTP JSON | `0.35` | [Dettagli](docs/browser-interop.md#mira-035-effetti-asincroni-pilota) |
| ✅ | Registro full-stack Mira JS/PHP con SQLite | `0.36` | [Dettagli](docs/studio.md#registro-full-stack-036) |
| ✅ | Servizi RPC JSON riutilizzabili tra JS e PHP | `0.37` | [Dettagli](docs/browser-interop.md#mira-037-rpc-json) |
| ✅ | Contratti RPC dichiarativi Mira e registrazioni generate | `0.38` | [Dettagli](docs/browser-interop.md#mira-038-contratti-di-servizio) |
| ✅ | Inferenza strutturale sperimentale, opt-in | `0.39` | [Dettagli](docs/type-checker.md) |
| ✅ | Inferenza ricorsiva per componenti e vincoli sulle righe | `0.40` | [Dettagli](docs/type-checker.md#040-gruppi-ricorsivi-e-vincoli-sulle-righe) |
| ✅ | Polimorfismo locale e aggiornamento strutturale dei record | `0.41` | [Dettagli](docs/type-checker.md#041-polimorfismo-locale-e-aggiornamenti) |
| ✅ | Inferenza vincolata ScalarEq per uguaglianza generica | `0.42` | [Dettagli](docs/type-checker.md#042-vincoli-di-tipo) |
| ✅ | Diagnostica dei tipi con ancore sorgente e JSON | `0.43` | [Dettagli](docs/type-checker.md#043-diagnostica-delle-espressioni) |
<!-- END GENERATED FEATURE MATRIX -->

Le funzioni **host** non sono primitive incorporate nel linguaggio:
la loro disponibilità dipende da un manifest e dall'ambiente di esecuzione.
Le view interattive sono attualmente eseguite nel browser JavaScript; il
backend PHP ne traspila il sorgente ma non fornisce un renderer DOM.

### Funzionalità non ancora implementate

Nessuna versione è assegnata finché non esiste un'implementazione verificata.

| Stato | Funzionalità | Prima versione | Documentazione |
| :---: | --- | :---: | --- |
| ⬜ | Mutazione e assegnazioni successive nei blocchi | — | [Decisioni aperte](docs/decisions.md#open-questions) |
| ⬜ | Currying completo e applicazione parziale generalizzata | — | [Decisioni aperte](docs/decisions.md#open-questions) |
| ⬜ | Tipi dichiarati, record tipizzati e type checker | — | [Proposta di sintassi](docs/syntax.md#proposed-type-declarations-and-mvu-records) |
| ⬜ | Pattern matching e confronti booleani nel nucleo | — | [Limiti attuali](docs/structured-data.md#limiti-conosciuti) |
| ⬜ | Namespace, export/private e scoping strutturato delle capability | — | [Questioni aperte](docs/dogfooding.md#limiti-e-questioni-aperte) |
| ⬜ | Operatori definiti dall'utente | — | [Decisioni aperte](docs/decisions.md#open-questions) |
| ⬜ | Metaprogrammazione e macro | — | [Decisioni architetturali](docs/decisions.md) |
| ⬜ | Runtime/libreria MVU generale con lifecycle e diffing | — | [Limiti dell'host UI](docs/browser-interop.md#anteprima-e-limiti) |

## What this repository contains

The compiler is **written entirely in Haxe** and compiled to JavaScript for the CLI. That CLI generates **both JavaScript and PHP** from Mira source. No Haxe-generated PHP is involved, no runtime VM is required, and the parser never asks a type checker to resolve syntax.

```text
Mira source
  └─ Lexer             tokens + source locations
      └─ DefinitionParser     declarations and raw expression spans
          └─ Symbols          collected selector signatures and names
              └─ SelectorResolver / ExpressionParser
                  └─ canonical expression AST
                      ├─ JsEmitter
                      └─ PhpEmitter
```

## Build and test

Requires Haxe **4.3.7**, Node.js **22+**, and PHP **8+** to execute the PHP test programs. No Haxelib packages or npm dependencies.

```sh
npm run build
npm test
npm run benchmark
npm run build:studio
npm run test:studio

node dist/mira.cjs examples/arithmetic.mira js > example.mjs
node dist/mira.cjs examples/arithmetic.mira php > example.php
node dist/mira.cjs examples/arithmetic.mira --tokens
```

`build.hxml` compiles Haxe into `dist/mira.cjs` (CommonJS). The directory `dist/` is not committed. CI compiles the frontend and runs the emitted programs on Node and PHP.

The compiler API uses the typed `Target` enum (`JavaScript` or `Php`). Only the CLI converts `js`/`php` strings to these enum values. CI also measures Haxe build duration and warmed-up Mira→JS/PHP transpilation (small and 100-definition fixtures). See [timing methodology](docs/performance.md) and the workflow run summary and `mira-timings` artifacts.

## A small executable example

```mira
add: a number, and: another number = a number + another number;
square: value = value * value;

two = add: 1, and: 1;
five = add 2 and 3;
seven = add (two) and (five);
result = square: (seven);
```

The labeled form `add: x, and: y` and the parenthesized abbreviation `add (x) and (y)` normalize to the **same selector** `add:and:`. Both emit `add__and(x, y)`, with multiword names mapped deterministically to host identifiers such as `aNumber`.

Explicit `:` remains essential when a bare multiword argument has no unambiguous boundary. Mira rejects ambiguous input rather than guessing from inferred types.

## Mira 0.3: functional sections, sequences and records

Mira now supports **first-class selector sections**: a complete keyword call with one or more `_` arguments creates a function value. `x >> f` applies the value `x` to the unary function `f` and pipelines group left to right.

```mira
add: x, and: y = x + y;
square: value = value * value;
increment = (add: _, and: 1);
result = 2 >> increment >> (square: _) >> (add: _, and: 1);
```

The resulting value is `10`, for both JS and PHP. See [executable example](examples/sections.mira). Sections can close over surrounding parameters in both backends. The compiler generates fresh placeholder parameter names without shadowing user symbols.

**Stato completo:** consulta la [tabella delle funzionalità e versioni](#funzionalità-e-versioni).
Gli operatori binari attuali condividono un unico livello di precedenza, con
associatività a sinistra. Una sezione con più `_` genera una funzione di
arità corrispondente, ma non si può applicare direttamente a una pipeline unaria.

See [syntax and examples](docs/syntax.md), [grammar notes](docs/grammar.md) and [design decisions](docs/decisions.md).

## Provenienza della documentazione

Il rapporto [**IA vs tooling: quantità e percentuali**](docs/documentation-origin.md)
indica quanta documentazione Markdown viene assemblata dagli strumenti,
quanta è dichiarata redatta con assistenza IA e quanta ha un'origine non
verificabile. Il rapporto è rigenerato automaticamente da `npm run docs`
e controllato dalla CI. Le attribuzioni per file sono documentate in
[catalog/documentation-origin.json](catalog/documentation-origin.json).

## Guida ed esempi verificati

Il [catalogo delle feature](catalog/manifest.json) descrive le aree
attualmente implementate, con almeno due esempi per ciascuna sotto
`catalog/examples/`. La CI verifica i risultati dei programmi su JS e PHP;
per gli esempi UI verifica la compilazione di entrambi i target e l'esecuzione
interattiva sull'host JavaScript.

`npm run docs` genera tre riferimenti Markdown interlinkati:
[linguaggio](docs/reference/language.md),
[esempi](docs/reference/examples.md),
[API Haxe](docs/reference/api.md).
Le firme API (inclusi enum e campi pubblici) sono estratte da `src/**/*.hx`,
le spiegazioni da `catalog/api-notes.json`. I Markdown sono aggiornati
automaticamente dalla workflow `reference.yml` quando cambia il linguaggio.

**Mira Studio** integra lo stesso catalogo nella nuova vista **Guida**,
con ricerca, collegamenti bidirezionali e «Prova nell’editor», disponibile
offline con la PWA. Le funzioni con più placeholder vengono invocate dal
worker del browser per rendere osservabili anche gli esempi di funzioni binarie.

## Programmi con dati strutturati

Le nuove forme sperimentali `[...]` e `{campo: valore}` permettono
programmi che analizzano liste e costruiscono record sia su JS sia su PHP.
Il [catalogo](docs/reference/examples.md) contiene quattro casi d'uso
eseguibili: scaletta musicale, allenamento, compensi per serata e lezioni.
Le funzioni di attraversamento sono normali capability dell'host;
i reducer e le trasformazioni sono scritti in Mira.

L'AST Inspector di Studio ora produce anche un report strutturato per
ogni definizione, trasformando l'AST con Mira. Dettagli e limiti:
[esempi strutturati e dogfooding](docs/structured-data.md).

## Mira 0.4: accessor, condizioni e filtri

Le nuove feature eliminano gran parte del codice host nei modelli di
Atlas: `field "hours"` crea un accessor nativo, `lesson >> hours`
lo applica (sintassi 0.6), i confronti producono booleani e
`if: (cond), then: (sì), else: (no)` valuta solo il ramo scelto.
`filter:with:` rimane una piccola primitiva host portabile JS/PHP.
Il filtro dei moduli di Atlas è ora calcolato da Mira.

[Documentazione ed esempi di Mira 0.4](docs/mira04.md).


## Laboratorio GUI: storia, risultati e roadmap

[Laboratory in Mira Studio](https://spyryto.github.io/Mira/laboratory.html) raccoglie l'evoluzione 0.15–0.34, i benchmark CI e le misure dell'autore su iPhone e smart TV. [Rapporto tecnico](docs/gui-rendering.md) · [Archivio JSON](catalog/laboratory/gui-rendering.json). Il rapporto storico è statico e separato dal benchmark eseguibile.

## Mira 0.45: esportazione strutturata dei tipi

Schemi JSON, specializzazione via unificazione e verifica statica
dei contratti RPC. [Dettagli](docs/type-checker.md#045-esportazione-dei-tipi).

## Mira 0.44: firme host

Firme opzionali nel manifest host, convertite nella stessa algebra
dei tipi del checker. [Dettagli](docs/type-checker.md#044-firme-host).

## Mira 0.43: diagnostica delle espressioni

Ancore sorgente per operazioni, diagnostica JSON e selezione del
token in Studio. [Dettagli](docs/type-checker.md#043-diagnostica-delle-espressioni).

## Mira 0.42: vincoli di tipo

Predicato statico ScalarEq, uguaglianza scalare polimorfica e
propagazione dei vincoli nell'unificazione e negli schemi.
[Dettagli](docs/type-checker.md#042-vincoli-di-tipo).

## Mira 0.41: polimorfismo locale e record aperti

Schemi di tipo lessicali, value restriction e sostituzione strutturale
con conservazione della coda del record. [Dettagli](docs/type-checker.md#041-polimorfismo-locale-e-aggiornamenti).

## Mira 0.40: inferenza ricorsiva e righe strutturali

Componenti di funzioni mutuamente ricorsive, unificazione monomorfa
interna e vincoli di assenza dei campi. [Dettagli](docs/type-checker.md#040-gruppi-ricorsivi-e-vincoli-sulle-righe).

## Mira 0.39: inferenza sperimentale dei tipi

Checker Haxe opt-in, CLI `--check`, inferenza strutturale, polimorfismo
top-level e laboratorio interattivo in Studio. [Architettura e limiti](docs/type-checker.md).

## Mira 0.38: contratti di servizio

Dichiarazioni Mira letterali, registri JS/PHP generati dall'AST e
validazione dei parametri dei servizi Mira. [Dettagli e limiti](docs/browser-interop.md#mira-038-contratti-di-servizio).

## Mira 0.37: interoperabilità RPC

Adapter HTTP/JSON riutilizzabili, metodi esplicitamente registrati e
integrazione con il runtime effetti. [Protocollo e limiti](docs/browser-interop.md#mira-037-rpc-json).

## Mira 0.36: primo registro full-stack

Frontend Mira→JS, backend Mira→PHP, SQLite e test Chromium reale in CI.
[Avvio locale, architettura e limiti](docs/studio.md#registro-full-stack-036).
Il database è privato e il pilota non è pubblicato su GitHub Pages.

## Mira 0.35: effetti asincroni

Transizioni Mira con risultato `{model, effects}`, runtime JS a capability
esplicite, laboratorio Studio e prova HTTP locale verso un servizio compilato
in PHP. [Semantica e limiti](docs/browser-interop.md#mira-035-effetti-asincroni-pilota).
Il laboratorio pubblico usa un servizio simulato; non è un deploy PHP.

## Mira 0.34: select/collect e registro persistente

Rimosso collect:if: dalla libreria standard: usare select:if:. Primo [registro lezioni persistente](https://spyryto.github.io/Mira/persistent-ledger.html), compilato da Mira e salvato localmente. [Metodo e limiti](docs/studio.md#registro-lezioni-persistente-034).

## Mira 0.33: identità delle liste GUI

`each: students, identified by: (_ ~ id), view: (student row: _)` costruisce righe con chiavi stabili, senza wrapper DOM. [Semantica e limiti](docs/browser-interop.md#mira-033-identità-delle-liste-gui).

## Mira 0.32: sequenze native

Append, remove, collect, filter e fold senza host; liste dinamiche in anteprima, riconciliazione posizionale. [Semantica e limiti](docs/structured-data.md#sequenze-native-e-immutabili-032).

## Mira 0.31: aggiornamento immutabile dei record

`update: old, with: {student: entered}` copia il record e modifica soltanto i campi indicati. Intrinseco JS/PHP, sezioni e binding GUI supportati. [Semantica e limiti](docs/structured-data.md#aggiornamento-immutabile-dei-record-031).

## Mira 0.30: import statici

Import di file Mira con dipendenze transitive, diagnostica e libreria GUI integrata in Studio. Primo passo verso i moduli, senza namespace o visibilità privata. [Grammatica](docs/grammar.md#mira-030-import-statici).

## Mira 0.29: layout differito del Laboratory

Schede statiche ad altezza variabile con content-visibility e misura intrinseca ricordata, disattivabili senza JavaScript. [Metodo e limiti](docs/studio.md#laboratory-layout-differito-029).

## Mira 0.28: CSS containment

Benchmark separato di contain e content-visibility su una view lunga, con costo di reveal. [Metodo e limiti](docs/browser-interop.md#mira-028-css-containment).

## Mira 0.27: raggruppamento dei commit DOM

Esperimento opt-in nel Performance Lab: immediato, microtask e rAF, con transizioni validate sincronicamente e misure di latenza. [Metodo e limiti](docs/browser-interop.md#mira-027-raggruppamento-dei-commit).

## Mira 0.26: esperimento Text node persistenti

Confronto isolato textContent / Text.data nel Performance Lab; renderer predefinito invariato. [Metodo e limiti](docs/browser-interop.md#mira-026-text-node-persistenti).

## Mira 0.25: anteprima automatica e ispettore

L'anteprima UI sceglie il renderer in modo conservativo e mostra il piano, gli slot, il motivo del fallback e i tempi iniziali. Modalità generica selezionabile. [Metodo e limiti](docs/browser-interop.md#mira-025-anteprima-e-ispettore).

## Mira 0.24: riconoscimento automatico delle regioni

Il Performance Lab passa una normale view unaria; il pass sceglie specializzazione completa, ibrido a regioni radice riconosciute o fallback generico. [Metodo e limiti](docs/browser-interop.md#mira-024-selezione-automatica-del-renderer).

## Mira 0.23: rendering ibrido

Il Performance Lab sperimenta regioni sorelle specializzate e generiche con un unico modello radice e validazione prima del commit. I confini sono espliciti; la selezione del renderer è automatica per ciascuna regione. [Metodo e limiti](docs/browser-interop.md#mira-023-rendering-ibrido).

## Mira 0.22: componenti GUI componibili

Il pass sperimentale espande selettori Mira ordinari prima del montaggio. Il form del Performance Lab usa la vera libreria GUI e componenti riutilizzabili, senza sintassi speciale. [Metodo e limiti](docs/browser-interop.md#mira-022-componenti-componibili).

## Mira 0.21: binding specializzato

Il Performance Lab contiene una scheda lezione specializzata e un benchmark dei form reattivi. Input, checkbox e select mantengono i nodi nativi e condividono la gestione degli eventi con il renderer ordinario. [Metodo e limiti](docs/browser-interop.md#mira-021-binding-specializzato).

## Mira 0.20: record e stili dinamici specializzati

Il laboratorio estende il pass a campi di record, condizioni e valori di stile dinamici, con validazione CSS condivisa e un caso benchmark dedicato.

## Mira 0.19: specializzazione sperimentale GUI

Il Performance Lab confronta anche un pass su AST risolto che compila soltanto gli slot testuali dinamici di una view fissa. Nessuna modifica alla grammatica, renderer generale invariato. [Metodo e limiti](docs/browser-interop.md#mira-019-specializzazione-sperimentale-di-view-fisse).

## Mira 0.18: DOM Performance Lab

Da Studio → Bench → DOM Performance Lab: confronto sul DOM reale
tra renderer Mira incrementale, ricostruzione completa e aggiornamento
diretto; casi sparsi e densi, con e senza layout forzato. Test Chrome in CI.
[Metodo e limiti](docs/browser-interop.md#mira-018-misure-sul-dom-reale).

## Mira 0.17: stili GUI componibili

`styled: view, with: [base, override]` applica stili validati senza
wrapper DOM; `grid: 2, children: items` compone schede a due colonne.
La Guida contiene Dashboard musicale e Tema dinamico. Il test sintetico
del renderer è eseguibile con `npm run benchmark:gui`.
Vedi [interoperabilità browser](docs/browser-interop.md#mira-017-stili-componibili-e-griglia).

## Mira 0.16: GUI incrementali

I nodi DOM compatibili conservano la loro identità durante gli aggiornamenti
dello stato. Le callback vengono aggiornate; gli state annidati conservano
il valore, oppure si resettano con una nuova chiave esplicita.
Il confronto è posizionale, non un algoritmo generale di riordino.
Due esempi in Guida → **DOM incrementale e stato indipendente**:
contatori indipendenti e nuova sessione.

## Mira 0.15: libreria GUI

`lib/gui.mira` è una piccola libreria di normali funzioni Mira. Non
introduce keyword, tipi o regole nel compilatore. Il catalogo concatena
esplicitamente la libreria e il programma, e Studio apre il sorgente
completo e modificabile.

```mira
greeting: name = column: [
  title: "Salutami",
  text input: "Il tuo nome", value: name,
    update: {old, entered | entered},
  button: "Mostra saluto", on click: {| alert name}
];
render (state: "Mira", view: (greeting: _));
```

Prova **Guida → Libreria GUI Mira e binding** in Studio, scegli
**Salutami** o **Scheda lezione** e premi **Anteprima UI**.
Vedi [interoperabilità browser](docs/browser-interop.md#mira-015-libreria-gui-e-binding).

## Mira 0.14: blocchi senza parametri

```mira
action = {| 21 * 2};
result = () >> action;
```

Il blocco è una funzione differita; `() >>` la applica senza argomenti.
Non si introduce un valore Unit. L'AST conserva Block e Apply, con
argomento assente per l'applicazione nullaria. Entrambi i backend
generano closure e chiamate native. Vedi [Guida](docs/grammar.md#blocchi-senza-parametri-014).

## Mira 0.13: posizioni nel sorgente per gli errori di esecuzione

Studio, premendo **Esegui**, prova a collegare gli errori JavaScript
alla definizione Mira che li ha originati. Il messaggio nativo viene
conservato; la posizione aggiuntiva è quella della **definizione**, non
ancora della singola espressione. Browser che non espongono stack
compatibili mostrano comunque l'errore originale.

Il CLI può produrre un documento JSON con `output` (codice identico a
quello normale) e `locations` (intervalli di righe generate, nome,
riga e colonna Mira), per entrambi i backend:

```sh
node dist/mira.cjs examples/arithmetic.mira js --locations
node dist/mira.cjs examples/arithmetic.mira php --locations
```

Non vengono introdotte istruzioni runtime di debug né un nuovo nodo AST.
Vedi [Mira Studio: diagnostica runtime](docs/studio.md#diagnostica-runtime-mira-013).

## Mira 0.12.2: parametri delle funzioni senza collisioni

Anche nelle funzioni nominate, i parametri distinti devono generare
**identificatori JS/PHP distinti**. Per esempio, `a b` e `aB`
non possono essere parametri della stessa funzione, perché diventano
entrambi `aB`. Il controllo include i valori globali (anche dichiarati
dopo la funzione) e il nome riservato `__miraHost`. La diagnostica
punta al parametro responsabile. Un parametro `x` può invece
ombreggiare intenzionalmente un valore globale `x`.

## Mira 0.12.1: diagnostica dello scoping lessicale

Quando una definizione locale usa un nome che verrà introdotto
soltanto dopo, Mira identifica **il nome e la posizione esatta**
del riferimento:

```mira
result = 4 >> {value |
  subtotal = amount + value;
  amount = value * 2;
  subtotal
};
```

Il compilatore segnala che `amount` è usato prima della dichiarazione,
invece di mostrare un generico identificatore sconosciuto.

Un altro controllo impedisce che un parametro interno come `aB`
collida in JS/PHP con un nome esterno diverso come `a b`.
Resta invece valido lo **shadowing lessicale intenzionale** tra
parametri con *lo stesso identico nome*. I valori locali `nome = ...`
continuano a non poter ombreggiare nomi già visibili.
Nessuna modifica alle funzioni generate o alle regole di mutabilità.

## Mira 0.12: valori locali immutabili nei blocchi

```mira
result = 4 >> {value |
  doubled = value * 2;
  doubled >> {inner | inner + doubled}
};
```

Il risultato è **16**. `doubled` viene definito una volta,
esiste soltanto dentro il blocco ed è catturato dalla closure
interna. Sono ammessi nomi composti e più definizioni consecutive.

Un nome è visibile solo dopo il proprio inizializzatore. Non sono
permesse riassegnazioni, duplicati o ridefinizioni di nomi
già visibili: gli ambiti rimangono espliciti e coerenti tra JS e PHP.
L'ultima istruzione del blocco deve essere un'espressione di valore.
Il compilatore emette `const` su JS e verifica staticamente
l'assenza di riassegnazioni su PHP, dove la variabile è ordinaria.
Non c'è mutabilità né `return` esplicito.

## Mira 0.11: più espressioni nello stesso blocco

```mira
result = 4 >> {value |
  value + 1;
  value * 3
};
```

Il risultato è **12**: tutte le espressioni vengono valutate
in ordine, e l'ultima è il valore restituito. Il separatore
è `;`, facoltativo anche dopo l'ultima espressione.

La sintassi dei blocchi a un'espressione rimane invariata.
Un nuovo nodo AST `Steps` rappresenta **soltanto** le sequenze
con più espressioni. JavaScript e PHP generano funzioni native,
senza introdurre una VM o una sintassi speciale per il ritorno.

Da Mira 0.12 sono ammesse definizioni locali immutabili.
Non sono introdotte riassegnazioni o variabili mutabili.

## Mira 0.10: campi e blocchi con meno parentesi

La catena `a ~ b ~ c` è associativa a sinistra e l'accesso `~`
precede gli operatori aritmetici. Quindi
`lesson ~ hours * lesson ~ rate` equivale a
`(lesson ~ hours) * (lesson ~ rate)`.

```mira
lessons = [
  {hours: 2, rate: 30},
  {hours: 1.5, rate: 40}
];

result = fold: lessons,
  with: {total, lesson |
    total + (lesson ~ hours * lesson ~ rate)
  },
  from: 0;
```

Risultato: **120** in JS e PHP. Il blocco `with: {…}`
è già delimitato dalle graffe; `with: ({…})` rimane valido.
`+`, `-`, `*`, `/` e `%` mantengono tra loro il
raggruppamento sinistra-destra di Mira.

## Mira 0.9: blocchi con più parametri

```mira
numbers = [1, 2, 3, 4];
result = fold: numbers,
  with: ({total, item | total + item}),
  from: 0;
```

Il risultato è `10`. Il blocco accetta ora una lista di parametri
espliciti separati da virgole, mantenendo nomi composti, cattura lessicale
e compatibilità con la sintassi unaria della 0.8. Non è currying:
`>>` accetta solo funzioni unarie; `fold:with:from:` invoca il blocco
con due argomenti. Nessun nuovo runtime né type checker.

## Mira 0.8: blocchi per funzioni ed espressioni complesse

```mira
lesson = {hours: 2, rate: 30};
fee = {_ | (_ ~ hours) * (_ ~ rate)};
result = lesson >> fee;
```

Il blocco `{parametro | espressione}` costruisce una funzione unaria che
cattura lessicalmente i valori circostanti. Il separatore `|` distingue
i blocchi dai record `{campo: valore}`. Il parametro può essere un nome
composto oppure `_`; dentro un blocco con `_`, ogni occorrenza designa
lo stesso parametro, anziché un nuovo placeholder.

I blocchi funzionano nelle pipeline `>>` e come callback:

```mira
result = select: lessons, if: ({_ | (_ ~ hours) >= 1});
```

Questa prima versione supporta un parametro e una sola espressione.
Nessun type checker o runtime aggiuntivo: genera closure native JS/PHP.

## Mira 0.7: condizionali discorsivi

```mira
result = if (1 < 2) then "valid" else "invalid";
```

La sintassi `if (test) then valore else valore` è equivalente alla
precedente `if: (test), then: (valore), else: (valore)`.
Dalla 0.7.1 anche `if (test), then: (valore), else: (valore)`
è valida: virgole e due punti dopo le keyword sono facoltativi.
Tutte
generano lo stesso nodo `Conditional`, quindi i rami restano lazy
su JavaScript e PHP. La condizione richiede parentesi; i condizionali
annidati si delimitano con parentesi. Non servono macro, runtime
aggiuntivi o un type checker.


## Mira 0.6: campi e applicazione hanno sintassi distinte

```mira
lesson = {hours: 2, rate: 30};
fee: item = (item ~ hours) * (item ~ rate);
result = lesson >> (fee: _);
```

`~` legge un campo letterale, senza risolvere il nome come variabile;
`>>` applica un valore a una funzione. `(_ ~ hours)` è già un accessor
anonimo unario; per espressioni più complesse si usano i blocchi
espliciti di Mira 0.8. `field "hours"` resta disponibile
come accessor di prima classe. Il controllo di esistenza del campo è
mantenuto su JS e PHP (nessun type checker richiesto).
Questa è una modifica incompatibile con la sintassi 0.5.

Dalla **0.6.1**, il nome di un campo può contenere più parole anche
senza virgolette:

```mira
lesson = {"total hours": 3};
result = lesson ~ total hours;
```

`lesson ~ "total hours"` rimane equivalente. Non è richiesto un
type checker; i test JS/PHP controllano anche i campi mancanti.

## Benchmark interattivi

La scheda **[Bench della PWA](https://spyryto.github.io/Mira/#/benchmark)**
misura sul dispositivo la compilazione Mira→JS/PHP in millisecondi e
**righe Mira compilate al secondo**, oltre all'esecuzione del JavaScript
generato (tempo per chiamata e chiamate al secondo).
Il pulsante **Schermo intero** espande la vista anche sui dispositivi
che non supportano la Fullscreen API.

La CI misura anche l'esecuzione PHP con `hrtime`, in un processo PHP
già avviato e con codice caricato. I risultati restano separati da quelli
locali perché CPU, engine e condizioni differiscono.
[Metodo di misura e limiti](docs/performance.md).

## Mira Atlas — documentazione viva

La [vista **Atlas** di Mira Studio](https://spyryto.github.io/Mira/#/atlas)
mostra le fasi reali del compilatore sul programma aperto nell'editor:
token, dichiarazioni, simboli, AST canonico e codice JS/PHP. Un grafo SVG
navigabile rappresenta le dipendenze estratte dagli **import espliciti**
dei sorgenti Haxe/JS, con collegamenti ai moduli.

Le schede e i riepiloghi sono elaborati dal programma
[`studio/atlas/atlas.mira`](studio/atlas/atlas.mira), compilato
**durante la build** in JavaScript. L'host JavaScript si occupa di rete,
DOM, SVG e layout. Non esiste ancora un type checker o un tokenizer
separato dal lexer. [Architettura, limiti e benchmark](docs/atlas.md).

## Interoperabilità browser: alert, view e pulsante

Tre nuovi esempi interattivi mostrano che le funzioni host possono collegare
Mira al DOM senza introdurre keyword speciali. `alert` mostra un dialogo,
`render` costruisce una view dichiarativa da record e il **contatore** usa
funzioni Mira per costruire la UI e calcolare lo stato successivo.
L'anteprima usa un iframe senza accesso same-origin a Studio.

Sorgenti: `catalog/examples/browser-*.mira`, accessibili nella
**Guida → UI web e interoperabilità** di Mira Studio.
[Documentazione tecnica e limiti](docs/browser-interop.md).

## Mira Studio — PWA

The experimental **[Mira Studio](docs/studio.md)** is a mobile-first, installable
browser editor built on the same Haxe compiler core as the CLI. It offers:

- Mira source editor, local saving and example programs;
- actual JS/PHP transpilation and exported source files;
- real AST and source token inspection;
- explicit execution of generated **JavaScript only**, in a Web Worker;
- offline caching, version updates and GitHub Pages deployment via CI.

Build it with `npm run build:studio` and serve `dist/studio/` from a local
HTTP server. The expected Pages URL **after enabling GitHub Pages in repository
Settings → Pages → Source → GitHub Actions** is
https://spyryto.github.io/Mira/. See [Studio instructions](docs/studio.md) for
installation, limitations and local preview.

## Related repositories

- [NailLang](https://github.com/Spyryto/NailLang) — existing positional-language compiler and toolchain
- [NailSeed](https://github.com/Spyryto/NailSeed) — historical prototypes
- [Nail Lab](https://github.com/Spyryto/Nail-Lab) — teaching and historical experiments
- [PHX-VM](https://github.com/Spyryto/PHX-VM) — separate PHP-focused VM

Mira may eventually become a frontend for Nail, a reboot, or an independent language. That choice is intentionally open.

Per la direzione applicativa, le scelte adottate e quelle rinviate: [decisioni fino alla 0.34](docs/decisions.md#stato-e-direzione-034).
