package mira.resolve;

// A canonical name is not a source identifier. Slash cannot occur in a
// discursive name or selector label; it is reserved here as a path boundary.
// This encoding is an internal implementation choice, not call-site syntax.
class ModuleIdentity {
    public static function qualify(path:Null<String>,name:String):String
        return path == null ? name : path + " / " + name;

    public static function isQualified(name:String):Bool return name.indexOf(" / ") >= 0;

    public static function mangle(name:String,kind:String):String {
        final bytes = haxe.io.Bytes.ofString(name);
        final encoded = new StringBuf();
        for (i in 0...bytes.length) encoded.add(StringTools.hex(bytes.get(i),2));
        return "__miraModule_" + kind + "_" + encoded.toString();
    }
}
