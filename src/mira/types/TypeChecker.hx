package mira.types;

import mira.MiraError;
import mira.syntax.Definition;
import mira.syntax.Expr;
import mira.lex.Token;

// Experimental, target-independent inference. No code generation or evaluation.
class TypeChecker {
    final bindings = new Map<Int, Type>();
    final definitions = new Map<String, Definition>();
    final inferred = new Map<String, Type>();
    final active = new Map<String, Bool>();
    var nextId = 0;
    var origin:Token;

    public function new() {}

    public function check(program:Array<Definition>):Array<Dynamic> {
        for (d in program) if (!d.isStatement)
            definitions.set(d.isFunction() ? d.selector() : d.name, d);
        final result:Array<Dynamic> = [];
        for (d in program) {
            origin = d.origin;
            final name = d.isStatement ? "<expression>" : d.isFunction() ? d.selector() : d.name;
            final type = d.isStatement ? infer(d.body, new Map<String, Type>()) : declaration(name);
            result.push({name:name, type:show(type), line:d.origin.line, column:d.origin.column, file:d.origin.file});
        }
        return result;
    }

    function fresh():Type return Variable(nextId++);

    function fail(message:String):Dynamic {
        throw new MiraError("Type check: " + message, origin);
    }

    function prune(type:Type):Type {
        return switch (type) {
            case Variable(id) if (bindings.exists(id)):
                final value = prune(bindings.get(id));
                bindings.set(id, value);
                value;
            default: type;
        };
    }

    function occurs(id:Int, type:Type):Bool {
        return switch (prune(type)) {
            case Variable(other): id == other;
            case ListType(item): occurs(id, item);
            case FunctionType(args, result): Lambda.exists(args, t -> occurs(id,t)) || occurs(id,result);
            case RecordType(fields, tail):
                var found = false;
                for (t in fields) if (occurs(id,t)) found = true;
                found || (tail != null && occurs(id,tail));
            default: false;
        };
    }

    function bind(id:Int, type:Type):Void {
        switch (prune(type)) {
            case Variable(other) if (id == other): return;
            default:
        }
        if (occurs(id,type)) fail("infinite type");
        bindings.set(id,type);
    }

    function unify(a:Type,b:Type):Void {
        final left = prune(a);
        final right = prune(b);
        switch [left,right] {
            case [Variable(id), _]: bind(id,right);
            case [_, Variable(id)]: bind(id,left);
            case [NumberType, NumberType] | [TextType,TextType] | [BooleanType,BooleanType]:
            case [ListType(x),ListType(y)]: unify(x,y);
            case [FunctionType(xs,x),FunctionType(ys,y)]:
                if (xs.length != ys.length) fail("function arity mismatch");
                for (i in 0...xs.length) unify(xs[i],ys[i]);
                unify(x,y);
            case [RecordType(_, _),RecordType(_, _)]: unifyRecords(left,right);
            default: fail("expected " + show(left) + ", got " + show(right));
        }
    }

    // Flatten row extensions before comparison. A projection introduces an open
    // row, while a record literal closes it. Shared fields must agree.
    function row(type:Type):{fields:Map<String,Type>,tail:Null<Type>} {
        final fields = new Map<String,Type>();
        var current:Null<Type> = type;
        while (current != null) {
            switch (prune(current)) {
                case RecordType(part,tail):
                    for (key => value in part) {
                        if (fields.exists(key)) unify(fields.get(key),value);
                        else fields.set(key,value);
                    }
                    current = tail;
                case Variable(_): return {fields:fields,tail:prune(current)};
                default: return fail("invalid record row");
            }
        }
        return {fields:fields,tail:null};
    }

