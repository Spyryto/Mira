package mira.studio;

import mira.Compiler;
import mira.HostEnvironment;
import mira.Target;
import mira.MiraError;
import mira.syntax.Expr;
import mira.syntax.Definition;
import mira.types.Type;
import mira.resolve.Symbols;
import mira.emit.SourceLocations.GeneratedLocation;

class Bridge {
    public static function main():Void {
        final global:Dynamic = js.Syntax.code("globalThis");
        Reflect.setField(global, "MiraStudioCompiler", {
            compile: compile,
            check: check,
            specialize: specialize,
            tokens: tokens,
            ast: ast,
            trace: trace,
            exploreModules: exploreModules,
            interfaces: interfaces,
            verifyContract: verifyContract,
            version: "0.81.0"
        });
    }

    // Studio bundles the actual library as a Haxe resource. Optional virtual
    // project files are supplied explicitly, never fetched by source code.
    static function resolver(?modulesJson:String):String->Null<String> {
        final files = new Map<String, String>();
        final gui = haxe.Resource.getString("lib/gui.mira");
        if (gui != null) files.set("lib/gui.mira", gui);
        if (modulesJson != null) {
            final supplied:Dynamic = haxe.Json.parse(modulesJson);
            if (supplied == null || !Reflect.isObject(supplied) || Std.isOfType(supplied, Array)
                || Std.isOfType(supplied, String)) throw new MiraError("Expected a module file map");
            for (name in Reflect.fields(supplied)) {
                final value:Dynamic = Reflect.field(supplied, name);
                if (!Std.isOfType(value, String)) throw new MiraError("Module source must be text: " + name);
                files.set(name, value);
            }
        }
        return function(name) {
            if (files.exists(name)) return files.get(name);
            return files.get(name.split(" / ").join("/") + ".mira");
        };
    }

    public static function compile(source:String, targetName:String, ?hostJson:String,
        ?withLocations:Bool = false, ?modulesJson:String, ?checked:Bool = false, ?treeShake:Bool = false, ?bindingsJson:String, ?withProfile:Bool = false):Dynamic {
        final profile = withProfile ? new mira.CompileProfile() : null;
        final locations:Array<GeneratedLocation> = withLocations ? [] : null;
        final optimization:Dynamic = {};
        final result = safely(function() {
            final target = switch (targetName) {
                case "js": JavaScript;
                case "php": Php;
                default: throw new MiraError("Unknown target: " + targetName);
            };
            final host = hostJson == null ? HostEnvironment.empty()
                : HostEnvironment.fromJson(hostJson);
            if (treeShake && !checked) throw new MiraError("Tree shaking requires checked compilation");
            if (withProfile && !checked) throw new MiraError("Profiling requires checked compilation");
            if (bindingsJson != null && !checked) throw new MiraError("Provider bindings require checked compilation");
            final providers = bindingsJson == null ? null : mira.resolve.ProviderBindings.fromJson(bindingsJson);
            return checked ? Compiler.transpileChecked(source,target,host,locations,resolver(modulesJson),null,treeShake,optimization,providers,profile)
                : Compiler.transpile(source, target, host, locations, resolver(modulesJson));
        });
        if (withLocations && result.ok) Reflect.setField(result, "locations", locations);
        if (treeShake && result.ok) Reflect.setField(result,"optimization",optimization);
        if (withProfile && result.ok) Reflect.setField(result,"profile",profile.report());
        return result;
    }

    public static function check(source:String, ?hostJson:String, ?modulesJson:String, ?bindingsJson:String):Dynamic {
        return safely(function() {
            final host = hostJson == null ? HostEnvironment.empty() : HostEnvironment.fromJson(hostJson);
            final providers = bindingsJson == null ? null : mira.resolve.ProviderBindings.fromJson(bindingsJson);
            return haxe.Json.stringify(Compiler.check(source,host,resolver(modulesJson),null,providers), null, "  ");
        });
    }

    public static function specialize(source:String,name:String,argsJson:String,?hostJson:String,?modulesJson:String):Dynamic {
        return safely(function() {
            final host = hostJson == null ? HostEnvironment.empty() : HostEnvironment.fromJson(hostJson);
            final input:Dynamic = haxe.Json.parse(argsJson);
            if (!Std.isOfType(input,Array)) throw new MiraError("Expected specialization argument types");
            final args:Array<Dynamic> = cast input;
            final types = [for (i in 0...args.length) mira.types.HostTypeCodec.decode(args[i],"argument "+i)];
            return haxe.Json.stringify(Compiler.specialize(source,name,types,host,resolver(modulesJson)),null,"  ");
        });
    }

