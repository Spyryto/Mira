# Mira 0.14: executable subset and grammar boundaries

This file documents the parser's **implemented** boundaries. It is a readable
grammar sketch, not a separate parser generator or a promise of accepted syntax.

## Lexical layer

- Words: ASCII letters/underscores, then ASCII letters/digits/underscores.
- Identifiers may contain multiple words separated by whitespace.
- Numbers: unsigned decimal integers or decimals.
- Strings: JSON-style double-quoted strings.
- `#` begins a line comment.
- Source positions (line/column) are preserved for diagnostics.

## Definition layer

```ebnf
program        = { definition, ";" } ;
definition     = value-header, "=", expression
               | function-header, "=", expression ;
value-header   = name ;
function-header = label, ":", parameter,
                  { ",", label, ":", parameter } ;
label          = name ;
parameter      = name ;
name           = word, { word } ;
```

`definition` requires a terminating `;` even across newlines.
The first declaration pass collects all selector signatures before any
expression bodies are resolved.

## Expression layer (simplified)

```ebnf
expression      = (field-access | "(", ")", ">>", field-access),
                  { binary-operator, field-access } ;
field-access    = application, { "~", (name | string) } ;
application     = primary, { primary } ; (* when callable *)
primary         = number | string | name | "(", expression, ")"
                | selector-call | record | block | sequence ;
binary-operator = "+" | "-" | "*" | "/" | "%" | ">>"
                | "==" | "!=" | "<" | ">" | "<=" | ">=" ;
record-key      = name | string ;
```

From 0.10, field access `~` binds more tightly than arithmetic,
and chains from left to right. `lesson ~ hours * lesson ~ rate`
means `(lesson ~ hours) * (lesson ~ rate)`. The remaining binary
operators still share one precedence level and group left:
`1 + 2 * 3` means `(1 + 2) * 3`, not `1 + (2 * 3)`.

A selector call is recognized by comparing the word labels and argument
boundaries against a declared selector signature:

```mira
add: x, and: y             # complete and explicit
add (x) and (y)            # parenthesized values
add 2 and 3                # self-delimited numeric literals
add: a number, and: another number
```

The following is **intentionally rejected**:

```mira
add a number and another number
```

It provides no lexical boundary between a multiword argument and the next
selector label. Parentheses or the labeled/commas form must be used.

Braced expressions are self-delimited selector arguments, without
an extra grouping `( )`: `fold: xs, with: {total, item | total + item},
from: 0`. The same is true for record and list literals.
Parenthesized block arguments remain supported.

A well-formed partial prefix of a selector is not automatically a function
value: `add` is *not* an alias for `add:and:`.

## Native conditionals (0.4 / 0.7)

Both spellings lower to the same lazy `Conditional` AST node:

```mira
result = if: (1 < 2), then: ("valid"), else: ("invalid");
result = if (1 < 2) then "valid" else "invalid";
```

In the second form, the condition must be parenthesized.
The `then` argument is delimited by the first top-level bare `else`,
while the final `else` argument consumes the remaining expression.
When nesting concise conditionals, parentheses disambiguate branch
boundaries: `if (true) then (if (false) then 1 else 2) else 3`.
The unused branch never runs on either JS or PHP. No selector lookup
or type inference is involved.

Since 0.7.1, the two commas and the three label colons are optional,
independently, like selector-call separators:

```mira
result = if (1 < 2), then: ("valid"), else: ("invalid");
```

This produces the very same `Conditional` AST and keeps the original
laziness and source locations.

## Sections and pipelines (implemented in 0.2)

A placeholder `_` is accepted **only as the entire argument of a complete
keyword selector**. It becomes a fresh function parameter in a `Section`
AST node. Multiple placeholders become distinct parameters, in source order.
The parser never guesses missing arguments.

```mira
add: left, and: right = left + right;
increment = (add: _, and: 1);
adder = (add: _, and: _);
result = 4 >> increment;
```

`increment` is unary, `adder` is binary. The operator `>>` is
left-associative and reduces to `Apply(right, left)`. Its right operand
must be an expression that can represent a function (a section, a name or
a call returning a function). A directly supplied section with two holes
is rejected as a unary pipeline target. Without a type checker, Mira
cannot yet prove that arbitrary named expressions are callable.

