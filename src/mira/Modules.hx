package mira;

import mira.lex.Lexer;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.syntax.Definition;
import mira.syntax.DefinitionParser;
import mira.syntax.ModuleSections;
import mira.resolve.ModuleIdentity;

// File resolution belongs to the host. The compiler never accesses the
// filesystem or network, and each source retains its own token coordinates.
class Modules {
    public static function collect(source:String, ?read:String->Null<String>,
        ?entry:String, ?types:Map<String,mira.types.Type>,
        ?moduleTypes:Map<String,Map<String,mira.types.Type>>,
        ?publicTypes:Map<String,Array<String>>):Array<Definition> {
        if (types == null) types = new Map<String,mira.types.Type>();
        if (moduleTypes == null) moduleTypes = new Map<String,Map<String,mira.types.Type>>();
        if (publicTypes == null) publicTypes = new Map<String,Array<String>>();
        final loaded = new Map<String, Bool>();
        final stack:Array<String> = entry == null ? [] : [entry];
        final definitions:Array<Definition> = [];
        var count = 0;
        var size = source.length;
        function visit(text:String, file:Null<String>):Void {
            var tokens = new Lexer(text, file).tokenize();
            var offset = 0;
            var modulePath:Null<String> = null;
            // The header is a logical identity, unrelated to the resolver's file key.
            // Preserve legacy multiword definitions such as "module name = ...".
            var header = tokens[0].kind == Word && tokens[0].value == "module" && tokens[1].kind == Word;
            if (header) {
                var cursor = 1;
                while (tokens[cursor].kind != End && !tokens[cursor].isSymbol(";")) {
                    if (tokens[cursor].isSymbol("=") || tokens[cursor].isSymbol(":") || tokens[cursor].isSymbol("::")
                        || tokens[cursor].isSymbol("(")) { header = false; break; }
                    cursor++;
                }
            }
            if (header) {
                final anchor = tokens[0];
                final segments:Array<String> = [];
                var words:Array<String> = [];
                offset = 1;
                while (tokens[offset].kind != End && !tokens[offset].isSymbol(";")) {
                    final token = tokens[offset++];
                    if (token.kind == Word && token.value != "_") words.push(token.value);
                    else if (token.isSymbol("/") && words.length > 0) {
                        segments.push(words.join(" "));
                        words = [];
                    } else throw new MiraError("Expected discursive module path segment",token);
                }
                if (words.length == 0 || !tokens[offset].isSymbol(";"))
                    throw new MiraError("Expected module path and terminating ;",tokens[offset]);
                segments.push(words.join(" "));
                modulePath = segments.join(" / ");
                if (moduleTypes.exists(modulePath))
                    throw new MiraError("Duplicate module " + modulePath,anchor);
                moduleTypes.set(modulePath,new Map<String,mira.types.Type>());
                offset++;
            }
            var sections:Null<ModuleSections> = null;
            if (modulePath != null) {
                publicTypes.set(modulePath,[]);
                if (tokens[offset].kind == Word && tokens[offset].value == "interface") {
                    sections = new ModuleSections(tokens,offset);
                    tokens = tokens.slice(0,offset).concat(sections.imports).concat(tokens.slice(sections.bodyOffset));
                }
            }
            while (tokens[offset].kind == Word && tokens[offset].value == "import"
                && tokens[offset + 1].kind == Text) {
                final origin = tokens[offset];
                final path = tokens[offset + 1].value;
                if (!tokens[offset + 2].isSymbol(";"))
                    throw new MiraError("Expected ; after import", origin);
                offset += 3;
                if (!~/^([A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.mira$/.match(path))
                    throw new MiraError("Invalid module path: " + path, origin);
                if (stack.indexOf(path) >= 0)
                    throw new MiraError("Import cycle: " + stack.concat([path]).join(" -> "), origin);
                if (loaded.exists(path)) continue;
                if (read == null) throw new MiraError("No module resolver for " + path, origin);
                if (++count > 128 || stack.length >= 32)
                    throw new MiraError("Module graph limit exceeded", origin);
                var dependency:Null<String>;
                try {
                    dependency = read(path);
                } catch (e:Dynamic) {
                    throw new MiraError("Cannot read module " + path + ": " + Std.string(e), origin);
                }
                if (dependency == null) throw new MiraError("Module not found: " + path, origin);
                size += dependency.length;
                if (size > 2000000) throw new MiraError("Module source size limit exceeded", origin);
                stack.push(path);
                visit(dependency, path);
                stack.pop();
                loaded.set(path, true);
            }
            final localTypes = modulePath == null ? types : moduleTypes.get(modulePath);
            final local:Array<Definition> = [];
            if (sections != null) {
                final constructors = DefinitionParser.parse(sections.typeTokens,localTypes,modulePath);
                for (name in localTypes.keys()) publicTypes.get(modulePath).push(name);
                publicTypes.get(modulePath).sort(Reflect.compare);
                for (d in constructors) {
                    d.isExported = true;
                    local.push(d);
                }
            }
            for (d in DefinitionParser.parse(offset == 0 ? tokens : tokens.slice(offset),localTypes,modulePath))
                local.push(d);
            if (sections != null) {
                final byName = new Map<String,Definition>();
                for (d in local) if (!d.isStatement) byName.set(d.isFunction() ? d.selector() : d.name,d);
                for (reference in sections.references) {
                    final d = byName.get(reference.name);
                    if (localTypes.exists(reference.name)) {
                        if (d != null) throw new MiraError("Ambiguous value or type export " + reference.name,reference.origin);
                        throw new MiraError("Opaque type exports are not implemented yet: " + reference.name,reference.origin);
                    }
                    if (d == null) throw new MiraError("Unknown interface export " + reference.name,reference.origin);
                    if (d.isExported) throw new MiraError("Duplicate interface export " + reference.name,reference.origin);
                    d.isExported = true;
                }
            }
            for (definition in local) {
                if (sections != null && (definition.origin.value == "interface" || definition.origin.value == "implementation"))
                    throw new MiraError("Unexpected module section marker",definition.origin);
                // Detect a misplaced directive independently of host signatures.
                if (definition.isStatement && definition.bodyTokens[0].kind == Word
                    && definition.bodyTokens[0].value == "import"
                    && definition.bodyTokens.length > 1 && definition.bodyTokens[1].kind == Text)
                    throw new MiraError("Imports must precede definitions", definition.origin);
                if (file != null && definition.isStatement)
                    throw new MiraError("Imported modules may contain declarations only", definition.origin);
                definition.modulePath = modulePath;
                definitions.push(definition);
            }
        }
        visit(source, null);
        return definitions;
    }
}
