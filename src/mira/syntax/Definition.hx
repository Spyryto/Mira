package mira.syntax;

import mira.lex.Token;

class Definition {
    public final name:String;
    public final labels:Array<String>;
    public final parameters:Array<String>;
    public final bodyTokens:Array<Token>;
    public final origin:Token;
    public final isStatement:Bool;
    public var body:Null<Expr> = null;

    public function new(
        name:String,
        labels:Array<String>,
        parameters:Array<String>,
        bodyTokens:Array<Token>,
        origin:Token,
        isStatement:Bool = false
    ) {
        this.name = name;
        this.labels = labels;
        this.parameters = parameters;
        this.bodyTokens = bodyTokens;
        this.origin = origin;
        this.isStatement = isStatement;
    }

    public function isFunction():Bool {
        return !isStatement && labels.length > 0;
    }

    public function selector():String {
        return labels.join(":") + ":";
    }
}
