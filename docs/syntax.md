# Mira: syntax experiments

**Mira 0.10 implements selectors, selector/operator sections, field access, expression blocks, pipelines, sequence literals and anonymous records.** Typed records and other advanced forms remain under evaluation.

## Implemented: complete selectors

```mira
add: a number, and: another number = a number + another number;
two = add: 1, and: 1;
five = add 2 and 3;
seven = add (two) and (five);
```

The canonical selector is `add:and:`, not `add`. Its host symbol is currently `add__and`. The parser discovers signatures from declarations, **not** from a type checker. Multiword names remain one identifier at resolution time.

```mira
add: a number, and: another number
add (a number) and (another number)
```

These are equivalent **as calls within a program defining `add:and:`**. The punctuation-free version requires literal or parenthesized argument boundaries. `add a number and another number` is intentionally rejected. Call operands containing operators must be parenthesized.

The prototype requires `;` after each top-level definition. It supports numeric operators `+ - * / %` with equal precedence and left grouping; parentheses control grouping. Operators are not yet overloaded or unary.

## Implemented: selector sections and pipelines

```mira
add: left, and: right = left + right;
square: x = x * x;

increment = (add: _, and: 1);
adder = (add: _, and: _);
result = 2 >> increment >> (square: _);
```

`_` is a **whole missing selector argument**, not a generic anonymous
variable inside arbitrary expressions. `increment` is a unary function
value, and `adder` is a binary function value. Sections preserve captured
local arguments on JavaScript and PHP.

The pipeline `x >> f` applies the value on the left to the function on
the right; it lowers to `Apply(f, x)`. Operators associate left to right
without mathematical precedence. Both `5 >> increment` and
`5 >> (add: _, and: 1)` are supported. Sections with two or more holes
cannot be used directly as unary pipeline targets.

## Implementato in Mira 0.4: accessor, confronti e condizioni

```mira
hours = field "hours";
lesson = {hours: 1.5};
result = if: ((lesson >> hours) >= 1),
  then: ("fatturabile"),
  else: ("non fatturabile");
```

`field "hours"` è un accessor di prima classe, nativo su JS/PHP.
`true` e `false`, gli operatori `==`, `!=`, `<`, `>`, `<=`,
`>=` e la forma `if: (...), then: (...), else: (...)` sono
espressioni native. I rami della condizione sono lazy e le tre
espressioni devono essere parenthesized per delimitare i confini.
I predicati permettono `filter:with:` tramite una capability host.

[Dettagli storici della versione 0.4](mira04.md). Dalla 0.6 la stessa lettura diretta si scrive `lesson ~ hours` senza dichiarare `hours = field "hours"`.

## Implementato in Mira 0.7: condizionali sintetici

```mira
result = if (1 < 2) then "valid" else "invalid";
```

Questa forma produce **lo stesso nodo AST `Conditional`** della
versione con i due punti:

```mira
result = if: (1 < 2), then: ("valid"), else: ("invalid");
```

La condizione deve rimanere tra parentesi per delimitare l'argomento.
Le espressioni nei rami possono essere semplici oppure composte, per
esempio `if (true) then (1 + 2 * 3) else 0`. Il ramo `then`
termina al primo `else` non racchiuso fra parentesi: per annidare
condizionali nella forma discorsiva, usare le parentesi, ad esempio
`if (true) then (if (false) then 1 else 2) else 3`.
Solo il ramo selezionato viene eseguito, su JS e PHP. I due punti
restano supportati per compatibilità con tutti i programmi precedenti.

### Mira 0.7.1: virgole e due punti opzionali

Le separazioni tra `if`, `then` ed `else` seguono la stessa
convenzione delle chiamate di selettore: virgole opzionali e
due punti opzionali dopo ciascuna parola chiave.

```mira
result = if (1 < 2), then: ("valid"), else: ("invalid");
result = if (1 < 2) then "valid" else "invalid";
result = if: (1 < 2), then: ("valid"), else: ("invalid");
result = if (1 < 2) then: ("valid") else: ("invalid");
```

Le quattro forme producono **esattamente lo stesso AST**; non cambiano
né il risultato né la valutazione lazy. La condizione rimane tra parentesi,
mentre per i due rami le parentesi sono necessarie solo quando servono
per delimitare espressioni annidate.


