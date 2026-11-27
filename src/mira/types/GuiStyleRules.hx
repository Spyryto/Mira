package mira.types;

// Compile-time mirror of the deliberately small studio/ui-host.js vocabulary.
// Host validation remains authoritative for values not known statically.
// Parity regression tests exercise both implementations.
class GuiStyleRules {
    public static function kind(key:String):Null<String> return switch (key) {
        case "padding" | "margin" | "gap" | "radius" | "borderWidth" | "fontSize": "length";
        case "fontWeight": "weight";
        case "flex": "flex";
        case "width" | "minWidth" | "maxWidth": "size";
        case "background" | "color" | "borderColor": "color";
        case "borderStyle" | "align" | "justify" | "wrap" | "textAlign" | "shadow": "choice";
        default: null;
    };

    public static function allowsNumber(kind:String):Bool
        return kind == "length" || kind == "weight" || kind == "flex" || kind == "size";

    public static function allowsText(kind:String):Bool
        return kind == "color" || kind == "choice" || kind == "size";

    public static function numberAllowed(kind:String,n:Float):Bool {
        if (!Math.isFinite(n)) return false;
        return switch (kind) {
            case "length" | "size": n >= 0 && n <= 4096;
            case "weight": n >= 100 && n <= 900 && Math.floor(n) == n;
            case "flex": n >= 0 && n <= 100;
            default: false;
        };
    }

    public static function textAllowed(key:String,kind:String,value:String):Bool {
        if (kind == "color")
            return value == "transparent" || value == "currentColor" ||
                ((value.length == 4 || value.length == 5 || value.length == 7 || value.length == 9)
                 && ~/^#[0-9a-f]+$/i.match(value));
        final options = switch (key) {
            case "width" | "minWidth" | "maxWidth": ["fill","auto"];
            case "borderStyle": ["solid","none","dashed"];
            case "align": ["start","center","end","stretch","baseline"];
            case "justify": ["start","center","end","space-between","space-around"];
            case "wrap": ["wrap","nowrap"];
            case "textAlign": ["left","center","right"];
            case "shadow": ["none","hard","soft"];
            default: [];
        };
        return options.indexOf(value) >= 0;
    }
}
