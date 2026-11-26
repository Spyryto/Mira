# Design decisions (experimental)

## Accepted for the prototype

- Mira is a separate repository, versioned independently of NailLang.
- Multiword identifiers and complete keyword selector labels are syntactic concepts.
- `add: x, and: y` and `add (x) and (y)` resolve to the same selector `add:and:`.
- Parsing uses declared selector signatures and explicit argument boundaries, **not** inferred types.
- Ambiguous unparenthesized multiword arguments are rejected, not guessed.
- Compile the limited supported subset directly to JavaScript and PHP without a VM.
- **Compiler source in Haxe**, compiled to Node-compatible JavaScript for CI and the CLI.
- Handwritten, modular lexer / definition parser / expression parser with a distinct selector resolver.
- Keep the grammar in readable documentation and verify examples with executable tests, rather than introducing a second parser.
- **Mira 0.2:** `_` is a complete missing selector argument; keyword sections produce first-class functions and `~` lowers to `Apply(right, left)`.
- Multiple holes produce distinct parameters; generated binders are hygienic on JS/PHP; PHP captures enclosing parameters with arrow-function lexical capture.
- The parser rejects direct multi-hole sections used as unary pipeline functions without asking a type checker.

## Open questions

- General anonymous functions, operator sections such as `(_ + 1)`, and implicit omitted-argument syntax such as `join, with " "`.
- Full currying, partial application and the type discipline of pipelines.
- Record literals, blocks and DSLs using `{}` without type-directed parsing.
- Whether `type` is syntax or a compile-time constructor.
- The role of Mira: Nail frontend, reboot, or independent language.
- User-defined unary/binary `defop` and operator resolution.

No backward-compatibility, shared IR, macro system or full runtime is promised before 1.0.

## Direzione applicazioni (0.30)

La ricerca prestazionale GUI lascia spazio alle applicazioni complete. Priorità: import e moduli, manipolazione ergonomica dei dati immutabili, liste GUI con identità stabile, interoperabilità e persistenza, tipizzazione progressiva e client/server JS/PHP. In questa fase (0.30) il registro lezioni era proposto; dalla 0.34 esiste un primo pilota locale. Gli import statici a namespace condiviso sono il primo passo; namespace, export e privacy vanno progettati separatamente. Le ottimizzazioni GUI ulteriori saranno motivate dalle misure su app reali.

## Stato e direzione (0.34)

Decisioni adottate e relativo compromesso; le proposte rimangono distinte dalle implementazioni. [Guida](reference/language.md) · [Laboratory](https://spyryto.github.io/Mira/laboratory.html) · [Registro](https://spyryto.github.io/Mira/persistent-ledger.html).

| Versione | Scelta | Alternativa non adottata / limite |
| --- | --- | --- |
| 0.29 | CSS-only sul Laboratory, content-visibility + altezza ricordata | Nessuna applicazione globale; stima di scroll variabile, non virtualizzazione |
| 0.30 | Import statici DFS, resolver fornito dall'host, coordinate per file | Nessun namespace/export/private, nessun linker separato o I/O runtime; editor non multifile |
| 0.31 | update:with: intrinseco, copia superficiale nativa | Nessuna fusione ricorsiva, deep freeze, nuovo nodo AST o runtime proprietario |
| 0.32 | Liste native JS/PHP, predicato Boolean, fold esplicito | Nessun HAMT/persistent vector; vecchie capability dichiarabili esplicitamente (fold degli alberi) |
| 0.33 | each:identified by:view: nella libreria, chiave locale al dato | Nessun contatore globale/ID DOM, nessuna convenzione implicita sul campo id; widget statici posizionali |
| 0.34 | select filtra, collect trasforma, rimosso collect:if: | Niente alias semanticamente contraddittori; map/filter coerenti mantenuti |
| 0.34 | Adapter LocalStorage esplicito dopo commit dello stato radice | Nessuna nuova primitiva di storage, niente accesso dall'editor arbitrario, niente sync o backend server |

### Identità

Il contatore autoincrementante appartiene alla creazione del dato, non alla generazione della view: cambiare ordine non deve cambiare la sua identità. Identità per fratelli e tipo; numero 1 e stringa "1" distinti; duplicati rifiutati prima del commit. Rimozione disattiva callback, reinserimento riparte dallo stato iniziale. Lo state.key storico resta token di reset. Il riordino non garantisce la composizione IME sui vecchi browser. La specializzazione keyed è rinviata.

### Prestazioni delle collezioni

Il modello immutabile non obbliga a copiare fisicamente tutta la struttura a ogni aggiornamento. Per ora usiamo copie superficiali di array/record nativi e PHP beneficia del copy-on-write, quando applicabile. Accesso indicizzato nativo tipicamente O(1); append immutabile e patch di record O(n) nel caso generale; collect/select/fold O(n) più il costo delle callback. Costruzione con n append che copiano i precedenti elementi: O(n²) (n(n+1)/2 elementi nel modello di copia completa, contando l'inserimento); builder mutabile O(n) ammortizzato, esclusi altri costi. È un modello teorico, non un benchmark di Mira. In futuro si possono confrontare builder, structural sharing, vettori persistenti, fusioni di operazioni e mutazioni interne provate non osservabili. Queste ottimizzazioni e i benchmark 100/1000/10000/100000 elementi JS/PHP sono stati esplicitamente rinviati. Nessuna scelta di nuova rappresentazione è stata fatta. Conservare la semantica indipendente dall'implementazione.

### Roadmap applicativa (proposta, non promessa)

Priorità immediata: interoperabilità asincrona ed effetti, errori espliciti, HTTP/servizi esterni e transizioni del modello. Poi remoting JS/PHP e deploy reale, evoluzione del registro con form e validazione, navigazione, layout responsive e componenti riutilizzabili. Ancora da progettare: namespace, export/private, editor multifile, tipi/inferenza/generici/tipi somma/pattern matching, Result/optional, sincronizzazione e backup, database, test/debugger/formatter/language server. Dialoghi e notifiche, SVG/grafici e temi sono desiderabili; animazioni, virtualizzazione e nuove ottimizzazioni solo quando motivate da app e misure. Il pilota non è un gestionale di produzione: tariffa fissa, limite 100 lezioni, nessuna cifratura o backup. Non usare dati personali reali.

Nessun ulteriore sviluppo in questa revisione documentale.

## Decisioni successive (0.39–0.52)

Il [quaderno di progettazione](design-notes.md) raccoglie le decisioni
concordate sui tipi, sugli operatori, sul Grammar Lab e sul principio
compile-time-first, distinguendo implementazioni verificate, proposte
e questioni aperte. È consultabile anche da Mira Studio.
Le sezioni storiche precedenti conservano la prospettiva delle versioni
a cui si riferiscono, non rappresentano tutte lo stato attuale.
