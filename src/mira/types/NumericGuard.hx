package mira.types;

// Compile-time obligation, attached to an existing expression by identity.
// Multiple inherited constraints share one evaluation and one guard.
class NumericGuard {
    public var integer:Bool = false;
    public var range:Null<NumericRange> = null;
    public function new() {}
    public function requireRange(value:NumericRange):Void {
        range = range == null ? value : range.intersect(value);
    }
}
