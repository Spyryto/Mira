package mira.types;

// Closed numeric refinement predicates, normalized to one interval.
// Infinite endpoints are internal sentinels, never serialized as JSON numbers.
class NumericRange {
    public final low:Float;
    public final high:Float;
    public final lowClosed:Bool;
    public final highClosed:Bool;

    public function new(low:Float,high:Float,lowClosed:Bool,highClosed:Bool) {
        this.low = low;
        this.high = high;
        this.lowClosed = lowClosed;
        this.highClosed = highClosed;
    }

    public static function any():NumericRange return new NumericRange(Math.NEGATIVE_INFINITY,Math.POSITIVE_INFINITY,false,false);

    public static function comparison(op:String,value:Float):NumericRange {
        return switch (op) {
            case ">": new NumericRange(value,Math.POSITIVE_INFINITY,false,false);
            case ">=": new NumericRange(value,Math.POSITIVE_INFINITY,true,false);
            case "<": new NumericRange(Math.NEGATIVE_INFINITY,value,false,false);
            case "<=": new NumericRange(Math.NEGATIVE_INFINITY,value,false,true);
            case "==": new NumericRange(value,value,true,true);
            default: throw new mira.MiraError("Unsupported refinement comparison " + op);
        };
    }

    public function intersect(other:NumericRange):NumericRange {
        return new NumericRange(Math.max(low,other.low),Math.min(high,other.high),
            low > other.low ? lowClosed : low < other.low ? other.lowClosed : lowClosed && other.lowClosed,
            high < other.high ? highClosed : high > other.high ? other.highClosed : highClosed && other.highClosed);
    }

    public function empty():Bool return low > high || (low == high && !(lowClosed && highClosed));

    public function contains(n:Float):Bool return Math.isFinite(n)
        && (n > low || (lowClosed && n == low)) && (n < high || (highClosed && n == high));

    public function implies(other:NumericRange):Bool return
        (low > other.low || (low == other.low && (!lowClosed || other.lowClosed)))
        && (high < other.high || (high == other.high && (!highClosed || other.highClosed)));

    public function equal(other:NumericRange):Bool return implies(other) && other.implies(this);

    public static function ofType(type:Type):Null<NumericRange> {
        return switch (type) {
            case NumberType: any();
            case NamedType(_,base): ofType(base);
            case RefinedType(base,range):
                final previous = ofType(base);
                previous == null ? null : previous.intersect(range);
            default: null;
        };
    }

    public function predicate():String {
        final parts:Array<String> = [];
        if (Math.isFinite(low)) parts.push("_ " + (lowClosed ? ">=" : ">") + " " + Std.string(low));
        if (Math.isFinite(high)) parts.push("_ " + (highClosed ? "<=" : "<") + " " + Std.string(high));
        return parts.join(" AND ");
    }

    public function schema():Dynamic return {
        lower:Math.isFinite(low) ? low : null, upper:Math.isFinite(high) ? high : null,
        lowerInclusive:lowClosed, upperInclusive:highClosed
    };
}
