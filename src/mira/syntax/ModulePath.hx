package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;

// A module/implements header has the same logical path grammar.
class ModulePath {
    public static function read(tokens:Array<Token>,start:Int):{path:String,next:Int} {
        final segments:Array<String> = [];
        var words:Array<String> = [];
        var cursor = start;
        while (tokens[cursor].kind != End && !tokens[cursor].isSymbol(";")) {
            final token = tokens[cursor++];
            if (token.kind == Word && token.value != "_") words.push(token.value);
            else if (token.isSymbol("/") && words.length > 0) {
                segments.push(words.join(" "));
                words = [];
            } else throw new MiraError("Expected discursive module path segment",token);
        }
        if (words.length == 0 || !tokens[cursor].isSymbol(";"))
            throw new MiraError("Expected module path and terminating ;",tokens[cursor]);
        segments.push(words.join(" "));
        return {path:segments.join(" / "),next:cursor+1};
    }
}
