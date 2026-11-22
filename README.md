# Mira

**Discursive syntax, readable at a glance.**

Mira is currently a standalone **syntax and transpiler experiment**, not a replacement for NailLang. It explores multiword identifiers and Smalltalk-inspired keyword selectors, with a deliberately small executable core.

## What this repository contains

The compiler is **written entirely in Haxe** and compiled to JavaScript for the CLI. That CLI generates **both JavaScript and PHP** from Mira source. No Haxe-generated PHP is involved, no runtime VM is required, and the parser never asks a type checker to resolve syntax.

```text
Mira source
  └─ Lexer             tokens + source locations
      └─ DefinitionParser     declarations and raw expression spans
          └─ Symbols          collected selector signatures and names
              └─ SelectorResolver / ExpressionParser
                  └─ canonical expression AST
                      ├─ JsEmitter
                      └─ PhpEmitter
```

## Build and test

Requires Haxe **4.3.7**, Node.js **22+**, and PHP **8+** to execute the PHP test programs. No Haxelib packages or npm dependencies.

```sh
npm run build
npm test
npm run benchmark

node dist/mira.cjs examples/arithmetic.mira js > example.mjs
node dist/mira.cjs examples/arithmetic.mira php > example.php
node dist/mira.cjs examples/arithmetic.mira --tokens
```

`build.hxml` compiles Haxe into `dist/mira.cjs` (CommonJS). The directory `dist/` is not committed. CI compiles the frontend and runs the emitted programs on Node and PHP.

The compiler API uses the typed `Target` enum (`JavaScript` or `Php`). Only the CLI converts `js`/`php` strings to these enum values. CI also measures Haxe build duration and warmed-up Mira→JS/PHP transpilation (small and 100-definition fixtures). See [timing methodology](docs/performance.md) and the workflow run summary and `mira-timings` artifacts.

## A small executable example

```mira
add: a number, and: another number = a number + another number;
square: value = value * value;

two = add: 1, and: 1;
five = add 2 and 3;
seven = add (two) and (five);
result = square: (seven);
```

The labeled form `add: x, and: y` and the parenthesized abbreviation `add (x) and (y)` normalize to the **same selector** `add:and:`. Both emit `add__and(x, y)`, with multiword names mapped deterministically to host identifiers such as `aNumber`.

Explicit `:` remains essential when a bare multiword argument has no unambiguous boundary. Mira rejects ambiguous input rather than guessing from inferred types.

## Current 0.1 restrictions

This prototype recognizes function/value definitions, multiword names, numeric and string literals, delimited selector calls, parentheses, and basic binary numeric operators. The supported binary operators group **left-to-right with no arithmetic precedence**; parentheses are explicit.

**Not implemented:** function values, partial application, `_`, `~`, user-defined operators, lists, closures, records, types, imports, macros or MVU. Those remain syntax proposals, not advertised runtime features.

See [syntax and examples](docs/syntax.md), [grammar notes](docs/grammar.md) and [design decisions](docs/decisions.md).

## Related repositories

- [NailLang](https://github.com/Spyryto/NailLang) — existing positional-language compiler and toolchain
- [NailSeed](https://github.com/Spyryto/NailSeed) — historical prototypes
- [Nail Lab](https://github.com/Spyryto/Nail-Lab) — teaching and historical experiments
- [PHX-VM](https://github.com/Spyryto/PHX-VM) — separate PHP-focused VM

Mira may eventually become a frontend for Nail, a reboot, or an independent language. That choice is intentionally open.
