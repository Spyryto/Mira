package mira.types;

import mira.MiraError;
import mira.HostEnvironment;
import mira.syntax.Definition;
import mira.syntax.Expr;
import mira.syntax.ExpressionOrigins;
import mira.lex.Token;

private typedef LocalScheme = {
    var type:Type;
    var quantified:Map<Int,Bool>;
}

// Experimental, target-independent inference. No code generation or evaluation.
class TypeChecker {
    final bindings = new Map<Int, Type>();
    final definitions = new Map<String, Definition>();
    final inferred = new Map<String, Type>();
    final active = new Map<String, Type>();
    final lacks = new Map<Int, Map<String,Bool>>();
    final scalarEq = new Map<Int,Bool>();
    var nextId = 0;
    var origin:Token;

    final origins:ExpressionOrigins;

    final host:HostEnvironment;

    public function new(origins:ExpressionOrigins,host:HostEnvironment) {
        this.origins = origins;
        this.host = host;
    }

    function prepare(program:Array<Definition>):Void {
        for (d in program) if (!d.isStatement)
            definitions.set(d.isFunction() ? d.selector() : d.name, d);
        final graph = new Dependencies(program);
        for (group in graph.ordered()) checkGroup(group,graph.recursive(group));
    }

    public function check(program:Array<Definition>):Array<Dynamic> {
        prepare(program);
        final result:Array<Dynamic> = [];
        for (d in program) {
            origin = d.origin;
            final name = d.isStatement ? "<expression>" : d.isFunction() ? d.selector() : d.name;
            final type = d.isStatement ? infer(d.body, new Map<String, LocalScheme>()) : declaration(name);
            result.push({name:name, type:show(type), schema:describe(type), line:d.origin.line, column:d.origin.column, file:d.origin.file});
        }
        return result;
    }

    // Specialize a declared function against concrete argument types, using
    // exactly the same inference and unification as a regular Mira call.
    public function specialize(program:Array<Definition>,name:String,args:Array<Type>):Dynamic {
        prepare(program);
        final d = definitions.get(name);
        if (d == null || !d.isFunction()) throw new MiraError("Unknown Mira function " + name);
        origin = d.origin;
        final type = declaration(name);
        final result = call(type,args);
        final signature:Type = FunctionType(args,result);
        return {name:name,type:show(signature),schema:describe(signature)};
    }

    function fresh():Type return Variable(nextId++);

    function fail(message:String):Dynamic {
        throw new MiraError("Type check: " + message, origin, "type_error");
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
        if (lacks.exists(id)) constrainRow(type,lacks.get(id));
        if (scalarEq.exists(id)) requireScalarEq(type);
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

    // Row variables carry a set of labels that must be absent. Propagate
    // restrictions through variable aliases and concrete extensions.
    function constrainRow(type:Type, forbidden:Map<String,Bool>):Void {
        switch (prune(type)) {
            case Variable(id):
                if (scalarEq.exists(id)) fail("scalar equality cannot constrain a record row");
                if (!lacks.exists(id)) lacks.set(id,new Map<String,Bool>());
                final current = lacks.get(id);
                for (key in forbidden.keys()) current.set(key,true);
            case RecordType(fields,tail):
                final next = forbidden.copy();
                for (key in fields.keys()) {
                    if (next.exists(key)) fail("duplicate record row field " + key);
                    next.set(key,true);
                }
                if (tail != null) constrainRow(tail,next);
            default: fail("expected a record row");
        }
    }

    function recordType(fields:Map<String,Type>,tail:Null<Type>):Type {
        if (tail != null) {
            final forbidden = new Map<String,Bool>();
            for (key in fields.keys()) forbidden.set(key,true);
            constrainRow(tail,forbidden);
        }
        return RecordType(fields,tail);
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
                        if (fields.exists(key)) fail("duplicate record row field " + key);
                        fields.set(key,value);
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
            unify(y.tail,recordType(onlyX,null));
        } else if (y.tail == null) {
            unify(x.tail,recordType(onlyY,null));
        } else if (missingX.length == 0 && missingY.length == 0) {
            unify(x.tail,y.tail);
        } else {
            // Sharing a tail while demanding distinct extra fields is cyclic.
            switch [prune(x.tail),prune(y.tail)] {
                case [Variable(i),Variable(j)] if (i == j): fail("incompatible record rows");
                default:
            }
            final shared = fresh();
            unify(x.tail,recordType(onlyY,shared));
            unify(y.tail,recordType(onlyX,shared));
        }
    }

