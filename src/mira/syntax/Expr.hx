package mira.syntax;

// Canonical AST. Host references are explicit bindings, not guessed at runtime.
enum Expr {
    Name(value:String);
    HostRef(name:String);
    Numeric(value:String);
    Text(value:String);
    BooleanLiteral(value:Bool);
    FieldAccessor(key:String);
    Conditional(condition:Expr, whenTrue:Expr, whenFalse:Expr);
    Sequence(items:Array<Expr>);
    Record(keys:Array<String>, values:Array<Expr>);
    Binary(symbol:String, left:Expr, right:Expr);
    OperatorSection(symbol:String, left:Expr, right:Expr);
    Call(selector:String, arguments:Array<Expr>);
    HostCall(selector:String, arguments:Array<Expr>);
    Placeholder;
    Section(selector:String, arguments:Array<Expr>);
    HostSection(selector:String, arguments:Array<Expr>);
    Apply(callee:Expr, argument:Expr);
}
