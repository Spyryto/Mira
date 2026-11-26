package mira.studio;

import mira.Compiler;
import mira.HostEnvironment;
import mira.Target;
import mira.MiraError;
import mira.syntax.Expr;
import mira.syntax.Definition;
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
            version: "0.57.0"
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
        return function(name) return files.get(name);
    }

    public static function compile(source:String, targetName:String, ?hostJson:String,
        ?withLocations:Bool = false, ?modulesJson:String, ?checked:Bool = false):Dynamic {
        final locations:Array<GeneratedLocation> = withLocations ? [] : null;
        final result = safely(function() {
            final target = switch (targetName) {
                case "js": JavaScript;
                case "php": Php;
                default: throw new MiraError("Unknown target: " + targetName);
            };
            final host = hostJson == null ? HostEnvironment.empty()
                : HostEnvironment.fromJson(hostJson);
            return checked ? Compiler.transpileChecked(source,target,host,locations,resolver(modulesJson))
                : Compiler.transpile(source, target, host, locations, resolver(modulesJson));
        });
        if (withLocations && result.ok) Reflect.setField(result, "locations", locations);
        return result;
    }

    public static function check(source:String, ?hostJson:String, ?modulesJson:String):Dynamic {
        return safely(function() {
            final host = hostJson == null ? HostEnvironment.empty() : HostEnvironment.fromJson(hostJson);
            return haxe.Json.stringify(Compiler.check(source,host,resolver(modulesJson)), null, "  ");
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
            final definitions = Compiler.parse(source, host, resolver(modulesJson));
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

    // Exposes actual compiler intermediate data, not a reconstructed diagram.
    // The raw declarations are collected before expression resolution.
    public static function trace(source:String, ?hostJson:String, ?modulesJson:String):Dynamic {
        return safely(function() {
            final host = hostJson == null ? HostEnvironment.empty()
                : HostEnvironment.fromJson(hostJson);
            final raw = mira.Modules.collect(source, resolver(modulesJson));
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
                compiledNames: symbols.hostNames
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
