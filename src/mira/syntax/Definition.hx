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
    public var modulePath:Null<String> = null;
    public var isExported:Bool = false;
    public var hasPublicSignature:Bool = false;
    public var isAbstractContract:Bool = false;
    public var importedGlobals:Array<String> = [];
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

    // Resolved declarations share the same identity as their AST references.
    public function canonical():Definition {
        if (modulePath == null || isStatement) return this;
        final labels = this.labels.copy();
        if (isFunction()) labels[0] = mira.resolve.ModuleIdentity.qualify(modulePath,labels[0]);
        final d = new Definition(isFunction() ? name : mira.resolve.ModuleIdentity.qualify(modulePath,name),
            labels,parameters,bodyTokens,origin,isStatement,parameterOrigins);
        d.modulePath = modulePath;
        d.isExported = isExported;
        d.hasPublicSignature = hasPublicSignature;
        d.isAbstractContract = isAbstractContract;
        d.importedGlobals = importedGlobals;
        d.typeParameters = typeParameters;
        d.parameterAnnotations = parameterAnnotations;
        d.resultAnnotation = resultAnnotation;
        d.resultAnnotationOrigin = resultAnnotationOrigin;
        d.body = body;
        return d;
    }

    public function isFunction():Bool {
        return !isStatement && labels.length > 0;
    }

    public function selector():String {
        return labels.join(":") + ":";
    }
}
