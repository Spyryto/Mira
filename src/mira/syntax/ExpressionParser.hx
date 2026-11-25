package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.resolve.SelectorResolver;
import mira.resolve.Symbols;
import mira.resolve.Mangle;

class ExpressionParser {
    final tokens:Array<Token>;
    final symbols:Symbols;
    final selectorResolver:SelectorResolver;
    final localNames:Array<String>;
    var position:Int = 0;
    var operatorDepth:Int = 0;
    final allowOperatorArgument:Bool;

    public function new(tokens:Array<Token>, symbols:Symbols, localNames:Array<String>, ?allowOperatorArgument:Bool = false) {
        this.tokens = tokens.copy();
        final last = tokens.length > 0 ? tokens[tokens.length - 1] : new Token(End, "", 1, 1);
        this.tokens.push(new Token(End, "", last.line, last.column));
        this.symbols = symbols;
        this.localNames = localNames;
        this.allowOperatorArgument = allowOperatorArgument;
        this.selectorResolver = new SelectorResolver(symbols);
    }

    public function parse():Expr {
        final parsed = expression();
        final result = allowOperatorArgument ? sectionify(parsed) : parsed;
        if (current().kind != End) {
            throw new MiraError("Unexpected token " + current().value, current());
        }
        return result;
    }

    function expression():Expr {
        var left = fieldAccess();

        // Arithmetic, comparisons, and >> keep their existing
        // left-to-right grouping. Only ~ binds more tightly.
        while (current().kind == Symbol && isOperator(current().value)) {
            final token = consume();
            final right = fieldAccess();
            if (token.value == ">>") {
                switch (right) {
                    case Section(_, args) | HostSection(_, args):
                        var holes = 0;
                        for (arg in args) if (isPlaceholder(arg)) holes++;
                        if (holes != 1) {
                            throw new MiraError("Pipeline needs a unary section; this section has "
                                + holes + " holes", token);
                        }
                    case OperatorSection(_, sectionLeft, sectionRight):
                        final holes = (isPlaceholder(sectionLeft) ? 1 : 0)
                            + (isPlaceholder(sectionRight) ? 1 : 0);
                        if (holes != 1) {
                            throw new MiraError("Pipeline needs a unary operator section; this section has "
                                + holes + " holes", token);
                        }
                    case Block(parameters, _):
                        if (parameters.length != 1) {
                            throw new MiraError("Pipeline needs a unary block; this block has "
                                + parameters.length + " parameters", token);
                        }
                    case Numeric(_) | Text(_) | BooleanLiteral(_) | Binary(_, _, _) | Placeholder
                        | FieldGet(_, _):
                        throw new MiraError("Pipeline target must be a function", token);
                    default:
                }
                left = Apply(right, left);
            } else {
                left = Binary(token.value, left, right);
            }
        }
        return left;
    }

    // A field lookup is a postfix operator: a ~ b ~ c means
    // (a ~ b) ~ c, and it binds before all arithmetic operators.
    function fieldAccess():Expr {
        var left = application();
        while (current().isSymbol("~")) {
            consume();
            left = FieldGet(left, literalKey("Expected a field name after ~"));
        }
        return left;
    }

    // Juxtaposition is unary function application: log "hello", double (x).
    // It never consumes operators and never consults inferred types.
    function application():Expr {
        var callee = primary();
        while (startsPrimary(current()) && isPotentialCallable(callee)) {
            final argument = primary();
            callee = Apply(callee, argument);
        }
        return callee;
    }

