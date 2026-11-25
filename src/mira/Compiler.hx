package mira;

import mira.lex.Lexer;
import mira.lex.Token;
import mira.resolve.Symbols;
import mira.syntax.Definition;
import mira.syntax.ExpressionParser;
import mira.emit.JsEmitter;
import mira.emit.PhpEmitter;
import mira.emit.SourceLocations.GeneratedLocation;

class Compiler {
    public static function parse(source:String, ?host:HostEnvironment,
        ?readModule:String->Null<String>, ?entry:String):Array<Definition> {
        final definitions = Modules.collect(source, readModule, entry);
        final symbols = new Symbols(definitions, host);
        for (definition in definitions) {
            final locals = definition.isFunction() ? definition.parameters : [];
            definition.body = new ExpressionParser(definition.bodyTokens, symbols, locals).parse();
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

    // Checking is opt-in while the type system is experimental.
    public static function check(source:String, ?host:HostEnvironment,
        ?readModule:String->Null<String>, ?entry:String):Array<Dynamic> {
        return new mira.types.TypeChecker().check(parse(source,host,readModule,entry));
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
