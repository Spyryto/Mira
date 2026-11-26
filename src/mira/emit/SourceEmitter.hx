package mira.emit;

import mira.MiraError;
import mira.Target;
import mira.syntax.Expr;
import mira.resolve.Mangle;
import mira.resolve.Symbols;
import mira.types.NumericGuard;
import haxe.ds.ObjectMap;

class SourceEmitter {
    public static function expression(
        expr:Expr,
        target:Target,
        scope:Array<String>,
        reservedHostNames:Array<String>,
        ?guards:ObjectMap<Dynamic,NumericGuard>
    ):String {
        final emitted = switch (expr) {
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
                "(" + expression(FieldAccessor(key), target, scope, reservedHostNames, guards)
                    + ")(" + expression(record, target, scope, reservedHostNames, guards) + ")";

            case FieldSection(key):
                expression(FieldAccessor(key), target, scope, reservedHostNames, guards);

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

            case Validate(input,required,success,failure):
                final constraint = new NumericGuard();
                constraint.integer = mira.types.NumericRange.integerType(required);
                constraint.range = mira.types.NumericRange.ofType(required);
                final prefix = target == Php ? "$" : "";
                final v = prefix + "__miraValidationValue";
                final yes = prefix + "__miraValidationSuccess";
                final no = prefix + "__miraValidationFailure";
                final predicate = numericTests(target,constraint,v).join(" && ");
                final message = constraint.integer ? "Invalid Integer value" : "Invalid numeric value";
                final body = "(" + predicate + " ? " + yes + "(" + v + ") : " + no + "('" + message + "'))";
                final params = v + ", " + yes + ", " + no;
                final wrapper = target == Php ? "(static fn(" + params + ") => " + body + ")"
                    : "((" + params + ") => " + body + ")";
                wrapper + "(" + expression(input,target,scope,reservedHostNames,guards) + ", "
                    + expression(success,target,scope,reservedHostNames,guards) + ", "
                    + expression(failure,target,scope,reservedHostNames,guards) + ")";

            case Conditional(predicate, whenTrue, whenFalse):
                "(" + expression(predicate, target, scope, reservedHostNames, guards)
                    + " ? " + expression(whenTrue, target, scope, reservedHostNames, guards)
                    + " : " + expression(whenFalse, target, scope, reservedHostNames, guards) + ")";

            case Sequence(items):
                "[" + [for (item in items)
                    expression(item, target, scope, reservedHostNames, guards)].join(", ") + "]";

            case Block(parameters, body):
                final names = [for (parameter in parameters) Mangle.name(parameter)];
                final formals = [for (name in names)
                    target == Php ? "$" + name : name];
                final innerScope = parameters.concat(scope);
                switch (body) {
                    case Steps(items):
                        final statements:Array<String> = [];
                        for (index in 0...(items.length - 1)) {
                            switch (items[index]) {
                                case Local(name, value):
                                    final rhs = expression(value, target,
                                        innerScope, reservedHostNames, guards);
                                    final symbol = Mangle.name(name);
                                    statements.push((target == Php ? "$" : "const ")
                                        + symbol + " = " + rhs + ";");
                                    innerScope.unshift(name);
                                default:
                                    statements.push(expression(items[index], target,
                                        innerScope, reservedHostNames, guards) + ";");
                            }
                        }
                        final last = expression(items[items.length - 1], target,
                            innerScope, reservedHostNames, guards);
                        final contents = statements.join(" ") + " return " + last + ";";
                        switch (target) {
                            case JavaScript:
                                "((" + formals.join(", ") + ") => { "
                                    + contents + " })";
                            case Php:
                                // PHP anonymous functions need explicit lexical captures.
                                // Remove shadowed and duplicate names before using use(...).
                                final referenced:Array<String> = [];
                                referencedNames(body, parameters, referenced);
                                final seen = names.copy();
                                final captures:Array<String> = [];
                                for (outer in scope) {
                                    final name = Mangle.name(outer);
                                    if (referenced.indexOf(outer) >= 0
                                        && seen.indexOf(name) == -1) {
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
                            reservedHostNames, guards);
                        switch (target) {
                            case JavaScript: "((" + formals.join(", ") + ") => " + value + ")";
                            case Php: "(fn(" + formals.join(", ") + ") => " + value + ")";
                        }
                }

            case Steps(_):
                throw new MiraError("Steps can only occur inside a block");
            case Local(_, _):
                throw new MiraError("Local bindings can only occur in block steps");

            case Record(keys, values):
                final entries:Array<String> = [];
                for (index in 0...keys.length) {
                    final key = switch (target) {
                        case JavaScript: haxe.Json.stringify(keys[index]);
                        case Php: phpString(keys[index]);
                    };
                    final value = expression(values[index], target, scope, reservedHostNames, guards);
                    entries.push(switch (target) {
                        case JavaScript: (keys[index] == "__proto__" ? "[" + key + "]" : key) + ": " + value;
                        case Php: key + " => " + value;
                    });
                }
                switch (target) {
                    case JavaScript: "({" + entries.join(", ") + "})";
                    case Php: "([" + entries.join(", ") + "])";
                }

            case Binary(symbol, left, right):
                if (["+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "AND", "OR"].indexOf(symbol) < 0) {
                    throw new MiraError("Unsupported operator " + symbol);
                }
                "(" + expression(left, target, scope, reservedHostNames, guards) + " "
                    + (symbol == "==" ? "===" : symbol == "!=" ? "!==" : symbol == "AND" ? "&&" : symbol == "OR" ? "||" : symbol)
                    + " " + expression(right, target, scope, reservedHostNames, guards) + ")";

            case OperatorSection(symbol, left, right):
                operatorSection(symbol, left, right, target, scope, reservedHostNames, guards);

            case Call(selector, arguments):
                selectorCall(selector, [
                    for (arg in arguments) expression(arg, target, scope, reservedHostNames, guards)
                ], target, false);

            case HostCall(selector, arguments):
                selectorCall(selector, [
                    for (arg in arguments) expression(arg, target, scope, reservedHostNames, guards)
                ], target, true);

            case Section(selector, arguments):
                section(selector, arguments, target, scope, reservedHostNames, false, guards);

            case HostSection(selector, arguments):
                section(selector, arguments, target, scope, reservedHostNames, true, guards);

            case Apply(callee, arg):
                "(" + expression(callee, target, scope, reservedHostNames, guards)
                    + ")(" + (arg == null ? "" : expression(arg, target, scope, reservedHostNames, guards)) + ")";

            case Placeholder:
                throw new MiraError("A placeholder cannot be emitted outside a selector section");
        };
        return guards != null && guards.exists(expr) ? numericGuard(emitted,target,guards.get(expr)) : emitted;
    }

    // The generated parameter has its own scope; the operand is evaluated once.
    static function numericTests(target:Target,guard:NumericGuard,v:String):Array<String> {
        final tests:Array<String> = target == Php
            ? ["(\\is_int(" + v + ") || \\is_float(" + v + "))", "\\is_finite(" + v + ")"]
            : ["typeof " + v + " === \"number\"", "(" + v + " - " + v + ") === 0"];
        if (guard.integer) {
            tests.push(v + " >= -9007199254740991");
            tests.push(v + " <= 9007199254740991");
            tests.push(target == Php ? "\\floor(" + v + ") == " + v : v + " % 1 === 0");
        }
        if (guard.range != null) {
            final r = guard.range;
            if (Math.isFinite(r.low)) tests.push(v + (r.lowClosed ? " >= " : " > ") + Std.string(r.low));
            if (Math.isFinite(r.high)) tests.push(v + (r.highClosed ? " <= " : " < ") + Std.string(r.high));
        }
        return tests;
    }

    static function numericGuard(value:String,target:Target,guard:NumericGuard):String {
        final v = target == Php ? "$__miraNumericValue" : "__miraNumericValue";
        final tests = numericTests(target,guard,v);
        final message = guard.integer ? "Mira Integer constraint violated" : "Mira numeric refinement violated";
        final body = "if (!(" + tests.join(" && ") + ")) throw new "
            + (target == Php ? "\\RuntimeException" : "Error") + "('" + message + "'); return " + v + ";";
        return (target == Php ? "(static function(" + v + ") { " + body + " })"
            : "((" + v + ") => { " + body + " })") + "(" + value + ")";
    }

    // Collect only lexical names actually referenced by a block body.
    // Nested blocks introduce their own parameters, but references to
    // enclosing parameters remain captures for their ancestors.
    static function referencedNames(value:Expr, bound:Array<String>,
        names:Array<String>):Void {
        switch (value) {
            case Name(name):
                if (bound.indexOf(name) == -1 && names.indexOf(name) == -1)
                    names.push(name);
            case FieldGet(receiver, _):
                referencedNames(receiver, bound, names);
            case Validate(input,_,success,failure):
                referencedNames(input,bound,names);
                referencedNames(success,bound,names);
                referencedNames(failure,bound,names);
            case Conditional(test, whenTrue, whenFalse):
                referencedNames(test, bound, names);
                referencedNames(whenTrue, bound, names);
                referencedNames(whenFalse, bound, names);
            case Steps(items):
                final visible = bound.copy();
                for (item in items) {
                    switch (item) {
                        case Local(name, initializer):
                            referencedNames(initializer, visible, names);
                            visible.push(name);
                        default:
                            referencedNames(item, visible, names);
                    }
                }
            case Local(_, initializer):
                referencedNames(initializer, bound, names);
            case Sequence(items) | Call(_, items) | HostCall(_, items)
                | Section(_, items) | HostSection(_, items):
                for (item in items) referencedNames(item, bound, names);
            case Record(_, values):
                for (item in values) referencedNames(item, bound, names);
            case Binary(_, left, right) | OperatorSection(_, left, right):
                referencedNames(left, bound, names);
                referencedNames(right, bound, names);
            case Apply(callee, argument):
                referencedNames(callee, bound, names);
                if (argument != null) referencedNames(argument, bound, names);
            case Block(parameters, body):
                referencedNames(body, parameters.concat(bound), names);
            default:
        }
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
        reservedHostNames:Array<String>,
        ?guards:ObjectMap<Dynamic,NumericGuard>
    ):String {
        if (["+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "AND", "OR"].indexOf(symbol) < 0) {
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
                    operands.push(expression(operand, target, scope, reservedHostNames, guards));
            }
        }
        if (parameters.length == 0) throw new MiraError("Operator section needs a placeholder");
        final formals = [for (parameter in parameters)
            target == Php ? "$" + parameter : parameter];
        final emittedOperator = symbol == "==" ? "===" : symbol == "!=" ? "!==" : symbol == "AND" ? "&&" : symbol == "OR" ? "||" : symbol;
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
        fromHost:Bool,
        ?guards:ObjectMap<Dynamic,NumericGuard>
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
                    emittedArgs.push(expression(argument, target, scope, reservedHostNames, guards));
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
        if (!fromHost && selector == Symbols.RECORD_UPDATE)
            return recordUpdate(arguments, target);
        if (!fromHost && Symbols.collectionSelectors().indexOf(selector) >= 0)
            return collectionCall(selector, arguments, target);
        final callee = fromHost
            ? hostAccess(selector, target)
            : Mangle.selector(selector.substr(0, selector.length - 1).split(":"));
        // PHP cannot invoke a named function through "(name)(args)":
        // it would resolve 'name' as a constant. Host array callables do
        // require the parentheses, ordinary functions do not.
        return (fromHost ? "(" + callee + ")" : callee)
            + "(" + arguments.join(", ") + ")";
    }


    // JS and PHP use their native shallow-copy operations. Empty arrays
    // are accepted as empty records on both targets because PHP cannot
    // distinguish them. Integer-shaped keys are outside this operation's
    // portable record subset.
    static function recordUpdate(arguments:Array<String>, target:Target):String {
        final callable = switch (target) {
            case JavaScript:
                '((a, b) => { const valid = v => v != null'
                + ' && ((Array.isArray(v) && v.length === 0)'
                + ' || Object.prototype.toString.call(v) === "[object Object]")'
                + ' && Object.keys(v).every(k => !/^-?(0|[1-9][0-9]*)$/.test(k));'
                + ' if (!valid(a) || !valid(b)) throw new Error("update:with: expects records with non-integer keys");'
                + ' return {...a, ...b}; })';
            case Php:
                "((static function($a, $b) { "
                + "$valid = static function($v) { if (!is_array($v)) return false;"
                + " foreach (array_keys($v) as $k) if (!is_string($k)"
                + " || preg_match('/^-?(0|[1-9][0-9]*)$/D', $k)) return false;"
                + " return true; };"
                + " if (!$valid($a) || !$valid($b)) throw new \\RuntimeException('update:with: expects records with non-integer keys');"
                + " return array_replace($a, $b); }))";
        };
        return callable + "(" + arguments.join(", ") + ")";
    }


    static function collectionCall(selector:String, arguments:Array<String>, target:Target):String {
        final append = selector == "append:to:";
        final fold = selector == "fold:with:from:";
        final map = selector == "map:with:" || selector == "collect:with:";
        final remove = selector == "remove:if:";
        final message = selector + " expects a list";
        final callable = switch (target) {
            case JavaScript:
                final formals = append ? "item, items" : fold ? "items, callback, seed" : "items, callback";
                final check = 'if (!Array.isArray(items)) throw new Error(' + haxe.Json.stringify(message) + '); ';
                final cb = append ? "" : 'if (typeof callback !== "function") throw new Error("Expected collection callback"); ';
                final body = if (append) 'return [...items, item];'
                    else if (fold) 'return items.reduce((acc, item) => callback(acc, item), seed);'
                    else if (map) 'return items.map(item => callback(item));'
                    else 'return items.filter(item => { const keep = callback(item); '
                        + 'if (typeof keep !== "boolean") throw new Error("Expected Boolean predicate"); return '
                        + (remove ? '!keep' : 'keep') + '; });';
                '((' + formals + ') => { ' + check + cb + body + ' })';
            case Php:
                final formals = append ? "$item, $items" : fold ? "$items, $callback, $seed" : "$items, $callback";
                final check = "if (!is_array($items) || !array_is_list($items)) throw new \\RuntimeException("
                    + phpString(message) + "); ";
                final cb = append ? "" : "if (!($callback instanceof \\Closure)) throw new \\RuntimeException('Expected collection callback'); ";
                final body = if (append) "$items[] = $item; return $items;"
                    else if (fold) "return array_reduce($items, $callback, $seed);"
                    else if (map) "return array_map($callback, $items);"
                    else "return array_values(array_filter($items, static function($item) use ($callback) { "
                        + "$keep = $callback($item); if (!is_bool($keep)) throw new \\RuntimeException('Expected Boolean predicate'); return "
                        + (remove ? "!$keep" : "$keep") + "; }));";
                "((static function(" + formals + ") { " + check + cb + body + " }))";
        };
        return callable + "(" + arguments.join(", ") + ")";
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
