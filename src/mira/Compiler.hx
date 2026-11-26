package mira;

import mira.lex.Lexer;
import mira.lex.Token;
import mira.resolve.Symbols;
import mira.syntax.Definition;
import mira.syntax.ExpressionParser;
import mira.syntax.ExpressionOrigins;
import mira.emit.JsEmitter;
import mira.emit.PhpEmitter;
import mira.emit.SourceLocations.GeneratedLocation;

class Compiler {
    public static function parse(source:String, ?host:HostEnvironment,
        ?readModule:String->Null<String>, ?entry:String, ?origins:ExpressionOrigins):Array<Definition> {
        final types = new Map<String,mira.types.Type>();
        final definitions = Modules.collect(source, readModule, entry,types);
        final symbols = new Symbols(definitions, host);
        for (definition in definitions) {
            if (definition.body != null) continue; // synthesized sum constructor
            final locals = definition.isFunction() ? definition.parameters : [];
            definition.body = new ExpressionParser(definition.bodyTokens, symbols, locals, false, null, origins,types).parse();
        }
        return definitions;
    }

    public static function transpile(source:String, target:Target, ?host:HostEnvironment,
        ?locations:Array<GeneratedLocation>, ?readModule:String->Null<String>, ?entry:String):String {
        final definitions = parse(source, host, readModule, entry);
        final symbols = new Symbols(definitions, host);
        return switch (target) {
            case JavaScript: JsEmitter.emit(definitions, symbols, locations);
            case Php: PhpEmitter.emit(definitions, symbols, locations);
        };
    }

    // A distinct checked path preserves byte-for-byte unchecked emission
    // when all obligations are proven. The same parsed AST reaches both phases.
    public static function transpileChecked(source:String,target:Target,?host:HostEnvironment,
        ?locations:Array<GeneratedLocation>,?readModule:String->Null<String>,?entry:String):String {
        final origins = new ExpressionOrigins();
        final definitions = parse(source,host,readModule,entry,origins);
        final guards = new haxe.ds.ObjectMap<Dynamic,mira.types.NumericGuard>();
        new mira.types.TypeChecker(origins,host == null ? HostEnvironment.empty() : host,guards).check(definitions);
        final symbols = new Symbols(definitions,host);
        return switch (target) {
            case JavaScript: JsEmitter.emit(definitions,symbols,locations,guards);
            case Php: PhpEmitter.emit(definitions,symbols,locations,guards);
        };
    }

    // Checking is opt-in while the type system is experimental.
    public static function check(source:String, ?host:HostEnvironment,
        ?readModule:String->Null<String>, ?entry:String):Array<Dynamic> {
        final origins = new ExpressionOrigins();
        return new mira.types.TypeChecker(origins,host == null ? HostEnvironment.empty() : host).check(parse(source,host,readModule,entry,origins));
    }

    public static function specialize(source:String,name:String,args:Array<mira.types.Type>,?host:HostEnvironment,
        ?readModule:String->Null<String>,?entry:String):Dynamic {
        final origins = new ExpressionOrigins();
        return new mira.types.TypeChecker(origins,host == null ? HostEnvironment.empty() : host)
            .specialize(parse(source,host,readModule,entry,origins),name,args);
    }

    public static function inspectTokens(source:String):String {
        final tokens = new Lexer(source).tokenize();
        final items:Array<Dynamic> = [];
        for (token in tokens) {
            items.push({
                kind: Std.string(token.kind),
                value: token.value,
                line: token.line,
                column: token.column
            });
        }
        return haxe.Json.stringify(items, null, "  ");
    }
}
