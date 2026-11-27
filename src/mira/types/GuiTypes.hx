package mira.types;

import mira.types.Type;

// A small trusted ABI for the existing ordinary Mira GUI constructors.
// The fingerprint pins the checked signatures to the actual descriptor bodies.
// No runtime representation is added: View is an unforgeable phantom type.
class GuiTypes {
    static inline final libraryLength = 2003;
    public static inline final libraryLines = 43;
    static inline final digest = "299d67de5df17f835ba263918f6d004c46e0b84fbd59edf4d4b0506198c3bf5d";
    public static function matches(source:String):Bool
        return source.length == libraryLength && haxe.crypto.Sha256.encode(source) == digest;
    public static function hasPrefix(source:String):Bool
        return source.length >= libraryLength && matches(source.substr(0,libraryLength));

    public static function view(state:Type):Type return OpaqueType("#GUI.View",[state]);
    public static function root():Type return OpaqueType("#GUI.NoState",[]);
    public static function renderType():Type {
        final v = view(root());
        return FunctionType([v],v);
    }

    public static function signature(selector:String, fresh:Void->Type,
        scalar:Type->Void, needsState:Type->Void, ?annotations:Array<Null<Type>>):Null<Type> {
        final s = fresh();
        final v = view(s);
        function scalarValue():Type {
            final t = fresh();
            scalar(t);
            return t;
        }
        function transition(?value:Type):Type {
            needsState(s);
            return FunctionType(value == null ? [s] : [s,value],s);
        }
        return switch (selector) {
            case "column:" | "row:": FunctionType([ListType(v)],v);
            case "title:" | "text:": FunctionType([scalarValue()],v);
            case "button:on click:": FunctionType([TextType,FunctionType([],fresh())],v);
            case "button:update:": FunctionType([TextType,transition()],v);
            case "text input:value:update:": FunctionType([TextType,TextType,transition(TextType)],v);
            case "checkbox:checked:update:" | "switch:checked:update:": FunctionType([TextType,BooleanType,transition(BooleanType)],v);
            case "slider:value:update:": FunctionType([TextType,NumberType,transition(NumberType)],v);
            case "choose:value:options:update:": FunctionType([TextType,TextType,ListType(TextType),transition(TextType)],v);
            case "state:view:": FunctionType([s,FunctionType([s],v)],view(fresh()));
            case "state:key:view:": FunctionType([s,TextType,FunctionType([s],v)],view(fresh()));
            case "grid:children:": FunctionType([NumberType,ListType(v)],v);
            case "keyed:view:": FunctionType([scalarValue(),v],v);
            case "styled:with:": FunctionType([v,ListType(RecordType(new Map<String,Type>(),fresh()))],v);
            // The checked layer type comes from the exact trusted Mira source.
            case "styled:with styles:" if (annotations != null && annotations.length == 2 && annotations[1] != null):
                FunctionType([v,annotations[1]],v);
            case "each:identified by:view:":
                final item = fresh();
                FunctionType([ListType(item),FunctionType([item],scalarValue()),FunctionType([item],v)],ListType(v));
            default: null;
        };
    }
}
