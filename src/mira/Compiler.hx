package mira;

import mira.lex.Lexer;
import mira.lex.Token;
import mira.resolve.Symbols;
import mira.syntax.Definition;
import mira.syntax.ExpressionParser;
import mira.syntax.ExpressionOrigins;
import mira.emit.JsEmitter;
import mira.emit.PhpEmitter;
import mira.emit.SourceLocations.GeneratedLocation;

class Compiler {
    public static function parse(source:String, ?host:HostEnvironment,
        ?readModule:String->Null<String>, ?entry:String, ?origins:ExpressionOrigins, ?visibility:mira.types.TypeVisibility, ?providers:mira.resolve.ProviderBindings, allowContracts:Bool = false, allowUnbound:Bool = false, ?interfaceData:mira.types.InterfaceReport, ?profile:mira.CompileProfile):Array<Definition> {
        final types = new Map<String,mira.types.Type>();
        final moduleTypes = new Map<String,Map<String,mira.types.Type>>();
        final bindings = new Map<String,Array<mira.resolve.ImportBinding>>();
        final definitions = Modules.collect(source, readModule, entry,types,moduleTypes,interfaceData == null ? null : interfaceData.publicTypes,bindings,visibility,interfaceData == null ? null : interfaceData.reexports,interfaceData == null ? null : interfaceData.edges,providers,allowContracts,allowUnbound);
        if (interfaceData != null) interfaceData.moduleTypes = moduleTypes;
        if (profile != null) profile.mark("collect");
        final groups = new Map<String,Array<Definition>>();
        for (definition in definitions) {
            final key = definition.modulePath == null ? "" : definition.modulePath;
            if (!groups.exists(key)) groups.set(key,[]);
            groups.get(key).push(definition);
        }
        final scopes = new Map<String,Symbols>();
        for (key => group in groups)
            scopes.set(key,new Symbols(group,host == null ? null : host.forModule(key == "" ? null : key),key == "" ? null : key,bindings.get(key)));
        if (profile != null) profile.mark("scopes");
        for (definition in definitions) {
            if (definition.body != null || definition.isAbstractContract) continue; // synthesized sum constructor
            final key = definition.modulePath == null ? "" : definition.modulePath;
            final locals = definition.isFunction() ? definition.parameters : [];
            final localTypes = key == "" ? types : moduleTypes.get(key);
            definition.body = new ExpressionParser(definition.bodyTokens, scopes.get(key), locals, false, null, origins,localTypes).parse();
        }
        final result = [for (definition in definitions) definition.canonical()];
        if (profile != null) profile.mark("expressions");
        return result;
    }

    public static function transpile(source:String, target:Target, ?host:HostEnvironment,
        ?locations:Array<GeneratedLocation>, ?readModule:String->Null<String>, ?entry:String):String {
        final definitions = parse(source, host, readModule, entry);
        final symbols = new Symbols(definitions, host);
        return switch (target) {
            case JavaScript: JsEmitter.emit(definitions, symbols, locations);
            case Php: PhpEmitter.emit(definitions, symbols, locations);
        };
    }

    // A distinct checked path preserves byte-for-byte unchecked emission
    // when all obligations are proven. The same parsed AST reaches both phases.
    public static function transpileChecked(source:String,target:Target,?host:HostEnvironment,
        ?locations:Array<GeneratedLocation>,?readModule:String->Null<String>,?entry:String, ?treeShake:Bool = false, ?optimization:Dynamic, ?providers:mira.resolve.ProviderBindings, ?profile:mira.CompileProfile):String {
        if (profile != null) profile.begin();
        final origins = new ExpressionOrigins();
        final visibility = new mira.types.TypeVisibility();
        var definitions = parse(source,host,readModule,entry,origins,visibility,providers,true,false,null,profile);
        final guards = new haxe.ds.ObjectMap<Dynamic,mira.types.NumericGuard>();
        new mira.types.TypeChecker(origins,host == null ? HostEnvironment.empty() : host,guards,visibility).check(definitions);
        if (profile != null) profile.mark("checking");
        if (treeShake) {
            definitions = mira.optimize.TreeShaker.run(definitions,guards,optimization);
            if (profile != null) profile.mark("pruning");
        }
        final symbols = new Symbols(definitions,host);
        final result = switch (target) {
            case JavaScript: JsEmitter.emit(definitions,symbols,locations,guards);
            case Php: PhpEmitter.emit(definitions,symbols,locations,guards);
        };
        if (profile != null) profile.mark("emission");
        return result;
    }

    // Checking is opt-in while the type system is experimental.
    public static function check(source:String, ?host:HostEnvironment,
        ?readModule:String->Null<String>, ?entry:String, ?providers:mira.resolve.ProviderBindings):Array<Dynamic> {
        final origins = new ExpressionOrigins();
        final visibility = new mira.types.TypeVisibility();
        return new mira.types.TypeChecker(origins,host == null ? HostEnvironment.empty() : host,null,visibility).check(parse(source,host,readModule,entry,origins,visibility,providers,true,true));
    }

    public static function interfaces(source:String,?host:HostEnvironment,?readModule:String->Null<String>,?entry:String,?providers:mira.resolve.ProviderBindings):Dynamic {
        final origins = new ExpressionOrigins();
        final visibility = new mira.types.TypeVisibility();
        final data = new mira.types.InterfaceReport();
        // Observe actual resolver reads, including inherited contracts and
        // legacy files. No second read, file access or new cache.
        final reads:Array<{path:String,fingerprint:String}> = [];
        var trackedRead:String->Null<String> = null;
        if (readModule != null) trackedRead = function(path:String):Null<String> {
            final text = readModule(path);
            if (text != null) reads.push({path:path,fingerprint:haxe.crypto.Sha256.encode(text)});
            return text;
        };
        final program = parse(source,host,trackedRead,entry,origins,visibility,providers,true,true,data);
        final checker = new mira.types.TypeChecker(origins,host == null ? HostEnvironment.empty() : host,null,visibility);
        final rows = checker.check(program);
        final report:Dynamic = data.build(rows,checker,providers);
        report.sourceInputs = {entry:haxe.crypto.Sha256.encode(source),reads:reads};
        return report;
    }

    public static function specialize(source:String,name:String,args:Array<mira.types.Type>,?host:HostEnvironment,
        ?readModule:String->Null<String>,?entry:String):Dynamic {
        final origins = new ExpressionOrigins();
        final visibility = new mira.types.TypeVisibility();
        return new mira.types.TypeChecker(origins,host == null ? HostEnvironment.empty() : host,null,visibility)
            .specialize(parse(source,host,readModule,entry,origins,visibility,null,true,true),name,args);
    }

    public static function inspectTokens(source:String):String {
        final tokens = new Lexer(source).tokenize();
        final items:Array<Dynamic> = [];
        for (token in tokens) {
            items.push({
                kind: Std.string(token.kind),
                value: token.value,
                line: token.line,
                column: token.column
            });
        }
        return haxe.Json.stringify(items, null, "  ");
    }
}
