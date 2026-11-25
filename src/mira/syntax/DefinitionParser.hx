package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.types.Type;

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
        var depth = 0;
        for (i in 0...tokens.length) {
            final token = tokens[i];
            if (token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{")) {
                depth++;
            } else if (token.isSymbol(")") || token.isSymbol("]") || token.isSymbol("}")) {
                depth--;
            } else if (depth == 0 && token.isSymbol("=")) {
                if (equals != -1) throw new MiraError("Unexpected second =", token);
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

        var header = tokens.slice(0, equals);
        var resultType:Null<Type> = null;
        var resultOrigin:Null<Token> = null;
        final arrow = topLevel(header,"->");
        if (arrow >= 0) {
            resultOrigin = arrow + 1 < header.length ? header[arrow+1] : header[arrow];
            resultType = new TypeParser(header.slice(arrow+1),resultOrigin).parse();
            header = header.slice(0,arrow);
            if (header.length == 0) throw new MiraError("Expected definition name before ->",tokens[0]);
        }
        final body = tokens.slice(equals + 1);
        final parts = splitHeader(header);

        if (parts.length == 1 && !containsColon(parts[0])) {
            final d = new Definition(readWords(header), [], [], body, tokens[0]);
            d.resultAnnotation = resultType;
            d.resultAnnotationOrigin = resultOrigin;
            return d;
        }

        final labels:Array<String> = [];
        final parameters:Array<String> = [];
        final parameterOrigins:Array<Token> = [];
        final annotations:Array<Null<Type>> = [];
        for (part in parts) {
            final colon = topLevel(part,":");
            if (colon <= 0 || colon == part.length - 1) {
                throw new MiraError("Expected label: parameter", part[0]);
            }
            labels.push(readWords(part.slice(0, colon)));
            final parameter = part.slice(colon+1);
            if (parameter[0].isSymbol("(")) {
                if (!parameter[parameter.length-1].isSymbol(")"))
                    throw new MiraError("Expected closing ) for annotated parameter",parameter[0]);
                final inner = parameter.slice(1,parameter.length-1);
                final separator = topLevel(inner,":");
                if (separator <= 0 || separator == inner.length-1)
                    throw new MiraError("Expected (parameter: Type)",parameter[0]);
                parameters.push(readWords(inner.slice(0,separator)));
                parameterOrigins.push(inner[0]);
                annotations.push(new TypeParser(inner.slice(separator+1),inner[separator]).parse());
            } else {
                parameters.push(readWords(parameter));
                parameterOrigins.push(parameter[0]);
                annotations.push(null);
            }
        }

        final d = new Definition("", labels, parameters, body, tokens[0], false, parameterOrigins);
        d.parameterAnnotations = annotations;
        d.resultAnnotation = resultType;
        d.resultAnnotationOrigin = resultOrigin;
        return d;
    }

    static function splitHeader(tokens:Array<Token>):Array<Array<Token>> {
        final result:Array<Array<Token>> = [];
        var start = 0;
        var depth = 0;
        for (i in 0...tokens.length) {
            final token = tokens[i];
            if (token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{")) depth++;
            else if (token.isSymbol(")") || token.isSymbol("]") || token.isSymbol("}")) depth--;
            if (depth == 0 && token.isSymbol(",")) {
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
        return topLevel(tokens,":") >= 0;
    }

    static function topLevel(tokens:Array<Token>,symbol:String):Int {
        var depth = 0;
        for (i in 0...tokens.length) {
            final token = tokens[i];
            if (depth == 0 && token.isSymbol(symbol)) return i;
            if (token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{")) depth++;
            else if (token.isSymbol(")") || token.isSymbol("]") || token.isSymbol("}")) depth--;
        }
        return -1;
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
