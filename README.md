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
| ✅ | Pipeline `~` | `0.2` | [Dettagli](docs/reference/language.md#feature-pipelines) |
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
<!-- END GENERATED FEATURE MATRIX -->

Le funzioni **host** non sono primitive incorporate nel linguaggio:
la loro disponibilità dipende da un manifest e dall'ambiente di esecuzione.
Le view interattive sono attualmente eseguite nel browser JavaScript; il
backend PHP ne traspila il sorgente ma non fornisce un renderer DOM.

### Funzionalità non ancora implementate

Nessuna versione è assegnata finché non esiste un'implementazione verificata.

| Stato | Funzionalità | Prima versione | Documentazione |
| :---: | --- | :---: | --- |
| ⬜ | Funzioni anonime generali e sezioni di operatori come `(_ + 1)` | — | [Decisioni aperte](docs/decisions.md#open-questions) |
| ⬜ | Currying completo e applicazione parziale generalizzata | — | [Decisioni aperte](docs/decisions.md#open-questions) |
| ⬜ | Tipi dichiarati, record tipizzati e type checker | — | [Proposta di sintassi](docs/syntax.md#proposed-type-declarations-and-mvu-records) |
| ⬜ | Pattern matching e confronti booleani nel nucleo | — | [Limiti attuali](docs/structured-data.md#limiti-conosciuti) |
| ⬜ | Moduli/import e scoping strutturato delle capability | — | [Questioni aperte](docs/dogfooding.md#limiti-e-questioni-aperte) |
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

Mira now supports **first-class selector sections**: a complete keyword call with one or more `_` arguments creates a function value. `x ~ f` applies the value `x` to the unary function `f` and pipelines group left to right.

```mira
add: x, and: y = x + y;
square: value = value * value;
increment = (add: _, and: 1);
result = 2 ~ increment ~ (square: _) ~ (add: _, and: 1);
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
Atlas: `field "hours"` crea un accessor nativo, `lesson ~ hours`
legge il campo, i confronti producono booleani e
`if: (cond), then: (sì), else: (no)` valuta solo il ramo scelto.
`filter:with:` rimane una piccola primitiva host portabile JS/PHP.
Il filtro dei moduli di Atlas è ora calcolato da Mira.

[Documentazione ed esempi di Mira 0.4](docs/mira04.md).

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
