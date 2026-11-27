package mira.types;

import mira.Compiler;
import mira.HostEnvironment;
import mira.MiraError;
import mira.syntax.Definition;
import mira.syntax.Expr;
import mira.syntax.ExpressionOrigins;

// A bounded, data-only projection of the canonical AST. No execution of
// emitted code, host calls, arbitrary functions or user-supplied modules.
enum ConstantValue {
    CNumber(value:Float);
    CText(value:String);
    CBoolean(value:Bool);
    CList(values:Array<ConstantValue>);
    CRecord(fields:Map<String,ConstantValue>);
    CVariant(tag:String,payload:Null<ConstantValue>);
}

class ConstantData {
    final definitions = new Map<String,Definition>();
    var budget = 10000;

    function new(program:Array<Definition>) {
        for (d in program) {
            if (d.isStatement || d.modulePath != null || d.isAbstractContract)
                throw new MiraError("Constant data requires plain declarations",d.origin);
            if (d.isFunction()) switch (d.body) {
                case Variant(_,_,_):
                default: throw new MiraError("Constant data does not execute functions",d.origin);
            }
            definitions.set(d.isFunction() ? d.selector() : d.name,d);
        }
    }

    public static function read(source:String,name:String):ConstantValue {
        if (source.length > 65536) throw new MiraError("Constant data source limit");
        final origins = new ExpressionOrigins();
        final visibility = new TypeVisibility();
        final host = HostEnvironment.empty();
        final program = Compiler.parse(source,host,null,null,origins,visibility);
        final data = new ConstantData(program);
        new TypeChecker(origins,host,null,visibility).check(program);
        return data.evaluate(Name(name),0);
    }

    function evaluate(expr:Expr,depth:Int):ConstantValue {
        if (--budget < 0 || depth > 64) throw new MiraError("Constant data evaluation limit");
        return switch (expr) {
            case Numeric(value): CNumber(Std.parseFloat(value));
            case Text(value): CText(value);
            case BooleanLiteral(value): CBoolean(value);
            case Sequence(items): CList([for (item in items) evaluate(item,depth+1)]);
            case Record(keys,values):
                CRecord([for (i in 0...keys.length) keys[i] => evaluate(values[i],depth+1)]);
            case Name(name):
                final d = definitions.get(name);
                if (d == null || d.isFunction()) throw new MiraError("Unknown constant " + name);
                evaluate(d.scalarValue == null ? d.body : d.scalarValue,depth+1);
            case Variant(_,tag,null): CVariant(tag,null);
            case Call(selector,args):
                final d = definitions.get(selector);
                if (d == null || !d.isFunction() || args.length != 1)
                    throw new MiraError("Constant data permits only sum constructors");
                switch (d.body) {
                    case Variant(_,tag,Name(parameter)) if (d.parameters.length == 1 && d.parameters[0] == parameter):
                        CVariant(tag,evaluate(args[0],depth+1));
                    default: throw new MiraError("Constant data permits only sum constructors",d.origin);
                }
            default: throw new MiraError("Unsupported constant data expression");
        };
    }

    public static function json(value:ConstantValue):String {
        return switch (value) {
            case CNumber(n): haxe.Json.stringify(n);
            case CText(t): haxe.Json.stringify(t);
            case CBoolean(b): haxe.Json.stringify(b);
            case CList(items): "[" + [for (item in items) json(item)].join(",") + "]";
            case CRecord(fields):
                final keys = [for (key in fields.keys()) key];
                keys.sort(Reflect.compare);
                "{" + [for (key in keys) haxe.Json.stringify(key) + ":" + json(fields.get(key))].join(",") + "}";
            case CVariant(tag,payload):
                "{\"tag\":" + haxe.Json.stringify(tag) + (payload == null ? "" : ",\"value\":" + json(payload)) + "}";
        };
    }
}
