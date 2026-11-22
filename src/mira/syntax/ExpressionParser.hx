package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.resolve.SelectorResolver;
import mira.resolve.Symbols;

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
        var left = application();

        // The existing Mira binary operators and pipeline share one level,
        // all grouping left. Unary application binds before these operators.
        while (current().kind == Symbol && isOperator(current().value)) {
            final token = consume();
            final right = application();
            if (token.value == "~") {
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
                    case Numeric(_) | Text(_) | BooleanLiteral(_) | Binary(_, _, _) | Placeholder:
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
                | HostSection(_, _) | OperatorSection(_, _, _) | Apply(_, _): true;
            default: false;
        };
    }

    function primary():Expr {
        final token = current();
        if (token.isSymbol("[")) return sequence();
        if (token.isSymbol("{")) return record();
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
        if (token.value == "if" && tokens[position + 1].isSymbol(":")) {
            return conditional();
        }
        if (token.value == "_") {
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

    // Fully parenthesized branches make boundaries unambiguous with
    // multiword names and selectors. Both emitters evaluate only one branch.
    function conditional():Expr {
        consume(); // if
        requireSymbol(":");
        final predicate = parenthesizedBranch("if");
        if (current().isSymbol(",")) consume();
        requireWord("then");
        requireSymbol(":");
        final whenTrue = parenthesizedBranch("then");
        if (current().isSymbol(",")) consume();
        requireWord("else");
        requireSymbol(":");
        final whenFalse = parenthesizedBranch("else");
        return Conditional(predicate, whenTrue, whenFalse);
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

    function record():Expr {
        consume(); // {
        final keys:Array<String> = [];
        final values:Array<Expr> = [];
        while (!current().isSymbol("}")) {
            final keyToken = current();
            if (keyToken.kind != Word && keyToken.kind != Text) {
                throw new MiraError("Expected record key", keyToken);
            }
            final key = consume().value;
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
                isPlaceholder(left) || isPlaceholder(right)
                    ? OperatorSection(symbol, left, right) : expr;
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
        return ["+", "-", "*", "/", "%", "~", "==", "!=", "<", ">", "<=", ">="].indexOf(value) >= 0;
    }
}
