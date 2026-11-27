package mira.grammar;

import mira.MiraError;
import mira.types.ConstantData;
import mira.types.ConstantData.ConstantValue;

private typedef Edge = {codes:Array<Int>,to:Int};
private typedef State = {epsilon:Array<Int>,edges:Array<Edge>};
private typedef Fragment = {start:Int,end:Int};

// The grammar value is independent of this first strategy: Thompson NFA,
// then bounded subset construction into a deterministic ASCII recognizer.
class GrammarCompiler {
    final states:Array<State> = [];
    static inline final LIMIT = 256;
    static inline final ALPHABET = 128;

    public function new() {}

    function state():Int {
        if (states.length >= LIMIT) throw new MiraError("Grammar NFA state limit (256)");
        states.push({epsilon:[],edges:[]});
        return states.length-1;
    }

    function link(a:Int,b:Int):Void states[a].epsilon.push(b);

    static function codes(text:String):Array<Int> {
        final result:Array<Int> = [];
        for (i in 0...text.length) {
            final code:Int = text.charCodeAt(i);
            if (code >= ALPHABET) throw new MiraError("Grammar 0.104 supports ASCII literals and character sets");
            result.push(code);
        }
        return result;
    }

    static function count(value:ConstantValue):Int return switch (value) {
        case CNumber(n) if (Math.isFinite(n) && n >= 0 && n <= 64 && Math.ffloor(n) == n): Std.int(n);
        default: throw new MiraError("Grammar repetition bound must be an integer from 0 to 64");
    };

    function build(value:ConstantValue,depth:Int):Fragment {
        if (depth > 64) throw new MiraError("Grammar nesting limit");
        final a = state();
        final b = state();
        switch (value) {
            case CVariant("Literal",CText(text)):
                var from = a;
                for (code in codes(text)) {
                    final next = state();
                    states[from].edges.push({codes:[code],to:next});
                    from = next;
                }
                link(from,b);
            case CVariant("Character Set",CText(text)):
                final chars = codes(text);
                if (chars.length > 0) states[a].edges.push({codes:chars,to:b});
            case CVariant("Sequence",CList(items)):
                var from = a;
                for (item in items) {
                    final part = build(item,depth+1);
                    link(from,part.start);
                    from = part.end;
                }
                link(from,b);
            case CVariant("Choice",CList(items)):
                for (item in items) {
                    final part = build(item,depth+1);
                    link(a,part.start);
                    link(part.end,b);
                }
            case CVariant("Repeat",CRecord(fields)):
                final min = count(fields.get("min"));
                final max = count(fields.get("max"));
                final unbounded = switch (fields.get("unbounded")) {
                    case CBoolean(flag): flag;
                    default: throw new MiraError("Invalid grammar repetition flag");
                };
                if (unbounded ? max != 0 : min > max) throw new MiraError("Invalid grammar repetition bounds");
                final pattern = fields.get("pattern");
                var from = a;
                for (_ in 0...min) {
                    final part = build(pattern,depth+1);
                    link(from,part.start);
                    from = part.end;
                }
                link(from,b);
                if (unbounded) {
                    final part = build(pattern,depth+1);
                    link(from,part.start);
                    link(part.end,from);
                } else for (_ in min...max) {
                    final part = build(pattern,depth+1);
                    link(from,part.start);
                    from = part.end;
                    link(from,b);
                }
            default: throw new MiraError("Invalid Grammar value");
        }
        return {start:a,end:b};
    }

    // Visited states are essential for nullable repetitions and epsilon cycles.
    function closure(seeds:Array<Int>):Array<Int> {
        final seen = new Map<Int,Bool>();
        final pending = seeds.copy();
        while (pending.length > 0) {
            final id = pending.pop();
            if (seen.exists(id)) continue;
            seen.set(id,true);
            for (next in states[id].epsilon) if (!seen.exists(next)) pending.push(next);
        }
        final result = [for (id in seen.keys()) id];
        result.sort((a,b) -> a-b);
        return result;
    }

    public function compile(value:ConstantValue):GrammarMachine {
        final fragment = build(value,0);
        final subsets = [closure([fragment.start])];
        final ids = new Map<String,Int>();
        ids.set(subsets[0].join(","),0);
        final rows:Array<Array<Int>> = [];
        final accepting:Array<Bool> = [];
        var index = 0;
        while (index < subsets.length) {
            final subset = subsets[index++];
            accepting.push(subset.indexOf(fragment.end) >= 0);
            final row:Array<Int> = [];
            for (code in 0...ALPHABET) {
                final next:Array<Int> = [];
                for (id in subset) for (edge in states[id].edges)
                    if (edge.codes.indexOf(code) >= 0) next.push(edge.to);
                if (next.length == 0) {
                    row.push(-1);
                    continue;
                }
                final closed = closure(next);
                final key = closed.join(",");
                if (!ids.exists(key)) {
                    if (subsets.length >= LIMIT) throw new MiraError("Grammar DFA state limit (256)");
                    ids.set(key,subsets.length);
                    subsets.push(closed);
                }
                row.push(ids.get(key));
            }
            rows.push(row);
        }
        return new GrammarMachine(rows,accepting,states.length);
    }

    public static function fromSource(library:String,source:String,name:String):GrammarMachine {
        final value = ConstantData.read(library + "\n" + source,name,true,"Grammar");
        return new GrammarCompiler().compile(value);
    }
}
