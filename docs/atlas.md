# Mira Atlas — documentazione viva e dogfooding

Apri **[Mira Atlas nella PWA](https://spyryto.github.io/Mira/#/atlas)**.

Questo esperimento mette il codice del compilatore in relazione con ciò che
produce, senza chiedere di studiare manualmente tutti i sorgenti. Le viste
sono mobile-first, consultabili offline e integrate in Mira Studio.

## Come funziona

La prima vista, **Viaggio del codice**, legge il sorgente corrente dell'editor
e presenta queste fasi, tutte basate su chiamate reali al compilatore Haxe:

| Fase | Dato effettivamente mostrato | Origine |
| --- | --- | --- |
| Sorgente | Testo corrente dell'editor | Studio |
| Lexer/tokenizzazione | Token, kind, value, line, column | `Compiler.inspectTokens` |
| Parser delle definizioni | Intestazioni e `bodyTokens` non risolti | `Bridge.trace` → `DefinitionParser` |
| Tabella dei simboli | Nomi e firme dichiarate o fornite dall'host | `Bridge.trace` → `Symbols` |
| AST risolto | Definizioni e nodi espressione canonici | `Bridge.ast` → `Compiler.parse` |
| JS | Programma traspilato | `Bridge.compile(..., "js")` |
| PHP | Programma traspilato | `Bridge.compile(..., "php")` |

**Precisione:** nella versione 0.4 c'è un unico `Lexer` che esegue la
tokenizzazione, non un tokenizer autonomo. La tabella dei simboli nasce
dall'analisi delle dichiarazioni; la risoluzione delle espressioni avviene
nel parser delle espressioni con `Symbols` e `SelectorResolver`.
La vista non presenta artificialmente un AST «pre-risoluzione» che il
compilatore attuale non espone.

La seconda vista, **Mappa architetturale**, mostra un grafo SVG dei moduli
di sorgente e dei loro import effettivi. I dati vengono generati da
`scripts/generate-atlas.mjs` a ogni build. Le frecce significano
«questo modulo importa / usa esplicitamente quell'altro». Non pretende
di riconoscere dipendenze dinamiche, invocazioni indirette o processi CI.

## Dove entra Mira

Il programma sorgente
[`studio/atlas/atlas.mira`](../studio/atlas/atlas.mira) produce:

- le schede delle fasi del compilatore;
- le schede dei moduli e i relativi conteggi delle dipendenze;
- le schede delle definizioni prima del parser di espressioni;
- le schede delle definizioni nell'AST canonico;
- il riepilogo dei dati per l'interfaccia.

È **Mira vero**, traspilato in JavaScript durante la CI, non una
trascrizione manuale delle stesse trasformazioni in JavaScript.
Con Mira 0.6 i campi si leggono direttamente con `~`, senza dichiarare accessor; il filtraggio per gruppo resta in Mira.
Le sole primitive host rimaste nel modulo Atlas sono `map:with:`,
`filter:with:` e `count:`.
Il risultato è `dist/studio/atlas-program.js`.

L'host [`studio/atlas-ui.js`](../studio/atlas-ui.js) possiede solo
responsabilità del browser: caricamento del JSON, navigazione, rendering
DOM/SVG, gestione dei clic e invocazione delle API del compilatore.
I filtri e i predicati del gruppo sono ora in Mira; il layout SVG,
la navigazione e l'interazione rimangono responsabilità del browser.

## JSON, offline e prestazioni

`dist/studio/atlas-data.json` viene prodotto in fase di build con il
conteggio dei moduli e gli archi ricavati dagli import del repository.
La PWA memorizza sia il JSON sia `atlas-program.js` tramite service worker.

Il compilatore Haxe non viene invocato per costruire Atlas durante
la normale navigazione: il programma Mira è precompilato.
Il compilatore browser è invocato invece quando si esplora il
**sorgente corrente** lungo il viaggio del codice.

Un benchmark runtime viene eseguito nella CI Studio:

```sh
node scripts/benchmark-atlas.mjs
```

Confronta lo stesso modello di trasformazione su **1.000 record**
utilizzando Mira→JS e una funzione JavaScript equivalente, con 20 warmup
e 100 iterazioni. Il confronto misura **solo la trasformazione dei dati**:
esclude DOM, SVG, parsing del codice, download e render; non impone
soglie di performance arbitrarie. I risultati reali sono disponibili
nei sommari della workflow `Mira Studio PWA` e nell'artefatto
`mira-atlas-benchmark`.

Nella prima [CI di Atlas](https://github.com/Spyryto/Mira/actions/runs/45071690495)
(22 novembre 2026), il modello Mira compilato verso JS ha impiegato
**0,136 ms** di mediana per 1.000 record, contro **0,012 ms**
dell'implementazione manuale equivalente (**circa 11 volte più lento**).
È comunque sotto il millisecondo per il carico provato.
La differenza deriva in larga parte dai molti accessi dinamici
`get:from:` e dalle chiamate host; non è una misura del linguaggio
in generale né una prova della velocità di rendering.
Gli accessor nativi di Mira 0.4 riducono il numero delle chiamate
all'host; il benchmark continuo verifica se questo porta benefici reali.

## Quali feature Mira mancano dopo questo esperimento?

| Priorità | Feature desiderata | Ostacolo emerso |
| --- | --- | --- |
| ✅ 0.4 | Accessor funzionali nativi | `field "campo"` resta un accessor di prima classe |
| ✅ 0.6 | Accesso diretto e pipeline distinta | `record ~ campo` legge il campo, `value >> funzione` applica una funzione |
| ✅ 0.4 | Confronti e condizioni | Il filtro per gruppo di Atlas usa ora predicati e condizioni in Mira |
| Alta | `sort` e `groupBy` portabili | `filter:with:` è ancora una capability host, gli altri operatori mancano |
| Media | Funzioni anonime e applicazione generale | Le sezioni funzionano, ma obbligano a dichiarazioni nominate per molti trasformatori |
| Media | Tipi somma e pattern matching | L'elaborazione di nodi AST differenziati resta verbosa |
| Media | Stringhe, interpolazione e template text | Formattazione etichette e riassunti rimane nell'host |
| Media | Moduli/import di Mira | Il programma Atlas può crescere senza un'organizzazione interna scalabile |
| Più avanti | Tipi strutturali/nominali e checker | Serviranno per contratti forti delle API, non per questo prototipo |

Questa lista distingue i **limiti sperimentati durante lo sviluppo di
Atlas** dalla necessità generale di una feature per Mira. Non abbiamo
ancora bisogno di riscrivere il lexer o il parser in Mira.

## Riproduzione e test

```sh
npm run build:studio
node --test test/atlas.test.mjs
node scripts/benchmark-atlas.mjs
```

I test confrontano la fonte Haxe di token, dichiarazioni e simboli,
verificano che tutti gli archi del grafo facciano riferimento a moduli
presenti, e controllano che i modelli di Atlas siano prodotti da
funzioni **compilate da Mira**. L'elenco dei moduli e le descrizioni
delle fasi restano separati: import estratti automaticamente versus
spiegazioni editoriali.

Per l'origine della documentazione vedi
[`docs/documentation-origin.md`](documentation-origin.md).
