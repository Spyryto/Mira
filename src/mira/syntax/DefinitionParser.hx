package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.types.Type;

class DefinitionParser {
    public static function parse(tokens:Array<Token>, ?names:Map<String,Type>):Array<Definition> {
        if (names == null) names = new Map<String,Type>();
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
                    final segment = tokens.slice(start,index);
                    final marker = topLevel(segment,"::");
                    if (marker >= 0) {
                        if (marker == 0 || marker == segment.length-1)
                            throw new MiraError("Expected name :: Type",segment[marker]);
                        final name = readWords(segment.slice(0,marker));
                        if (["Number","Text","Boolean"].indexOf(name) >= 0 || names.exists(name))
                            throw new MiraError("Duplicate or reserved type " + name,segment[0]);
                        final base = new TypeParser(segment.slice(marker+1),segment[marker+1],names).parse();
                        names.set(name,NamedType(name,base));
                    } else definitions.push(parseOne(segment,names));
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

    static function parseOne(tokens:Array<Token>,names:Map<String,Type>):Definition {
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
            resultType = new TypeParser(header.slice(arrow+1),resultOrigin,names).parse();
            header = header.slice(0,arrow);
            if (header.length == 0) throw new MiraError("Expected definition name before ->",tokens[0]);
        }
        final body = tokens.slice(equals + 1);
        final parts = splitHeader(header);

        if (parts.length == 1 && !containsColon(parts[0])) {
            if (arrow >= 0) throw new MiraError("Use name (Type) for a value annotation",resultOrigin);
            final value = annotatedName(header,names);
            final d = new Definition(value.name, [], [], body, tokens[0]);
            d.resultAnnotation = value.type;
            d.resultAnnotationOrigin = value.typeOrigin;
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
            final parameter = annotatedName(part.slice(colon+1),names);
            parameters.push(parameter.name);
            parameterOrigins.push(part[colon+1]);
            annotations.push(parameter.type);
        }

        final d = new Definition("", labels, parameters, body, tokens[0], false, parameterOrigins);
        d.parameterAnnotations = annotations;
        d.resultAnnotation = resultType;
        d.resultAnnotationOrigin = resultOrigin;
        return d;
    }

    // A binding has the same grammar in both value and parameter headers:
    // multiword name, optionally followed by a single parenthesized type.
    public static function annotatedName(tokens:Array<Token>,?names:Map<String,Type>):{name:String,type:Null<Type>,typeOrigin:Null<Token>} {
        final opening = topLevel(tokens,"(");
        if (opening < 0) return {name:readWords(tokens),type:null,typeOrigin:null};
        if (opening == 0) throw new MiraError("Expected name before type annotation",tokens[0]);
        final name = readWords(tokens.slice(0,opening));
        if (!tokens[tokens.length-1].isSymbol(")"))
            throw new MiraError("Expected closing ) after type annotation",tokens[opening]);
        final origin = opening + 1 < tokens.length - 1 ? tokens[opening+1] : tokens[opening];
        final type = new TypeParser(tokens.slice(opening+1,tokens.length-1),origin,names).parse();
        return {name:name,type:type,typeOrigin:origin};
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
