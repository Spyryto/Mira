package mira.syntax;

import mira.MiraError;
import mira.lex.Lexer;
import mira.lex.Token;
import mira.types.Type;
import mira.types.TypeVisibility;
import mira.resolve.ModuleIdentity;
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
        validate(sections,anchor);
        return sections;
    }

    public static function validate(sections:ModuleSections,anchor:Token):Void {
        // Only explicitly named types may enter an independent interface.
        var cursor = 0;
        while (cursor < sections.imports.length) {
            final origin = sections.imports[cursor];
            if (origin.value != "import" || sections.imports[cursor+1].kind != Word)
                throw new MiraError("Independent contract requires selective logical type imports",origin);
            final directive = new ModuleImport(sections.imports,cursor);
            if (directive.wildcard)
                throw new MiraError("Independent contract requires explicit type names",origin);
            cursor = directive.next;
        }
        for (reference in sections.references)
            if (reference.name.indexOf(":") >= 0)
                throw new MiraError("Independent contract requires explicit selector signature " + reference.name,reference.origin);
        if (sections.references.length == 0 && sections.signatures.length == 0 && sections.typeTokens.length == 1)
            throw new MiraError("Empty independent contract",anchor);
    }

    // The existing value annotation and abstract type header share parentheses.
    // Recognize a generic abstract header only if its name is used as a type
    // application elsewhere. Unused ambiguous headers are diagnosed by the
    // ordinary value-signature parser, not silently accepted as new types.
    public static function classify(sections:ModuleSections):{
        headers:Array<{name:String,arity:Int,origin:Token}>, signatures:Array<Array<Token>>
    } {
        final known = new Map<String,Type>();
        final headers:Array<{name:String,arity:Int,origin:Token}> = [];
        for (reference in sections.references) {
            known.set(reference.name,NumberType);
            headers.push({name:reference.name,arity:0,origin:reference.origin});
        }
        for (name in DefinitionParser.typeHeaders(sections.typeTokens).keys()) known.set(name,NumberType);
        final signatures:Array<Array<Token>> = [];
        for (item in sections.signatures) {
            var abstractHeader = false;
            if (DefinitionParser.topLevel(item,"::") < 0 && DefinitionParser.topLevel(item,"(") > 0) {
                var header:Null<{name:String,parameters:Array<String>}> = null;
                try { header = DefinitionParser.typeHeader(item,known); } catch (_:MiraError) {}
                if (header != null && usedAsApplication(header.name,item,sections)) {
                    headers.push({name:header.name,arity:header.parameters.length,origin:item[0]});
                    abstractHeader = true;
                }
            }
            if (!abstractHeader) signatures.push(item);
        }
        return {headers:headers,signatures:signatures};
    }

    static function usedAsApplication(name:String,own:Array<Token>,sections:ModuleSections):Bool {
        final words = name.split(" ");
        final uses:Array<Array<Token>> = [];
        for (item in sections.signatures) if (item != own) {
            final marker = DefinitionParser.topLevel(item,"::");
            final opening = DefinitionParser.topLevel(item,"(");
            if (marker >= 0) uses.push(item.slice(marker+1));
            else if (opening >= 0) uses.push(item.slice(opening+1));
        }
        var remaining = sections.typeTokens;
        while (remaining.length > 1) {
            final end = DefinitionParser.topLevel(remaining,";");
            if (end < 0) break;
            final item = remaining.slice(0,end);
            final marker = DefinitionParser.topLevel(item,"::");
            if (marker >= 0) uses.push(item.slice(marker+1));
            remaining = remaining.slice(end+1);
        }
        for (item in uses) {
            for (i in 0...item.length) {
                if (i > 0 && item[i-1].kind == Word) continue;
                if (i+words.length >= item.length || !item[i+words.length].isSymbol("(")) continue;
                var matches = true;
                for (j in 0...words.length)
                    if (item[i+j].kind != Word || item[i+j].value != words[j]) matches = false;
                if (matches) return true;
            }
        }
        return false;
    }

    public static function elaborate(sections:ModuleSections,path:String,names:Map<String,Type>,visibility:TypeVisibility):Array<Definition> {
        final classified = classify(sections);
        for (header in classified.headers) {
            if (names.exists(header.name) || ["Number","Integer","Text","Boolean"].indexOf(header.name) >= 0)
                throw new MiraError("Duplicate or reserved abstract type " + header.name,header.origin);
            final identity = ModuleIdentity.qualify(path,header.name);
            visibility.markOpaque(identity);
            names.set(header.name,OpaqueType(identity,[for (i in 0...header.arity) Variable(-i-1)]));
        }
        final result = DefinitionParser.parse(sections.typeTokens,names,path);
        for (name in names.keys()) switch (names.get(name)) {
            case NamedType(_,OpaqueType(other,_)) if (ModuleIdentity.owner(other) == path):
                throw new MiraError("Direct public representation alias to local opaque type is not supported: " + name);
            default:
        }
        final seen = new Map<String,Bool>();
        for (d in result) seen.set(d.isFunction() ? d.selector() : d.name,true);
        for (item in classified.signatures) {
            final signature = PublicSignature.read(item,names);
            if (seen.exists(signature.name) || names.exists(signature.name))
                throw new MiraError("Duplicate or ambiguous contract symbol " + signature.name,signature.origin);
            seen.set(signature.name,true);
            final labels = signature.parameters.length == 0 ? [] : signature.name.substr(0,signature.name.length-1).split(":");
            final parameters = [for (i in 0...labels.length) "contractArg" + i];
            final d = new Definition(labels.length == 0 ? signature.name : "",labels,parameters,[],signature.origin,false,[for (_ in parameters) signature.origin]);
            d.parameterAnnotations = [for (_ in parameters) null];
            signature.apply(d);
            d.isAbstractContract = true;
            result.push(d);
        }
        for (d in result) {
            d.modulePath = path;
            d.isExported = true;
        }
        return result;
    }
}