## Implementato in Mira 0.5: sezioni di operatori

```mira
over five = (_ > 5);
increment = (_ + 1);
subtract from ten = (10 - _);
sum = (_ + _);
result = 7 >> over five;
```

Un operatore binario tra parentesi, con uno o due operandi `_`, produce
una funzione. Le sezioni accettano `+ - * / % == != < > <= >=` e sono
emesse come arrow function su JS/PHP. La pipeline `~` richiede sempre una
funzione unaria: `7 >> (_ + _)` è rifiutato. Le parentesi sono obbligatorie;
`result = _ + 1` resta un errore. Non c'è inferenza dei tipi.

`accept: predicate = 8 >> predicate; result = accept: (_ > 5);`
dimostra che una sezione può essere passata come argomento di selettore.

## Implementato in Mira 0.6: `~` e `>>`

```mira
lesson = {hours: 2, rate: 30};
result = (lesson ~ hours) * (lesson ~ rate);

student = {address: {city: "Padova"}};
city = student ~ address ~ city;

double = (_ * 2);
eleven = 5 >> double >> (_ + 1);
same hours = lesson >> (_ ~ hours);
```

`~` prende un campo letterale alla sua destra, senza cercarlo fra le
variabili. Dalla 0.6.1 ammette **identificatori composti** senza virgolette:
`lesson ~ total hours` è equivalente a `lesson ~ "total hours"`.
Le parole consecutive terminano al successivo operatore o delimitatore.
La stessa regola vale nella costruzione dei record: `{total hours: 3}`
è equivalente a `{"total hours": 3}`. Non servono dichiarazioni di tipo.
Se manca il campo, JS/PHP generano un errore.
`>>` applica la funzione a destra al valore a sinistra. Entrambi
mantengono associatività a sinistra, senza type inference.

`(_ ~ hours)` è una sezione unaria semplice. `(_ ~ hours >= 1)`
non è implementato come sezione implicita: dalla 0.8 si può usare
`{_ | (_ ~ hours) >= 1}`, dove tutte le occorrenze di `_` sono lo
stesso parametro. Anche `(_ ~ total hours)` è un accessor unario.
Si può usare una funzione nominata:
`billable: lesson = (lesson ~ hours) >= 1;`.

## Implementato in Mira 0.8: blocchi di espressione

```mira
lesson = {hours: 2, rate: 30};
fee = {lesson | (lesson ~ hours) * (lesson ~ rate)};
result = lesson >> fee;

# Ripetere _ significa riferirsi allo stesso parametro
fee = {_ | (_ ~ hours) * (_ ~ rate)};
result = lesson >> fee;

# Passare un blocco come predicato
result = collect: lessons, if: ({_ | (_ ~ hours) >= 1});
```

`{parametro | espressione}` costruisce una funzione con un parametro.
Sono ammessi nomi composti, cattura lessicale e blocchi annidati.
Dentro `{_ | ...}` ogni `_` indica il medesimo parametro; fuori
dai blocchi i placeholder delle sezioni restano indipendenti.

La presenza di `|` distingue un blocco da un record:
`{hours: 2}` resta un record. Dalla 0.9 sono supportati
anche più parametri, separati da virgole. Dalla 0.11 le espressioni
possono essere multiple, separate da `;`. Restano fuori dalle
possibilità attuali le riassegnazioni, la mutabilità e i tipi.
Dalla 0.12 sono ammesse definizioni locali immutabili.

## Implementato in Mira 0.9: più parametri nei blocchi

```mira
numbers = [1, 2, 3, 4];
result = fold: numbers, with: ({total, item | total + item}), from: 0;
```

La grammatica del blocco è `{parametro, parametro, ... | espressione}`,
con almeno un parametro. Sono validi nomi composti e cattura lessicale.
Il controllo dei parametri duplicati avviene durante il parsing;
anche collisioni fra identificatori diversi che produrrebbero lo stesso
nome JavaScript/PHP vengono segnalate.

Un blocco con più parametri è una funzione di arità corrispondente.
Non è curried: `>>` continua ad applicare un solo argomento e rifiuta
esplicitamente un blocco con arità diversa da uno.

