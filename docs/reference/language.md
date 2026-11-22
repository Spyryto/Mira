# Guida a Mira 0.2.0

Generata automaticamente da catalog/manifest.json e dai programmi di catalog/examples/.
Le firme API sono estratte dal sorgente Haxe, non ricopiate manualmente.

Apri [Mira Studio](https://spyryto.github.io/Mira/#/guide) per consultare gli esempi e provarli.

<a id="feature-values"></a>
## Definizioni di valori

Valori intermedi nominati, separati da `;`.

Il corpo della definizione viene valutato sul backend di destinazione.

API collegata: [`mira.syntax.DefinitionParser.parse`](api.md#api-mira-syntax-definitionparser-parse)

- [Fattura e trasferta](examples.md#example-invoice-total) — result = 98
- [Margine di un concerto](examples.md#example-concert-margin) — result = 396

<a id="feature-names"></a>
## Identificatori composti

Nomi formati da più parole.

La risoluzione è basata sui nomi e sui confini sintattici, non sull'inferenza di tipo.

API collegata: [`mira.resolve.Symbols.resolveName`](api.md#api-mira-resolve-symbols-resolvename)

- [Voci di stipendio](examples.md#example-salary-adjustment) — result = 1950
- [Consumi di viaggio](examples.md#example-fuel-efficiency) — result = 15

<a id="feature-functions"></a>
## Funzioni con parametri

Definizioni di funzioni con argomenti leggibili.

La sintassi `label: parametro` dichiara una funzione; i suoi parametri possono avere più parole.

API collegata: [`mira.syntax.DefinitionParser.parse`](api.md#api-mira-syntax-definitionparser-parse)

- [Sconto su fattura](examples.md#example-cash-discount) — result = 165
- [Stima scalata](examples.md#example-scale-estimate) — result = 72

<a id="feature-selectors"></a>
## Selettori con più keyword

Firme articolate con etichette significative.

Ogni keyword contribuisce all'identità del selettore, e può contenere più parole.

API collegata: [`mira.resolve.SelectorResolver.match`](api.md#api-mira-resolve-selectorresolver-match)

- [Punteggio in tre passaggi](examples.md#example-three-step-score) — result = 42
- [Imposte e sconto](examples.md#example-tax-and-discount) — result = 107

<a id="feature-shorthand"></a>
## Chiamate discorsive

Abbreviazioni senza `:` quando non ambigue.

Letterali e parentesi rendono deterministici i confini degli argomenti.

API collegata: [`mira.resolve.SelectorResolver.match`](api.md#api-mira-resolve-selectorresolver-match)

- [Argomenti calcolati](examples.md#example-calculated-arguments) — result = 48
- [Etichetta discorsiva composta](examples.md#example-shipping-charge) — result = 55

<a id="feature-numbers"></a>
## Letterali numerici

Interi e decimali.

Il lexer legge numeri positivi; `-` è un operatore binario in Mira 0.2.

API collegata: [`mira.lex.Lexer.tokenize`](api.md#api-mira-lex-lexer-tokenize)

- [Importi decimali](examples.md#example-fractional-invoice) — result = 52.75
- [Minuti e coefficiente](examples.md#example-minutes-rate) — result = 3.375

<a id="feature-strings"></a>
## Letterali testuali

Testo delimitato da doppi apici.

Le stringhe sono dati utilizzabili nei selettori. Non esiste ancora una libreria di manipolazione del testo.

API collegata: [`mira.lex.Lexer.tokenize`](api.md#api-mira-lex-lexer-tokenize)

- [Titolo di una band](examples.md#example-band-title) — result = "I Liberamente"
- [Testo di benvenuto](examples.md#example-welcome-label) — result = "Benvenuto in Mira Studio"

<a id="feature-arithmetic"></a>
## Operatori aritmetici

`+`, `-`, `*`, `/` e `%`.

Attenzione: stessa precedenza per tutti, associatività a sinistra.

API collegata: [`mira.syntax.ExpressionParser.parse`](api.md#api-mira-syntax-expressionparser-parse)

- [Valutazione da sinistra](examples.md#example-left-to-right) — result = 20
- [Resto di una ripartizione](examples.md#example-modulo-remainder) — result = 2

<a id="feature-grouping"></a>
## Parentesi

Esplicitare il raggruppamento.

Permettono anche di delimitare espressioni negli argomenti discorsivi.

API collegata: [`mira.syntax.ExpressionParser.parse`](api.md#api-mira-syntax-expressionparser-parse)

- [Costi per gruppo](examples.md#example-stage-production) — result = 24
- [Ripartizione e supplemento](examples.md#example-split-payment) — result = 28

<a id="feature-sections"></a>
## Sezioni unarie

Un `_` in un selettore crea una funzione.

`_` deve essere un argomento intero della chiamata, non una sottoespressione generica.

API collegata: [`mira.syntax.Expr`](api.md#api-mira-syntax-expr)

- [Sconto riutilizzabile](examples.md#example-reduce-price) — result = 75
- [Moltiplicatore nominato](examples.md#example-triple-quantity) — result = 42

<a id="feature-multi-sections"></a>
## Sezioni con più `_`

Più segnaposto producono più parametri.

Il compilatore emette funzioni di arità corrispondente. In Mira 0.2 le applicazioni binarie generiche non hanno ancora sintassi nel sorgente.

API collegata: [`mira.emit.SourceEmitter.expression`](api.md#api-mira-emit-sourceemitter-expression)

- [Funzione binaria](examples.md#example-mix-two-inputs) — mixer(7, 9) = 23
- [Due argomenti liberi](examples.md#example-fee-calculator) — adjustment(125, 20) = 31

<a id="feature-pipelines"></a>
## Pipeline `~`

Composizione da sinistra a destra.

`x ~ f` applica `f` a `x`; non supporta sezioni con più fori direttamente.

API collegata: [`mira.syntax.Expr`](api.md#api-mira-syntax-expr)

- [Catena di livelli](examples.md#example-recording-level) — result = 22
- [Budget progressivo](examples.md#example-revised-budget) — result = 90

<a id="feature-captures"></a>
## Cattura lessicale

Funzioni che restituiscono sezioni parametrizzate.

Le arrow function JS/PHP conservano i parametri della funzione esterna.

API collegata: [`mira.emit.SourceEmitter.expression`](api.md#api-mira-emit-sourceemitter-expression)

- [Sezione che cattura un parametro](examples.md#example-extra-budget) — result = 20
- [Fabbrica di moltiplicatori](examples.md#example-rate-factory) — result = 42

<a id="feature-forward"></a>
## Dichiarazioni successive

I selettori possono essere dichiarati dopo l'uso.

Il compilatore raccoglie tutte le firme prima di analizzare i corpi.

API collegata: [`mira.Compiler.parse`](api.md#api-mira-compiler-parse)

- [Dichiarazione successiva](examples.md#example-declare-later) — result = 25
- [Commenti e firma futura](examples.md#example-commented-forward) — result = 38

<a id="feature-diagnostics"></a>
## Diagnostica e ambiguità

Esempi di errori intenzionali.

Sono esercizi negativi: fallire con una diagnostica precisa è il comportamento corretto.

API collegata: [`mira.MiraError`](api.md#api-mira-miraerror)

- [Argomenti senza confini](examples.md#example-ambiguous-words) — Errore atteso: Unknown identifier
- [Parametro ripetuto](examples.md#example-duplicate-parameter) — Errore atteso: Duplicate parameter

