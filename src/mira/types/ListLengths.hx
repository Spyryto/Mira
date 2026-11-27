package mira.types;

// Cardinality is a nonnegative integral interval, independent of item types.
class ListLengths {
    public static function domain():NumericRange
        return new NumericRange(0,4294967295.0,true,true);
    public static function ofType(type:Type):Null<NumericRange> return switch (type) {
        case NamedType(_,base): ofType(base);
        case ListRefinedType(_,length): length;
        default: null;
    };
    public static function exact(n:Int):NumericRange return new NumericRange(n,n,true,true);
    public static function predicate(length:NumericRange):String
        return StringTools.replace(length.predicate(),"_","(length of: _)");
}
