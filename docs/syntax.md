# Mira: syntax experiments

**Mira 0.6 implements selectors, selector/operator sections, field access, pipelines, sequence literals and anonymous records.** Typed records and other advanced forms remain under evaluation.

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
Se manca il campo, JS/PHP generano un errore.
`>>` applica la funzione a destra al valore a sinistra. Entrambi
mantengono associatività a sinistra, senza type inference.

`(_ ~ hours)` è una sezione unaria semplice. `(_ ~ hours >= 1)`
non è implementato: i placeholder nelle espressioni complesse saranno
progettati insieme ai blocchi. Anche `(_ ~ total hours)` è un accessor unario.
Si può usare una funzione nominata:
`billable: lesson = (lesson ~ hours) >= 1;`.

## Proposto: closure generali e selettori parziali

```mira
greater than: limit = {x | x > limit};
join, with " "
```

**Non implementati**: closure esplicite con parametri arbitrari,
selector parziali con argomenti impliciti e type checker.

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