    // All free variables of a completed top-level definition are generalized.
    // Recursive components are generalized only after checking every member.
    function instantiate(type:Type, ?variables:Map<Int,Type>, ?quantified:Map<Int,Bool>):Type {
        final seen = variables == null ? new Map<Int,Type>() : variables;
        return switch (prune(type)) {
            case Variable(id) if (quantified != null && !quantified.exists(id)): Variable(id);
            case Variable(id):
                if (!seen.exists(id)) {
                    final copy = fresh();
                    if (lacks.exists(id)) constrainRow(copy,lacks.get(id));
                    if (scalarEq.exists(id)) requireScalarEq(copy);
                    seen.set(id,copy);
                }
                seen.get(id);
            case ListType(item): ListType(instantiate(item,seen,quantified));
            case FunctionType(args,result): FunctionType([for (a in args) instantiate(a,seen,quantified)],instantiate(result,seen,quantified));
            case RecordType(fields,tail):
                final r = row(type);
                recordType([for (key => value in r.fields) key => instantiate(value,seen,quantified)],
                    r.tail == null ? null : instantiate(r.tail,seen,quantified));
            default: prune(type);
        };
    }

    function free(type:Type, found:Map<Int,Bool>):Void {
        switch (prune(type)) {
            case Variable(id): found.set(id,true);
            case ListType(item): free(item,found);
            case FunctionType(args,result):
                for (arg in args) free(arg,found);
                free(result,found);
            case RecordType(fields,tail):
                for (value in fields) free(value,found);
                if (tail != null) free(tail,found);
            default:
        }
    }

    function mono(type:Type):LocalScheme return {type:type, quantified:new Map<Int,Bool>()};

    // Value restriction: generalize only non-expansive local initializers.
    // In particular a call might eventually perform an external effect.
    function isValue(expr:Expr):Bool {
        return switch (expr) {
            case Numeric(_) | Text(_) | BooleanLiteral(_) | Name(_) | Block(_,_) | FieldAccessor(_) | FieldSection(_): true;
            case Sequence(items) | Record(_,items): Lambda.foreach(items,isValue);
            default: false;
        };
    }

    function localScheme(expr:Expr,type:Type,scope:Map<String,LocalScheme>):LocalScheme {
        final scheme = mono(type);
        if (!isValue(expr)) return scheme;
        final excluded = new Map<Int,Bool>();
        for (binding in scope) {
            final vars = new Map<Int,Bool>();
            free(binding.type,vars);
            for (id in vars.keys()) if (!binding.quantified.exists(id)) excluded.set(id,true);
        }
        // Recursive group placeholders must stay monomorphic inside the group.
        for (pending in active) free(pending,excluded);
        free(type,scheme.quantified);
        for (id in excluded.keys()) scheme.quantified.remove(id);
        return scheme;
    }

