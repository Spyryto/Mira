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
            final locals = definition.isFunction() ? definition.parameters : [];
            definition.body = new ExpressionParser(
                definition.bodyTokens, symbols, locals
            ).parse();
        }

        return definitions;
    }

    public static function transpile(source:String, target:String):String {
        final definitions = parse(source);
        final symbols = new Symbols(definitions);

        return switch (target) {
            case "js": JsEmitter.emit(definitions, symbols);
            case "php": PhpEmitter.emit(definitions, symbols);
            default: throw new MiraError("Target must be js or php");
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
