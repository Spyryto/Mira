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
        var left = primary();

        // Operators share one precedence level and group left-to-right.
        // A pipeline supplies its left value as the argument of its right function.
        while (current().kind == Symbol && isOperator(current().value)) {
            final operatorToken = consume();
            final right = primary();

            if (operatorToken.value == "~") {
                switch (right) {
                    case Section(_, arguments):
                        var missing = 0;
                        for (argument in arguments) {
                            if (isPlaceholder(argument)) missing++;
                        }
                        if (missing != 1) {
                            throw new MiraError(
                                "Pipeline needs a unary section; this section has " + missing + " holes",
                                operatorToken
                            );
                        }
                    case Numeric(_) | Text(_) | Binary(_, _, _) | Placeholder:
                        throw new MiraError("Pipeline target must be a function", operatorToken);
                    default:
                }
                left = Apply(right, left);
            } else {
                left = Binary(operatorToken.value, left, right);
            }
        }
        return left;
    }

    function primary():Expr {
        final token = current();

        if (token.isSymbol("(")) {
            consume();
            final inner = expression();
            if (!current().isSymbol(")")) {
                throw new MiraError("Expected closing )", current());
            }
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

        if (token.kind != Word) {
            throw new MiraError("Expected expression", token);
        }

        if (token.value == "_") {
            throw new MiraError(
                "Placeholder '_' must be a complete keyword-selector argument",
                token
            );
        }

        final selectorMatch = selectorResolver.match(tokens, position);
        if (selectorMatch != null) {
            position = selectorMatch.end;
            final arguments:Array<Expr> = [];
            var holeCount = 0;

            for (argumentTokens in selectorMatch.arguments) {
                if (argumentTokens.length == 1 && argumentTokens[0].kind == Word
                    && argumentTokens[0].value == "_") {
                    arguments.push(Placeholder);
                    holeCount++;
                } else {
                    arguments.push(new ExpressionParser(
                        argumentTokens, symbols, localNames
                    ).parse());
                }
            }

            return holeCount > 0
                ? Section(selectorMatch.selector, arguments)
                : Call(selectorMatch.selector, arguments);
        }

        final name = symbols.resolveName(tokens, position, localNames);
        if (name != null) {
            position += name.split(" ").length;
            return Name(name);
        }

        throw new MiraError(
            "Unknown identifier or incomplete selector; use explicit labels and parentheses",
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
