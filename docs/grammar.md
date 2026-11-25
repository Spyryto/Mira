# Mira 0.12: executable subset and grammar boundaries

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
expression      = field-access, { binary-operator, field-access } ;
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
