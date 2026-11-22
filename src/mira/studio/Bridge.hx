package mira.studio;

import mira.Compiler;
import mira.HostEnvironment;
import mira.Target;
import mira.MiraError;
import mira.syntax.Expr;
import mira.syntax.Definition;

class Bridge {
    public static function main():Void {
        final global:Dynamic = js.Syntax.code("globalThis");
        Reflect.setField(global, "MiraStudioCompiler", {
            compile: compile,
            tokens: tokens,
            ast: ast,
            version: "0.3.0"
        });
    }

    public static function compile(source:String, targetName:String, ?hostJson:String):Dynamic {
        return safely(function() {
            final target = switch (targetName) {
                case "js": JavaScript;
                case "php": Php;
                default: throw new MiraError("Unknown target: " + targetName);
            };
            final host = hostJson == null ? HostEnvironment.empty()
                : HostEnvironment.fromJson(hostJson);
            return Compiler.transpile(source, target, host);
        });
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

    static function expression(value:Null<Expr>):Dynamic {
        if (value == null) return null;
        return switch (value) {
            case Name(name): {kind: "Name", value: name};
            case HostRef(name): {kind: "HostRef", name: name};
            case Numeric(number): {kind: "Number", value: number};
            case Text(text): {kind: "Text", value: text};
            case Sequence(items):
                {kind: "Sequence", items: [for (item in items) expression(item)]};
            case Record(keys, values):
                {kind: "Record", fields: [for (index in 0...keys.length)
                    {key: keys[index], value: expression(values[index])}]};
            case Binary(symbol, left, right):
                {kind: "Binary", symbol: symbol, left: expression(left), right: expression(right)};
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
