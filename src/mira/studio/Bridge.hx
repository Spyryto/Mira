package mira.studio;

import mira.Compiler;
import mira.HostEnvironment;
import mira.Target;
import mira.MiraError;
import mira.syntax.Expr;
import mira.syntax.Definition;
import mira.syntax.DefinitionParser;
import mira.lex.Lexer;
import mira.resolve.Symbols;
import mira.emit.SourceLocations.GeneratedLocation;

class Bridge {
    public static function main():Void {
        final global:Dynamic = js.Syntax.code("globalThis");
        Reflect.setField(global, "MiraStudioCompiler", {
            compile: compile,
            tokens: tokens,
            ast: ast,
            trace: trace,
            version: "0.19.0"
        });
    }

    public static function compile(source:String, targetName:String, ?hostJson:String,
        ?withLocations:Bool = false):Dynamic {
        final locations:Array<GeneratedLocation> = withLocations ? [] : null;
        final result = safely(function() {
            final target = switch (targetName) {
                case "js": JavaScript;
                case "php": Php;
                default: throw new MiraError("Unknown target: " + targetName);
            };
            final host = hostJson == null ? HostEnvironment.empty()
                : HostEnvironment.fromJson(hostJson);
            return Compiler.transpile(source, target, host, locations);
        });
        if (withLocations && result.ok) Reflect.setField(result, "locations", locations);
        return result;
    }

    public static function tokens(source:String):Dynamic {
        return safely(function() return Compiler.inspectTokens(source));
    }

    public static function ast(source:String, ?hostJson:String):Dynamic {
        return safely(function() {
            final host = hostJson == null ? HostEnvironment.empty()
                : HostEnvironment.fromJson(hostJson);
            final definitions = Compiler.parse(source, host);
            final tree:Array<Dynamic> = [];
            for (definition in definitions) {
                final node:Dynamic = {
                    kind: definition.isStatement ? "ExpressionStatement"
                        : definition.isFunction() ? "Function" : "Value",
                    line: definition.origin.line,
                    column: definition.origin.column,
                    body: expression(definition.body)
                };
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
    public static function trace(source:String, ?hostJson:String):Dynamic {
        return safely(function() {
            final host = hostJson == null ? HostEnvironment.empty()
                : HostEnvironment.fromJson(hostJson);
            final raw = DefinitionParser.parse(new Lexer(source).tokenize());
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
        } catch (error:haxe.Exception) {
            return {ok: false, message: error.message};
        } catch (error:Dynamic) {
            return {ok: false, message: Std.string(error)};
        }
    }
}