I selettori che ricevono callback di più argomenti, per esempio
`fold:with:from:`, possono invece invocarlo direttamente. Fino alla 0.9 occorrevano parentesi tonde attorno al blocco
nell'argomento `with:`. Dalla 0.10 le graffe delimitano già
l'espressione: `with: {…}` funziona senza parentesi aggiuntive.
Dalla 0.11 si possono anche separare più espressioni con il punto e virgola.

## Implementato in Mira 0.10: accessi prioritari e blocchi diretti

`~` è ora un operatore postfix associativo a sinistra, con
precedenza rispetto a tutti gli operatori aritmetici:

```mira
lesson = {hours: 2, rate: 30};
result = lesson ~ hours * lesson ~ rate;
```

Il risultato è `60`. `student ~ address ~ city` equivale a
`(student ~ address) ~ city`. Gli operatori `+ - * / %`
mantengono lo **stesso livello tra loro**: `1 + 2 * 3`
vale ancora `9`, non `7`.

Ora i selettori possono ricevere direttamente espressioni tra graffe,
come `with: {total, lesson | ...}`. Non è necessaria un'ulteriore
parentesi tonda, anche con record o espressioni annidati.
La forma `with: ({...})` resta supportata.

## Implementato in Mira 0.11: blocchi con più espressioni

```mira
result = 4 >> {value |
  value + 1;
  value * 3
};
```

Le espressioni vengono valutate **nell'ordine scritto**:
l'ultima è il valore restituito (nell'esempio: `12`). Il punto
e virgola finale prima della graffa è facoltativo.

Non viene aggiunto un `return` esplicito. All'interno dei blocchi
con una sola espressione non cambia né la sintassi né l'AST
già esistente. I blocchi con più espressioni espongono invece
un nodo `Steps` con i figli nell'ordine d'esecuzione, ispezionabile
in Mira Studio. Le closure su JavaScript/PHP mantengono la
cattura lessicale; PHP usa `function (...) use (...)` quando
occorre un corpo con istruzioni.

Dalla 0.12 i blocchi possono contenere anche definizioni
di valori locali immutabili. Non sono previste riassegnazioni o mutazioni.

## Implementato in Mira 0.12: valori locali immutabili

```mira
result = 4 >> {value |
  doubled = value * 2;
  doubled >> {inner |
    inner + doubled
  }
};
```

Il risultato è `16`. La forma `nome = espressione;` all'interno
di un blocco crea un valore **locale e immutabile**. Il nome è visibile
soltanto nelle espressioni successive e può essere catturato dai
blocchi annidati. Un blocco deve terminare con un'espressione che
produca un valore; un'inizializzazione non è il risultato finale.

Non si possono ridefinire nomi già disponibili (compresi parametri e
valori globali), né introdurre nomi distinti che collidano dopo il
mangling. Questo primo modello rende il comportamento uguale su
JavaScript e PHP senza una nuova infrastruttura di scoping.
`Local(name, value)` è un nodo AST interno a `Steps`. In JS
si genera `const`; in PHP un'assegnazione a variabile ordinaria,
ma Mira impedisce staticamente di riassegnare il nome.

## Proposto: closure generali e selettori parziali

```mira
greater than: limit = {x | x > limit};
join, with " "
```

**Non implementati**: mutabilità, riassegnazioni, selector parziali con
argomenti impliciti e type checker.

## Proposed: type declarations and MVU records

```mira
type a Person {
  first name: Text,
  age: Number
}

mario = a Person {
  first name "Mario",
  age 51
};

registration = form {
  title: "Registration",
  fields: [
    input: "name", labeled: "Your name";
    input: "email", labeled: "Email"
  ],
  on submit: register user
};
```

The UI functions can build a data tree without DOM side effects. This does **not** require delaying their execution. `type` may be syntactic rather than a compile-time function; the shared-braces grammar must remain unambiguous before implementation.

## Compilation stages

Tokenize (preserve locations) → collect selector signatures → parse with boundaries → canonical AST → emit JS/PHP.

The 0.3 grammar deliberately has no type inference. Selector sections and pipelines are tested through executed JavaScript and PHP, with explicit limits on supported forms.
