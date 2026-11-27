package mira.types;

import mira.MiraError;
import mira.types.ConstantData.ConstantValue;

// Domain-independent scalar constraints. Alternatives describe native values,
// not a tagged representation of the application value being checked.
enum ScalarRule {
    Bounds(min:Float,max:Float,whole:Bool);
    TextChoices(values:Array<String>);
    TextPattern(pattern:EReg);
    Alternatives(rules:Array<ScalarRule>);
}

class ScalarRules {
    public static function readRecord(source:String,name:String):Map<String,ScalarRule> {
        return switch (ConstantData.read(source,name)) {
            case CRecord(fields): [for (key => value in fields) key => decode(value)];
            default: throw new MiraError("Expected a record of scalar rules");
        };
    }

    static function decode(value:ConstantValue):ScalarRule {
        return switch (value) {
            case CVariant(tag,CRecord(fields)) if (tag == "Range" || tag == "Whole"):
                switch [fields.get("min"),fields.get("max")] {
                    case [CNumber(min),CNumber(max)] if (Math.isFinite(min) && Math.isFinite(max) && min <= max && Lambda.count(fields) == 2):
                        Bounds(min,max,tag == "Whole");
                    default: throw new MiraError("Invalid scalar bounds");
                }
            case CVariant("Choices",CList(values)):
                if (values.length == 0) throw new MiraError("Empty scalar choices");
                TextChoices([for (item in values) switch (item) {
                    case CText(text): text;
                    default: throw new MiraError("Scalar choices require Text");
                }]);
            case CVariant("Pattern",CText(pattern)): TextPattern(new EReg(pattern,""));
            case CVariant("Either",CList(values)):
                if (values.length == 0) throw new MiraError("Empty scalar alternatives");
                Alternatives([for (item in values) decode(item)]);
            default: throw new MiraError("Unknown scalar rule");
        };
    }

    public static function allowsNumber(rule:ScalarRule):Bool {
        return switch (rule) {
            case Bounds(_,_,_): true;
            case Alternatives(items): Lambda.exists(items,allowsNumber);
            default: false;
        };
    }

    public static function allowsText(rule:ScalarRule):Bool {
        return switch (rule) {
            case TextChoices(_) | TextPattern(_): true;
            case Alternatives(items): Lambda.exists(items,allowsText);
            default: false;
        };
    }

    public static function numberAllowed(rule:ScalarRule,n:Float):Bool {
        if (!Math.isFinite(n)) return false;
        return switch (rule) {
            case Bounds(min,max,whole): n >= min && n <= max && (!whole || Math.ffloor(n) == n);
            case Alternatives(items): Lambda.exists(items,item -> numberAllowed(item,n));
            default: false;
        };
    }

    public static function textAllowed(rule:ScalarRule,value:String):Bool {
        return switch (rule) {
            case TextChoices(items): items.indexOf(value) >= 0;
            case TextPattern(pattern):
                pattern.match(value) && pattern.matchedPos().pos == 0 && pattern.matchedPos().len == value.length;
            case Alternatives(items): Lambda.exists(items,item -> textAllowed(item,value));
            default: false;
        };
    }
}
