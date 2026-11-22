package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;

class DefinitionParser {
    public static function parse(tokens:Array<Token>):Array<Definition> {
        final definitions:Array<Definition> = [];
        var start = 0;
        var index = 0;
        final brackets:Array<String> = [];

        while (index < tokens.length && tokens[index].kind != End) {
            final token = tokens[index];
            if (token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{")) {
                brackets.push(token.value);
            } else if (token.isSymbol(")") || token.isSymbol("]") || token.isSymbol("}")) {
                final opening = brackets.pop();
                if ((token.value == ")" && opening != "(")
                    || (token.value == "]" && opening != "[")
                    || (token.value == "}" && opening != "{")) {
                    throw new MiraError("Unmatched closing delimiter " + token.value, token);
                }
            }

            if (token.isSymbol(";") && brackets.length == 0) {
                if (start < index) {
                    definitions.push(parseOne(tokens.slice(start, index)));
                }
                start = index + 1;
            }
            index++;
        }

        if (brackets.length != 0) throw new MiraError("Unclosed delimiter", tokens[index]);
        if (start != index) {
            throw new MiraError("Expected ; after definition", tokens[index - 1]);
        }
        return definitions;
    }

    static function parseOne(tokens:Array<Token>):Definition {
        var equals = -1;
        for (i in 0...tokens.length) {
            if (tokens[i].isSymbol("=")) {
                if (equals != -1) throw new MiraError("Unexpected second =", tokens[i]);
                equals = i;
            }
        }

        // No '=' means an expression statement, such as log "hey there";
        if (equals == -1) {
            return new Definition("", [], [], tokens, tokens[0], true);
        }
        if (equals == 0 || equals == tokens.length - 1) {
            throw new MiraError("A definition needs a name, = and a body", tokens[0]);
        }

        final header = tokens.slice(0, equals);
        final body = tokens.slice(equals + 1);
        final parts = splitHeader(header);

        if (parts.length == 1 && !containsColon(parts[0])) {
            return new Definition(readWords(header), [], [], body, tokens[0]);
        }

        final labels:Array<String> = [];
        final parameters:Array<String> = [];
        for (part in parts) {
            var colon = -1;
            for (i in 0...part.length) {
                if (part[i].isSymbol(":")) {
                    if (colon != -1) throw new MiraError("Too many : in selector segment", part[i]);
                    colon = i;
                }
            }
            if (colon <= 0 || colon == part.length - 1) {
                throw new MiraError("Expected label: parameter", part[0]);
            }
            labels.push(readWords(part.slice(0, colon)));
            parameters.push(readWords(part.slice(colon + 1)));
        }

        return new Definition("", labels, parameters, body, tokens[0]);
    }

    static function splitHeader(tokens:Array<Token>):Array<Array<Token>> {
        final result:Array<Array<Token>> = [];
        var start = 0;
        for (i in 0...tokens.length) {
            if (tokens[i].isSymbol(",")) {
                if (start == i) throw new MiraError("Empty selector segment", tokens[i]);
                result.push(tokens.slice(start, i));
                start = i + 1;
            }
        }
        if (start == tokens.length) throw new MiraError("Empty final selector segment", tokens[tokens.length - 1]);
        result.push(tokens.slice(start));
        return result;
    }

    static function containsColon(tokens:Array<Token>):Bool {
        for (token in tokens) if (token.isSymbol(":")) return true;
        return false;
    }

    static function readWords(tokens:Array<Token>):String {
        if (tokens.length == 0) throw new MiraError("Expected an identifier");
        final parts:Array<String> = [];
        for (token in tokens) {
            if (token.kind != Word) throw new MiraError("Expected an identifier word", token);
            parts.push(token.value);
        }
        return parts.join(" ");
    }
}
