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
npm run build:studio
npm run test:studio

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

## Mira 0.2: sections and pipelines

Mira now supports **first-class selector sections**: a complete keyword call with one or more `_` arguments creates a function value. `x ~ f` applies the value `x` to the unary function `f` and pipelines group left to right.

```mira
add: x, and: y = x + y;
square: value = value * value;
increment = (add: _, and: 1);
result = 2 ~ increment ~ (square: _) ~ (add: _, and: 1);
```

The resulting value is `10`, for both JS and PHP. See [executable example](examples/sections.mira). Sections can close over surrounding parameters in both backends. The compiler generates fresh placeholder parameter names without shadowing user symbols.

**Implemented subset:** value/function definitions, multiword names, literal and parenthesized selector arguments, numeric/string literals, binary arithmetic, keyword sections and pipelines. Operators still group **left-to-right at one precedence level**; parentheses control grouping.

**Not yet implemented:** a general lambda syntax, non-selector sections such as `(_ + 1)`, implicit missing-argument sections, user-defined operators, lists, records, types, imports, macros, MVU, type-checking or full currying. A multi-hole section produces a function of that arity; passing it directly to a unary pipeline is rejected.

See [syntax and examples](docs/syntax.md), [grammar notes](docs/grammar.md) and [design decisions](docs/decisions.md).

## Mira Studio — PWA

The experimental **[Mira Studio](docs/studio.md)** is a mobile-first, installable
browser editor built on the same Haxe compiler core as the CLI. It offers:

- Mira source editor, local saving and example programs;
- actual JS/PHP transpilation and exported source files;
- real AST and source token inspection;
- explicit execution of generated **JavaScript only**, in a Web Worker;
- offline caching, version updates and GitHub Pages deployment via CI.

Build it with `npm run build:studio` and serve `dist/studio/` from a local
HTTP server. The expected Pages URL **after enabling GitHub Pages in repository
Settings → Pages → Source → GitHub Actions** is
https://spyryto.github.io/Mira/. See [Studio instructions](docs/studio.md) for
installation, limitations and local preview.

## Related repositories

- [NailLang](https://github.com/Spyryto/NailLang) — existing positional-language compiler and toolchain
- [NailSeed](https://github.com/Spyryto/NailSeed) — historical prototypes
- [Nail Lab](https://github.com/Spyryto/Nail-Lab) — teaching and historical experiments
- [PHX-VM](https://github.com/Spyryto/PHX-VM) — separate PHP-focused VM

Mira may eventually become a frontend for Nail, a reboot, or an independent language. That choice is intentionally open.
