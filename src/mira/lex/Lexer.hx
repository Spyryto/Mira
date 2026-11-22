package mira.lex;

import mira.MiraError;
import mira.lex.Token.TokenKind;

class Lexer {
    final source:String;
    var offset:Int = 0;
    var line:Int = 1;
    var column:Int = 1;

    public function new(source:String) {
        this.source = source;
    }

    public function tokenize():Array<Token> {
        final tokens:Array<Token> = [];

        while (offset < source.length) {
            final character = current();

            if (isWhitespace(character)) {
                advance();
                continue;
            }

            if (character == "#") {
                while (offset < source.length && current() != "\n") {
                    advance();
                }
                continue;
            }

            final tokenLine = line;
            final tokenColumn = column;

            if (isLetter(character) || character == "_") {
                final start = offset;
                while (isLetter(current()) || isDigit(current()) || current() == "_") {
                    advance();
                }
                tokens.push(new Token(Word, source.substring(start, offset), tokenLine, tokenColumn));
                continue;
            }

            if (isDigit(character)) {
                final start = offset;
                while (isDigit(current())) {
                    advance();
                }
                if (current() == "." && isDigit(peek(1))) {
                    advance();
                    while (isDigit(current())) {
                        advance();
                    }
                }
                tokens.push(new Token(Number, source.substring(start, offset), tokenLine, tokenColumn));
                continue;
            }

            if (character == '"') {
                final start = offset;
                advance();
                var escaped = false;
                var closed = false;

                while (offset < source.length) {
                    final ch = current();
                    advance();
                    if (!escaped && ch == '"') {
                        closed = true;
                        break;
                    }
                    if (!escaped && ch == "\\") {
                        escaped = true;
                    } else {
                        escaped = false;
                    }
                }

                if (!closed) {
                    throw new MiraError("Unterminated string", new Token(Text, "", tokenLine, tokenColumn));
                }
                final raw = source.substring(start, offset);
                var decoded:String;
                try {
                    decoded = haxe.Json.parse(raw);
                } catch (error:Dynamic) {
                    throw new MiraError("Invalid string literal", new Token(Text, "", tokenLine, tokenColumn));
                }
                tokens.push(new Token(Text, decoded, tokenLine, tokenColumn));
                continue;
            }

            final pair = character + peek(1);
            if (["==", "!=", "<=", ">=", "&&", "||"].indexOf(pair) != -1) {
                advance();
                advance();
                tokens.push(new Token(Symbol, pair, tokenLine, tokenColumn));
                continue;
            }

            if ("()[]{}:,;=+-*/%<>~!|".indexOf(character) != -1) {
                advance();
                tokens.push(new Token(Symbol, character, tokenLine, tokenColumn));
                continue;
            }

            throw new MiraError(
                "Unexpected character " + haxe.Json.stringify(character),
                new Token(Symbol, character, tokenLine, tokenColumn)
            );
        }

        tokens.push(new Token(End, "", line, column));
        return tokens;
    }

    function current():String {
        return peek(0);
    }

    function peek(distance:Int):String {
        return source.charAt(offset + distance);
    }

    function advance():Void {
        if (current() == "\n") {
            line++;
            column = 1;
        } else {
            column++;
        }
        offset++;
    }

    static function isLetter(value:String):Bool {
        if (value.length != 1) return false;
        final code = value.charCodeAt(0);
        return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    }

    static function isDigit(value:String):Bool {
        if (value.length != 1) return false;
        final code = value.charCodeAt(0);
        return code >= 48 && code <= 57;
    }

    static function isWhitespace(value:String):Bool {
        return value == " " || value == "\n" || value == "\r" || value == "\t";
    }
}
