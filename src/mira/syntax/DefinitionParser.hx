package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;

class DefinitionParser {
    public static function parse(tokens:Array<Token>):Array<Definition> {
        final definitions:Array<Definition> = [];
        var start = 0;
        var index = 0;
        var depth = 0;

        while (index < tokens.length && tokens[index].kind != End) {
            final token = tokens[index];

            if (token.isSymbol("(")) {
                depth++;
            } else if (token.isSymbol(")")) {
                depth--;
                if (depth < 0) throw new MiraError("Unmatched closing parenthesis", token);
            }

            if (token.isSymbol(";") && depth == 0) {
                if (start < index) {
                    definitions.push(parseOne(tokens.slice(start, index)));
                }
                start = index + 1;
            }
            index++;
        }

        if (depth != 0) throw new MiraError("Unclosed parenthesis", tokens[index]);
        if (start != index) {
            throw new MiraError("Expected ; after definition", tokens[index - 1]);
        }

        return definitions;
    }

    static function parseOne(tokens:Array<Token>):Definition {
        // "extern" is syntax for an explicit host dependency, not a user name.
        // It requires a signature but no Mira body. Normal definitions still
        // require exactly one "=" and a nonempty expression.
        final isExtern = tokens[0].kind == Word && tokens[0].value == "extern";
        var equals = -1;
        for (i in 0...tokens.length) {
            if (tokens[i].isSymbol("=")) {
                if (equals != -1) throw new MiraError("Unexpected second =", tokens[i]);
                equals = i;
            }
        }

        if (isExtern && equals != -1) {
            throw new MiraError("Extern declarations cannot define a body", tokens[0]);
        }
        if (!isExtern && (equals <= 0 || equals == tokens.length - 1)) {
            throw new MiraError("A definition needs a name, = and a body", tokens[0]);
        }

        final header = isExtern ? tokens.slice(1) : tokens.slice(0, equals);
        if (header.length == 0) {
            throw new MiraError("Extern declaration needs a name or selector", tokens[0]);
        }
        final body = isExtern ? [] : tokens.slice(equals + 1);
        final parts = splitHeader(header);

        if (parts.length == 1 && !containsColon(parts[0])) {
            return new Definition(readWords(header), [], [], body, tokens[0], isExtern);
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

        return new Definition("", labels, parameters, body, tokens[0], isExtern);
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