`1 + 2 >> increment` means `(1 + 2) >> increment`. Use parentheses for
other groupings. Simple operator sections such as `(_ + 1)` are supported
since 0.5. The variable name `_` is reserved.

`Section`, `Placeholder` and `Apply` are real AST constructors, exposed
by Mira Studio. Emission uses JavaScript arrow functions or PHP arrow
functions, both with hygienic generated parameter names.

## Blocchi di espressione (0.8)

`{parametro | espressione}` è una funzione unaria con cattura lessicale.
La distinzione dal record è lessicale, senza inferenza dei tipi:

```mira
lesson = {hours: 2, rate: 30};
fee = {item | (item ~ hours) * (item ~ rate)};
result = lesson >> fee;
```

Il parametro può essere un identificatore composto. Con `{_ | ...}`,
tutte le occorrenze di `_` dentro il blocco sono riferimenti allo stesso
argomento. Fuori dai blocchi le sezioni mantengono i propri placeholder
indipendenti. I blocchi annidati catturano variabili esterne in JS/PHP.
Dalla versione 0.9 i parametri possono essere multipli, separati
da virgole: `{total, item | total + item}`. Il nodo canonico
`Block` conserva l'elenco dei parametri. La distinzione fra
record e blocco resta deterministica: prima di `|` devono esserci
solo nomi e virgole. Parametri duplicati o in collisione dopo
la trasformazione del nome sono errori di compilazione.
Dalla versione 0.11, il corpo ammette più espressioni separate
da `;`. Un `;` finale prima di `}` è consentito.
Con una sola espressione l'AST resta invariato; con due o
più espressioni compare `Steps(expressions)` sotto `Block`.
Le espressioni precedenti vengono valutate e scartate:
il valore dell'ultima è il risultato del blocco.
Il codice generato usa funzioni native JS/PHP e mantiene
la cattura lessicale. Da Mira 0.12 sono possibili definizioni locali immutabili prima
dell'ultima espressione. Le riassegnazioni, la mutabilità e
`return` esplicito non sono ancora previsti.

`{hours: 2}` è un record; `{item | item + 1}` è un blocco.

## Blocchi senza parametri (0.14)

`{| espressione}` crea una closure senza parametri: il corpo non viene
eseguito finché non viene applicato tramite `() >> action`.
Anche qui valgono cattura lessicale, valori locali e risultato finale.
```mira
action = {| base = 21; base * 2};
result = () >> action;
```

`()` non è un valore, una lista o una tupla: è ammesso esclusivamente
all'inizio di un'espressione seguito da `>>`. Il nodo `Block([], body)`
è già sufficiente; `Apply(callee, null)` rappresenta l'assenza di un
argomento nell'AST (non un valore null di Mira). Le applicazioni con
argomento mantengono la forma precedente. L'arità dei blocchi e delle
sezioni esplicite è verificata; quella dei valori nominati non è ancora
inferita staticamente. Per usare un'applicazione nullaria come operando
a destra, racchiuderla in parentesi: `2 + (() >> {| 40})`.

## Record fields in 0.6

`record ~ field` compiles to a checked literal field lookup in the AST
(`FieldGet`). Starting in 0.6.1, unquoted keys can be **multiword
identifiers**, just like declared names: `lesson ~ total hours`.
Consecutive words belong to one key until an operator or delimiter;
quoted strings remain valid (`lesson ~ "total hours"`). Record
literals use the same rule: `{total hours: 3}` and
`{"total hours": 3}` are equivalent. Field keys do
not resolve as ordinary variables. `(_ ~ total hours)` produces
`FieldSection`, a callable unary accessor with `>>`. More complex
complex repeated placeholders can now be expressed through an
explicit block `{_ | (_ ~ hours) >= 1}`.

`field "name"` from 0.4 remains a first-class accessor. The meaning
of `~` changed in 0.6; older programs must migrate their pipelines
to `>>`.

## Separation of responsibilities

```text
Lexer:              characters -> token stream
DefinitionParser:   token stream -> declaration headers and body token spans
Symbols:            top-level symbols / selector signatures / collisions
SelectorResolver:   matching keyword labels + delimited argument slices
ExpressionParser:   those slices -> canonical expression AST
Emitters:           canonical AST -> JS or PHP
```

