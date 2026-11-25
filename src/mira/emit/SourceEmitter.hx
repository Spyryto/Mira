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

            case BooleanLiteral(value):
                value ? "true" : "false";

            case FieldGet(record, key):
                // Evaluate the receiver once and preserve the same missing-key
                // error semantics as the first-class field accessor.
                "(" + expression(FieldAccessor(key), target, scope, reservedHostNames)
                    + ")(" + expression(record, target, scope, reservedHostNames) + ")";

            case FieldSection(key):
                expression(FieldAccessor(key), target, scope, reservedHostNames);

            case FieldAccessor(key):
                final accessor = switch (target) {
                    case JavaScript:
                        final quoted = haxe.Json.stringify(key);
                        '((__miraFieldRecord) => { if (__miraFieldRecord == null'
                            + ' || !Object.hasOwn(__miraFieldRecord, ' + quoted + '))'
                            + ' throw new Error("Missing record field: " + ' + quoted + ');'
                            + ' return __miraFieldRecord[' + quoted + ']; })';
                    case Php:
                        final quoted = phpString(key);
                        "((static function($__miraFieldRecord) { if (!is_array($__miraFieldRecord)"
                            + " || !array_key_exists(" + quoted + ", $__miraFieldRecord))"
                            + " throw new \\RuntimeException('Missing record field: ' . " + quoted + ");"
                            + " return $__miraFieldRecord[" + quoted + "]; }))";
                };
                accessor;

            case Conditional(predicate, whenTrue, whenFalse):
                "(" + expression(predicate, target, scope, reservedHostNames)
                    + " ? " + expression(whenTrue, target, scope, reservedHostNames)
                    + " : " + expression(whenFalse, target, scope, reservedHostNames) + ")";

            case Sequence(items):
                "[" + [for (item in items)
                    expression(item, target, scope, reservedHostNames)].join(", ") + "]";

            case Block(parameters, body):
                final names = [for (parameter in parameters) Mangle.name(parameter)];
                final formals = [for (name in names)
                    target == Php ? "$" + name : name];
                final innerScope = parameters.concat(scope);
                switch (body) {
                    case Steps(items):
                        final statements:Array<String> = [];
                        for (index in 0...items.length - 1) {
                            statements.push(expression(items[index], target,
                                innerScope, reservedHostNames) + ";");
                        }
                        final last = expression(items[items.length - 1], target,
                            innerScope, reservedHostNames);
                        final contents = statements.join(" ") + " return " + last + ";";
                        switch (target) {
                            case JavaScript:
                                "((" + formals.join(", ") + ") => { "
                                    + contents + " })";
                            case Php:
                                // PHP anonymous functions need explicit lexical captures.
                                // Remove shadowed and duplicate names before using use(...).
                                final seen = names.copy();
                                final captures:Array<String> = [];
                                for (outer in scope) {
                                    final name = Mangle.name(outer);
                                    if (seen.indexOf(name) == -1) {
                                        seen.push(name);
                                        captures.push("$" + name);
                                    }
                                }
                                final use = captures.length == 0
                                    ? "" : " use (" + captures.join(", ") + ")";
                                "(function(" + formals.join(", ") + ")" + use
                                    + " { " + contents + " })";
                        }
                    default:
                        // Preserve compact native arrows for single-expression blocks.
                        final value = expression(body, target, innerScope,
                            reservedHostNames);
                        switch (target) {
                            case JavaScript: "((" + formals.join(", ") + ") => " + value + ")";
                            case Php: "(fn(" + formals.join(", ") + ") => " + value + ")";
                        }
                }

            case Steps(_):
                throw new MiraError("Steps can only occur inside a block");

            case Record(keys, values):
                final entries:Array<String> = [];
                for (index in 0...keys.length) {
                    final key = switch (target) {
                        case JavaScript: haxe.Json.stringify(keys[index]);
                        case Php: phpString(keys[index]);
                    };
                    final value = expression(values[index], target, scope, reservedHostNames);
                    entries.push(switch (target) {
                        case JavaScript: key + ": " + value;
                        case Php: key + " => " + value;
                    });
                }
                switch (target) {
                    case JavaScript: "({" + entries.join(", ") + "})";
                    case Php: "([" + entries.join(", ") + "])";
                }

            case Binary(symbol, left, right):
                if (["+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">="].indexOf(symbol) < 0) {
                    throw new MiraError("Unsupported operator " + symbol);
                }
                "(" + expression(left, target, scope, reservedHostNames) + " "
                    + (symbol == "==" ? "===" : symbol == "!=" ? "!==" : symbol)
                    + " " + expression(right, target, scope, reservedHostNames) + ")";

            case OperatorSection(symbol, left, right):
                operatorSection(symbol, left, right, target, scope, reservedHostNames);

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

    static function operatorSection(
        symbol:String,
        left:Expr,
        right:Expr,
        target:Target,
        scope:Array<String>,
        reservedHostNames:Array<String>
    ):String {
        if (["+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">="].indexOf(symbol) < 0) {
            throw new MiraError("Unsupported operator section " + symbol);
        }
        final parameters:Array<String> = [];
        final operands:Array<String> = [];
        for (operand in [left, right]) {
            switch (operand) {
                case Placeholder:
                    final parameter = freshParameter(parameters, scope, reservedHostNames);
                    parameters.push(parameter);
                    operands.push(target == Php ? "$" + parameter : parameter);
                default:
                    operands.push(expression(operand, target, scope, reservedHostNames));
            }
        }
        if (parameters.length == 0) throw new MiraError("Operator section needs a placeholder");
        final formals = [for (parameter in parameters)
            target == Php ? "$" + parameter : parameter];
        final emittedOperator = symbol == "==" ? "===" : symbol == "!=" ? "!==" : symbol;
        final body = "(" + operands[0] + " " + emittedOperator + " " + operands[1] + ")";
        return switch (target) {
            case JavaScript: "((" + formals.join(", ") + ") => " + body + ")";
            case Php: "(fn(" + formals.join(", ") + ") => " + body + ")";
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
