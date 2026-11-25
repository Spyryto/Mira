package mira.resolve;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.syntax.Definition;

// Selector matching is structural. It never consults inferred argument types.
// No exception-driven backtracking: incomplete patterns simply do not match.
class SelectorMatch {
    public final selector:String;
    public final arguments:Array<Array<Token>>;
    public final end:Int;

    public function new(selector:String, arguments:Array<Array<Token>>, end:Int) {
        this.selector = selector;
        this.arguments = arguments;
        this.end = end;
    }
}

class SelectorResolver {
    final symbols:Symbols;

    public function new(symbols:Symbols) {
        this.symbols = symbols;
    }

    public function match(tokens:Array<Token>, start:Int):Null<SelectorMatch> {
        final candidates = symbols.matchingFunctions(tokens, start);
        final matches:Array<SelectorMatch> = [];

        for (definition in candidates) {
            final result = matchDefinition(tokens, start, definition);
            if (result != null) matches.push(result);
        }

        if (matches.length == 0) return null;

        matches.sort(function(a, b) return b.end - a.end);
        final best = matches[0];

        for (other in matches) {
            if (other != best && other.end == best.end) {
                throw new MiraError(
                    "Ambiguous selector call: " + best.selector + " or " + other.selector,
                    tokens[start]
                );
            }
        }
        return best;
    }

    function matchDefinition(tokens:Array<Token>, start:Int, definition:Definition):Null<SelectorMatch> {
        var cursor = start;
        final arguments:Array<Array<Token>> = [];

        for (labelIndex in 0...definition.labels.length) {
            final label = definition.labels[labelIndex];

            if (!Symbols.matchesWords(tokens, cursor, label)) return null;
            cursor += label.split(" ").length;

            final punctuated = cursor < tokens.length && tokens[cursor].isSymbol(":");
            if (punctuated) cursor++;

            if (cursor >= tokens.length) return null;
            final token = tokens[cursor];
            var argument:Array<Token> = [];

            if (token.isSymbol("(") || token.isSymbol("{") || token.isSymbol("[")) {
                // A braced block or record is already a self-delimited expression.
                // Preserve its delimiters for ExpressionParser; only parentheses
                // are grouping syntax and must be removed here.
                final isGrouping = token.isSymbol("(");
                final open = token.value;
                final close = open == "(" ? ")" : open == "{" ? "}" : "]";
                final begin = isGrouping ? cursor + 1 : cursor;
                cursor++;
                var depth = 1;
                while (cursor < tokens.length && depth > 0) {
                    if (tokens[cursor].isSymbol(open)) depth++;
                    if (tokens[cursor].isSymbol(close)) depth--;
                    if (depth > 0) cursor++;
                }
                if (depth != 0 || (isGrouping && cursor == begin)) return null;
                argument = tokens.slice(begin, isGrouping ? cursor : cursor + 1);
                cursor++; // after the matching delimiter
            } else if (token.kind == Number || token.kind == Text) {
                argument = [token];
                cursor++;
            } else if (punctuated && token.kind == Word) {
                final begin = cursor;
                final nextLabel = labelIndex + 1 < definition.labels.length
                    ? definition.labels[labelIndex + 1]
                    : null;

                while (cursor < tokens.length && tokens[cursor].kind == Word) {
                    // A complete next label followed by ':' delimits this argument.
                    if (nextLabel != null && cursor > begin
                        && Symbols.matchesWords(tokens, cursor, nextLabel)) {
                        final afterLabel = cursor + nextLabel.split(" ").length;
                        if (afterLabel < tokens.length && tokens[afterLabel].isSymbol(":")) break;
                    }
                    cursor++;
                }
                argument = tokens.slice(begin, cursor);
            } else {
                // Without ':', a bare multiword name has no clear boundary.
                return null;
            }

            if (argument.length == 0) return null;
            arguments.push(argument);

            if (labelIndex < definition.labels.length - 1
                && cursor < tokens.length && tokens[cursor].isSymbol(",")) {
                cursor++;
            }
        }

        return new SelectorMatch(definition.selector(), arguments, cursor);
    }
}