    function checkGroup(group:Array<String>,recursive:Bool):Void {
        // A cyclic global value would require recursive initialization semantics,
        // which neither Mira emitter currently promises.
        for (name in group) {
            final d = definitions.get(name);
            origin = d.origin;
            if (recursive && !d.isFunction()) fail("recursive value dependency not supported: " + name);
            final result:Type = d.resultAnnotation == null ? fresh() : d.resultAnnotation;
            final placeholder:Type = d.isFunction()
                ? FunctionType([for (i in 0...d.parameters.length)
                    i < d.parameterAnnotations.length && d.parameterAnnotations[i] != null
                        ? d.parameterAnnotations[i] : fresh()],result) : result;
            active.set(name,placeholder);
        }
        for (name in group) {
            final d = definitions.get(name);
            origin = d.origin;
            final scope = new Map<String,LocalScheme>();
            final params:Array<Type> = switch (active.get(name)) {
                case FunctionType(args,_) if (d.isFunction()): args;
                default: [];
            };
            for (i in 0...params.length) scope.set(d.parameters[i],mono(params[i]));
            final body = infer(d.body,scope);
            final type:Type = d.isFunction() ? FunctionType(params,body) : body;
            if (d.resultAnnotationOrigin != null) origin = d.resultAnnotationOrigin;
            unify(active.get(name),type);
        }
        for (name in group) {
            inferred.set(name,active.get(name));
            active.remove(name);
        }
    }

    function declaration(name:String):Type {
        if (active.exists(name)) return active.get(name);
        if (inferred.exists(name)) return instantiate(inferred.get(name));
        return fail("unknown declaration " + name);
    }

    function hostType(name:String):Type {
        if (!host.types.exists(name)) return fail("host type signature required: " + name);
        return host.types.get(name);
    }

    function projection(record:Type,key:String):Type {
        final value = fresh();
        unify(record,recordType([key => value],fresh()));
        return value;
    }

    function call(type:Type,args:Array<Type>):Type {
        final result = fresh();
        unify(type,FunctionType(args,result));
        return result;
    }

    // A closed built-in predicate, not a runtime typeclass dictionary.
    // Unification may solve it now or propagate it to another variable.
    function requireScalarEq(type:Type):Void {
        switch (prune(type)) {
            case NumberType | TextType | BooleanType:
            case Variable(id):
                if (lacks.exists(id)) fail("scalar equality cannot constrain a record row");
                scalarEq.set(id,true);
            default: fail("ScalarEq requires Number, Text or Boolean, got " + show(type));
        }
    }

    function binary(symbol:String,left:Type,right:Type):Type {
        if (symbol == "==" || symbol == "!=") {
            unify(left,right);
            requireScalarEq(left);
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
                return updateRecord(args[0],args[1]);
            default: return call(declaration(selector),args);
        }
    }

    // Closed patches only. For an unknown/open base, replacing an unknown
    // field requires that field to exist. A field known absent may be added.
    // No deferred overwrite constraints or optional row fields are invented.
    function updateRecord(base:Type,patch:Type):Type {
        switch (prune(patch)) {
            case RecordType(_,_):
            default: return fail("record update requires a known closed patch");
        }
        final changes = row(patch);
        if (changes.tail != null) return fail("record update requires a known closed patch");
        switch (prune(base)) {
            case Variable(_): unify(base,recordType(new Map<String,Type>(),fresh()));
            case RecordType(_,_):
            default: return fail("record update requires a record base");
        }
        final original = row(base);
        if (original.tail != null) {
            for (key in changes.fields.keys()) {
                if (!original.fields.exists(key)) {
                    final current = row(base);
                    if (current.fields.exists(key)) continue;
                    final absent = switch (current.tail == null ? null : prune(current.tail)) {
                        case Variable(id): lacks.exists(id) && lacks.get(id).exists(key);
                        case null: true;
                        default: false;
                    };
                    if (!absent) projection(base,key);
                }
            }
        }
        final updated = row(base);
        for (key => value in changes.fields) updated.fields.set(key,value);
        return recordType(updated.fields,updated.tail);
    }

    function operand(expr:Expr,scope:Map<String,LocalScheme>,holes:Array<Type>):Type {
        return switch (expr) {
            case Placeholder: final type = fresh(); holes.push(type); type;
            default: infer(expr,scope);
        };
    }

    function unifyAt(a:Type,b:Type,expr:Expr):Void {
        final previous = origin;
        final anchor = origins.get(expr);
        if (anchor != null) origin = anchor;
        unify(a,b);
        origin = previous;
    }

