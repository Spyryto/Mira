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

        // All supported binary operators have the same precedence and group left.
        while (current().kind == Symbol && isOperator(current().value)) {
            final symbol = consume().value;
            final right = primary();
            left = Binary(symbol, left, right);
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

        final selectorMatch = selectorResolver.match(tokens, position);
        if (selectorMatch != null) {
            position = selectorMatch.end;
            final arguments:Array<Expr> = [];
            for (argumentTokens in selectorMatch.arguments) {
                arguments.push(new ExpressionParser(argumentTokens, symbols, localNames).parse());
            }
            return Call(selectorMatch.selector, arguments);
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

    static function isOperator(value:String):Bool {
        return ["+", "-", "*", "/", "%"].indexOf(value) >= 0;
    }
}
