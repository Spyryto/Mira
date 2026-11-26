package mira.syntax;

import mira.lex.Token;
import mira.types.Type;

class Definition {
    public final name:String;
    public final labels:Array<String>;
    public final parameters:Array<String>;
    public final bodyTokens:Array<Token>;
    public final origin:Token;
    public final parameterOrigins:Array<Token>;
    public final isStatement:Bool;
    public var typeParameters:Array<String> = [];
    public var parameterAnnotations:Array<Null<Type>> = [];
    public var resultAnnotation:Null<Type> = null;
    public var resultAnnotationOrigin:Null<Token> = null;
    public var body:Null<Expr> = null;

    public function new(
        name:String,
        labels:Array<String>,
        parameters:Array<String>,
        bodyTokens:Array<Token>,
        origin:Token,
        isStatement:Bool = false,
        ?parameterOrigins:Array<Token>
    ) {
        this.name = name;
        this.labels = labels;
        this.parameters = parameters;
        this.bodyTokens = bodyTokens;
        this.origin = origin;
        this.isStatement = isStatement;
        this.parameterOrigins = parameterOrigins == null ? [] : parameterOrigins;
    }

    public function isFunction():Bool {
        return !isStatement && labels.length > 0;
    }

    public function selector():String {
        return labels.join(":") + ":";
    }
}
