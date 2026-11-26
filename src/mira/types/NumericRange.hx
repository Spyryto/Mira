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

    public static function integers():NumericRange return new NumericRange(-9007199254740991.0,9007199254740991.0,true,true);

    public function integerHull():NumericRange {
        final bounded = intersect(integers());
        final lo = bounded.lowClosed ? Math.fceil(bounded.low) : Math.ffloor(bounded.low) + 1;
        final hi = bounded.highClosed ? Math.ffloor(bounded.high) : Math.fceil(bounded.high) - 1;
        return new NumericRange(lo,hi,true,true);
    }

    public static function integerType(type:Type):Bool return switch (type) {
        case IntegerType: true;
        case NamedType(_,base) | RefinedType(base,_): integerType(base);
        default: false;
    };

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

    public function proof(required:NumericRange):NumericProof {
        if (implies(required)) return Proven;
        if (intersect(required).empty()) return Violated;
        return Unknown;
    }

    // Conservative closed bounds for arithmetic on finite portable numbers.
    // PHP integer arithmetic and JS double arithmetic agree on the numerical
    // bounds when operands/results remain within the safe integer magnitude.
    public function portable():Bool return Math.isFinite(low) && Math.isFinite(high)
        && Math.abs(low) <= 9007199254740991.0 && Math.abs(high) <= 9007199254740991.0;

    // Wide observations are for diagnostics only. They must not feed
    // further arithmetic proofs after leaving the portable domain.
    public static function literalBounds(text:String):Null<NumericRange> {
        if (!~/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.match(text)) return null;
        final n = Std.parseFloat(text);
        final result = new NumericRange(n,n,true,true);
        return Math.isFinite(n) ? result : null;
    }

    public static function literal(text:String):Null<NumericRange> {
        final result = literalBounds(text);
        return result != null && result.portable() ? result : null;
    }

    public static function arithmeticBounds(op:String,a:NumericRange,b:NumericRange):Null<NumericRange> {
        if (!a.portable() || !b.portable()) return null;
        // A divisor approaching zero is deliberately not analysed, even if
        // its zero endpoint is open. No assumptions about overflow or NaN.
        if (op == "/" && b.low <= 0 && b.high >= 0) return null;
        var low = Math.POSITIVE_INFINITY;
        var high = Math.NEGATIVE_INFINITY;
        for (x in [a.low,a.high]) for (y in [b.low,b.high]) {
            final value = switch (op) {
                case "+": x + y;
                case "-": x - y;
                case "*": x * y;
                case "/": x / y;
                default: return null;
            };
            if (!Math.isFinite(value)) return null;
            low = Math.min(low,value);
            high = Math.max(high,value);
        }
        // Close endpoints even if inputs were open: rounding can reach them.
        final result = new NumericRange(low,high,true,true);
        return result;
    }

    public static function arithmetic(op:String,a:NumericRange,b:NumericRange):Null<NumericRange> {
        final result = arithmeticBounds(op,a,b);
        return result != null && result.portable() ? result : null;
    }

    public function equal(other:NumericRange):Bool return implies(other) && other.implies(this);

    public static function ofType(type:Type):Null<NumericRange> {
        return switch (type) {
            case NumberType: any();
            case IntegerType: integers();
            case NamedType(_,base): ofType(base);
            case RefinedType(base,range):
                final previous = ofType(base);
                previous == null ? null : integerType(base) ? previous.intersect(range).integerHull() : previous.intersect(range);
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
