# Mira

**A readable, discursive syntax experiment.** *Code you understand at a glance.*

Mira is an **independent experimental frontend**, exploring multiword identifiers and keyword selectors with punctuation that may be omitted only when argument boundaries are clear. Mira is not currently a replacement for [NailLang](https://github.com/Spyryto/NailLang). The relationship to Nail remains open.

## Current stage: 0.1

The prototype is a small **Node.js-based lexer, parser, structural selector resolver and JS/PHP emitter**. It uses neither a type checker nor a VM. A Haxe implementation is a possible later direction, not a requirement of this first experiment.

Supported example:

```mira
add: a number, and: another number = a number + another number;
square: value = value * value;

two = add: 1, and: 1;
five = add 2 and 3;
seven = add (two) and (five);
result = square: (seven);
```

Both `add: 2, and: 3` and `add 2 and 3` resolve to the same canonical selector `add:and:`, and generate `add__and(2, 3)` on both targets.

## Run

Requires Node.js 22+; PHP 8+ is needed for executing PHP output.

```sh
node --test
node src/mira.mjs examples/arithmetic.mira js > /tmp/mira-example.mjs
node src/mira.mjs examples/arithmetic.mira php > /tmp/mira-example.php
```

No dependencies or build step. The optional third CLI argument writes directly to an output file.

## What is implemented

- Multiword function parameters and variables
- One- and multi-part keyword selector declarations
- Fully labeled or clearly delimited abbreviated calls
- Numeric/string literals, parentheses, left-associated numeric arithmetic with equal operator precedence
- A simple AST, JS/PHP emitters, source-positioned lexer errors, generated-name collision checks
- Cross-target execution smoke tests

**Not implemented yet:** first-class functions, keyword sections (`_`), pipeline, `defop`, types, records, lists, closure blocks, imports, pattern matching, async, MVU/HTML or a general runtime. These features have not been silently approximated.

See [syntax notes](docs/syntax.md) and [design decisions](docs/decisions.md).

## Repository boundaries

- [NailLang](https://github.com/Spyryto/NailLang) — existing positional functional implementation
- [NailSeed](https://github.com/Spyryto/NailSeed) — historical prototypes
- **Mira** — discursive syntax experiment; future status undecided
- [Nail Lab](https://github.com/Spyryto/Nail-Lab) — historical and interactive teaching environment
- [PHX-VM](https://github.com/Spyryto/PHX-VM) — separately designed PHP-focused VM

This repository is deliberately kept independent so parsing experiments cannot disrupt NailLang's already working toolchain.
