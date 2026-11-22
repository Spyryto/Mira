package mira;

import mira.lex.Lexer;
import mira.lex.Token;
import mira.resolve.Symbols;
import mira.syntax.Definition;
import mira.syntax.DefinitionParser;
import mira.syntax.ExpressionParser;
import mira.emit.JsEmitter;
import mira.emit.PhpEmitter;

class Compiler {
    public static function parse(source:String):Array<Definition> {
        final tokens = new Lexer(source).tokenize();
        final definitions = DefinitionParser.parse(tokens);
        final symbols = new Symbols(definitions);

        for (definition in definitions) {
            if (definition.isExtern) continue;
            final locals = definition.isFunction() ? definition.parameters : [];
            definition.body = new ExpressionParser(
                definition.bodyTokens, symbols, locals
            ).parse();
        }

        return definitions;
    }

    public static function transpile(source:String, target:Target):String {
        final definitions = parse(source);
        final symbols = new Symbols(definitions);

        return switch (target) {
            case JavaScript: JsEmitter.emit(definitions, symbols);
            case Php: PhpEmitter.emit(definitions, symbols);
        };
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
