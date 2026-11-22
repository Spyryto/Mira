package mira.syntax;

// The canonical expression AST is intentionally small. Distinct surface
// spellings of a selector become the same Call node.
enum Expr {
    Name(value:String);
    Numeric(value:String);
    Text(value:String);
    Binary(symbol:String, left:Expr, right:Expr);
    Call(selector:String, arguments:Array<Expr>);
}
