package mira;

import mira.lex.Lexer;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.syntax.Definition;
import mira.syntax.DefinitionParser;
import mira.syntax.ModuleSections;
import mira.syntax.ModuleImport;
import mira.syntax.PublicSignature;
import mira.types.TypeVisibility;
import mira.types.Type;
import mira.resolve.ModuleIdentity;
import mira.resolve.ImportBinding;
import mira.resolve.ProviderBindings;

// File resolution belongs to the host. The compiler never accesses the
// filesystem or network, and each source retains its own token coordinates.
class Modules {
    public static function collect(source:String, ?read:String->Null<String>,
        ?entry:String, ?types:Map<String,mira.types.Type>,
        ?moduleTypes:Map<String,Map<String,mira.types.Type>>,
        ?publicTypes:Map<String,Array<String>>, ?bindings:Map<String,Array<ImportBinding>>, ?visibility:TypeVisibility, ?reexports:Map<String,Array<Dynamic>>, ?moduleEdges:Array<Dynamic>, ?providers:ProviderBindings):Array<Definition> {
        if (types == null) types = new Map<String,mira.types.Type>();
        if (moduleTypes == null) moduleTypes = new Map<String,Map<String,mira.types.Type>>();
        if (publicTypes == null) publicTypes = new Map<String,Array<String>>();
        if (bindings == null) bindings = new Map<String,Array<ImportBinding>>();
        if (visibility == null) visibility = new TypeVisibility();
        final exportedSymbols = new Map<String,Map<String,Definition>>();
        final contractExports = new Map<String,Map<String,Definition>>();
        if (reexports == null) reexports = new Map<String,Array<Dynamic>>();
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
                if (providers != null && providers.exists(modulePath))
                    throw new MiraError("Concrete module conflicts with configured contract path " + modulePath,anchor);
                if (moduleTypes.exists(modulePath))
                    throw new MiraError("Duplicate module " + modulePath,anchor);
                moduleTypes.set(modulePath,new Map<String,mira.types.Type>());
                offset++;
            }
            var sections:Null<ModuleSections> = null;
            var publicEnd = -1;
            final publicAliases = new Map<String,mira.types.Type>();
            final privateAliases = new Map<String,mira.types.Type>();
            final imported:Array<ImportBinding> = [];
            final aliasNames = new Map<String,Bool>();
            final forwarded = new Map<String,Definition>();
            final forwardedTypes:Array<String> = [];
            final forwardedInfo:Array<Dynamic> = [];
            if (modulePath != null) {
                publicTypes.set(modulePath,[]);
                if (tokens[offset].kind == Word && tokens[offset].value == "interface") {
                    sections = new ModuleSections(tokens,offset);
                    publicEnd = offset + sections.imports.length;
                    tokens = tokens.slice(0,offset).concat(sections.imports).concat(tokens.slice(sections.bodyOffset));
                }
            }
            while (tokens[offset].kind == Word && (tokens[offset].value == "import" || (modulePath != null && tokens[offset].value == "export" && offset < publicEnd))
                && (tokens[offset + 1].kind == Text || (modulePath != null && tokens[offset + 1].kind == Word))) {
                final origin = tokens[offset];
                final forwarding = origin.value == "export";
                if (forwarding && tokens[offset+1].kind == Text) throw new MiraError("Re-export requires a logical module path",origin);
                if (tokens[offset+1].kind != Text) {
                    final isPublic = offset < publicEnd;
                    final directive = new ModuleImport(tokens,offset);
                    offset = directive.next;
                    final service = directive.path;
                    final selection = providers == null ? null : providers.get(service);
                    final path = selection == null ? service : selection.provider;
                    if (moduleEdges != null) moduleEdges.push({from:modulePath,to:path,kind:forwarding ? "export" : "import",phase:isPublic ? "interface" : "implementation",wildcard:directive.wildcard,names:[for (item in directive.names) {name:item.name,alias:item.alias}],line:origin.line,column:origin.column,file:origin.file,contract:selection == null ? null : service});
                    if (!exportedSymbols.exists(path)) {
                        if (moduleTypes.exists(path))
                            throw new MiraError("Import cycle involving " + path,origin);
                        if (read == null) throw new MiraError("No module resolver for " + path,origin);
                        if (++count > 128 || stack.length >= 32)
                            throw new MiraError("Module graph limit exceeded",origin);
                        var dependency:Null<String>;
                        try { dependency = read(path); }
                        catch (e:Dynamic) { throw new MiraError("Cannot read module " + path + ": " + Std.string(e),origin); }
                        if (dependency == null) throw new MiraError("Module not found: " + path,origin);
                        size += dependency.length;
                        if (size > 2000000) throw new MiraError("Module source size limit exceeded",origin);
                        stack.push(path);
                        visit(dependency,path);
                        stack.pop();
                        if (!exportedSymbols.exists(path))
                            throw new MiraError("Module declaration does not match requested path " + path,origin);
                    }
                    var exported = exportedSymbols.get(path);
                    var availableTypes = publicTypes.get(path);
                    if (selection != null) {
                        if (!contractExports.exists(service)) {
                            final restricted = new Map<String,Definition>();
                            for (signature in selection.signatures) {
                                final d = exported.get(signature.name);
                                if (d == null || d.modulePath != path)
                                    throw new MiraError("Contract symbol not publicly defined by " + path + ": " + signature.name,origin);
                                signature.apply(d);
                                restricted.set(signature.name,d);
                            }
                            contractExports.set(service,restricted);
                        }
                        exported = contractExports.get(service);
                        availableTypes = [];
                    }
                    final requested = directive.names.copy();
                    if (directive.wildcard) {
                        final all = [for (name in exported.keys()) name].concat(availableTypes);
                        all.sort(Reflect.compare);
                        for (name in all) requested.push({name:name,alias:name,origin:origin});
                    }
                    for (item in requested) {
                        final d = exported.get(item.name);
                        final isType = availableTypes.indexOf(item.name) >= 0;
                        if (d != null && isType) throw new MiraError("Ambiguous imported symbol " + item.name,item.origin);
                        if (d == null && !isType) throw new MiraError("Symbol not exported by " + service + ": " + item.name,item.origin);
                        if (aliasNames.exists(item.alias)) throw new MiraError("Duplicate imported name " + item.alias,item.origin);
                        aliasNames.set(item.alias,true);
                        if (isType) {
                            if (["Number","Integer","Text","Boolean"].indexOf(item.alias) >= 0)
                                throw new MiraError("Reserved imported type name " + item.alias,item.origin);
                            final type = visibility.view(moduleTypes.get(path).get(item.name),modulePath);
                            (isPublic ? publicAliases : privateAliases).set(item.alias,type);
                            if (forwarding) {
                                forwardedTypes.push(item.alias);
                                final identity = switch (type) {
                                    case NamedType(name,_) | OpaqueType(name,_) | ParametricNamedType(name,_,_) | SumType(name,_,_) | SumReference(name,_,_): name;
                                    default: throw new MiraError("Expected nominal re-export type",item.origin);
                                };
                                forwardedInfo.push({name:item.alias,kind:"type",target:identity,opaque:visibility.opaqueNames.exists(identity)});
                            }
                        } else {
                            final binding = new ImportBinding(item.alias,d,item.origin);
                            imported.push(binding);
                            if (forwarding) {
                                forwarded.set(item.alias,d);
                                forwardedInfo.push({name:item.alias,kind:d.isFunction() ? "selector" : "value",target:binding.canonicalName()});
                            }
                        }
                    }
                    continue;
                }
                final path = tokens[offset + 1].value;
                if (moduleEdges != null) moduleEdges.push({from:modulePath,to:path,kind:"file",phase:offset < publicEnd ? "interface" : "implementation",line:origin.line,column:origin.column,file:origin.file});
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
            final signatures:Array<PublicSignature> = [];
            var signatureTypes:Map<String,Type> = null;
            final opaque = new Map<String,Int>();
            final opaqueOrigins = new Map<String,Token>();
            final explicitSignatures:Array<Array<Token>> = [];
            final implementation = tokens.slice(offset);
            if (modulePath != null && tokens[offset].kind == Word && tokens[offset].value == "export" && tokens[offset+1].kind == Word)
                throw new MiraError("Re-exports belong in the interface",tokens[offset]);
            for (name => type in publicAliases) localTypes.set(name,type);
            if (sections != null) {
                final headers = DefinitionParser.typeHeaders(implementation);
                function reserve(name:String,arity:Int,origin:Token):Void {
                    if (opaque.exists(name) || localTypes.exists(name) || privateAliases.exists(name))
                        throw new MiraError("Duplicate or conflicting opaque type " + name,origin);
                    if (headers.get(name) != arity)
                        throw new MiraError("Opaque type parameter count mismatch for " + name,origin);
                    opaque.set(name,arity);
                    opaqueOrigins.set(name,origin);
                    final identity = ModuleIdentity.qualify(modulePath,name);
                    visibility.markOpaque(identity);
                    localTypes.set(name,OpaqueType(identity,[for (i in 0...arity) Variable(-i-1)]));
                }
                for (reference in sections.references)
                    if (headers.exists(reference.name)) reserve(reference.name,0,reference.origin);
                for (item in sections.signatures) {
                    final opening = DefinitionParser.topLevel(item,"(");
                    if (opening > 0 && DefinitionParser.topLevel(item,"::") < 0) {
                        final name = ModuleSections.reference(item.slice(0,opening));
                        if (headers.exists(name)) {
                            final header = DefinitionParser.typeHeader(item,localTypes);
                            reserve(name,header.parameters.length,item[0]);
                            continue;
                        }
                    }
                    explicitSignatures.push(item);
                }
                final constructors = DefinitionParser.parse(sections.typeTokens,localTypes,modulePath);
                for (name in localTypes.keys()) if (!publicAliases.exists(name) || forwardedTypes.indexOf(name) >= 0) publicTypes.get(modulePath).push(name);
                publicTypes.get(modulePath).sort(Reflect.compare);
                signatureTypes = localTypes.copy();
                // A direct representation alias through a forward opaque reference
                // can form a cycle. Nested record/list/sum references are finite.
                for (name in publicTypes.get(modulePath)) switch (localTypes.get(name)) {
                    case NamedType(_,OpaqueType(other,_)) if (ModuleIdentity.owner(other) == modulePath):
                        throw new MiraError("Direct public representation alias to local opaque type is not supported: " + name,tokens[offset]);
                    default:
                }
                for (name in opaque.keys()) localTypes.remove(name);
                for (d in constructors) {
                    d.isExported = true;
                    local.push(d);
                }
            }
            for (name => type in privateAliases) {
                if (localTypes.exists(name)) throw new MiraError("Imported type conflicts with local type " + name,tokens[offset]);
                localTypes.set(name,type);
            }
            for (d in DefinitionParser.parse(implementation,localTypes,modulePath))
                local.push(d);
            if (sections != null) {
                final byName = new Map<String,Definition>();
                for (d in local) if (!d.isStatement) byName.set(d.isFunction() ? d.selector() : d.name,d);
                for (name => arity in opaque) {
                    if (byName.exists(name)) throw new MiraError("Ambiguous value or type export " + name,opaqueOrigins.get(name));
                    final type = localTypes.get(name);
                    if (type == null) throw new MiraError("Missing opaque type implementation " + name,opaqueOrigins.get(name));
                    visibility.defineOpaque(ModuleIdentity.qualify(modulePath,name),type);
                    signatureTypes.set(name,type);
                }
                for (reference in sections.references) {
                    if (opaque.exists(reference.name)) continue;
                    final d = byName.get(reference.name);
                    if (localTypes.exists(reference.name)) {
                        if (d != null) throw new MiraError("Ambiguous value or type export " + reference.name,reference.origin);
                        if (publicAliases.exists(reference.name) || privateAliases.exists(reference.name))
                            throw new MiraError("Cannot re-export imported type " + reference.name,reference.origin);
                        if (publicTypes.get(modulePath).indexOf(reference.name) >= 0)
                            throw new MiraError("Duplicate interface export " + reference.name,reference.origin);
                        throw new MiraError("Missing opaque type declaration " + reference.name,reference.origin);
                    }
                    if (d == null) throw new MiraError("Unknown interface export " + reference.name,reference.origin);
                    if (d.isExported) throw new MiraError("Duplicate interface export " + reference.name,reference.origin);
                    d.isExported = true;
                }
                publicTypes.get(modulePath).sort(Reflect.compare);
                for (tokens in explicitSignatures) signatures.push(PublicSignature.read(tokens,signatureTypes));
                for (signature in signatures) {
                    final d = byName.get(signature.name);
                    if (localTypes.exists(signature.name))
                        throw new MiraError("Ambiguous value or type export " + signature.name,signature.origin);
                    if (d == null) throw new MiraError("Unknown interface export " + signature.name,signature.origin);
                    if (d.isExported) throw new MiraError("Duplicate interface export " + signature.name,signature.origin);
                    signature.apply(d);
                    d.isExported = true;
                }
                for (d in local) if (d.isExported) switch (d.body) {
                    case Variant(SumType(name,_,_),_,_) if (visibility.opaqueNames.exists(name)):
                        throw new MiraError("Cannot export constructor of opaque type " + name,d.origin);
                    default:
                }
            }
            if (modulePath != null) {
                for (name in localTypes.keys())
                    if (!publicAliases.exists(name) && !privateAliases.exists(name) && publicTypes.get(modulePath).indexOf(name) < 0)
                        visibility.privateNames.set(ModuleIdentity.qualify(modulePath,name),true);
                for (name in publicTypes.get(modulePath))
                    visibility.requirePublic(localTypes.get(name),opaqueOrigins.exists(name) ? opaqueOrigins.get(name) : tokens[offset],t -> t);
                for (d in local) if (!d.isStatement && aliasNames.exists(d.isFunction() ? d.selector() : d.name))
                    throw new MiraError("Imported name conflicts with local declaration " + (d.isFunction() ? d.selector() : d.name),d.origin);
                // Type aliases and local type declarations cannot silently collide with imported values.
                for (binding in imported) if (localTypes.exists(binding.alias))
                    throw new MiraError("Imported name conflicts with local type " + binding.alias,binding.origin);
                bindings.set(modulePath,imported);
            }
            for (definition in local) {
                if (sections != null && (definition.origin.value == "interface" || definition.origin.value == "implementation"))
                    throw new MiraError("Unexpected module section marker",definition.origin);
                // Detect a misplaced directive independently of host signatures.
                if (definition.isStatement && definition.bodyTokens[0].kind == Word
                    && definition.bodyTokens[0].value == "import"
                    && definition.bodyTokens.length > 1 && definition.bodyTokens[1].kind == Text)
                    throw new MiraError("Imports must precede definitions", definition.origin);
                if (modulePath != null && definition.isStatement && definition.bodyTokens[0].kind == Word
                    && definition.bodyTokens[0].value == "export")
                    throw new MiraError("Re-exports belong in the interface",definition.origin);
                if (file != null && definition.isStatement)
                    throw new MiraError("Imported modules may contain declarations only", definition.origin);
                definition.modulePath = modulePath;
                definition.importedGlobals = [for (binding in imported) if (!binding.target.isFunction()) binding.canonicalName()];
                definitions.push(definition);
            }
            if (modulePath != null) {
                final table = forwarded;
                for (d in local) if (d.isExported) table.set(d.isFunction() ? d.selector() : d.name,d);
                exportedSymbols.set(modulePath,table);
                reexports.set(modulePath,forwardedInfo);
            }
        }
        visit(source, null);
        return definitions;
    }
}
