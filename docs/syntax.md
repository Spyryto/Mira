# Mira: syntax experiments

**Only the first sections are implemented in the 0.1 prototype.** The rest are ideas under evaluation.

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

## Proposed: first-class functions, sections and pipeline

```mira
greater than: limit = {x | x > limit};
filter: items, with: (_ > 5);
join: _, with: " ";
items ~ fold, with: +, start with: 0;
```

`{}` for closures/blocks is a **hypothesis**, not a finalized grammar. Keep parser decisions structural, without consulting expected types.

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

The 0.1 grammar deliberately has no type inference and does not claim JS/PHP behavior equivalence beyond its numeric smoke tests.
