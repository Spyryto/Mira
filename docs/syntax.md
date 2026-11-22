# Mira: syntax experiments

**Mira 0.3 implements selectors, selector sections, pipelines, sequence literals and anonymous records.** Typed records and other advanced forms remain under evaluation.

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
result = 2 ~ increment ~ (square: _);
```

`_` is a **whole missing selector argument**, not a generic anonymous
variable inside arbitrary expressions. `increment` is a unary function
value, and `adder` is a binary function value. Sections preserve captured
local arguments on JavaScript and PHP.

The pipeline `x ~ f` applies the value on the left to the function on
the right; it lowers to `Apply(f, x)`. Operators associate left to right
without mathematical precedence. Both `5 ~ increment` and
`5 ~ (add: _, and: 1)` are supported. Sections with two or more holes
cannot be used directly as unary pipeline targets.

## Proposed: general closures and partial selector notation

```mira
greater than: limit = {x | x > limit};
filter: items, with: (_ > 5);
join, with " "
```

These are **not implemented**: an explicit closure grammar (`{}`),
arithmetic/comparison operator sections and implicit omitted keyword
arguments need separate design. They must not require type inference to
parse.

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
