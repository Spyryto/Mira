package mira.types;

import mira.syntax.Definition;
import mira.syntax.Expr;

// Strongly connected components of resolved declarations. Edges refer to
// global names/selectors only; local scopes shadow names, never selectors.
class Dependencies {
    final edges = new Map<String,Array<String>>();
    final indices = new Map<String,Int>();
    final low = new Map<String,Int>();
    final stack:Array<String> = [];
    final onStack = new Map<String,Bool>();
    final groups:Array<Array<String>> = [];
    var next = 0;

    public function new(program:Array<Definition>) {
        for (d in program) if (!d.isStatement)
            edges.set(d.isFunction() ? d.selector() : d.name, []);
        for (d in program) if (!d.isStatement) {
            final name = d.isFunction() ? d.selector() : d.name;
            final found = new Map<String,Bool>();
            walk(d.body,d.parameters.copy(),found);
            final deps = [for (key in found.keys()) if (edges.exists(key)) key];
            deps.sort(Reflect.compare);
            edges.set(name,deps);
        }
        // Preserve source order for independent components.
        for (d in program) if (!d.isStatement) {
            final name = d.isFunction() ? d.selector() : d.name;
            if (!indices.exists(name)) visit(name);
        }
    }

    public function ordered():Array<Array<String>> return groups;
    public function recursive(group:Array<String>):Bool
        return group.length > 1 || edges.get(group[0]).indexOf(group[0]) >= 0;

    function visit(name:String):Void {
        indices.set(name,next);
        low.set(name,next++);
        stack.push(name);
        onStack.set(name,true);
        for (dep in edges.get(name)) {
            if (!indices.exists(dep)) {
                visit(dep);
                if (low.get(dep) < low.get(name)) low.set(name,low.get(dep));
            } else if (onStack.exists(dep) && indices.get(dep) < low.get(name)) {
                low.set(name,indices.get(dep));
            }
        }
        if (low.get(name) == indices.get(name)) {
            final group:Array<String> = [];
            while (true) {
                final member = stack.pop();
                onStack.remove(member);
                group.push(member);
                if (member == name) break;
            }
            groups.push(group);
        }
    }

    static function walk(expr:Expr,locals:Array<String>,found:Map<String,Bool>):Void {
        switch (expr) {
            case Name(name): if (locals.indexOf(name) < 0) found.set(name,true);
            case Call(selector,args) | Section(selector,args):
                found.set(selector,true);
                for (arg in args) walk(arg,locals,found);
            case HostCall(_,args) | HostSection(_,args) | Sequence(args) | Record(_,args):
                for (arg in args) walk(arg,locals,found);
            case FieldGet(receiver,_): walk(receiver,locals,found);
            case Validate(value,_,success,failure):
                walk(value,locals,found); walk(success,locals,found); walk(failure,locals,found);
            case Conditional(predicate,yes,no):
                walk(predicate,locals,found);
                walk(yes,locals,found);
                walk(no,locals,found);
            case Block(parameters,body): walk(body,parameters.concat(locals),found);
            case Steps(items):
                final inner = locals.copy();
                for (item in items) switch (item) {
                    case Local(name,value): walk(value,inner,found); inner.push(name);
                    default: walk(item,inner,found);
                }
            case Local(_,value): walk(value,locals,found);
            case Binary(_,left,right) | OperatorSection(_,left,right):
                walk(left,locals,found);
                walk(right,locals,found);
            case Apply(callee,arg):
                walk(callee,locals,found);
                if (arg != null) walk(arg,locals,found);
            case HostRef(_) | Numeric(_) | Text(_) | BooleanLiteral(_) | FieldAccessor(_) | FieldSection(_) | Placeholder:
        }
    }
}
