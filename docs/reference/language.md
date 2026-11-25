# Guida a Mira 0.10.0

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

`x >> f` applica `f` a `x` e si associa a sinistra; `>>` sostituisce il precedente `~` (0.2–0.5). Le sezioni a due placeholder non sono applicabili direttamente.

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

Sono esercizi negativi: fallire con una diagnostica precisa è il comportamento corretto.

API collegata: [`mira.MiraError`](api.md#api-mira-miraerror)

- [Argomenti senza confini](examples.md#example-ambiguous-words) — Errore atteso: Unknown identifier
- [Parametro ripetuto](examples.md#example-duplicate-parameter) — Errore atteso: Duplicate parameter

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

Il predicato è scritto in Mira; l'host esegue solo l'iterazione limitata delle liste. `filter:with:`, `select:with:`, `select:if:` e `collect:if:` sono alias di filtraggio: conservano l'ordine e restituiscono una lista reindicizzata su JS/PHP. `collect:if:` significa «raccogli se», distinto da `collect:with:` che trasforma come il `collect:` di Smalltalk.

API collegata: [`mira.HostEnvironment`](api.md#api-mira-hostenvironment)

- [Numeri sopra soglia](examples.md#example-filter-numbers) — result = [5,9]
- [Lezioni da fatturare](examples.md#example-filter-lessons) — result = ["Ada","Lia"]
- [Collect if: selezionare lezioni](examples.md#example-collect-if-lessons) — result = [{"student":"Ada","hours":1.5},{"student":"Lia","hours":2}]

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

Un blocco è `{parametro | espressione}` con cattura lessicale, distinto dal record `{campo: valore}`. Il parametro può essere un nome composto o `_`; tutte le occorrenze di `_` nel blocco si riferiscono allo stesso argomento. Dalla 0.9 la stessa grammatica ammette anche più parametri separati da virgole (`{total, item | total + item}`), utili come callback di `fold:with:from:`. I blocchi sono closure native JS/PHP. Per ora una sola espressione per corpo.

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

