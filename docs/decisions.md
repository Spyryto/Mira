# Design decisions (experimental)

## Accepted for the prototype

- Mira is a separate repository, versioned independently of NailLang.
- Multiword identifiers and complete keyword selector labels are syntactic concepts.
- `add: x, and: y` and `add (x) and (y)` resolve to the same selector `add:and:`.
- Parsing uses declared selector signatures and explicit argument boundaries, **not** inferred types.
- Ambiguous unparenthesized multiword arguments are rejected, not guessed.
- Compile the limited supported subset directly to JavaScript and PHP without a VM.

## Open questions

- Is Haxe or JS preferable as the final implementation language?
- Function references and sections, such as `(add: _, and: _)`.
- `~` pipelines and partial application with multiword selector labels.
- Record literals, blocks and DSLs using `{}` without type-directed parsing.
- Whether `type` is syntax or a compile-time constructor.
- The role of Mira: Nail frontend, reboot, or independent language.
- User-defined unary/binary `defop` and operator resolution.

No backward-compatibility, shared IR, macro system or full runtime is promised for version 0.1.
