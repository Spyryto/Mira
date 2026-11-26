package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;

typedef ExportReference = {
    final name:String;
    final origin:Token;
}

// Parse only module-level directives. Bodies retain their original tokens
// and are handled by the existing definition and expression parsers.
class ModuleSections {
    public final references:Array<ExportReference> = [];
    public final typeTokens:Array<Token> = [];
    public final imports:Array<Token> = [];
    public final bodyOffset:Int;

    public function new(tokens:Array<Token>, start:Int) {
        var cursor = start + 1; // interface
        var importing = false;
        final seen = new Map<String,Bool>();
        while (tokens[cursor].kind != End) {
            final anchor = tokens[cursor];
            if (anchor.kind == Word && anchor.value == "implementation") {
                bodyOffset = cursor + 1;
                typeTokens.push(tokens[tokens.length-1]);
                return;
            }
            if (anchor.kind == Word && anchor.value == "interface")
                throw new MiraError("Duplicate interface section",anchor);
            final begin = cursor;
            var depth = 0;
            var marker = -1;
            var selector = false;
            while (tokens[cursor].kind != End) {
                final token = tokens[cursor];
                if (depth == 0 && token.isSymbol(";")) break;
                if (depth == 0 && token.isSymbol("::")) marker = cursor;
                if (depth == 0 && token.isSymbol(":") && marker < 0) selector = true;
                if (token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{")) depth++;
                if (token.isSymbol(")") || token.isSymbol("]") || token.isSymbol("}")) depth--;
                cursor++;
            }
            if (!tokens[cursor].isSymbol(";") || begin == cursor)
                throw new MiraError("Expected interface declaration followed by ;",anchor);
            final item = tokens.slice(begin,cursor);
            cursor++;
            if (anchor.kind == Word && anchor.value == "import") {
                if (item.length != 2 || item[1].kind != Text)
                    throw new MiraError("Logical and selective imports are not implemented yet",anchor);
                importing = true;
                for (token in tokens.slice(begin,cursor)) imports.push(token);
                continue;
            }
            if (importing) throw new MiraError("Interface exports must precede imports",anchor);
            if (anchor.kind == Word && anchor.value == "export")
                throw new MiraError("Re-exports are not implemented yet",anchor);
            if (marker >= 0 && !selector && anchor.kind == Word) {
                // Nominal definitions in the interface reuse DefinitionParser.
                for (token in tokens.slice(begin,cursor)) typeTokens.push(token);
            } else {
                final name = reference(item);
                if (seen.exists(name)) throw new MiraError("Duplicate interface export " + name,anchor);
                seen.set(name,true);
                references.push({name:name,origin:anchor});
            }
        }
        throw new MiraError("Expected implementation section",tokens[cursor]);
    }

    static function reference(tokens:Array<Token>):String {
        final labels:Array<String> = [];
        var words:Array<String> = [];
        for (token in tokens) {
            if (token.kind == Word && token.value != "_") words.push(token.value);
            else if (token.isSymbol(":") && words.length > 0) {
                labels.push(words.join(" "));
                words = [];
            } else throw new MiraError("Expected an unannotated export name or selector; explicit signatures are not implemented yet",token);
        }
        if (labels.length == 0 && words.length > 0) return words.join(" ");
        if (labels.length > 0 && words.length == 0) return labels.join(":") + ":";
        throw new MiraError("Expected complete export selector",tokens[0]);
    }
}
