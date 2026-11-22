# Mira 0.1: executable subset and grammar boundaries

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
binary-operator = "+" | "-" | "*" | "/" | "%" ;
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

The syntax of `type`, records `{}`, closures, lists `[]`, pipelines `~`
and operator declarations remains under discussion and is **not** covered
by this first implementation.
