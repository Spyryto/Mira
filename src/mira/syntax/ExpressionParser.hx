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

    public function new(tokens:Array<Token>, symbols:Symbols, localNames:Array<String>) {
        this.tokens = tokens.copy();
        final last = tokens.length > 0 ? tokens[tokens.length - 1] : new Token(End, "", 1, 1);
        this.tokens.push(new Token(End, "", last.line, last.column));
        this.symbols = symbols;
        this.localNames = localNames;
        this.selectorResolver = new SelectorResolver(symbols);
    }

    public function parse():Expr {
        final result = expression();
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
                    case Numeric(_) | Text(_) | Binary(_, _, _) | Placeholder:
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
            || token.isSymbol("(");
    }

    static function isPotentialCallable(expr:Expr):Bool {
        return switch (expr) {
            case Name(_) | HostRef(_) | Call(_, _) | HostCall(_, _) | Section(_, _)
                | HostSection(_, _) | Apply(_, _): true;
            default: false;
        };
    }

    function primary():Expr {
        final token = current();
        if (token.isSymbol("(")) {
            consume();
            final inner = expression();
            if (!current().isSymbol(")")) throw new MiraError("Expected closing )", current());
            consume();
            return inner;
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
        if (token.value == "_") {
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
                    args.push(new ExpressionParser(argumentTokens, symbols, localNames).parse());
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

    function current():Token {
        return tokens[position];
    }

    function consume():Token {
        return tokens[position++];
    }

    static function isPlaceholder(expr:Expr):Bool {
        return switch (expr) {
            case Placeholder: true;
            default: false;
        };
    }

    static function isOperator(value:String):Bool {
        return ["+", "-", "*", "/", "%", "~"].indexOf(value) >= 0;
    }
}
