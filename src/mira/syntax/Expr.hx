package mira.syntax;

// Canonical expressions: surface keyword spelling is already resolved.
// A Section is a function value with one parameter per Placeholder slot.
// A Pipe is lowered into Apply without using types to choose the syntax.
enum Expr {
    Name(value:String);
    Numeric(value:String);
    Text(value:String);
    Binary(symbol:String, left:Expr, right:Expr);
    Call(selector:String, arguments:Array<Expr>);
    Placeholder;
    Section(selector:String, arguments:Array<Expr>);
    Apply(callee:Expr, argument:Expr);
}
