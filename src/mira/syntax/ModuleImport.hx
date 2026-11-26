package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;

typedef ImportedName = {
    final name:String;
    final alias:String;
    final origin:Token;
}

class ModuleImport {
    public final path:String;
    public final names:Array<ImportedName> = [];
    public final wildcard:Bool;
    public final next:Int;

    public function new(tokens:Array<Token>,start:Int) {
        var cursor = start + 1;
        final segments:Array<Array<Token>> = [];
        var part:Array<Token> = [];
        while (tokens[cursor].kind != End && !tokens[cursor].isSymbol("{") && !tokens[cursor].isSymbol(";")) {
            final token = tokens[cursor++];
            if (token.isSymbol("/")) {
                if (part.length == 0) throw new MiraError("Empty module path segment",token);
                segments.push(part);
                part = [];
            } else part.push(token);
        }
        if (part.length == 0) throw new MiraError("Expected module path",tokens[cursor]);
        segments.push(part);
        final grouped = tokens[cursor].isSymbol("{");
        if (!grouped) {
            if (segments.length < 2) throw new MiraError("Expected selective import group or module / symbol",tokens[start]);
            names.push(readName(segments.pop()));
        }
        path = [for (segment in segments) pathPart(segment)].join(" / ");
        var all = false;
        if (grouped) {
            cursor++;
            if (tokens[cursor].isSymbol("*")) {
                all = true;
                cursor++;
                if (tokens[cursor].isSymbol(";")) cursor++;
            } else {
                while (tokens[cursor].kind != End && !tokens[cursor].isSymbol("}")) {
                    final begin = cursor;
                    while (tokens[cursor].kind != End && !tokens[cursor].isSymbol(";") && !tokens[cursor].isSymbol("}")) cursor++;
                    if (!tokens[cursor].isSymbol(";") || begin == cursor)
                        throw new MiraError("Expected imported symbol followed by ;",tokens[begin]);
                    names.push(readName(tokens.slice(begin,cursor)));
                    cursor++;
                }
            }
            if (!tokens[cursor].isSymbol("}")) throw new MiraError("Expected } after imports",tokens[cursor]);
            cursor++;
        }
        if (!all && names.length == 0) throw new MiraError("Empty import group",tokens[start]);
        if (!tokens[cursor].isSymbol(";")) throw new MiraError("Expected ; after import",tokens[cursor]);
        wildcard = all;
        next = cursor + 1;
    }

    static function pathPart(tokens:Array<Token>):String {
        for (token in tokens)
            if (token.kind != Word || token.value == "_")
                throw new MiraError("Expected discursive module path segment",token);
        return [for (token in tokens) token.value].join(" ");
    }

    static function readName(tokens:Array<Token>):ImportedName {
        var arrow = -1;
        for (i in 0...tokens.length) if (tokens[i].isSymbol("=>")) {
            if (arrow >= 0) throw new MiraError("Duplicate import alias",tokens[i]);
            arrow = i;
        }
        if (arrow == 0 || arrow == tokens.length-1)
            throw new MiraError("Expected names on both sides of =>",tokens[0]);
        final name = ModuleSections.reference(arrow < 0 ? tokens : tokens.slice(0,arrow));
        final alias = arrow < 0 ? name : ModuleSections.reference(tokens.slice(arrow+1));
        if (name.split(":").length != alias.split(":").length)
            throw new MiraError("Import alias must preserve selector arity",tokens[0]);
        return {name:name,alias:alias,origin:tokens[0]};
    }
}
