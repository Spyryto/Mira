package mira.syntax;

// Canonical AST. Host references are explicit bindings, not guessed at runtime.
enum Expr {
    Name(value:String);
    HostRef(name:String);
    Numeric(value:String);
    Text(value:String);
    BooleanLiteral(value:Bool);
    FieldAccessor(key:String);
    FieldGet(record:Expr, key:String);
    OptionalFieldGet(record:Expr,key:String,option:mira.types.Type);
    FieldSection(key:String);
    Conditional(condition:Expr, whenTrue:Expr, whenFalse:Expr);
    Validate(value:Expr, required:mira.types.Type, success:Expr, failure:Expr);
    ValidateResult(value:Expr, required:mira.types.Type, result:mira.types.Type);
    Variant(sum:mira.types.Type, tag:String, payload:Null<Expr>);
    Match(value:Expr, tags:Array<String>, handlers:Array<Expr>);
    Sequence(items:Array<Expr>);
    Record(keys:Array<String>, values:Array<Expr>);
    Block(parameters:Array<String>, body:Expr);
    Steps(expressions:Array<Expr>);
    Local(name:String, value:Expr);
    Binary(symbol:String, left:Expr, right:Expr);
    OperatorSection(symbol:String, left:Expr, right:Expr);
    Call(selector:String, arguments:Array<Expr>);
    HostCall(selector:String, arguments:Array<Expr>);
    Placeholder;
    Section(selector:String, arguments:Array<Expr>);
    HostSection(selector:String, arguments:Array<Expr>);
    // A null argument represents a zero-argument call, not a Mira value.
    Apply(callee:Expr, argument:Null<Expr>);
}