    function unifyRecords(a:Type,b:Type):Void {
        final x = row(a);
        final y = row(b);
        final onlyX = new Map<String,Type>();
        final onlyY = new Map<String,Type>();
        for (key => value in x.fields) {
            if (y.fields.exists(key)) unify(value,y.fields.get(key));
            else onlyX.set(key,value);
        }
        for (key => value in y.fields) if (!x.fields.exists(key)) onlyY.set(key,value);
        final missingX = [for (key in onlyX.keys()) key];
        final missingY = [for (key in onlyY.keys()) key];
        missingX.sort(Reflect.compare);
        missingY.sort(Reflect.compare);
        if (x.tail == null && missingY.length > 0) fail("missing record field " + missingY[0]);
        if (y.tail == null && missingX.length > 0) fail("missing record field " + missingX[0]);
        if (x.tail == null && y.tail == null) return;
        if (x.tail == null) {
            unify(y.tail,RecordType(onlyX,null));
        } else if (y.tail == null) {
            unify(x.tail,RecordType(onlyY,null));
        } else if (missingX.length == 0 && missingY.length == 0) {
            unify(x.tail,y.tail);
        } else {
            // Sharing a tail while demanding distinct extra fields is cyclic.
            switch [prune(x.tail),prune(y.tail)] {
                case [Variable(i),Variable(j)] if (i == j): fail("incompatible record rows");
                default:
            }
            final shared = fresh();
            unify(x.tail,RecordType(onlyY,shared));
            unify(y.tail,RecordType(onlyX,shared));
        }
    }

    // All free variables of a completed top-level definition are generalized.
    // No local generalization or recursive dependency groups in this pilot.
    function instantiate(type:Type, ?variables:Map<Int,Type>):Type {
        final seen = variables == null ? new Map<Int,Type>() : variables;
        return switch (prune(type)) {
            case Variable(id):
                if (!seen.exists(id)) seen.set(id,fresh());
                seen.get(id);
            case ListType(item): ListType(instantiate(item,seen));
            case FunctionType(args,result): FunctionType([for (a in args) instantiate(a,seen)],instantiate(result,seen));
            case RecordType(fields,tail):
                final r = row(type);
                RecordType([for (key => value in r.fields) key => instantiate(value,seen)],
                    r.tail == null ? null : instantiate(r.tail,seen));
            default: prune(type);
        };
    }

    function declaration(name:String):Type {
        if (inferred.exists(name)) return instantiate(inferred.get(name));
        if (active.exists(name)) return fail("recursive dependency not supported yet: " + name);
        final d = definitions.get(name);
        if (d == null) return fail("unknown declaration " + name);
        final previous = origin;
        origin = d.origin;
        active.set(name,true);
        final scope = new Map<String,Type>();
        final params = [for (p in d.parameters) fresh()];
        for (i in 0...params.length) scope.set(d.parameters[i],params[i]);
        final body = infer(d.body,scope);
        final type = d.isFunction() ? FunctionType(params,body) : body;
        active.remove(name);
        inferred.set(name,type);
        origin = previous;
        return instantiate(type);
    }

    function projection(record:Type,key:String):Type {
        final value = fresh();
        unify(record,RecordType([key => value],fresh()));
        return value;
    }

    function call(type:Type,args:Array<Type>):Type {
        final result = fresh();
        unify(type,FunctionType(args,result));
        return result;
    }

    function binary(symbol:String,left:Type,right:Type):Type {
        if (symbol == "==" || symbol == "!=") {
            unify(left,right);
            switch (prune(left)) {
                case NumberType | TextType | BooleanType:
                default: fail("equality currently requires a known scalar type");
            }
            return BooleanType;
        }
        unify(NumberType,left);
        unify(NumberType,right);
        return ["<",">","<=",">="].indexOf(symbol) >= 0 ? BooleanType : NumberType;
    }

    function selectorCall(selector:String,args:Array<Type>):Type {
        final item = fresh();
        final result = fresh();
        switch (selector) {
            case "append:to:":
                unify(item,args[0]); unify(ListType(item),args[1]); return ListType(item);
            case "map:with:" | "collect:with:":
                unify(ListType(item),args[0]); unify(FunctionType([item],result),args[1]); return ListType(result);
            case "filter:with:" | "select:with:" | "select:if:" | "remove:if:":
                unify(ListType(item),args[0]); unify(FunctionType([item],BooleanType),args[1]); return ListType(item);
            case "fold:with:from:":
                unify(ListType(item),args[0]); unify(result,args[2]); unify(FunctionType([result,item],result),args[1]); return result;
            case "update:with:":
                switch [prune(args[0]),prune(args[1])] {
                    case [RecordType(_,_),RecordType(_, _)]:
                        final a = row(args[0]);
                        final b = row(args[1]);
                        if (a.tail != null || b.tail != null) return fail("open record update not supported yet");
                        for (k => v in b.fields) a.fields.set(k,v);
                        return RecordType(a.fields,null);
                    default: return fail("record update requires known closed records in this pilot");
                }
            default: return call(declaration(selector),args);
        }
    }

