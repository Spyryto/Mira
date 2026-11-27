package mira.types;

import mira.MiraError;
import mira.Modules;
import mira.types.ScalarRules.ScalarRule;

// Legacy contextual style syntax projects the exact bundled nominal types.
// The renderer remains an independent trust boundary.
class GuiStyleRules {
    static var rules:Null<Map<String,ScalarRule>>;
    static var length:NumericRange;

    static function initialize():Void {
        if (rules != null) return;
        final source = haxe.Resource.getString("lib/gui-typed-styles.mira");
        final grammar = haxe.Resource.getString("lib/grammar.mira");
        if (source == null || grammar == null) throw new MiraError("Missing standard typed GUI style library");
        final types = new Map<String,Type>();
        final definitions = Modules.collect(source,path -> path == "lib/grammar.mira" ? grammar : null,null,types);
        final fields = switch (types.get("GUI Style")) {
            case NamedType(_,OptionalRecordType(required,optional)) if (!required.keys().hasNext()): optional;
            default: throw new MiraError("Expected optional GUI Style schema");
        };
        length = ListLengths.ofType(types.get("Style Layers"));
        if (length == null) throw new MiraError("Expected bounded Style Layers schema");
        rules = [for (key => type in fields) key => ScalarRules.fromType(type,definitions)];
    }

    public static function get(key:String):Null<ScalarRule> {
        initialize();
        return rules.get(key);
    }

    public static function layerCountAllowed(count:Int):Bool {
        initialize();
        return length.contains(count);
    }

    public static function layerLimit():String {
        initialize();
        return Std.string(length.high);
    }
}
