package mira.syntax;

import haxe.ds.ObjectMap;
import mira.lex.Token;
import mira.types.Type;

// Optional, per-compilation identity map. Equal-looking AST nodes at
// different source locations must not share their diagnostic anchor.
class ExpressionOrigins {
    final anchors = new ObjectMap<Dynamic,Token>();
    final bindingTypes = new ObjectMap<Dynamic,Array<Null<Type>>>();

    public final highlight:Null<HighlightSpans>;
    public function new(?highlight:HighlightSpans) { this.highlight = highlight; }

    public function remember(expr:Expr, token:Token):Expr {
        switch (expr) {
            case Placeholder: // Nullary enum singleton; not a useful diagnostic anchor.
            default: anchors.set(expr,token);
        }
        return expr;
    }

    public function get(expr:Expr):Null<Token> return anchors.get(expr);

    public function annotate(expr:Expr, types:Array<Null<Type>>):Expr {
        if (Lambda.exists(types,t -> t != null)) bindingTypes.set(expr,types);
        return expr;
    }

    public function annotations(expr:Expr):Null<Array<Null<Type>>> return bindingTypes.get(expr);

    public function inherit(rewritten:Expr, original:Expr):Expr {
        final token = get(original);
        return token == null ? rewritten : remember(rewritten,token);
    }
}
