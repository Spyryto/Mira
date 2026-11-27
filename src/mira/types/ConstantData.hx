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
    final pureCalls:Bool;

    function new(program:Array<Definition>,pureCalls:Bool) {
        this.pureCalls = pureCalls;
        for (d in program) {
            if (d.isStatement || d.modulePath != null || d.isAbstractContract)
                throw new MiraError("Constant data requires plain declarations",d.origin);
            if (d.isFunction() && !pureCalls) switch (d.body) {
                case Variant(_,_,_):
                default: throw new MiraError("Constant data does not execute functions",d.origin);
            }
            definitions.set(d.isFunction() ? d.selector() : d.name,d);
        }
    }

    public static function read(source:String,name:String,?pureCalls:Bool = false,?expectedType:String):ConstantValue {
        if (source.length > 65536) throw new MiraError("Constant data source limit");
        final origins = new ExpressionOrigins();
        final visibility = new TypeVisibility();
        final host = HostEnvironment.empty();
        final program = Compiler.parse(source,host,null,null,origins,visibility);
        final data = new ConstantData(program,pureCalls);
        final checked = new TypeChecker(origins,host,null,visibility).check(program);
        if (expectedType != null && !Lambda.exists(checked,row -> row.name == name && row.type == expectedType))
            throw new MiraError("Expected constant " + name + " of type " + expectedType);
        return data.evaluate(Name(name),0);
    }

    // Snapshot previously declared flat definitions. Parsing the copies
    // leaves normal expression origins and subsequent inference untouched.
    public static function grammarPrefix(program:Array<Definition>,types:Map<String,Type>,name:String):mira.grammar.GrammarMachine {
        final copies = [];
        for (d in program) {
            if (d.isStatement || d.modulePath != null) throw new MiraError("Grammar refinement requires preceding flat declarations");
            final copy = new Definition(d.name,d.labels,d.parameters,d.bodyTokens,d.origin,false,d.parameterOrigins);
            copy.body = d.body;
            copy.scalarValue = d.scalarValue;
            copy.typeParameters = d.typeParameters;
            copy.parameterAnnotations = d.parameterAnnotations;
            copy.resultAnnotation = d.resultAnnotation;
            copy.resultAnnotationOrigin = d.resultAnnotationOrigin;
            copies.push(copy);
        }
        final origins = new ExpressionOrigins();
        final host = HostEnvironment.empty();
        final symbols = new mira.resolve.Symbols(copies,host);
        for (d in copies) if (d.body == null)
            d.body = new mira.syntax.ExpressionParser(d.bodyTokens,symbols,d.parameters,false,null,origins,types).parse();
        final checked = new TypeChecker(origins,host).check(copies);
        if (!Lambda.exists(checked,row -> row.name == name && row.type == "Grammar"))
            throw new MiraError("Expected preceding constant " + name + " of type Grammar");
        final value = new ConstantData(copies,true).evaluate(Name(name),0);
        return new mira.grammar.GrammarCompiler().compile(value);
    }

    function evaluate(expr:Expr,depth:Int,?locals:Map<String,ConstantValue>):ConstantValue {
        if (--budget < 0 || depth > 64) throw new MiraError("Constant data evaluation limit");
        return switch (expr) {
            case Numeric(value): CNumber(Std.parseFloat(value));
            case Text(value): CText(value);
            case BooleanLiteral(value): CBoolean(value);
            case Sequence(items): CList([for (item in items) evaluate(item,depth+1,locals)]);
            case Record(keys,values):
                CRecord([for (i in 0...keys.length) keys[i] => evaluate(values[i],depth+1,locals)]);
            case Name(name) if (locals != null && locals.exists(name)): locals.get(name);
            case Name(name):
                final d = definitions.get(name);
                if (d == null || d.isFunction()) throw new MiraError("Unknown constant " + name);
                evaluate(d.scalarValue == null ? d.body : d.scalarValue,depth+1);
            case Variant(_,tag,null): CVariant(tag,null);
            case Variant(_,tag,payload) if (pureCalls): CVariant(tag,evaluate(payload,depth+1,locals));
            case Call(selector,args):
                final d = definitions.get(selector);
                if (d == null || !d.isFunction() || args.length != d.parameters.length || (!pureCalls && args.length != 1))
                    throw new MiraError("Constant data permits only sum constructors");
                switch (d.body) {
                    case Variant(_,tag,Name(parameter)) if (d.parameters.length == 1 && d.parameters[0] == parameter):
                        d.scalarValue == null ? CVariant(tag,evaluate(args[0],depth+1,locals)) : evaluate(args[0],depth+1,locals);
                    default:
                        if (!pureCalls) throw new MiraError("Constant data permits only sum constructors",d.origin);
                        final frame = new Map<String,ConstantValue>();
                        for (i in 0...args.length) frame.set(d.parameters[i],evaluate(args[i],depth+1,locals));
                        evaluate(d.body,depth+1,frame);
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
