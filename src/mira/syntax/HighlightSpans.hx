package mira.syntax;

import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.lex.Lexer;
import mira.resolve.Symbols;

// Optional presentation side channel. All positions use the existing lexer
// coordinates; nothing here changes ASTs, name resolution or generated code.
class HighlightSpans {
    public final spans:Array<Dynamic> = [];
    public function new() {}
    public function add(first:Token,last:Token,kind:String):Void {
        if (first.file != null || last.file != null) return;
        spans.push({kind:kind,line:first.line,column:first.column,endLine:last.endLine,endColumn:last.endColumn});
    }
    public function words(tokens:Array<Token>,start:Int,name:String,kind:String):Void {
        final count = name.split(" ").length;
        if (start >= 0 && start+count <= tokens.length)
            add(tokens[start],tokens[start+count-1],kind);
    }
    public function headers(source:String,definitions:Array<Definition>):Void {
        final tokens = new Lexer(source).tokenize();
        final indices = new Map<String,Int>();
        for (i in 0...tokens.length) indices.set(tokens[i].line+":"+tokens[i].column,i);
        for (d in definitions) {
            if (!d.isFunction() || d.origin.file != null || d.bodyTokens.length == 0) continue;
            final start = indices.get(d.origin.line+":"+d.origin.column);
            if (start == null) continue;
            var cursor:Int = start;
            for (j in 0...d.labels.length) {
                if (j >= d.parameterOrigins.length) break;
                final param = d.parameterOrigins[j];
                final end = indices.get(param.line+":"+param.column);
                if (end == null || end <= cursor) break;
                while (cursor < end && !Symbols.matchesWords(tokens,cursor,d.labels[j])) cursor++;
                if (cursor < end) {
                    final last = cursor + d.labels[j].split(" ").length;
                    if (last <= end) {
                        final colon = last < end && tokens[last].isSymbol(":");
                        add(tokens[cursor],tokens[colon ? last : last-1],"selector");
                        // Generic headers have annotations between label and ':'.
                        if (!colon && tokens[end-1].isSymbol(":")) add(tokens[end-1],tokens[end-1],"selector");
                    }
                }
                words(tokens,end,d.parameters[j],"parameter");
                cursor = end + d.parameters[j].split(" ").length;
                // Skip the optional type annotation before the next label.
                if (cursor < tokens.length && tokens[cursor].isSymbol("(")) {
                    var depth=0;
                    do {
                        if (tokens[cursor].isSymbol("(")) depth++;
                        if (tokens[cursor].isSymbol(")")) depth--;
                        cursor++;
                    } while (cursor < tokens.length && depth>0);
                }
            }
        }
    }
}
