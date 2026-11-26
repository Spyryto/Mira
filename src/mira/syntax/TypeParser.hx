package mira.syntax;

import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.MiraError;
import mira.types.Type;

// Closed data annotations, deliberately no inference variables or refinements.
class TypeParser {
    final tokens:Array<Token>;
    final fallback:Token;
    var position = 0;
    final names:Map<String,Type>;

    public function new(tokens:Array<Token>, fallback:Token, ?names:Map<String,Type>) {
        this.tokens = tokens;
        this.fallback = fallback;
        this.names = names == null ? new Map<String,Type>() : names;
    }

    function current():Null<Token> return position < tokens.length ? tokens[position] : null;
    function fail(message:String):Dynamic {
        throw new MiraError(message,current() == null ? fallback : current());
    }
    function take(value:String):Bool {
        if (current() != null && current().isSymbol(value)) {
            position++;
            return true;
        }
        return false;
    }
    function require(value:String):Void {
        if (!take(value)) fail("Expected " + value + " in type annotation");
    }

    public function parse():Type {
        final type = readType(0);
        if (current() != null) fail("Unexpected token in type annotation");
        return type;
    }

    function readType(depth:Int):Type {
        if (depth > 32) return fail("Type annotation nesting exceeds 32");
        if (take("[")) {
            final item = readType(depth+1);
            require("]");
            return ListType(item);
        }
        if (take("{")) {
            final fields = new Map<String,Type>();
            if (!take("}")) {
                while (true) {
                    final token = current();
                    if (token == null) return fail("Expected record type field");
                    final parts:Array<String> = [];
                    if (token.kind == Text) {
                        parts.push(token.value);
                        position++;
                    } else {
                        while (current() != null && current().kind == Word) {
                            parts.push(current().value);
                            position++;
                        }
                        if (parts.length == 0) return fail("Expected record type field");
                    }
                    final key = parts.join(" ");
                    if (fields.exists(key)) throw new MiraError("Duplicate type field " + key,token);
                    require(":");
                    fields.set(key,readType(depth+1));
                    if (take("}")) break;
                    require(",");
                }
            }
            return RecordType(fields,null);
        }
        final token = current();
        if (token == null || token.kind != Word) return fail("Expected a type annotation");
        final words:Array<String> = [];
        while (current() != null && current().kind == Word) words.push(tokens[position++].value);
        final name = words.join(" ");
        return switch (name) {
            case "Number": NumberType;
            case "Text": TextType;
            case "Boolean": BooleanType;
            default: if (names.exists(name)) names.get(name) else throw new MiraError("Unknown annotation type " + name,token);
        };
    }
}