    public static function tokens(source:String):Dynamic {
        return safely(function() return Compiler.inspectTokens(source));
    }

    public static function ast(source:String, ?hostJson:String, ?modulesJson:String):Dynamic {
        return safely(function() {
            final host = hostJson == null ? HostEnvironment.empty()
                : HostEnvironment.fromJson(hostJson);
            final definitions = Compiler.parse(source, host, resolver(modulesJson),null,null,null,null,true);
            final tree:Array<Dynamic> = [];
            for (definition in definitions) {
                final node:Dynamic = {
                    kind: definition.isStatement ? "ExpressionStatement"
                        : definition.isFunction() ? "Function" : "Value",
                    line: definition.origin.line,
                    column: definition.origin.column,
                    body: expression(definition.body)
                };
                if (definition.origin.file != null) Reflect.setField(node, "file", definition.origin.file);
                if (definition.modulePath != null) {
                    Reflect.setField(node, "module",definition.modulePath);
                    Reflect.setField(node, "exported",definition.isExported);
                    if (definition.hasPublicSignature) Reflect.setField(node,"explicitSignature",true);
                }
                if (definition.isFunction()) {
                    Reflect.setField(node, "selector", definition.selector());
                    Reflect.setField(node, "name", definition.selector());
                    Reflect.setField(node, "labels", definition.labels);
                    Reflect.setField(node, "parameters", definition.parameters);
                } else {
                    Reflect.setField(node, "name",
                        definition.isStatement ? "<expression>" : definition.name);
                }
                tree.push(node);
            }
            return haxe.Json.stringify({kind: "Program", definitions: tree}, null, "  ");
        });
    }

    public static function interfaces(source:String,?hostJson:String,?modulesJson:String,?bindingsJson:String):Dynamic {
        return safely(function() {
            final host = hostJson == null ? HostEnvironment.empty() : HostEnvironment.fromJson(hostJson);
            final providers = bindingsJson == null ? null : mira.resolve.ProviderBindings.fromJson(bindingsJson);
            return haxe.Json.stringify(Compiler.interfaces(source,host,resolver(modulesJson),null,providers),null,"  ");
        });
    }

    public static function verifyContract(source:String,provider:String,contract:String,?hostJson:String,?modulesJson:String):Dynamic {
        return safely(function() {
            final host = hostJson == null ? HostEnvironment.empty() : HostEnvironment.fromJson(hostJson);
            return haxe.Json.stringify(mira.types.ContractVerifier.verify(source,provider,contract,host,resolver(modulesJson)),null,"  ");
        });
    }

    // Compose existing real trace and checked report; no source re-parsing in UI.
    public static function exploreModules(source:String,?hostJson:String,?modulesJson:String,?bindingsJson:String):Dynamic {
        final traced = Bridge.trace(source,hostJson,modulesJson,bindingsJson);
        if (!traced.ok) return traced;
        final checked = check(source,hostJson,modulesJson,bindingsJson);
        if (!checked.ok) return checked;
        return safely(function() {
            final info:Dynamic = haxe.Json.parse(traced.output);
            final types:Array<Dynamic> = haxe.Json.parse(checked.output);
            final byName = new Map<String,Dynamic>();
            final privateByModule = new Map<String,Array<Dynamic>>();
            for (row in types) {
                if (row.name != "<expression>") byName.set(row.name,row);
                if (row.module != null && row.exported == false) {
                    final path:String = row.module;
                    if (!privateByModule.exists(path)) privateByModule.set(path,[]);
                    privateByModule.get(path).push({name:row.name,type:row.type,line:row.line,column:row.column,file:row.file});
                }
            }
            final interfaces:Array<Dynamic> = info.interfaces;
            for (item in interfaces) {
                final exports:Array<Dynamic> = item.exports;
                for (symbol in exports) Reflect.setField(symbol,"signature",byName.get(symbol.name));
                final forwarded:Array<Dynamic> = item.reexports;
                if (forwarded != null) for (symbol in forwarded) if (symbol.kind != "type")
                    Reflect.setField(symbol,"signature",byName.get(symbol.target));
                Reflect.setField(item,"privateDeclarations",privateByModule.exists(item.module) ? privateByModule.get(item.module) : []);
            }
            return haxe.Json.stringify({interfaces:interfaces,dependencies:info.moduleDependencies},null,"  ");
        });
    }

