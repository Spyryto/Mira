package mira.syntax;

import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.MiraError;
import mira.types.Type;
import mira.types.NumericRange;
import mira.types.TextChoices;

// Closed data annotations and the initial numeric refinement subset.
class TypeParser {
    final tokens:Array<Token>;
    final fallback:Token;
    var position = 0;
    final names:Map<String,Type>;
    final allowProjection:Bool;
    final grammarResolver:Null<String->mira.grammar.GrammarMachine>;

    public function new(tokens:Array<Token>, fallback:Token, ?names:Map<String,Type>, ?allowProjection:Bool = true,?grammarResolver:String->mira.grammar.GrammarMachine) {
        this.tokens = tokens;
        this.fallback = fallback;
        this.names = names == null ? new Map<String,Type>() : names;
        this.allowProjection = allowProjection;
        this.grammarResolver = grammarResolver;
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
        final projected = take("~");
        if (projected && !allowProjection) return fail("Structural projection is an annotation, not a nominal base");
        var type = readType(0);
        if (current() != null && current().kind == Word && current().value == "where") {
            if (projected) return fail("Refinement cannot refine a structural projection");
            position++;
            if (current() != null && current().kind == Word && current().value == "matches") {
                if (grammarResolver == null) return fail("Grammar refinement requires a flat nominal declaration");
                if (type != TextType) return fail("Grammar refinement currently requires Text as its direct base");
                position++;
                require(":");
                if (current() == null || current().kind != Word || current().value != "_") return fail("Expected _ in grammar refinement");
                position++;
                require(",");
                if (current() == null || current().kind != Word || current().value != "grammar") return fail("Expected grammar label");
                position++;
                require(":");
                final words:Array<String> = [];
                while (current() != null && current().kind == Word) words.push(tokens[position++].value);
                if (words.length == 0 || current() != null) return fail("Expected preceding grammar value name");
                final name = words.join(" ");
                type = GrammarRefinedType(name,grammarResolver(name));
            } else if (TextChoices.isText(type)) {
                if (mira.grammar.GrammarMachine.ofType(type) != null) return fail("Composed grammar refinements are not yet supported");
                final choices = readChoices();
                final inherited = TextChoices.ofType(type);
                if (inherited != null && inherited.intersect(choices).values.length == 0) return fail("Empty text refinement");
                type = TextRefinedType(type,choices);
            } else {
                final inherited = NumericRange.ofType(type);
                if (inherited == null) return fail("Refinement requires a Number or Text representation");
                final range = readRange();
                if ((NumericRange.integerType(type) ? inherited.intersect(range).integerHull() : inherited.intersect(range)).empty()) return fail("Empty numeric refinement");
                type = RefinedType(type,range);
            }
        }
        if (current() != null) fail("Unexpected token in type annotation");
        if (!projected) return type;
        return switch (type) {
            case NamedType(name,base):
                var shape = base;
                while (true) {
                    switch (shape) {
                        case NamedType(_,parent): shape = parent;
                        case RecordType(fields,null): return StructuralType(name,fields);
                        default: return fail("Structural projection requires a named record type");
                    }
                }
                fail("Structural projection requires a named record type");
            default: fail("Structural projection requires a named record type");
        };
    }

    // Initial predicate subset: conjunctions of comparisons against numeric
    // constants. All occurrences of _ refer to the same refined value.
    function readChoices():TextChoices {
        final values:Array<String> = [];
        while (true) {
            if (current() == null || current().kind != Word || current().value != "_")
                return fail("Expected _ in text refinement");
            position++;
            require("==");
            if (current() == null || current().kind != Text) return fail("Expected Text literal in text refinement");
            values.push(current().value);
            position++;
            if (!take("OR")) break;
        }
        return new TextChoices(values);
    }

    function readRange():NumericRange {
        var result = NumericRange.any();
        while (true) {
            if (current() == null || current().kind != Word || current().value != "_")
                return fail("Expected _ in numeric refinement");
            position++;
            final op = current();
            if (op == null || [">",">=","<","<=","=="].indexOf(op.value) < 0 || op.kind != Symbol)
                return fail("Expected numeric refinement comparison");
            position++;
            final negative = take("-");
            final value = current();
            if (value == null || value.kind != Number || !~/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.match(value.value))
                return fail("Expected decimal constant in numeric refinement");
            position++;
            final n = Std.parseFloat(value.value) * (negative ? -1 : 1);
            if (!Math.isFinite(n) || Math.abs(n) > 9007199254740991.0)
                return fail("Numeric refinement constant exceeds portable range");
            result = result.intersect(NumericRange.comparison(op.value,n));
            if (!take("AND")) break;
        }
        return result;
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
            final optional = new Map<String,Type>();
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
                    if (fields.exists(key) || optional.exists(key)) throw new MiraError("Duplicate type field " + key,token);
                    final target = take("?") ? optional : fields;
                    require(":");
                    target.set(key,readType(depth+1));
                    if (take("}")) break;
                    require(",");
                }
            }
            return optional.keys().hasNext() ? OptionalRecordType(fields,optional) : RecordType(fields,null);
        }
        final token = current();
        if (token == null || token.kind != Word) return fail("Expected a type annotation");
        final words:Array<String> = [];
        while (current() != null && current().kind == Word && current().value != "where") words.push(tokens[position++].value);
        final name = words.join(" ");
        return switch (name) {
            case "Number": NumberType;
            case "Integer": IntegerType;
            case "Text": TextType;
            case "Boolean": BooleanType;
            default:
                if (!names.exists(name)) throw new MiraError("Unknown annotation type " + name,token);
                final declared = names.get(name);
                switch (declared) {
                    case OpaqueType(_,parameters) | SumType(_,_,parameters) | SumReference(_,_,parameters) | ParametricNamedType(_,_,parameters) if (parameters.length > 0):
                        if (!take("(")) return fail("Type " + name + " requires " + parameters.length + " type arguments");
                        final arguments:Array<Type> = [];
                        for (i in 0...parameters.length) {
                            if (i > 0) require(",");
                            arguments.push(readType(depth+1));
                        }
                        require(")");
                        switch (declared) {
                            case SumReference(_,_,_):
                                // Regular self recursion only: preserve all type arguments in order.
                                for (i in 0...arguments.length) switch (arguments[i]) {
                                    case Variable(id) if (id == -i-1):
                                    default: return fail("Recursive sum must preserve its type parameters");
                                }
                            default:
                        }
                        mira.types.TypeTemplates.apply(declared,arguments);
                    default: declared;
                }
        };
    }
}
