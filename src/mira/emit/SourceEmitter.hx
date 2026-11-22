package mira.emit;

import mira.MiraError;
import mira.Target;
import mira.syntax.Expr;
import mira.resolve.Mangle;

class SourceEmitter {
    public static function expression(
        expr:Expr,
        target:Target,
        scope:Array<String>,
        reservedHostNames:Array<String>
    ):String {
        return switch (expr) {
            case Name(name):
                if (scope.indexOf(name) < 0) throw new MiraError("Unbound name " + name);
                final symbol = Mangle.name(name);
                target == Php ? "$" + symbol : symbol;

            case HostRef(name):
                hostAccess(name, target);

            case Numeric(value):
                value;

            case Text(value):
                switch (target) {
                    case JavaScript: haxe.Json.stringify(value);
                    case Php: phpString(value);
                }

            case Binary(symbol, left, right):
                if (["+", "-", "*", "/", "%"].indexOf(symbol) < 0) {
                    throw new MiraError("Unsupported operator " + symbol);
                }
                "(" + expression(left, target, scope, reservedHostNames) + " "
                    + symbol + " " + expression(right, target, scope, reservedHostNames) + ")";

            case Call(selector, arguments):
                selectorCall(selector, [
                    for (arg in arguments) expression(arg, target, scope, reservedHostNames)
                ], target, false);

            case HostCall(selector, arguments):
                selectorCall(selector, [
                    for (arg in arguments) expression(arg, target, scope, reservedHostNames)
                ], target, true);

            case Section(selector, arguments):
                section(selector, arguments, target, scope, reservedHostNames, false);

            case HostSection(selector, arguments):
                section(selector, arguments, target, scope, reservedHostNames, true);

            case Apply(callee, arg):
                "(" + expression(callee, target, scope, reservedHostNames)
                    + ")(" + expression(arg, target, scope, reservedHostNames) + ")";

            case Placeholder:
                throw new MiraError("A placeholder cannot be emitted outside a selector section");
        };
    }

    public static function hostAccess(name:String, target:Target):String {
        return switch (target) {
            case JavaScript: '__miraHost[' + haxe.Json.stringify(name) + ']';
            case Php: "$GLOBALS[\"__miraHost\"][" + phpString(name) + "]";
        };
    }

    static function section(
        selector:String,
        arguments:Array<Expr>,
        target:Target,
        scope:Array<String>,
        reservedHostNames:Array<String>,
        fromHost:Bool
    ):String {
        final params:Array<String> = [];
        final emittedArgs:Array<String> = [];
        for (argument in arguments) {
            switch (argument) {
                case Placeholder:
                    final param = freshParameter(params, scope, reservedHostNames);
                    params.push(param);
                    emittedArgs.push(target == Php ? "$" + param : param);
                default:
                    emittedArgs.push(expression(argument, target, scope, reservedHostNames));
            }
        }
        if (params.length == 0) throw new MiraError("A section needs a placeholder");

        final body = selectorCall(selector, emittedArgs, target, fromHost);
        final formals = [for (param in params) target == Php ? "$" + param : param];
        return switch (target) {
            case JavaScript: "((" + formals.join(", ") + ") => " + body + ")";
            case Php: "(fn(" + formals.join(", ") + ") => " + body + ")";
        };
    }

    static function selectorCall(
        selector:String,
        arguments:Array<String>,
        target:Target,
        fromHost:Bool
    ):String {
        final callee = fromHost
            ? hostAccess(selector, target)
            : Mangle.selector(selector.substr(0, selector.length - 1).split(":"));
        // PHP cannot invoke a named function through "(name)(args)":
        // it would resolve 'name' as a constant. Host array callables do
        // require the parentheses, ordinary functions do not.
        return (fromHost ? "(" + callee + ")" : callee)
            + "(" + arguments.join(", ") + ")";
    }

    static function freshParameter(
        parameters:Array<String>, scope:Array<String>, reservedHostNames:Array<String>
    ):String {
        var candidate = "__miraSection" + parameters.length;
        while (parameters.indexOf(candidate) >= 0
            || reservedHostNames.indexOf(candidate) >= 0
            || shadowsLocal(candidate, scope)) {
            candidate += "_";
        }
        return candidate;
    }

    static function shadowsLocal(candidate:String, scope:Array<String>):Bool {
        for (name in scope) if (Mangle.name(name) == candidate) return true;
        return false;
    }

    static function phpString(value:String):String {
        final escaped = StringTools.replace(
            StringTools.replace(value, "\\", "\\\\"),
            "'", "\\'"
        );
        return "'" + escaped + "'";
    }
}
