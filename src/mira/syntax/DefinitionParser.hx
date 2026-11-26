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
                        final header = typeHeader(segment.slice(0,marker),names);
                        final name = header.name;
                        if (["Number","Integer","Text","Boolean"].indexOf(name) >= 0 || names.exists(name))
                            throw new MiraError("Duplicate or reserved type " + name,segment[0]);
                        final rhs = segment.slice(marker+1);
                        if (topLevel(rhs,"|") >= 0) {
                            declareSum(name,rhs,names,definitions,header.parameters);
                        } else {
                            if (header.parameters.length == 0) {
                                final base = new TypeParser(rhs,segment[marker+1],names,false).parse();
                                names.set(name,NamedType(name,base));
                            } else {
                                final local = names.copy();
                                final arguments:Array<Type> = [for (i in 0...header.parameters.length) Variable(-i-1)];
                                for (i in 0...arguments.length) local.set(header.parameters[i],arguments[i]);
                                final base = new TypeParser(rhs,segment[marker+1],local,false).parse();
                                switch (base) {
                                    case RecordType(_,null) | ListType(_):
                                        names.set(name,ParametricNamedType(name,base,arguments));
                                    default:
                                        throw new MiraError("Parametric nominal types currently require a record or list base",segment[0]);
                                }
                            }
                        }
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

    // Parameter names are lexical to a sum declaration, not global type names.
    static function typeHeader(tokens:Array<Token>,names:Map<String,Type>):{name:String,parameters:Array<String>} {
        final opening = topLevel(tokens,"(");
        if (opening < 0) return {name:readWords(tokens,true),parameters:[]};
        final name = readWords(tokens.slice(0,opening),true);
        if (!tokens[tokens.length-1].isSymbol(")"))
            throw new MiraError("Expected closing ) in type declaration",tokens[opening]);
        final parameters:Array<String> = [];
        final arguments = tokens.slice(opening + 1,tokens.length-1);
        if (arguments.length == 0) throw new MiraError("Expected type parameter",tokens[opening]);
        for (part in splitHeader(arguments)) {
            final parameter = readWords(part);
            for (word in part) if (word.value == "where")
                throw new MiraError("Invalid or duplicate type parameter " + parameter,word);
            if (parameter == "_" || names.exists(parameter)
                || ["Number","Integer","Text","Boolean"].indexOf(parameter) >= 0
                || parameter == name || parameters.indexOf(parameter) >= 0)
                throw new MiraError("Invalid or duplicate type parameter " + parameter,part[0]);
            parameters.push(parameter);
        }
        return {name:name,parameters:parameters};
    }

    // Sum declarations synthesize ordinary constructor definitions, with a
    // trusted canonical Variant body rather than user-forgeable records.
    static function declareSum(name:String,tokens:Array<Token>,names:Map<String,Type>,definitions:Array<Definition>,parameters:Array<String>):Void {
        final local = names.copy();
        // Negative ids are declaration-local template slots, never checker ids.
        final arguments:Array<Type> = [for (i in 0...parameters.length) Variable(-i-1)];
        for (i in 0...parameters.length) local.set(parameters[i],arguments[i]);
        final alternatives = new Map<String,Null<Type>>();
        // Only this declaration can see its own back-reference before completion.
        local.set(name,SumReference(name,alternatives,arguments));
        final tags:Array<String> = [];
        final origins:Array<Token> = [];
        var rest = tokens[0].isSymbol("|") ? tokens.slice(1) : tokens;
        while (true) {
            final separator = topLevel(rest,"|");
            final part = separator < 0 ? rest : rest.slice(0,separator);
            if (part.length == 0) throw new MiraError("Empty sum alternative",tokens[0]);
            final variant = annotatedName(part,local);
            if (!~/^[A-Z][A-Za-z0-9_]*( [A-Za-z_][A-Za-z0-9_]*)*$/.match(variant.name))
                throw new MiraError("Sum constructor must start with an uppercase letter",part[0]);
            if (alternatives.exists(variant.name))
                throw new MiraError("Duplicate sum alternative " + variant.name,part[0]);
            alternatives.set(variant.name,variant.type);
            tags.push(variant.name);
            origins.push(part[0]);
            if (separator < 0) break;
            rest = rest.slice(separator+1);
        }
        final sum = SumType(name,alternatives,arguments);
        names.set(name,sum);
        final dot = name.lastIndexOf(".");
        final qualifier = dot < 0 ? "" : name.substr(0,dot+1);
        for (i in 0...tags.length) {
            final tag = tags[i];
            final payload = alternatives.get(tag);
            final anchor = origins[i];
            final constructor = qualifier + tag;
            final d = payload == null
                ? new Definition(constructor,[],[],[],anchor)
                : new Definition("",[constructor],["payload"],[],anchor,false,[anchor]);
            if (payload != null) d.parameterAnnotations = [payload];
            d.resultAnnotation = sum;
            d.resultAnnotationOrigin = anchor;
            d.body = Variant(sum,tag,payload == null ? null : Name("payload"));
            definitions.push(d);
        }
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
        // Explicit generics belong to the first selector label, not to its identity.
        final colon = topLevel(header,":");
        final typeParameters:Array<String> = [];
        if (colon >= 0) {
            final first = header.slice(0,colon);
            final opening = topLevel(first,"(");
            if (opening >= 0) {
                final generic = typeHeader(first,names);
                names = names.copy();
                for (i in 0...generic.parameters.length) {
                    final parameter = generic.parameters[i];
                    typeParameters.push(parameter);
                    names.set(parameter,Variable(-i-1));
                }
                header = first.slice(0,opening).concat(header.slice(colon));
            }
        }
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
            final value = annotatedName(header,names,true);
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
            labels.push(readWords(part.slice(0, colon),labels.length == 0));
            final parameter = annotatedName(part.slice(colon+1),names);
            parameters.push(parameter.name);
            parameterOrigins.push(part[colon+1]);
            annotations.push(parameter.type);
        }

        final d = new Definition("", labels, parameters, body, tokens[0], false, parameterOrigins);
        if (typeParameters.length > 0) {
            if (resultType == null || Lambda.exists(annotations, a -> a == null))
                throw new MiraError("Explicit generic functions require all parameter and result annotations",tokens[0]);
            d.typeParameters = typeParameters;
        }
        d.parameterAnnotations = annotations;
        d.resultAnnotation = resultType;
        d.resultAnnotationOrigin = resultOrigin;
        return d;
    }

    // A binding has the same grammar in both value and parameter headers:
    // multiword name, optionally followed by a single parenthesized type.
    public static function annotatedName(tokens:Array<Token>,?names:Map<String,Type>,allowQualified:Bool = false):{name:String,type:Null<Type>,typeOrigin:Null<Token>} {
        final opening = topLevel(tokens,"(");
        if (opening < 0) return {name:readWords(tokens,allowQualified),type:null,typeOrigin:null};
        if (opening == 0) throw new MiraError("Expected name before type annotation",tokens[0]);
        final name = readWords(tokens.slice(0,opening),allowQualified);
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

    static function readWords(tokens:Array<Token>,allowQualified:Bool = false):String {
        if (tokens.length == 0) throw new MiraError("Expected an identifier");
        final parts:Array<String> = [];
        for (token in tokens) {
            if (token.kind != Word) throw new MiraError("Expected an identifier word", token);
            if (token.value.indexOf(".") >= 0 && (!allowQualified || parts.length != 0))
                throw new MiraError("Qualification is allowed only at the start of a global name",token);
            parts.push(token.value);
        }
        return parts.join(" ");
    }
}