    // Exposes actual compiler intermediate data, not a reconstructed diagram.
    // The raw declarations are collected before expression resolution.
    public static function trace(source:String, ?hostJson:String, ?modulesJson:String, ?bindingsJson:String):Dynamic {
        return safely(function() {
            final host = hostJson == null ? HostEnvironment.empty()
                : HostEnvironment.fromJson(hostJson);
            final publicTypes = new Map<String,Array<String>>();
            final moduleTypes = new Map<String,Map<String,mira.types.Type>>();
            final moduleEdges:Array<Dynamic> = [];
            final abstractModules:Array<String> = [];
            final providers = bindingsJson == null ? null : mira.resolve.ProviderBindings.fromJson(bindingsJson);
            final reexports = new Map<String,Array<Dynamic>>();
            final visibility = new mira.types.TypeVisibility();
            final raw = [for (d in mira.Modules.collect(source, resolver(modulesJson),null,null,moduleTypes,publicTypes,null,visibility,reexports,moduleEdges,providers,true,true,abstractModules)) d.canonical()];
            final exportsByModule = new Map<String,Array<Dynamic>>();
            for (d in raw) if (d.modulePath != null && d.isExported) {
                if (!exportsByModule.exists(d.modulePath)) exportsByModule.set(d.modulePath,[]);
                exportsByModule.get(d.modulePath).push({name:d.isFunction() ? d.selector() : d.name,kind:d.isFunction() ? "selector" : "value"});
            }
            final moduleInterfaces:Array<Dynamic> = [];
            final paths = [for (path in publicTypes.keys()) path];
            paths.sort(Reflect.compare);
            for (path in paths) moduleInterfaces.push({
                module:path,
                types:publicTypes.get(path),
                typeIdentities:[for (name in publicTypes.get(path)) {
                    final type = moduleTypes.get(path).get(name);
                    switch (type) {
                        case NamedType(id,_): {name:name,identity:id,arity:0,opaque:visibility.opaqueNames.exists(id)};
                        case OpaqueType(id,args) | ParametricNamedType(id,_,args) | SumType(id,_,args) | SumReference(id,_,args): {name:name,identity:id,arity:args.length,opaque:visibility.opaqueNames.exists(id)};
                        default: throw new MiraError("Expected nominal public type " + name);
                    }
                }],
                opaqueTypes:[for (name in publicTypes.get(path)) if (switch (moduleTypes.get(path).get(name)) {
                    case NamedType(id,_) | OpaqueType(id,_) | ParametricNamedType(id,_,_) | SumType(id,_,_) | SumReference(id,_,_): visibility.opaqueNames.exists(id);
                    default: false;
                }) name],
                exports:exportsByModule.exists(path) ? exportsByModule.get(path) : []
            });
            for (item in moduleInterfaces) {
                if (abstractModules.indexOf(item.module) >= 0) Reflect.setField(item,"abstractContract",true);
                final forwarded = reexports.get(item.module);
                if (forwarded != null && forwarded.length > 0) {
                    Reflect.setField(item,"reexports",forwarded);
                    final opaque:Array<String> = item.opaqueTypes;
                    for (symbol in forwarded) if (symbol.kind == "type" && symbol.opaque && opaque.indexOf(symbol.name) < 0)
                        opaque.push(symbol.name);
                    opaque.sort(Reflect.compare);
                }
            }
            final symbols = new Symbols(raw, host);
            final declarations:Array<Dynamic> = [];
            for (definition in raw) {
                declarations.push({
                    name: definition.isStatement ? "<expression>"
                        : definition.isFunction() ? definition.selector() : definition.name,
                    kind: definition.isStatement ? "ExpressionStatement"
                        : definition.isFunction() ? "Function" : "Value",
                    parameters: definition.parameters,
                    line: definition.origin.line,
                    column: definition.origin.column,
                    bodyTokens: [for (token in definition.bodyTokens) {
                        kind: Std.string(token.kind),
                        value: token.value,
                        line: token.line,
                        column: token.column
                    }]
                });
            }
            final signatures:Array<Dynamic> = [];
            for (definition in raw) {
                if (!definition.isStatement) {
                    signatures.push({
                        name: definition.isFunction() ? definition.selector() : definition.name,
                        kind: definition.isFunction() ? "selector" : "value",
                        parameters: definition.parameters,
                        line: definition.origin.line,
                        column: definition.origin.column
                    });
                }
            }
            for (selector in Symbols.nativeSelectors())
                if (!symbols.isHostSelector(selector)) signatures.push({name: selector, kind: "native selector"});
            for (name in host.values) signatures.push({name: name, kind: "host value"});
            for (name in host.callables) signatures.push({name: name, kind: "host callable"});
            for (name in host.selectors) signatures.push({name: name, kind: "host selector"});
            return haxe.Json.stringify({
                declarations: declarations,
                symbols: signatures,
                declaredFunctions: raw.length,
                compiledNames: symbols.hostNames,
                interfaces: moduleInterfaces,
                moduleDependencies:moduleEdges
            }, null, "  ");
        });
    }

