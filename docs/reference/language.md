# Guida a Mira 0.85.0

Generata automaticamente da catalog/manifest.json e dai programmi di catalog/examples/.
Le firme API sono estratte dal sorgente Haxe, non ricopiate manualmente.

Apri [Mira Studio](https://spyryto.github.io/Mira/#/guide) per consultare gli esempi e provarli.

<a id="feature-values"></a>
## Definizioni di valori

**Disponibile dalla versione 0.1**

Valori intermedi nominati, separati da `;`.

Il corpo della definizione viene valutato sul backend di destinazione.

API collegata: [`mira.syntax.DefinitionParser.parse`](api.md#api-mira-syntax-definitionparser-parse)

- [Fattura e trasferta](examples.md#example-invoice-total) — result = 98
- [Margine di un concerto](examples.md#example-concert-margin) — result = 396

<a id="feature-names"></a>
## Identificatori composti

**Disponibile dalla versione 0.1**

Nomi formati da più parole.

La risoluzione è basata sui nomi e sui confini sintattici, non sull'inferenza di tipo.

API collegata: [`mira.resolve.Symbols.resolveName`](api.md#api-mira-resolve-symbols-resolvename)

- [Voci di stipendio](examples.md#example-salary-adjustment) — result = 1950
- [Consumi di viaggio](examples.md#example-fuel-efficiency) — result = 15

<a id="feature-functions"></a>
## Funzioni con parametri

**Disponibile dalla versione 0.1**

Definizioni di funzioni con argomenti leggibili.

La sintassi `label: parametro` dichiara una funzione; i suoi parametri possono avere più parole.

API collegata: [`mira.syntax.DefinitionParser.parse`](api.md#api-mira-syntax-definitionparser-parse)

- [Sconto su fattura](examples.md#example-cash-discount) — result = 165
- [Stima scalata](examples.md#example-scale-estimate) — result = 72

<a id="feature-selectors"></a>
## Selettori con più keyword

**Disponibile dalla versione 0.1**

Firme articolate con etichette significative.

Ogni keyword contribuisce all'identità del selettore, e può contenere più parole.

API collegata: [`mira.resolve.SelectorResolver.match`](api.md#api-mira-resolve-selectorresolver-match)

- [Punteggio in tre passaggi](examples.md#example-three-step-score) — result = 42
- [Imposte e sconto](examples.md#example-tax-and-discount) — result = 107

<a id="feature-shorthand"></a>
## Chiamate discorsive

**Disponibile dalla versione 0.1**

Abbreviazioni senza `:` quando non ambigue.

Letterali e parentesi rendono deterministici i confini degli argomenti.

API collegata: [`mira.resolve.SelectorResolver.match`](api.md#api-mira-resolve-selectorresolver-match)

- [Argomenti calcolati](examples.md#example-calculated-arguments) — result = 48
- [Etichetta discorsiva composta](examples.md#example-shipping-charge) — result = 55

<a id="feature-numbers"></a>
## Letterali numerici

**Disponibile dalla versione 0.1**

Interi e decimali.

Il lexer legge numeri positivi; `-` è un operatore binario in Mira 0.2.

API collegata: [`mira.lex.Lexer.tokenize`](api.md#api-mira-lex-lexer-tokenize)

- [Importi decimali](examples.md#example-fractional-invoice) — result = 52.75
- [Minuti e coefficiente](examples.md#example-minutes-rate) — result = 3.375

<a id="feature-strings"></a>
## Letterali testuali

**Disponibile dalla versione 0.1**

Testo delimitato da doppi apici.

Le stringhe sono dati utilizzabili nei selettori. Non esiste ancora una libreria di manipolazione del testo.

API collegata: [`mira.lex.Lexer.tokenize`](api.md#api-mira-lex-lexer-tokenize)

- [Titolo di una band](examples.md#example-band-title) — result = "I Liberamente"
- [Testo di benvenuto](examples.md#example-welcome-label) — result = "Benvenuto in Mira Studio"

<a id="feature-arithmetic"></a>
## Operatori aritmetici

**Disponibile dalla versione 0.1**

`+`, `-`, `*`, `/` e `%`.

Gli operatori aritmetici `+`, `-`, `*`, `/`, `%` mantengono la stessa precedenza tra loro e l'associatività a sinistra (come da 0.1). Dalla 0.10, `~` è più forte di tutti gli operatori aritmetici: `lesson ~ hours * lesson ~ rate` si legge `(lesson ~ hours) * (lesson ~ rate)`.

API collegata: [`mira.syntax.ExpressionParser.parse`](api.md#api-mira-syntax-expressionparser-parse)

- [Valutazione da sinistra](examples.md#example-left-to-right) — result = 20
- [Resto di una ripartizione](examples.md#example-modulo-remainder) — result = 2

<a id="feature-grouping"></a>
## Parentesi

**Disponibile dalla versione 0.1**

Esplicitare il raggruppamento.

Permettono anche di delimitare espressioni negli argomenti discorsivi.

API collegata: [`mira.syntax.ExpressionParser.parse`](api.md#api-mira-syntax-expressionparser-parse)

- [Costi per gruppo](examples.md#example-stage-production) — result = 24
- [Ripartizione e supplemento](examples.md#example-split-payment) — result = 28

<a id="feature-sections"></a>
## Sezioni unarie

**Disponibile dalla versione 0.2**

Un `_` in un selettore crea una funzione.

`_` deve essere un argomento intero della chiamata, non una sottoespressione generica.

API collegata: [`mira.syntax.Expr`](api.md#api-mira-syntax-expr)

- [Sconto riutilizzabile](examples.md#example-reduce-price) — result = 75
- [Moltiplicatore nominato](examples.md#example-triple-quantity) — result = 42

<a id="feature-multi-sections"></a>
## Sezioni con più `_`

**Disponibile dalla versione 0.2**

Più segnaposto producono più parametri.

Il compilatore emette funzioni di arità corrispondente. In Mira 0.2 le applicazioni binarie generiche non hanno ancora sintassi nel sorgente.

API collegata: [`mira.emit.SourceEmitter.expression`](api.md#api-mira-emit-sourceemitter-expression)

- [Funzione binaria](examples.md#example-mix-two-inputs) — mixer(7, 9) = 23
- [Due argomenti liberi](examples.md#example-fee-calculator) — adjustment(125, 20) = 31

<a id="feature-pipelines"></a>
## Pipeline `>>`

**Disponibile dalla versione 0.2**

Applicazione funzionale esplicita da sinistra a destra.

`x >> f` applica `f` a `x` e si associa a sinistra; `>>` sostituisce il precedente `~` (0.2–0.5). Le sezioni a due placeholder non sono applicabili direttamente. Dalla 0.14, `() >> f` applica f senza argomenti.

API collegata: [`mira.syntax.Expr`](api.md#api-mira-syntax-expr)

- [Catena di livelli](examples.md#example-recording-level) — result = 22
- [Budget progressivo](examples.md#example-revised-budget) — result = 90

<a id="feature-captures"></a>
## Cattura lessicale

**Disponibile dalla versione 0.2**

Funzioni che restituiscono sezioni parametrizzate.

Le arrow function JS/PHP conservano i parametri della funzione esterna.

API collegata: [`mira.emit.SourceEmitter.expression`](api.md#api-mira-emit-sourceemitter-expression)

- [Sezione che cattura un parametro](examples.md#example-extra-budget) — result = 20
- [Fabbrica di moltiplicatori](examples.md#example-rate-factory) — result = 42

<a id="feature-forward"></a>
## Dichiarazioni successive

**Disponibile dalla versione 0.1**

I selettori possono essere dichiarati dopo l'uso.

Il compilatore raccoglie tutte le firme prima di analizzare i corpi.

API collegata: [`mira.Compiler.parse`](api.md#api-mira-compiler-parse)

- [Dichiarazione successiva](examples.md#example-declare-later) — result = 25
- [Commenti e firma futura](examples.md#example-commented-forward) — result = 38

<a id="feature-diagnostics"></a>
## Diagnostica e ambiguità

**Disponibile dalla versione 0.1**

Esempi di errori intenzionali.

Sono esercizi negativi: fallire con una diagnostica precisa è il comportamento corretto. Dalla 0.12.1 i valori locali usati prima della dichiarazione mostrano il nome e la posizione del riferimento; i parametri di blocchi annidati che colliderebbero dopo mangling con un nome esterno diverso vengono rifiutati. Lo shadowing con lo stesso identico nome resta consentito. Dalla 0.12.2 la verifica copre anche i parametri delle funzioni nominate, con posizione del parametro e controllo indipendente dall'ordine di dichiarazione dei globali. Dalla 0.13 il compilatore può restituire una mappa delle righe generate verso le definizioni Mira. Studio la usa per identificare la definizione coinvolta in un errore runtime JS quando lo stack del browser lo consente; il CLI espone la mappa opzionale anche per PHP.

API collegata: [`mira.MiraError`](api.md#api-mira-miraerror)

- [Argomenti senza confini](examples.md#example-ambiguous-words) — Errore atteso: Unknown identifier
- [Parametro ripetuto](examples.md#example-duplicate-parameter) — Errore atteso: Duplicate parameter
- [Locale usato prima della dichiarazione](examples.md#example-local-before-declaration) — Errore atteso: used before its declaration
- [Collisione del parametro dopo mangling](examples.md#example-block-parameter-mangle) — Errore atteso: Generated-name collision for block parameter
- [Shadowing lessicale con lo stesso nome](examples.md#example-legal-nested-shadow) — result = 10
- [Collisione tra parametri nominati](examples.md#example-function-parameter-mangle) — Errore atteso: Generated-name collision for function parameter
- [Shadowing valido in una funzione nominata](examples.md#example-function-parameter-shadow) — result = 6

<a id="feature-sequences"></a>
## Sequenze e trasformazioni

**Disponibile dalla versione 0.3**

Liste letterali e trasformazioni funzionali con un host minimo.

Le sequenze `[a, b]` sono valori di Mira. `map:with:` e `fold:with:from:` sono funzioni esplicite dell'host, non keyword del linguaggio; i reducer rimangono funzioni Mira. `collect:with:` è l'alias di `map:with:` in stile Smalltalk.

API collegata: [`mira.syntax.Expr.Sequence`](api.md#api-mira-syntax-expr-sequence)

- [Registro delle sessioni di studio](examples.md#example-practice-log) — result = {"minutes":70,"seconds":[900,1200,600,1500]}
- [Scaletta musicale e minutaggio](examples.md#example-setlist-plan) — result = {"minutes":13.5,"items":[{"title":"Opening","seconds":270},{"title":"Midnight","seconds":225},{"title":"Encore","seconds":315}]}
- [Collect with: trasformare valori](examples.md#example-collect-with-numbers) — result = [2,4,6]

<a id="feature-records"></a>
## Record e dati strutturati

**Disponibile dalla versione 0.3**

Costruzione di record anonimi portabili tra JavaScript e PHP.

I record `{campo: espressione}` diventano oggetti JavaScript e array associativi PHP. Le chiavi possono essere parole composte senza virgolette, come `{total hours: 3}`, o stringhe esplicite. Il selettore host `get:from:` legge una chiave; chiavi duplicate (anche fra forme con e senza virgolette) e delimitatori errati vengono rifiutati.

API collegata: [`mira.syntax.Expr.Record`](api.md#api-mira-syntax-expr-record)

- [Bilancio di tre concerti](examples.md#example-gig-ledger) — result = {"netTotal":679,"shows":[{"venue":"Padova","net":223},{"venue":"Treviso","net":282},{"venue":"Venezia","net":174}]}
- [Registro delle lezioni di chitarra](examples.md#example-teaching-ledger) — result = {"income":130,"invoices":[{"student":"Anna","amount":45},{"student":"Luca","amount":50},{"student":"Mia","amount":35}]}

<a id="feature-browser-ui"></a>
## UI web e interoperabilità

**Disponibile dalla versione 0.3**

Visualizzazione dichiarativa, alert e gestione degli eventi con funzioni Mira collegate a un host browser.

`alert` e `render` sono callable registrati nell'ambiente JS. `render` accetta record con tipi di view consentiti: title, text, column, button e state. Nel componente state il browser conserva il valore, mentre la funzione Mira `view` produce la UI e le funzioni Mira `update` calcolano lo stato successivo. L'anteprima è confinata in un iframe sandbox senza accesso all'origine dello Studio. Il PHP generato è compilabile, ma l'esecuzione di queste capability richiede un ambiente DOM e viene verificata soltanto nel browser.

API collegata: [`mira.HostEnvironment`](api.md#api-mira-hostenvironment)

- [Alert dall’host](examples.md#example-browser-alert) — Anteprima interattiva (browser JS; PHP compilato soltanto)
- [View e pulsante](examples.md#example-browser-view) — Anteprima interattiva (browser JS; PHP compilato soltanto)
- [Pulsante con contatore](examples.md#example-browser-counter) — Anteprima interattiva (browser JS; PHP compilato soltanto)

<a id="feature-accessors"></a>
## Accessor funzionali di record

**Disponibile dalla versione 0.4**

`field "name"` costruisce una funzione accessor, applicabile con `lesson >> hours`.

Resta un valore funzione di prima classe (0.4): un campo mancante produce un errore runtime. In Mira 0.6 gli accessi diretti senza dichiarazioni si scrivono `lesson ~ hours`.

API collegata: [`mira.syntax.Expr.FieldAccessor`](api.md#api-mira-syntax-expr-fieldaccessor)

- [Fattura di una lezione](examples.md#example-lesson-accessors) — result = 45
- [Record dello studente](examples.md#example-student-accessors) — result = {"student":"Ada","hours":1.5}

<a id="feature-comparisons"></a>
## Booleani e confronti

**Disponibile dalla versione 0.4**

`true`, `false`, `==`, `!=`, `<`, `>`, `<=` e `>=`.

Gli operatori sono espressioni native. L'uguaglianza usa operatori stretti JS/PHP, testati per scalari; per strutture e numeri con rappresentazioni diverse la semantica dei backend può divergere senza un sistema di tipi. Gli operatori condividono un livello di precedenza e si associano a sinistra.

API collegata: [`mira.syntax.Expr.BooleanLiteral`](api.md#api-mira-syntax-expr-booleanliteral)

- [Confronti e booleani](examples.md#example-threshold-comparisons) — result = true
- [Confronti su testo e numeri](examples.md#example-equality-comparisons) — result = true

<a id="feature-conditionals"></a>
## Espressioni condizionali

**Disponibile dalla versione 0.4**

`if: (cond), then: (a), else: (b)` e `if (cond) then a else b` valutano un solo ramo.

Tutte le forme di `if (condizione) then valore else valore` condividono lo stesso nodo `Conditional` e la valutazione lazy con `if: (condizione), then: (vero), else: (falso)`. Le virgole fra i tre segmenti e i due punti dopo `if`, `then`, `else` sono opzionali e indipendenti: `if (cond), then: (vero), else: (falso)` è valido. La condizione richiede parentesi; per annidare condizionali nel ramo then usare parentesi. Nessuna capacità host aggiuntiva.

API collegata: [`mira.syntax.Expr.Conditional`](api.md#api-mira-syntax-expr-conditional)

- [Scelta di un'etichetta](examples.md#example-conditional-label) — result = "valid"
- [Soglia per uno sconto](examples.md#example-conditional-fee) — result = {"bonus":0}
- [Selezione discorsiva senza due punti](examples.md#example-conditional-natural-label) — result = "valid"
- [Ramo non selezionato mai eseguito](examples.md#example-conditional-natural-lazy) — result = 42
- [Virgole e due punti opzionali](examples.md#example-conditional-optional-commas) — result = "valid"

<a id="feature-filtering"></a>
## Filtri con predicati Mira

**Disponibile dalla versione 0.4**

`filter: list, with: (predicate: _)` filtrando con funzioni Mira.

Il predicato Mira seleziona gli elementi. filter:with:, select:with: e select:if: filtrano; collect:with: trasforma, secondo la semantica Smalltalk. Ordine preservato e lista reindicizzata su JS/PHP.

API collegata: [`mira.HostEnvironment`](api.md#api-mira-hostenvironment)

- [Numeri sopra soglia](examples.md#example-filter-numbers) — result = [5,9]
- [Lezioni da fatturare](examples.md#example-filter-lessons) — result = ["Ada","Lia"]
- [Select if: selezionare lezioni](examples.md#example-collect-if-lessons) — result = [{"student":"Ada","hours":1.5},{"student":"Lia","hours":2}]

<a id="feature-operator-sections"></a>
## Sezioni di operatori

**Disponibile dalla versione 0.5**

`(_ > 5)` e `(10 - _)` sono funzioni, senza nuova sintassi lambda.

Un operatore aritmetico o di confronto con uno o due placeholder diretti, delimitato da parentesi, produce una funzione di prima classe. La pipeline `>>` accetta solo sezioni unarie. Gli emettitori JS/PHP generano closure native senza inferenza dei tipi.

API collegata: [`mira.syntax.ExpressionParser.parse`](api.md#api-mira-syntax-expressionparser-parse)

- [Soglia come funzione](examples.md#example-operator-threshold) — result = true
- [Predicato passato a un selettore](examples.md#example-operator-as-argument) — result = true

<a id="feature-field-get"></a>
## Accesso diretto ai campi `~`

**Disponibile dalla versione 0.6**

`record ~ field` legge un campo senza dichiarare accessor.

Il nome dopo `~` è un campo letterale: una o più parole consecutive, oppure una stringa tra virgolette. Un operatore o delimitatore termina il nome, che non viene cercato tra le variabili. Gli accessi si concatenano e i campi mancanti producono lo stesso errore su JS/PHP. `(_ ~ total hours)` è una sezione unaria; le espressioni complesse possono ora usare `{ _ | (_ ~ hours) >= 1 }` (0.8); le sezioni implicite più complesse non sono ancora implementate. Dalla 0.10 l'accesso `~` è associativo a sinistra e ha precedenza sulle operazioni aritmetiche, così `lesson ~ hours * lesson ~ rate` non richiede parentesi.

API collegata: [`mira.syntax.Expr.FieldGet`](api.md#api-mira-syntax-expr-fieldget)

- [Navigazione di record annidati](examples.md#example-record-field-path) — result = "Padova"
- [Campo con spazi](examples.md#example-record-field-quoted) — result = 3
- [Campo con nome composto, senza virgolette](examples.md#example-record-field-words) — result = 3

<a id="feature-blocks"></a>
## Blocchi funzione con parametro

**Disponibile dalla versione 0.8**

`{ value | expression }` crea una funzione lessicale applicabile con `>>`.

Un blocco è `{parametro | espressione}` con cattura lessicale, distinto dal record `{campo: valore}`. Il parametro può essere un nome composto o `_`; tutte le occorrenze di `_` nel blocco si riferiscono allo stesso argomento. Dalla 0.9 la stessa grammatica ammette anche più parametri separati da virgole (`{total, item | total + item}`), utili come callback di `fold:with:from:`. I blocchi sono closure native JS/PHP. Dalla 0.11 il corpo ammette più espressioni separate da `;`, con il valore dell'ultima come risultato.

API collegata: [`mira.syntax.Expr.Block`](api.md#api-mira-syntax-expr-block)

- [Calcolo della tariffa con un blocco](examples.md#example-block-fee) — result = 60
- [Filtrare lezioni con un blocco](examples.md#example-block-filter) — result = [{"student":"Ada","hours":1.5},{"student":"Lia","hours":2}]

<a id="feature-block-parameters"></a>
## Blocchi con più parametri

**Disponibile dalla versione 0.9**

`{total, item | total + item}` è una callback binaria per `fold:with:from:`.

Una lista di parametri espliciti separati da virgole precede `|`. I nomi possono avere più parole e catturano lessicalmente lo scope esterno. Il parser vieta duplicati, collisioni dopo il mangling e parametri riservati. Il nodo AST Block contiene un array di parametri. Non si introduce currying: `>>` resta applicazione unaria e rifiuta un blocco multi-parametro; i selettori host possono invocarlo con l'arità appropriata. Dalla 0.10 i blocchi si possono passare direttamente ai selettori, come `fold: items, with: {total, item | total + item}, from: 0`, senza parentesi aggiuntive.

API collegata: [`mira.syntax.Expr.Block`](api.md#api-mira-syntax-expr-block)

- [Somma di numeri con un blocco binario](examples.md#example-block-fold-numbers) — result = 10
- [Ridurre il compenso di più lezioni](examples.md#example-block-fold-fees) — result = 120

<a id="feature-field-precedence"></a>
## Accesso `~` prima dell'aritmetica

**Disponibile dalla versione 0.10**

`lesson ~ hours * lesson ~ rate` equivale a `(lesson ~ hours) * (lesson ~ rate)`.

L'accesso ai campi `~` forma una catena associativa a sinistra (`x ~ a ~ b` significa `(x ~ a) ~ b`) e precede tutti gli operatori aritmetici. Gli altri operatori mantengono la precedenza comune e il raggruppamento sinistra-destra già definiti in Mira. Non cambia il controllo dei campi o l'emissione JS/PHP.

API collegata: [`mira.syntax.ExpressionParser.parse`](api.md#api-mira-syntax-expressionparser-parse)

- [Tariffa senza parentesi sui campi](examples.md#example-precedence-fee) — result = 60
- [Accessi concatenati e addizione](examples.md#example-precedence-nested-field) — result = 7

<a id="feature-bare-block-arguments"></a>
## Blocchi diretti negli argomenti dei selettori

**Disponibile dalla versione 0.10**

`fold: xs, with: {sum, x | sum + x}, from: 0` senza parentesi tonde.

Le parentesi graffe delimitano già una singola espressione. Il riconoscitore dei selettori conserva le parentesi graffe e il loro contenuto, anche quando contengono record, chiamate o operatori. Le parentesi tonde restano accettate per compatibilità. Le parentesi quadrate di una lista possono analogamente delimitare un argomento.

API collegata: [`mira.resolve.SelectorResolver.match`](api.md#api-mira-resolve-selectorresolver-match)

- [Fold compensi con blocco diretto](examples.md#example-bare-fold-fees) — result = 120
- [Trasformare una lista con un blocco diretto](examples.md#example-bare-collect-map) — result = [2,4,6]

<a id="feature-block-steps"></a>
## Blocchi con espressioni in sequenza

**Disponibile dalla versione 0.11**

`{item | step1; step2}` esegue in ordine e restituisce il valore finale.

In Mira 0.11 un blocco può contenere più espressioni separate da punto e virgola. Il risultato è il valore dell'ultima; un `;` finale è facoltativo. Per un solo corpo l'AST resta `Block(parameters, body)` con il nodo originale; per più corpi un nuovo nodo `Steps` mantiene l'ordine. Il compilatore genera closure JS/PHP native e conserva scoping e cattura. Non sono ancora implementate dichiarazioni locali, assegnazioni o return espliciti nei blocchi.

API collegata: [`mira.syntax.Expr.Steps`](api.md#api-mira-syntax-expr-steps)

- [Il blocco restituisce l'ultima espressione](examples.md#example-block-steps-last) — result = 12
- [Più espressioni nel riduttore](examples.md#example-block-steps-fold) — result = 12

<a id="feature-local-values"></a>
## Valori locali immutabili nei blocchi

**Disponibile dalla versione 0.12**

`{value | doubled = value * 2; doubled + value}` definisce un valore locale nel blocco.

Da Mira 0.12 i blocchi ammettono definizioni locali `nome = espressione;` prima dell'espressione finale. Il nome, anche composto, è visibile solo alle espressioni successive e ai blocchi annidati. Non può essere riassegnato né ripetuto o collidere dopo mangling; per ora non può ombreggiare parametri e valori già visibili. L'ultima espressione è il risultato. Il nodo AST `Local(name, value)` vive in `Steps`. JavaScript usa const; PHP assegna una variabile ma Mira ne impedisce ogni ridefinizione. Le closure PHP catturano per valore i soli nomi esterni effettivamente usati.

API collegata: [`mira.syntax.Expr.Local`](api.md#api-mira-syntax-expr-local)

- [Compenso con subtotale locale](examples.md#example-local-values-fee) — result = 65
- [Closure annidata con valore locale](examples.md#example-local-values-closure) — result = 16
- [Riduzione con valore locale](examples.md#example-local-values-fold) — result = 12

<a id="feature-nullary-blocks"></a>
## Blocchi senza parametri

**Disponibile dalla versione 0.14**

`{| ...}` crea una computazione differita e `() >> action` la esegue.

Il corpo non viene valutato alla creazione della closure. Cattura lessicale, passi e valori locali funzionano come nei blocchi unari. `()` non rappresenta un valore; è sintassi dell'applicazione nullaria. L'AST riusa Block con parametri vuoti e Apply con argument null. I backend emettono chiamate native; l'arità dei blocchi espliciti è controllata, ma non viene inferita per valori nominati.

API collegata: [`mira.syntax.Expr.Block`](api.md#api-mira-syntax-expr-block)

- [Computazione differita](examples.md#example-nullary-value) — result = 42
- [Cattura lessicale senza argomenti](examples.md#example-nullary-closure) — result = 42

<a id="feature-gui-library"></a>
## Libreria GUI Mira e binding

**Disponibile dalla versione 0.15**

Costruttori GUI componibili scritti in Mira, input controllati e stato immutabile.

lib/gui.mira contiene normali selettori che costruiscono record. Row, input testuale, checkbox e select sono interpretati dall'host DOM. Per i campi controllati update riceve lo stato precedente e il nuovo valore; una funzione Mira restituisce lo stato successivo. I cataloghi concatenano esplicitamente la libreria con l'esempio durante la build, senza introdurre import o sintassi nuova. Dalla 0.16 il renderer conserva i nodi DOM compatibili per posizione e tipo. PHP compila le view ma non esegue il DOM.

API collegata: [`mira.HostEnvironment`](api.md#api-mira-hostenvironment)

- [Salutami · input reattivo](examples.md#example-gui-greeting) — Anteprima interattiva (browser JS; PHP compilato soltanto)
- [Scheda lezione · form reattivo](examples.md#example-gui-lesson) — Anteprima interattiva (browser JS; PHP compilato soltanto)

<a id="feature-incremental-gui"></a>
## DOM incrementale e stato indipendente

**Disponibile dalla versione 0.16**

I nodi compatibili restano montati; gli state annidati conservano il loro valore.

Il renderer valida la nuova view prima di applicarla e confronta i nodi per posizione e tipo. Aggiorna testo, callback e proprietà mutate senza sostituire input compatibili. Uno state annidato conserva il valore mentre cambia la view del genitore. Un key esplicito diverso nella stessa posizione resetta lo state. Non è un algoritmo di riordino per liste con chiavi; non cambia l'AST. I test usano un DOM simulato, non un browser mobile reale.

API collegata: [`mira.HostEnvironment`](api.md#api-mira-hostenvironment)

- [Due contatori indipendenti](examples.md#example-gui-independent) — Anteprima interattiva (browser JS; PHP compilato soltanto)
- [Nuova sessione · reset esplicito](examples.md#example-gui-reset) — Anteprima interattiva (browser JS; PHP compilato soltanto)

<a id="feature-styled-gui"></a>
## Stili GUI componibili e griglia

**Disponibile dalla versione 0.17**

Record di stile riutilizzabili, applicabili a qualunque view, e layout a griglia.

styled:with: costruisce un record decoratore senza creare nodi DOM. I record successivi prevalgono sui precedenti, gli stili esterni su quelli interni. Il renderer accetta un vocabolario di proprietà CSS validate e aggiorna soltanto proprietà cambiate, rimuovendo quelle assenti. grid:children: produce una griglia da 1 a 6 colonne. Nessuna nuova sintassi; PHP esegue i costruttori ma non il DOM. Il benchmark sintetico conta allocazioni di elementi e scritture stile su DOM simulato, non layout o paint del browser.

API collegata: [`mira.HostEnvironment`](api.md#api-mira-hostenvironment)

- [Dashboard musicale · stili componibili](examples.md#example-gui-dashboard) — Anteprima interattiva (browser JS; PHP compilato soltanto)
- [Tema dinamico](examples.md#example-gui-style-toggle) — Anteprima interattiva (browser JS; PHP compilato soltanto)

<a id="feature-record-update"></a>
## Aggiornamento immutabile dei record

**Disponibile dalla versione 0.31**

Sostituisce o aggiunge campi senza modificare il record originale.

update:with: è un selettore intrinseco, risolto dal normale resolver e compilato in una copia superficiale nativa JS/PHP. Supporta sezioni. I campi della patch prevalgono; nessuna fusione ricorsiva. Record con chiavi intere canoniche esclusi; [] vuoto accettato per compatibilità con PHP. Nessun host richiesto. Binding GUI utilizzabile anche nel renderer specializzato.

API collegata: [`mira.resolve.Symbols`](api.md#api-mira-resolve-symbols)

- [Aggiorna una lezione](examples.md#example-record-update-basic) — result = {"original":{"student":"Ada","hours":2,"paid":false},"changed":{"student":"Mira","hours":2,"paid":true}}
- [Aggiornamento riutilizzabile](examples.md#example-record-update-section) — result = {"student":"Ada","hours":3,"details":{"rate":30},"paid":true}
- [Registro lezioni · modifica immutabile](examples.md#example-record-update-form) — Anteprima interattiva (browser JS; PHP compilato soltanto)

<a id="feature-native-sequences"></a>
## Operazioni native sulle sequenze

**Disponibile dalla versione 0.32**

Append, rimozione, trasformazione, filtro e riduzione immutabili senza host.

append:to: aggiunge un elemento; remove:if: elimina tutti quelli per cui il predicato è true. collect:with:/map:with:, filter:with:/select:if:/select:with: e fold:with:from: sono native per default. Le vecchie capability possono essere ancora dichiarate esplicitamente per compatibilità (es. fold dell'AST). Ordine stabile, liste dense, predicato Boolean, nessuna mutazione degli operandi; PHP usa array_is_list. L'esempio 0.32 usa identità posizionale; dalla 0.33 le liste possono dichiarare chiavi stabili.

API collegata: [`mira.resolve.Symbols`](api.md#api-mira-resolve-symbols)

- [Aggiungere e rimuovere lezioni](examples.md#example-sequence-edit) — result = {"original":[{"id":1,"hours":2},{"id":2,"hours":1}],"remaining":[{"id":1,"hours":2},{"id":3,"hours":4}]}
- [Registro lezioni · trasformazione e totale](examples.md#example-sequence-native-fold) — result = {"lessons":[{"hours":2,"paid":true},{"hours":3,"paid":true}],"total":150}
- [Registro lezioni · lista dinamica](examples.md#example-sequence-gui-list) — Anteprima interattiva (browser JS; PHP compilato soltanto)

<a id="feature-gui-keyed"></a>
## Identità stabile delle liste GUI

**Disponibile dalla versione 0.33**

Riconciliazione per chiave dei widget dinamici, senza wrapper DOM.

each:identified by:view: è una normale funzione di lib/gui.mira che costruisce descrittori keyed:key/view. Il renderer generico mantiene le istanze per chiave fra fratelli, rimuove quelle non presenti e sposta i nodi esistenti. Stringhe non vuote e interi sicuri; duplicati e chiavi invalide sono errori prima del commit. Stato locale preservato per chiave e tipo, reinizializzato dopo rimozione e reinserimento. I widget senza chiave rimangono posizionali. Nessuna nuova sintassi; PHP costruisce i record ma non il DOM.

API collegata: [`mira.HostEnvironment`](api.md#api-mira-hostenvironment)

- [Identità delle righe · record GUI](examples.md#example-gui-keyed-descriptors) — result = [{"type":"keyed","key":7,"view":{"type":"text","text":"Ada"}},{"type":"keyed","key":9,"view":{"type":"text","text":"Lia"}}]
- [Registro allievi · identità stabile](examples.md#example-gui-keyed-students) — Anteprima interattiva (browser JS; PHP compilato soltanto)

