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
                if (scope.indexOf(name) < 0) {
                    throw new MiraError("Unbound name " + name);
                }
                final symbol = Mangle.name(name);
                target == Php ? "$" + symbol : symbol;

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

                "(" + expression(left, target, scope, reservedHostNames)
                    + " " + symbol + " "
                    + expression(right, target, scope, reservedHostNames) + ")";

            case Call(selector, arguments):
                final emittedArguments = [
                    for (argument in arguments)
                        expression(argument, target, scope, reservedHostNames)
                ];
                selectorCall(selector, emittedArguments);

            case Section(selector, arguments):
                section(selector, arguments, target, scope, reservedHostNames);

            case Apply(callee, argument):
                // Explicit parentheses also keep anonymous-function calls
                // syntactically valid for both JavaScript and PHP.
                "(" + expression(callee, target, scope, reservedHostNames)
                    + ")(" + expression(argument, target, scope, reservedHostNames) + ")";

            case Placeholder:
                throw new MiraError(
                    "A placeholder cannot be emitted outside a selector section"
                );
        };
    }

    static function section(
        selector:String,
        arguments:Array<Expr>,
        target:Target,
        scope:Array<String>,
        reservedHostNames:Array<String>
    ):String {
        final parameters:Array<String> = [];
        final callArguments:Array<String> = [];

        for (argument in arguments) {
            switch (argument) {
                case Placeholder:
                    final parameter = freshParameter(
                        parameters, scope, reservedHostNames
                    );
                    parameters.push(parameter);
                    callArguments.push(target == Php ? "$" + parameter : parameter);

                default:
                    callArguments.push(
                        expression(argument, target, scope, reservedHostNames)
                    );
            }
        }

        if (parameters.length == 0) {
            throw new MiraError("A section must contain at least one placeholder");
        }

        final body = selectorCall(selector, callArguments);
        final formals = [
            for (parameter in parameters)
                target == Php ? "$" + parameter : parameter
        ];

        return switch (target) {
            case JavaScript:
                "((" + formals.join(", ") + ") => " + body + ")";

            case Php:
                "(fn(" + formals.join(", ") + ") => " + body + ")";
        };
    }

    static function selectorCall(selector:String, arguments:Array<String>):String {
        final labels = selector.substr(0, selector.length - 1).split(":");
        final name = Mangle.selector(labels);
        return name + "(" + arguments.join(", ") + ")";
    }

    static function freshParameter(
        parameters:Array<String>,
        scope:Array<String>,
        reservedHostNames:Array<String>
    ):String {
        var candidate = "__miraSection" + parameters.length;

        // Scope contains original user names; reservedHostNames contains
        // ALL generated top-level names, including selector functions.
        // This keeps section binding hygienic without forbidding user names.
        while (parameters.indexOf(candidate) != -1
            || reservedHostNames.indexOf(candidate) != -1
            || shadowsLocal(candidate, scope)) {
            candidate += "_";
        }
        return candidate;
    }

    static function shadowsLocal(candidate:String, scope:Array<String>):Bool {
        for (name in scope) {
            if (Mangle.name(name) == candidate) {
                return true;
            }
        }
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