    static function expression(value:Null<Expr>):Dynamic {
        if (value == null) return null;
        return switch (value) {
            case Name(name): {kind: "Name", value: name};
            case HostRef(name): {kind: "HostRef", name: name};
            case Numeric(number): {kind: "Number", value: number};
            case Text(text): {kind: "Text", value: text};
            case BooleanLiteral(value): {kind: "Boolean", value: value};
            case FieldAccessor(key): {kind: "FieldAccessor", key: key};
            case FieldGet(record, key):
                {kind: "FieldGet", record: expression(record), key: key};
            case FieldSection(key):
                {kind: "FieldSection", key: key};
            case Match(input,tags,handlers):
                {kind:"Match",input:expression(input),alternatives:[for (i in 0...tags.length) {tag:tags[i],handler:expression(handlers[i])}]};
            case Variant(sum,tag,payload):
                {kind:"Variant", sum:switch(sum){case SumType(name,_,_):name;default:null;},tag:tag,payload:expression(payload)};
            case ValidateResult(input,required,_):
                {kind:"ValidateResult",input:expression(input),numericRange:mira.types.NumericRange.ofType(required).schema()};
            case Validate(input,required,success,failure):
                {kind:"Validate", input:expression(input), numericRange:mira.types.NumericRange.ofType(required).schema(),
                    integer:mira.types.NumericRange.integerType(required), success:expression(success), failure:expression(failure)};
            case Conditional(predicate, whenTrue, whenFalse):
                {kind: "Conditional", condition: expression(predicate),
                    whenTrue: expression(whenTrue), whenFalse: expression(whenFalse)};
            case Sequence(items):
                {kind: "Sequence", items: [for (item in items) expression(item)]};
            case Block(parameters, body):
                {kind: "Block", parameters: parameters, body: expression(body)};
            case Steps(expressions):
                {kind: "Steps", expressions: [for (item in expressions) expression(item)]};
            case Local(name, initializer):
                {kind: "Local", name: name, value: expression(initializer)};
            case Record(keys, values):
                {kind: "Record", fields: [for (index in 0...keys.length)
                    {key: keys[index], value: expression(values[index])}]};
            case Binary(symbol, left, right):
                {kind: "Binary", symbol: symbol, left: expression(left), right: expression(right)};
            case OperatorSection(symbol, left, right):
                {kind: "OperatorSection", symbol: symbol,
                    left: expression(left), right: expression(right)};
            case Call(selector, args):
                {kind: "Call", selector: selector, arguments: [for (arg in args) expression(arg)]};
            case HostCall(selector, args):
                {kind: "HostCall", selector: selector, arguments: [for (arg in args) expression(arg)]};
            case Section(selector, args):
                {kind: "Section", selector: selector, arguments: [for (arg in args) expression(arg)]};
            case HostSection(selector, args):
                {kind: "HostSection", selector: selector, arguments: [for (arg in args) expression(arg)]};
            case Placeholder: {kind: "Placeholder"};
            case Apply(callee, arg):
                {kind: "Apply", callee: expression(callee), argument: expression(arg)};
        };
    }

    static function safely(produce:Void->String):Dynamic {
        try {
            return {ok: true, output: produce()};
        } catch (error:MiraError) {
            return {ok: false, message: error.message, diagnostic: error.diagnostic};
        } catch (error:haxe.Exception) {
            return {ok: false, message: error.message};
        } catch (error:Dynamic) {
            return {ok: false, message: Std.string(error)};
        }
    }
}
