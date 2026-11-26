package mira.syntax;

import mira.MiraError;
import mira.lex.Lexer;
import mira.lex.Token.TokenKind;

// Interface-only module source. Reuse ModuleSections; never synthesize
// source text or lose the contract's original diagnostic coordinates.
class ContractModule {
    public static function read(source:String,path:String):ModuleSections {
        final tokens = new Lexer(source,path).tokenize();
        if (tokens[0].kind != Word || tokens[0].value != "module")
            throw new MiraError("Expected contract module header",tokens[0]);
        final header = ModulePath.read(tokens,1);
        if (header.path != path)
            throw new MiraError("Contract declaration does not match requested path " + path,tokens[0]);
        final anchor = tokens[header.next];
        if (anchor.kind != Word || anchor.value != "interface")
            throw new MiraError("Expected contract interface",anchor);
        final sections = new ModuleSections(tokens,header.next,true);
        if (sections.imports.length > 0)
            throw new MiraError("Interface-only module imports and re-exports are not yet supported",sections.imports[0]);
        for (reference in sections.references)
            if (reference.name.indexOf(":") >= 0)
                throw new MiraError("Independent contract requires explicit selector signature " + reference.name,reference.origin);
        if (sections.references.length == 0 && sections.signatures.length == 0 && sections.typeTokens.length == 1)
            throw new MiraError("Empty independent contract",anchor);
        return sections;
    }
}