    function operand(expr:Expr,scope:Map<String,Type>,holes:Array<Type>):Type {
        return switch (expr) {
            case Placeholder: final type = fresh(); holes.push(type); type;
            default: infer(expr,scope);
        };
    }

    function infer(expr:Expr,scope:Map<String,Type>):Type {
        return switch (expr) {
            case Numeric(_): NumberType;
            case Text(_): TextType;
            case BooleanLiteral(_): BooleanType;
            case Name(name): scope.exists(name) ? scope.get(name) : declaration(name);
            case HostRef(name) | HostCall(name,_) | HostSection(name,_):
                fail("host type signature required: " + name);
            case FieldGet(record,key): projection(infer(record,scope),key);
            case FieldAccessor(key) | FieldSection(key):
                final record = fresh();
                FunctionType([record],projection(record,key));
            case Conditional(condition,yes,no):
                unify(BooleanType,infer(condition,scope));
                final a = infer(yes,scope);
                unify(a,infer(no,scope));
                a;
            case Sequence(items):
                final item = fresh();
                for (e in items) unify(item,infer(e,scope));
                ListType(item);
            case Record(keys,values):
                RecordType([for (i in 0...keys.length) keys[i] => infer(values[i],scope)],null);
            case Block(parameters,body):
                final inner = scope.copy();
                final args = [for (p in parameters) fresh()];
                for (i in 0...args.length) inner.set(parameters[i],args[i]);
                FunctionType(args,infer(body,inner));
            case Steps(items):
                final inner = scope.copy();
                var result:Type = fresh();
                for (e in items) switch (e) {
                    case Local(name,value): inner.set(name,infer(value,inner));
                    default: result = infer(e,inner);
                }
                result;
            case Local(_,_) | Placeholder: fail("unexpected expression");
            case Binary(symbol,left,right): binary(symbol,infer(left,scope),infer(right,scope));
            case OperatorSection(symbol,left,right):
                final holes:Array<Type> = [];
                final result = binary(symbol,operand(left,scope,holes),operand(right,scope,holes));
                FunctionType(holes,result);
            case Call(selector,args): selectorCall(selector,[for (arg in args) infer(arg,scope)]);
            case Section(selector,args):
                final holes:Array<Type> = [];
                final result = selectorCall(selector,[for (arg in args) operand(arg,scope,holes)]);
                FunctionType(holes,result);
            case Apply(callee,arg): call(infer(callee,scope),arg == null ? [] : [infer(arg,scope)]);
        };
    }

    function show(type:Type):String {
        return render(type,new Map<Int,String>(),[]);
    }

    function render(type:Type,names:Map<Int,String>,order:Array<Int>):String {
        return switch (prune(type)) {
            case NumberType: "Number";
            case TextType: "Text";
            case BooleanType: "Boolean";
            case Variable(id):
                if (!names.exists(id)) {
                    final n = order.length;
                    order.push(id);
                    names.set(id,"'" + String.fromCharCode(97 + n % 26) + (n < 26 ? "" : Std.string(Std.int(n / 26))));
                }
                names.get(id);
            case ListType(item): "[" + render(item,names,order) + "]";
            case FunctionType(args,result):
                "(" + [for (a in args) render(a,names,order)].join(", ") + ") -> " + render(result,names,order);
            case RecordType(_, _):
                final r = row(type);
                final keys = [for (key in r.fields.keys()) key];
                keys.sort(Reflect.compare);
                "{" + [for (key in keys) key + ": " + render(r.fields.get(key),names,order)].join(", ")
                    + (r.tail == null ? "" : " | " + render(r.tail,names,order)) + "}";
        };
    }
}
