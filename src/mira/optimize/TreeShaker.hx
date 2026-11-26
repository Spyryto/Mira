package mira.optimize;

import mira.syntax.Definition;
import mira.syntax.Expr;
import mira.types.Dependencies;
import mira.types.NumericGuard;

// Opt-in closed-world optimization of checked programs. Entry declarations
// and legacy modules remain roots for host compatibility. Imported named
// modules retain potentially observable initialization, even if unused.
class TreeShaker {
    public static function run(program:Array<Definition>,guards:haxe.ds.ObjectMap<Dynamic,NumericGuard>,?report:Dynamic):Array<Definition> {
        final start = haxe.Timer.stamp();
        final roots:Array<String> = [];
        final statements:Array<Definition> = [];
        for (d in program) {
            if (d.isStatement) statements.push(d);
            else if (d.origin.file == null || d.modulePath == null || (!d.isFunction() && !pure(d.body,guards)))
                roots.push(d.isFunction() ? d.selector() : d.name);
        }
        final graph = new Dependencies(program,false);
        final live = graph.reachable(roots,statements);
        final kept = [for (d in program) if (d.isStatement || live.exists(d.isFunction() ? d.selector() : d.name)) d];
        final removed = [for (d in program) if (!d.isStatement && !live.exists(d.isFunction() ? d.selector() : d.name)) d.isFunction() ? d.selector() : d.name];
        // Remove stale scope entries too (PHP globals and closure captures).
        for (d in kept) d.importedGlobals = [for (name in d.importedGlobals) if (live.exists(name)) name];
        if (report != null) {
            Reflect.setField(report,"before",program.length-statements.length);
            Reflect.setField(report,"after",kept.length-statements.length);
            Reflect.setField(report,"removed",removed);
            Reflect.setField(report,"optimizationMs",(haxe.Timer.stamp()-start)*1000);
        }
        return kept;
    }

    // Deliberately tiny whitelist: no reads, calls, arithmetic, validation,
    // closure captures, projection or conditional evaluation. In particular
    // a checked numeric guard can throw and is never considered pure.
    static function pure(expr:Expr,guards:haxe.ds.ObjectMap<Dynamic,NumericGuard>):Bool {
        if (guards.exists(expr)) return false;
        return switch (expr) {
            case Numeric(_) | Text(_) | BooleanLiteral(_): true;
            case Sequence(items) | Record(_,items): !Lambda.exists(items,e -> !pure(e,guards));
            case Variant(_,_,payload): payload == null || pure(payload,guards);
            default: false;
        };
    }
}
