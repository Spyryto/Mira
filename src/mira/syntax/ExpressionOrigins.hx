package mira.syntax;

import haxe.ds.ObjectMap;
import mira.lex.Token;

// Optional, per-compilation identity map. Equal-looking AST nodes at
// different source locations must not share their diagnostic anchor.
class ExpressionOrigins {
    final anchors = new ObjectMap<Dynamic,Token>();

    public function new() {}

    public function remember(expr:Expr, token:Token):Expr {
        switch (expr) {
            case Placeholder: // Nullary enum singleton; not a useful diagnostic anchor.
            default: anchors.set(expr,token);
        }
        return expr;
    }

    public function get(expr:Expr):Null<Token> return anchors.get(expr);

    public function inherit(rewritten:Expr, original:Expr):Expr {
        final token = get(original);
        return token == null ? rewritten : remember(rewritten,token);
    }
}
