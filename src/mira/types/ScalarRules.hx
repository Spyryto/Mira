package mira.types;

import mira.MiraError;
import mira.syntax.Definition;
import mira.syntax.Expr;
import mira.grammar.GrammarMachine;

// Project native scalar domains from ordinary Mira types. This is a
// compatibility projection, not a second declaration language.
enum ScalarRule {
    Bounds(range:NumericRange,whole:Bool);
    TextChoices(values:Array<String>);
    TextGrammar(machine:GrammarMachine);
    Alternatives(rules:Array<ScalarRule>);
}

class ScalarRules {
    public static function fromType(type:Type,definitions:Array<Definition>):ScalarRule {
        final range = NumericRange.ofType(type);
        if (range != null) return Bounds(range,NumericRange.integerType(type));
        final choices = mira.types.TextChoices.ofType(type);
        if (choices != null) return TextChoices(choices.values);
        final grammar = GrammarMachine.ofType(type);
        if (grammar != null) return TextGrammar(grammar);
        return switch (type) {
            case NamedType(_,base): fromType(base,definitions);
            case SumType(name,alternatives,_):
                final rules:Array<ScalarRule> = [];
                for (d in definitions) if (d.body != null) switch (d.body) {
                    case Variant(SumType(owner,_,_),tag,payload) if (owner == name):
                        if (d.scalarValue == null) throw new MiraError("Expected native scalar encoding for " + tag);
                        if (payload != null) rules.push(fromType(alternatives.get(tag),definitions));
                        else switch (d.scalarValue) {
                            case Text(value): rules.push(TextChoices([value]));
                            case Numeric(value):
                                final n = Std.parseFloat(value);
                                rules.push(Bounds(new NumericRange(n,n,true,true),false));
                            default: throw new MiraError("Unsupported native scalar literal");
                        }
                    default:
                }
                if (rules.length != Lambda.count(alternatives)) throw new MiraError("Incomplete native scalar domain " + name);
                Alternatives(rules);
            default: throw new MiraError("Unsupported native scalar domain");
        };
    }

    public static function allowsNumber(rule:ScalarRule):Bool return switch (rule) {
        case Bounds(_,_): true;
        case Alternatives(items): Lambda.exists(items,allowsNumber);
        default: false;
    };

    public static function allowsText(rule:ScalarRule):Bool return switch (rule) {
        case TextChoices(_) | TextGrammar(_): true;
        case Alternatives(items): Lambda.exists(items,allowsText);
        default: false;
    };

    public static function numberAllowed(rule:ScalarRule,n:Float):Bool return switch (rule) {
        case Bounds(range,whole): range.contains(n) && (!whole || Math.ffloor(n) == n);
        case Alternatives(items): Lambda.exists(items,item -> numberAllowed(item,n));
        default: false;
    };

    public static function textAllowed(rule:ScalarRule,value:String):Bool return switch (rule) {
        case TextChoices(items): items.indexOf(value) >= 0;
        case TextGrammar(machine): machine.matches(value);
        case Alternatives(items): Lambda.exists(items,item -> textAllowed(item,value));
        default: false;
    };
}