    static function startsPrimary(token:Token):Bool {
        return token.kind == Word || token.kind == Number || token.kind == Text
            || token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{");
    }

    static function isPotentialCallable(expr:Expr):Bool {
        return switch (expr) {
            case Name(_) | HostRef(_) | Call(_, _) | HostCall(_, _) | Section(_, _)
                | HostSection(_, _) | OperatorSection(_, _, _) | FieldSection(_)
                | Block(_, _) | Apply(_, _): true;
            default: false;
        };
    }

    function primary():Expr {
        final token = current();
        if (token.isSymbol("[")) return sequence();
        if (token.isSymbol("{")) return isBlockStart() ? block() : record();
        if (token.isSymbol("(")) {
            consume();
            operatorDepth++;
            final inner = expression();
            operatorDepth--;
            if (!current().isSymbol(")")) throw new MiraError("Expected closing )", current());
            consume();
            return sectionify(inner);
        }
        if (token.kind == Number) {
            consume();
            return Numeric(token.value);
        }
        if (token.kind == Text) {
            consume();
            return Text(token.value);
        }
        if (token.kind != Word) throw new MiraError("Expected expression", token);
        // Native, typed-independent Boolean/record features; no host dispatch.
        if (token.value == "true" || token.value == "false") {
            consume();
            return BooleanLiteral(token.value == "true");
        }
        if (token.value == "field" && tokens[position + 1].kind == Text) {
            consume(); // field
            final key = consume().value;
            return FieldAccessor(key);
        }
        if (token.value == "if" && (tokens[position + 1].isSymbol(":")
            || tokens[position + 1].isSymbol("("))) {
            return conditional();
        }
        if (token.value == "_") {
            // Inside an explicit {_ | body} block, every _ is the SAME
            // lexical variable, not a new implicit section parameter.
            if (localNames.indexOf("_") >= 0) {
                consume();
                return Name("_");
            }
            if (operatorDepth > 0 || allowOperatorArgument) {
                consume();
                return Placeholder;
            }
            throw new MiraError("Placeholder '_' must be a complete keyword-selector argument", token);
        }

        final matched = selectorResolver.match(tokens, position);
        if (matched != null) {
            position = matched.end;
            final args:Array<Expr> = [];
            var holes = 0;
            for (argumentTokens in matched.arguments) {
                if (argumentTokens.length == 1 && argumentTokens[0].kind == Word
                    && argumentTokens[0].value == "_") {
                    args.push(Placeholder);
                    holes++;
                } else {
                    args.push(new ExpressionParser(argumentTokens, symbols, localNames, true).parse());
                }
            }
            if (symbols.isHostSelector(matched.selector)) {
                return holes == 0 ? HostCall(matched.selector, args)
                    : HostSection(matched.selector, args);
            }
            return holes == 0 ? Call(matched.selector, args) : Section(matched.selector, args);
        }

        final name = symbols.resolveName(tokens, position, localNames);
        if (name != null) {
            position += name.split(" ").length;
            // Local parameter shadows an external name if explicitly present.
            if (localNames.indexOf(name) == -1 && symbols.isHostName(name)) {
                return HostRef(name);
            }
            return Name(name);
        }
        throw new MiraError(
            "Unknown identifier or incomplete selector; register host names explicitly",
            token
        );
    }

    // Like keyword selectors, ':' and ',' are optional separators.
    // All forms lower to the same native, lazy Conditional AST:
    // if: (test), then: (yes), else: (no)
    // if (test), then: (yes), else: (no)
    // if (test) then yes else no
    // Parenthesize nested conditionals to make boundaries unambiguous.
    function conditional():Expr {
        consume(); // if
        optionalSymbol(":");
        final predicate = parenthesizedBranch("if");
        optionalSymbol(",");
        requireWord("then");
        optionalSymbol(":");

        final start = position;
        var depth = 0;
        while (current().kind != End) {
            final token = current();
            if (depth == 0 && token.kind == Word && token.value == "else") break;
            if (depth == 0 && token.isSymbol(",")
                && tokens[position + 1].kind == Word && tokens[position + 1].value == "else") break;
            if (depth == 0 && (token.isSymbol(";") || token.isSymbol(")")
                || token.isSymbol("]") || token.isSymbol("}"))) break;
            if (token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{")) {
                depth++;
            } else if (token.isSymbol(")") || token.isSymbol("]") || token.isSymbol("}")) {
                depth--;
            }
            consume();
        }
        if (start == position) throw new MiraError("Expected then expression", current());
        final whenTrue = new ExpressionParser(tokens.slice(start, position), symbols,
            localNames, allowOperatorArgument).parse();

        optionalSymbol(",");
        requireWord("else");
        optionalSymbol(":");
        if (current().kind == End || current().isSymbol(";") || current().isSymbol(",")
            || current().isSymbol(")") || current().isSymbol("]") || current().isSymbol("}")) {
            throw new MiraError("Expected else expression", current());
        }
        final whenFalse = expression();
        return Conditional(predicate, whenTrue, whenFalse);
    }

    function optionalSymbol(value:String):Void {
        if (current().isSymbol(value)) consume();
    }

    function parenthesizedBranch(label:String):Expr {
        if (!current().isSymbol("(")) {
            throw new MiraError(label + " requires a parenthesized expression", current());
        }
        consume();
        final branch = expression();
        requireSymbol(")");
        return branch;
    }

    function requireWord(expected:String):Void {
        if (current().kind != Word || current().value != expected) {
            throw new MiraError("Expected " + expected + " branch", current());
        }
        consume();
    }

    function requireSymbol(expected:String):Void {
        if (!current().isSymbol(expected)) {
            throw new MiraError("Expected " + expected, current());
        }
        consume();
    }

    // Data literals are deliberately expression-level constructs, not host APIs.
    // They keep exactly the same meaning on JS and PHP.
    function sequence():Expr {
        consume(); // [
        final items:Array<Expr> = [];
        while (!current().isSymbol("]")) {
            if (current().kind == End) throw new MiraError("Unclosed list literal", current());
            items.push(expression());
            if (current().isSymbol("]")) break;
            if (!current().isSymbol(",")) throw new MiraError("Expected , or ]", current());
            consume();
            if (current().isSymbol("]")) throw new MiraError("Trailing comma in list", current());
        }
        consume(); // ]
        return Sequence(items);
    }

    // A sequence of one or more parameter names separated by commas and
    // followed by | distinguishes a block from a record, without guessing.
    function isBlockStart():Bool {
        var cursor = position + 1;
        if (tokens[cursor].kind != Word) return false;
        while (true) {
            while (tokens[cursor].kind == Word) cursor++;
            if (tokens[cursor].isSymbol("|")) return true;
            if (!tokens[cursor].isSymbol(",")) return false;
            cursor++;
            if (tokens[cursor].kind != Word) return false;
        }
        return false;
    }

    // A block has one or more parameters and expressions separated by ';'.
    // Names can have spaces. Repeated _ refers to a single bound parameter.
    function block():Expr {
        consume(); // {
        final parameters:Array<String> = [];
        final emitted:Array<String> = [];
        while (true) {
            final parameterToken = current();
            final words:Array<String> = [];
            while (current().kind == Word) words.push(consume().value);
            if (words.length == 0) {
                throw new MiraError("Expected block parameter", parameterToken);
            }
            final parameter = words.join(" ");
            final symbol = Mangle.name(parameter);
            if (symbol == "__miraHost") {
                throw new MiraError("Reserved block parameter __miraHost", parameterToken);
            }
            if (parameters.indexOf(parameter) >= 0 || emitted.indexOf(symbol) >= 0) {
                throw new MiraError("Duplicate or conflicting block parameter " + parameter,
                    parameterToken);
            }
            parameters.push(parameter);
            emitted.push(symbol);
            if (!current().isSymbol(",")) break;
            consume();
        }
        requireSymbol("|");
        for (parameter in parameters) localNames.unshift(parameter);
        final expressions:Array<Expr> = [];
        if (current().isSymbol("}")) {
            throw new MiraError("A block needs at least one expression", current());
        }
        final bindings:Array<String> = [];
        final taken = emitted.copy();
        while (true) {
            final nameEnd = localAssignmentEnd();
            if (nameEnd >= 0) {
                final nameToken = current();
                final nameParts:Array<String> = [];
                while (position < nameEnd) nameParts.push(consume().value);
                final name = nameParts.join(" ");
                final symbol = Mangle.name(name);
                if (symbol == "__miraHost") {
                    throw new MiraError("Reserved local name __miraHost", nameToken);
                }
                var shadowsOuter = false;
                for (outer in localNames.concat(symbols.globals)) {
                    if (Mangle.name(outer) == symbol) shadowsOuter = true;
                }
                if (taken.indexOf(symbol) >= 0 || shadowsOuter) {
                    throw new MiraError("Duplicate or shadowed local name " + name, nameToken);
                }
                consume(); // =
                if (current().isSymbol(";") || current().isSymbol("}")) {
                    throw new MiraError("Expected value for local " + name, current());
                }
                // The initializer is resolved before this name comes into scope.
                final value = expression();
                expressions.push(Expr.Local(name, value));
                taken.push(symbol);
                localNames.unshift(name);
                bindings.push(name);
                if (current().isSymbol("}")) {
                    throw new MiraError("A block must end with a value expression", current());
                }
                if (!current().isSymbol(";")) {
                    throw new MiraError("Expected ; after local " + name, current());
                }
                consume();
                if (current().isSymbol("}")) {
                    throw new MiraError("A block must end with a value expression", current());
                }
            } else {
                expressions.push(expression());
                if (!current().isSymbol(";")) break;
                consume();
                // A single trailing ';' is allowed after the final expression.
                if (current().isSymbol("}")) break;
            }
        }
        for (_ in bindings) localNames.shift();
        for (_ in parameters) localNames.shift();
        requireSymbol("}");
        final body:Expr = expressions.length == 1 ? expressions[0] : Expr.Steps(expressions);
        return Block(parameters, body);
    }

    // Recognize only an initial sequence of words immediately followed
    // by '='. Comparisons '==' and calls remain ordinary expressions.
    function localAssignmentEnd():Int {
        var cursor = position;
        if (tokens[cursor].kind != Word) return -1;
        while (tokens[cursor].kind == Word) cursor++;
        return tokens[cursor].isSymbol("=") ? cursor : -1;
    }

    function record():Expr {
        consume(); // {
        final keys:Array<String> = [];
        final values:Array<Expr> = [];
        while (!current().isSymbol("}")) {
            final keyToken = current();
            final key = literalKey("Expected record key");
            if (keys.indexOf(key) >= 0) throw new MiraError("Duplicate record key " + key, keyToken);
            if (!current().isSymbol(":")) throw new MiraError("Expected : after record key", current());
            consume();
            keys.push(key);
            values.push(expression());
            if (current().isSymbol("}")) break;
            if (!current().isSymbol(",")) throw new MiraError("Expected , or }", current());
            consume();
            if (current().isSymbol("}")) throw new MiraError("Trailing comma in record", current());
        }
        consume(); // }
        return Record(keys, values);
    }

    // Shared grammar for record literals and ~ field access.
    // Unquoted consecutive words form one literal key, never a variable.
    function literalKey(diagnostic:String):String {
        final first = current();
        if (first.kind == Text) return consume().value;
        if (first.kind != Word) throw new MiraError(diagnostic, first);
        final words:Array<String> = [];
        while (current().kind == Word) words.push(consume().value);
        return words.join(" ");
    }

    function current():Token {
        return tokens[position];
    }

    function consume():Token {
        return tokens[position++];
    }

    // Parenthesized binary expressions can be functions without a new lambda
    // grammar. The holes must be direct operands; grouping stays explicit.
    function sectionify(expr:Expr):Expr {
        return switch (expr) {
            case Binary(symbol, left, right):
                switch ([left, right]) {
                    case [FieldGet(Placeholder, _), _] | [_, FieldGet(Placeholder, _)]:
                        throw new MiraError("Complex placeholders require blocks; use a named function for now", current());
                    default:
                }
                isPlaceholder(left) || isPlaceholder(right)
                    ? OperatorSection(symbol, left, right) : expr;
            case FieldGet(Placeholder, key):
                FieldSection(key);
            case Placeholder:
                throw new MiraError("Placeholder '_' requires an operator section", current());
            default: expr;
        };
    }

    static function isPlaceholder(expr:Expr):Bool {
        return switch (expr) {
            case Placeholder: true;
            default: false;
        };
    }

    static function isOperator(value:String):Bool {
        return ["+", "-", "*", "/", "%", ">>", "==", "!=", "<", ">", "<=", ">="].indexOf(value) >= 0;
    }
}
