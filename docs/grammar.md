# Mira 0.2: executable subset and grammar boundaries

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
expression    = primary, { binary-operator, primary } ;
primary       = number | string | name | "(", expression, ")" | selector-call ;
binary-operator = "+" | "-" | "*" | "/" | "%" | "~" ;
```

Operators share one precedence level and group left; `1 + 2 * 3` means
`(1 + 2) * 3`, not `1 + (2 * 3)`.

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

A well-formed partial prefix of a selector is not automatically a function
value: `add` is *not* an alias for `add:and:`.

## Sections and pipelines (implemented in 0.2)

A placeholder `_` is accepted **only as the entire argument of a complete
keyword selector**. It becomes a fresh function parameter in a `Section`
AST node. Multiple placeholders become distinct parameters, in source order.
The parser never guesses missing arguments.

```mira
add: left, and: right = left + right;
increment = (add: _, and: 1);
adder = (add: _, and: _);
result = 4 ~ increment;
```

`increment` is unary, `adder` is binary. The operator `~` is
left-associative and reduces to `Apply(right, left)`. Its right operand
must be an expression that can represent a function (a section, a name or
a call returning a function). A directly supplied section with two holes
is rejected as a unary pipeline target. Without a type checker, Mira
cannot yet prove that arbitrary named expressions are callable.

`1 + 2 ~ increment` means `(1 + 2) ~ increment`. Use parentheses for
other groupings. Non-selector placeholders such as `(_ + 1)` are
**not implemented**. The variable name `_` is reserved.

`Section`, `Placeholder` and `Apply` are real AST constructors, exposed
by Mira Studio. Emission uses JavaScript arrow functions or PHP arrow
functions, both with hygienic generated parameter names.

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

The syntax of `type`, records `{}`, general closures, lists `[]`,
implicit partial selector calls and operator declarations remains under
consideration; these are **not** implemented.

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