No type inference or backtracking exception handler is involved in selector
matching. SelectorResolver evaluates all candidate signatures structurally
and rejects equal-length competing matches instead of guessing.

Typed records, multi-statement/multi-parameter blocks, implicit partial
selector calls, and operator declarations remain future work.

## Sequenze e record (esperimento dopo 0.2)

```mira
numbers = [1, 2, 3];
empty list = [];
person = {name: "Mira", score: 10};
empty record = {};
summary = {values: numbers, metadata: person};
```

`[a, b]` è una sequenza in ordine; `{key: expression}` è un record
anonimo con chiavi uniche. Le chiavi sono una sola parola o una stringa.
Le espressioni annidate sono ammesse, ma le virgole finali sono rifiutate.
Il frontend produce nodi `Sequence` e `Record` dell'AST, con risultati
JS/PHP equivalenti per i dati JSON.

Le operazioni `get:from:`, `map:with:` e `fold:with:from:` negli
esempi sono selettori **dell'host**, non parole riservate del parser.
Vedi [i casi d'uso verificati](structured-data.md).

## Estensioni implementate in Mira 0.4

- Nuovi letterali `true`/`false` e comparatori `== != < > <= >=`,
  con lo stesso livello di precedenza e associatività degli operatori
  esistenti (usare parentesi esplicite).
- `field "nome"` genera una funzione accessor compilata nativamente
  in JS e PHP. È possibile applicarla con `record ~ accessor`.
- `if: (condition), then: (value), else: (value)` è una forma
  speciale del parser, non un selettore host. Valuta soltanto un ramo.
- `filter:with:` resta una funzione host limitata, che esegue un
  predicato Mira su ogni elemento della collezione.

[Language Tour 0.4](mira04.md).

## Valori locali immutabili (Mira 0.12)

Un blocco accetta definizioni seguite da un'espressione finale:

```mira
result = 4 >> {x |
  doubled = x * 2;
  doubled + x
};
```

Sintassi: `nome = espressione;` dentro il corpo del blocco,
seguita da almeno un'espressione finale. L'inizializzatore si
risolve prima che il nome diventi visibile. Ogni valore locale è
visibile soltanto nel proprio blocco, nelle espressioni successive
e nei blocchi annidati. Non sono ammesse riassegnazioni o
ridefinizioni di nomi già visibili.

Il nodo `Local(name,value)` è contenuto in `Steps`.
Il compilatore genera `const` su JS e variabili PHP ordinarie
con regole d'immutabilità verificate nel frontend. Il calcolo
delle catture nelle closure PHP considera l'ordine delle
definizioni locali, preservando lo scoping lessicale.

## Diagnostica degli ambiti (Mira 0.12.1)

Il parser raccoglie, a sola fini diagnostici, i nomi locali dichiarati
all'inizio delle espressioni di un blocco. La raccolta ignora i
sottoblocchi annidati. Questi nomi **non** entrano in scope prima della
dichiarazione: quando un riferimento sarebbe altrimenti sconosciuto,
Mira può segnalare `Local value 'name' used before its declaration`
con riga e colonna del token che lo usa.

Per evitare errori silenziosi sul codice generato, un parametro di
blocco non può avere un nome Mira diverso da un nome esterno visibile
se entrambi risultano nello stesso identificatore dopo il mangling.
È consentito invece lo shadowing con il medesimo nome letterale,
che mantiene la semantica lessicale ordinaria.

Le definizioni locali non introducono riassegnazione; il modello
resta identico per i due target JS/PHP. Nessuna nuova forma AST.


## Parametri delle funzioni nominate (Mira 0.12.2)

Il controllo delle collisioni dopo il mangling si applica anche ai
parametri delle funzioni nominate, non soltanto ai blocchi anonimi.
Due parametri `a b` e `aB` non possono condividere lo stesso simbolo
generato. Neppure un parametro può collidere con un valore globale
*diverso* nel nome Mira, a prescindere dall'ordine delle dichiarazioni.
Il parametro interno `__miraHost` è riservato perché il backend JS
lo usa per raggiungere le capability dell'host.

Sono preservati lo shadowing esatto (`x = 100; increment: x = x + 1;`)
e i nomi distinti che restano distinti dopo la generazione.
Gli errori sui parametri riportano riga e colonna del parametro stesso.
Nessuna nuova forma AST o regola runtime.

## Mira 0.30: import statici

```mira
import "lib/gui.mira";
import "lib/fees.mira";

result = fee: 2;
```

Un import è una direttiva statica all'inizio del file, prima di ogni definizione, terminata da `;`. Il percorso è una stringa relativa alla directory del file di ingresso (anche negli import transitivi), con segmenti ASCII alfanumerici, underscore e trattino ed estensione .mira. Non sono ammessi URL, percorsi assoluti, . o ..; il CLI non segue alias tramite symlink. I moduli importati contengono solo dichiarazioni (non expression statements top-level); i loro inizializzatori di valore possono comunque valutare espressioni. Import ripetuti e dipendenze a diamante vengono deduplicati, cicli e file mancanti sono errori. Limiti: 128 file importati, profondità 32 e sorgente totale importato di circa 2 milioni di unità UTF-16.

Il loader raccoglie le dichiarazioni per file in ordine DFS, dipendenze prima dell'importatore; poi il compilatore usa la stessa tabella globale di simboli e gli stessi parser/emitter JS/PHP. Le funzioni continuano a essere risolte globalmente; i valori sono inizializzati nell'ordine di emissione. Non è ancora un sistema di namespace: tutte le dichiarazioni sono visibili, anche transitivamente, le collisioni sono errori e non ci sono export/private/alias o isolamento delle capability. Non utilizzare riferimenti a valori non ancora inizializzati. Gli import non producono I/O a runtime; il risultato è un unico programma JS o PHP.

CLI: `node dist/mira.cjs app.mira js`, con lib/ accanto ad app.mira. Core: resolver sincrono opzionale (String -> Null<String>), senza filesystem o rete. Studio: lib/gui.mira incorporata nel compiler bundle; API virtuale opzionale con mappa JSON dei file. Il CLI --benchmark resta limitato a sorgenti singoli per ora. La diagnostica delle dipendenze riporta file:riga:colonna e l'AST/mappa delle posizioni include il file quando importato.

Scelta deliberatamente incrementale: separazione fisica e risoluzione deterministica prima di definire namespace e regole di visibilità, senza introdurre un secondo linker o un formato binario.

## Mira 0.31: aggiornamento di record

`update: record, with: patch` è un selettore intrinseco risolto normalmente, con sezioni e forme delimitate ordinarie. Nessuna nuova forma AST; semantica e limiti portabili in [dati strutturati](structured-data.md#aggiornamento-immutabile-dei-record-031).

## Mira 0.32: sequenze native

I selettori append:to:, remove:if:, map/collect, filter/select e fold sono disponibili senza host. [Semantica, alias e compatibilità](structured-data.md#sequenze-native-e-immutabili-032).

## 0.51–0.52: operatori logici e funzioni

AND, OR, NOT sono riservati e case-sensitive. L'attuale precedenza
è accesso ~ e applicazione per giustapposizione, poi gli operatori
binari storici allo stesso livello (associazione a sinistra), poi
NOT, AND e OR. AND e OR infissi sono short-circuit; NOT è una
condizionale canonica. Le forme parentetiche (+), (*), (AND), (OR),
(NOT) sono valori funzione e non conservano la valutazione differita
degli argomenti. La congiunzione dei refinement numerici usa AND.

Le annotazioni (Type), le dichiarazioni nominali ::, la proiezione
~ Type e where sono documentate in [type-checker.md](type-checker.md).
Precedenze configurabili, Unicode, localizzazione e dichiarazioni
di operatori custom sono proposte, non la grammatica attuale:
vedi [quaderno di progettazione](design-notes.md).

## Direzione futura: contratti e import logici dei moduli

Vedi [progetto dei moduli](module-design.md). Le sezioni piatte interface e implementation sono introdotte nella 0.66;
gli alias => di simboli sono introdotti nella 0.67; le firme pubbliche
esplicite nell'interfaccia sono introdotte nella 0.68. Gli import statici a percorso
file della 0.30 restano l'unica forma di caricamento implementata. Il punto sperimentato
nella PR #95 non è stato adottato.


## Mira 0.65: percorsi logici e scope isolati

```mira
module Music / Jazz Harmony;
Pitch :: Number;
rate = 2;
scale: x = x * rate;
a (Pitch) = 42;
result = scale: 5;
```

L'header precede gli import a percorso file e le definizioni. Segmenti
discorsivi separati da /, normalizzati nel percorso logico completo;
non si presume che esista un modulo padre. Due file distinti non
possono dichiarare lo stesso percorso logico. I file senza header
mantengono lo scope globale legacy, mentre ogni modulo dichiarato
ha tabelle separate per valori, selettori e tipi. I nomi risolti
sono canonici, non esprimibili nel sorgente. Tag delle somme immutati.
La forma breve validate cerca Result nella tabella locale.
Il mangler usa un prefisso riservato e codifica iniettiva; JS e PHP
non ricevono oggetti namespace o resolver. PHP non importa nei
corpi delle funzioni le variabili globali degli altri moduli.
L'host rimane una capability esplicita comune al programma.
Nella 0.65 un import a percorso file può caricare un modulo dichiarato, ma non
rende visibili i suoi simboli (in quella versione tutti privati). Gli effetti
degli inizializzatori continuano a essere eseguiti come prima.
Nella 0.65 non esistono ancora import logici, export, interface/implementation,
alias, qualificazione nelle espressioni o package. In questa fase
gli identificatori generati dei moduli non costituiscono un'API host.


## Mira 0.66: interfaccia e implementazione piatte

```mira
module Math / Integer Math;

interface

rate;
square:;
add: by: ;
Option (T) :: Some (T) | None;

implementation

rate = 2;
square: x = x * x;
add: x, by: y = x + y;
private constant = 42;
```

Le sezioni sono delimitate dalle due keyword, senza graffe, senza ;
dopo il marcatore e senza indentazione obbligatoria. Il modulo senza
interface conserva tutti i simboli privati. Le esportazioni di valori e
selettori senza annotazioni devono trovare una definizione locale;
gli spazi tra le label sono insignificanti. Duplicati, riferimenti
mancanti e ambiguità valore/tipo sono errori. Le dichiarazioni nominali
complete nell'interfaccia riusano il parser dei tipi, incluse somme e
parametri. In questa prima forma i costruttori delle somme dichiarate
pubblicamente sono pubblici; l'esportazione selettiva è rimandata.
Gli import legacy a percorso file sono ammessi dopo le esportazioni e
all'inizio dell'implementazione, ma caricano soltanto i moduli dichiarati,
senza introdurne i nomi. Gli import logici e gli alias seguiranno.
Il type checker marca i risultati delle dichiarazioni come exported e
l'AST/trace di Studio mostra il contratto di visibilità. Non è ancora
un'interfaccia tipizzata separatamente compilabile: firme esplicite
nell'interfaccia, verifica di fuga di tipi privati, tipi opachi e
riesportazione sono incrementi successivi. L'emissione non cambia
aggiungendo sole esportazioni a un programma equivalente.

## Mira 0.67: import selettivi e alias

```mira
module App;

interface

result;

import Math / Integer Math {
  square: ;
  add: by: => somma: a: ;
};

implementation

result = somma: (square: 3), a: 2;
```

Sono ammessi import di valori, tipi e selettori pubblici, inclusi costruttori
pubblici, con alias `=>` di identica arità. Anche `import Math / Integer Math / square: ;`
e `import Math / Integer Math { * };` sono accettati. I nomi non transitano
implicitamente ad altri moduli. Le collisioni sono errori, non overload.
Gli import dell'interfaccia precedono l'analisi dei tipi pubblici, quelli
privati non sono visibili a tali dichiarazioni. Alias di tipi mantengono
l'identità nominale; alias di funzioni non emettono wrapper. I riferimenti
sono diretti, anche nelle sezioni e nelle closure. Convenzione: spazio
prima del ; finale dei selettori importati e tra le keyword; il lexer
non richiede tali spazi.

Il resolver core riceve il percorso logico normalizzato. Il CLI usa la
convenzione `Math/Integer Math.mira` relativa alla directory di ingresso;
Studio accetta la chiave logica o il percorso file corrispondente nella
mappa virtuale. L'header deve corrispondere al percorso richiesto. I vecchi
import fra virgolette mantengono la semantica di caricamento. Evitare di
caricare lo stesso modulo con chiavi fisiche e logiche differenti.
I moduli devono avere un header per gli import logici. Alias dell'intero
modulo e qualificazione nelle espressioni restano aperti. Firme esplicite,
opacità e verifica delle fughe di tipi privati non ancora implementate:
le annotazioni restano opt-in. Gli import non creano oggetti runtime.

## Mira 0.68: firme pubbliche esplicite e inferite

```mira
module Math / Example;

interface

rate (Number);
square: :: (Number) -> Number;
identity (Value Type): :: (Value Type) -> Value Type;
add: by: :: (Number, Number) -> Number;
double: ;

implementation

rate = 2;
square: x = x * x;
identity: x = x;
add: x, by: y = x + y;
double: x = x + x;
```

Le firme esplicite vengono risolte dopo gli import e i tipi pubblici,
prima dei tipi privati. Sono trasferite alle annotazioni della definizione
locale: il checker esistente verifica parametri, risultato e genericità.
Per le firme ripetute, è richiesta l'identità del tipo, non una relazione
più permissiva di assegnabilità; i nomi dei parametri generici possono
essere diversi purché gli slot corrispondano. Se si ripete un header
generico nell'implementazione valgono ancora le regole della 0.61
(annotazioni complete). Nessuna ripetizione è necessaria.
Una funzione esportata senza firma continua a essere inferita. Il report
checked distingue exported e explicitSignature. I consumatori degli
import utilizzano le firme canoniche, non copie o wrapper. Controllo
dei tipi ancora opt-in (check/checked); anche in modalità unchecked
le firme sono analizzate e le annotazioni ripetute incompatibili rifiutate,
ma i corpi non sono verificati. Il confronto tra output di contratti e
annotazioni equivalenti copre entrambi i target.
In questa fase non è ancora garantito che le firme inferite non espongano
tipi privati; verifica delle fughe, opacità, compilazione separata e report
indipendente delle interfacce restano incrementi successivi.

## Mira 0.69: tipi opachi monomorfi e controllo delle firme pubbliche

```mira
module Music / Theory;

interface

Note;
note: :: (Number) -> Note;
pitch of: :: (Note) -> Number;

implementation

Note :: {pitch: Number};
note: n = {pitch: n};
pitch of: n = n ~ pitch;
```

Un riferimento a un tipo nominale non parametrico nell'interfaccia,
con definizione nell'implementazione, espone la sola identità. Nel
modulo proprietario la rappresentazione rimane disponibile. Gli import
(e gli alias) e le firme viste da altri moduli usano OpaqueType(name),
senza base, payload o intervallo numerico. Il checker rifiuta costruzioni
da rappresentazioni raw, conversioni, proiezioni, uguaglianza scalare,
validazione numerica e match non autorizzati. Le somme opache non
esportano direttamente i costruttori sintetizzati. Il report pubblico
usa lo schema {kind: Opaque, name: ...}; trace elenca i tipi opachi.
Le firme inferite ed esplicite di simboli esportati vengono controllate
ricorsivamente per evitare fughe di tipi privati, anche in liste,
record, funzioni e argomenti parametrici. L'opacità è un confine:
la rappresentazione privata di un tipo opaco non costituisce una fuga.
Gli import pubblici restano disponibili per le firme. Il controllo
resta opt-in (check/checked); il sorgente e il report diagnostico
privato del modulo non sono cifrati né costituiscono sicurezza runtime.
Nessuna modifica agli emitter: stesso codice per tipi equivalenti
pubblici o opachi. Non ancora supportati: tipi opachi parametrici,
riferimenti a un tipo opaco locale nelle dichiarazioni di altri tipi
pubblici della stessa interfaccia (le firme delle funzioni possono
riferirvisi), compilazione separata, riesportazioni.

## Mira 0.69.1: tipi opachi parametrici

```mira
module Data / Box;

interface

Box (Element Type);
Envelope (T) :: {box: Box (T)};
box (T): :: (T) -> Box (T);
item (T): :: (Box (T)) -> T;

implementation

Box (U) :: {item: U};
box: x = {item: x};
item: b = b ~ item;
```

I parametri dell'astrazione e dell'implementazione devono avere la stessa
arità, non necessariamente gli stessi nomi. Una vista opaca conserva
identità e argomenti; le applicazioni sono invarianti. Le somme
parametriche possono essere opache. I tipi pubblici possono contenere
riferimenti ai tipi opachi locali in record, liste e somme: si raccolgono
prima gli header, si risolvono le dichiarazioni pubbliche, poi le
rappresentazioni private. Il proprietario può rivelare la rappresentazione
quando necessario nel checker; i consumatori no. Gli argomenti di un
tipo opaco sono pubblici e non possono nascondere tipi privati in una
firma esportata. Alias diretti della rappresentazione di un tipo opaco
locale nelle dichiarazioni pubbliche restano esclusi per evitare cicli
di alias; non si introduce un sistema generale di tipi ricorsivi.
Il controllo resta opt-in. Nessuna modifica agli emitter.

## Mira 0.70: riesportazione statica

```mira
module Math / API;

interface

export Math / Integer Math {
  square: ;
  add: by: => somma: a: ;
};

implementation
```

Le direttive export con percorso logico riusano la sintassi degli import
selettivi, singoli e completi. Sono ammesse nell'interfaccia prima degli
import ordinari. Introducono un nome nel contratto pubblico del modulo
e nel suo scope locale. Non generano dichiarazioni o wrapper: la tabella
di export associa il nome pubblico alla dichiarazione originale (anche
attraverso più riesportazioni). Per i tipi conserva identità, argomenti
e opacità. Un import ordinario non diventa transitivo. Collisioni e
riesportazioni di simboli privati sono errori. Gli alias non cambiano
l'arità; le dipendenze circolari restano escluse. Il trace di Studio
riporta reexports con nome, categoria e identità originale.
Le interfacce senza implementazione propria mantengono il delimitatore
implementation, anche quando la sezione è vuota. Nessuna modifica agli
emitter. Il tree shaking è rinviato alla 0.70.1: la riesportazione non
elimina ancora dichiarazioni o inizializzatori caricati.

## Mira 0.70.1: tree shaking conservativo

`node dist/mira.cjs app.mira js --checked --tree-shake` (anche php).
L'ottimizzazione è opt-in e richiede checked: prima si risolve e controlla
l'intero programma, poi si filtra l'AST, mantenendo l'ordine originale.
Le radici sono le dichiarazioni del sorgente di ingresso, tutti i moduli
legacy senza header, gli statement e ogni inizializzatore di un modulo
importato che non sia provatamente innocuo. La whitelist comprende
letterali, liste/record di espressioni innocue e costruttori Variant
senza effetti; guard numeriche, letture, chiamate, blocchi con capture,
aritmetica e ogni altra forma restano conservativamente radici.
Il grafo scope-aware segue anche sezioni, closure e gruppi ricorsivi.
I simboli esportati di librerie importate possono essere eliminati se
irraggiungibili: il flag assume un programma chiuso, senza accessi host
esterni ai nomi generati delle librerie. Non usare il flag per produrre
una libreria destinata a invocazioni esterne arbitrarie. Gli import
rimangono risolti e tutti i tipi controllati; il pruning non nasconde
codice errato. Le globali importate eliminate sono rimosse dallo scope
emesso; nessun nuovo meccanismo runtime. Source locations preservate.
Studio: Type Lab → Tree shaking: esempio / Confronta JS / Confronta PHP.
Mostra conteggi effettivi, byte UTF-8, mediana di 7 compilazioni alternate
per variante e durata del pruning nell'ultima iterazione. Sono misure
locali del browser, non benchmark di esecuzione del codice generato.

## Mira 0.71: Module Explorer

Mira Studio → Module Explorer. Inserire il sorgente di ingresso, la mappa
JSON dei moduli virtuali e, facoltativamente, il manifest host. Il compilatore
fornisce le dipendenze dirette raccolte dal resolver (import, export e file
legacy), la fase, gli alias dichiarati, la posizione, le interfacce elaborate
dal checker, le identità nominali e l'arità dei tipi, la provenienza delle
riesportazioni e le dichiarazioni private. La vista permette di selezionare
un modulo dai nodi o dagli archi e filtrare i simboli. Le dipendenze a file
legacy sono mostrate come percorsi, non come identità logiche inventate.
Il report è disponibile solo dopo una verifica statica riuscita. Il bridge
combina trace e check (due passaggi del compilatore) senza interpretare la
grammatica in JavaScript. Nessun nuovo meccanismo runtime. La pagina e i suoi
asset fanno parte della cache offline della PWA.