    function infer(expr:Expr,scope:Map<String,LocalScheme>):Type {
        final previous = origin;
        final anchor = origins.get(expr);
        if (anchor != null) origin = anchor;
        final type:Type = inferNode(expr,scope);
        origin = previous;
        return type;
    }

    // A failed child keeps its own anchor in the exception. A successful
    // child restores the enclosing operator/call before unification.
    function inferNode(expr:Expr,scope:Map<String,LocalScheme>):Type {
        return switch (expr) {
            case Numeric(_): NumberType;
            case Text(_): TextType;
            case BooleanLiteral(_): BooleanType;
            case Name(name):
                if (scope.exists(name)) {
                    final binding = scope.get(name);
                    instantiate(binding.type,null,binding.quantified);
                } else declaration(name);
            case HostRef(name): hostType(name);
            case HostCall(name,args): call(hostType(name),[for (arg in args) infer(arg,scope)]);
            case HostSection(name,args):
                final holes:Array<Type> = [];
                final result = call(hostType(name),[for (arg in args) operand(arg,scope,holes)]);
                FunctionType(holes,result);
            case FieldGet(record,key): projection(infer(record,scope),key);
            case FieldAccessor(key) | FieldSection(key):
                final record = fresh();
                FunctionType([record],projection(record,key));
            case Conditional(condition,yes,no):
                unifyAt(BooleanType,infer(condition,scope),condition);
                final a = infer(yes,scope);
                unifyAt(a,infer(no,scope),no);
                a;
            case Sequence(items):
                final item = fresh();
                for (e in items) unifyAt(item,infer(e,scope),e);
                ListType(item);
            case Record(keys,values):
                RecordType([for (i in 0...keys.length) keys[i] => infer(values[i],scope)],null);
            case Block(parameters,body):
                final inner = scope.copy();
                final args = [for (p in parameters) fresh()];
                for (i in 0...args.length) inner.set(parameters[i],mono(args[i]));
                FunctionType(args,infer(body,inner));
            case Steps(items):
                final inner = scope.copy();
                var result:Type = fresh();
                for (e in items) switch (e) {
                    case Local(name,value):
                        final type = infer(value,inner);
                        inner.set(name,localScheme(value,type,inner));
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

    // Canonical, JSON-compatible representation, independent of pretty printing.
    // Variable ids are allocated in traversal order, scoped to one signature.
    function describe(type:Type, ?ids:Map<Int,Int>):Dynamic {
        final seen = ids == null ? new Map<Int,Int>() : ids;
        return switch (prune(type)) {
            case NumberType: {kind:"Number"};
            case TextType: {kind:"Text"};
            case BooleanType: {kind:"Boolean"};
            case Variable(id):
                if (!seen.exists(id)) {
                    var n = 0;
                    for (_ in seen.keys()) n++;
                    seen.set(id,n);
                }
                final missing = lacks.exists(id) ? [for (key in lacks.get(id).keys()) key] : [];
                missing.sort(Reflect.compare);
                {kind:"Variable",id:seen.get(id),scalarEq:scalarEq.exists(id),
                    row:lacks.exists(id),lacks:missing};
            case ListType(item): {kind:"List",item:describe(item,seen)};
            case FunctionType(args,result):
                {kind:"Function",parameters:[for (a in args) describe(a,seen)],result:describe(result,seen)};
            case RecordType(_,_):
                final r = row(type);
                final keys = [for (key in r.fields.keys()) key];
                keys.sort(Reflect.compare);
                {kind:"Record",fields:[for (key in keys) {name:key,type:describe(r.fields.get(key),seen)}],
                    tail:r.tail == null ? null : describe(r.tail,seen)};
        };
    }

    function show(type:Type):String {
        final names = new Map<Int,String>();
        final order:Array<Int> = [];
        final body = render(type,names,order);
        final predicates = [for (id in order) if (scalarEq.exists(id)) names.get(id) + ": ScalarEq"];
        return body + (predicates.length == 0 ? "" : " where " + predicates.join(", "));
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
