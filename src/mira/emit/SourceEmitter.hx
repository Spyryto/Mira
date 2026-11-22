package mira.emit;

import mira.MiraError;
import mira.syntax.Expr;
import mira.resolve.Mangle;

class SourceEmitter {
    public static function expression(expr:Expr, target:String, scope:Array<String>):String {
        return switch (expr) {
            case Name(name):
                if (scope.indexOf(name) < 0) {
                    throw new MiraError("Unbound name " + name);
                }
                final symbol = Mangle.name(name);
                target == "php" ? "$" + symbol : symbol;

            case Numeric(value):
                value;

            case Text(value):
                if (target == "js") {
                    haxe.Json.stringify(value);
                } else {
                    phpString(value);
                }

            case Binary(operator, left, right):
                if (["+", "-", "*", "/", "%"].indexOf(operator) < 0) {
                    throw new MiraError("Unsupported operator " + operator);
                }
                "(" + expression(left, target, scope)
                    + " " + operator + " "
                    + expression(right, target, scope) + ")";

            case Call(selector, arguments):
                final parts = selector.substr(0, selector.length - 1).split(":");
                final name = Mangle.selector(parts);
                final emitted:Array<String> = [];
                for (argument in arguments) {
                    emitted.push(expression(argument, target, scope));
                }
                name + "(" + emitted.join(", ") + ")";
        };
    }

    static function phpString(value:String):String {
        final escaped = StringTools.replace(
            StringTools.replace(value, "\\", "\\\\"),
            "'", "\\'"
        );
        return "'" + escaped + "'";
    }
}
