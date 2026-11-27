package mira.types;

import mira.syntax.Expr;

// Compile-time encoding facts, never emitted as runtime data.
enum NativeCase {
    Literal(value:Expr);
    Payload(domain:String);
}

class NativeVariants {
    // Deliberately conservative: one payload per primitive representation
    // domain. Refinements do not yet prove disjoint ranges within a domain.
    public static function domain(type:Type):Null<String> return switch (type) {
        case NamedType(_,base) | RefinedType(base,_) | TextRefinedType(base,_): domain(base);
        case NumberType | IntegerType: "number";
        case TextType | GrammarRefinedType(_,_): "string";
        case BooleanType: "boolean";
        default: null;
    };
}
