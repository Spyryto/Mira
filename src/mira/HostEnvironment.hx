package mira;

import mira.MiraError;
import mira.types.Type;
import mira.types.HostTypeCodec;

// Pure compile-time description of host names. No JavaScript or PHP functions
// are passed into Haxe; runtime callables remain owned by each host.
class HostEnvironment {
    public final values:Array<String>;
    public final callables:Array<String>;
    public final selectors:Array<String>;
    public final types:Map<String,Type>;
    final scopes = new Map<String,Array<String>>();

    public function new(
        ?values:Array<String>,
        ?callables:Array<String>,
        ?selectors:Array<String>,
        ?typeManifest:Dynamic,
        ?scopeManifest:Dynamic
    ) {
        this.values = values == null ? [] : values.copy();
        this.callables = callables == null ? [] : callables.copy();
        this.selectors = selectors == null ? [] : selectors.copy();

        final seen = new Map<String, Bool>();
        for (name in this.values.concat(this.callables)) {
            if (!validName(name)) {
                throw new MiraError("Invalid host name: " + name);
            }
            if (seen.exists(name)) throw new MiraError("Duplicate host name: " + name);
            seen.set(name, true);
        }
        for (selector in this.selectors) {
            if (!validSelector(selector)) {
                throw new MiraError("Invalid host selector: " + selector);
            }
            if (seen.exists(selector)) throw new MiraError("Duplicate host selector: " + selector);
            seen.set(selector, true);
        }
        types = HostTypeCodec.read(typeManifest,this.values,this.callables,this.selectors);
        if (scopeManifest != null) readScopes(scopeManifest,seen);
    }

    public static function empty():HostEnvironment {
        return new HostEnvironment();
    }

    public static function fromJson(source:String):HostEnvironment {
        final input:Dynamic = try {
            haxe.Json.parse(source);
        } catch (error:Dynamic) {
            throw new MiraError("Invalid host environment JSON");
        }
        if (input == null || !Reflect.isObject(input) || Std.isOfType(input, Array) || Std.isOfType(input,String)) {
            throw new MiraError("Host environment must be a JSON object");
        }
        return new HostEnvironment(
            names(input, "values"),
            names(input, "callables"),
            names(input, "selectors"),
            Reflect.field(input, "types"),
            Reflect.field(input, "scopes")
        );
    }

    function readScopes(input:Dynamic,registered:Map<String,Bool>):Void {
        if (!Reflect.isObject(input) || Std.isOfType(input,Array) || Std.isOfType(input,String))
            throw new MiraError("Host scopes must be a name-to-module-list object");
        for (name in Reflect.fields(input)) {
            if (!registered.exists(name) || !types.exists(name))
                throw new MiraError("Host scope requires a registered typed capability: " + name);
            // Legacy native overrides have global checker semantics.
            if (mira.resolve.Symbols.nativeSelectors().indexOf(name) >= 0)
                throw new MiraError("Cannot scope a native selector override: " + name);
            final raw:Dynamic = Reflect.field(input,name);
            if (!Std.isOfType(raw,Array) || (cast raw:Array<Dynamic>).length == 0)
                throw new MiraError("Host scope requires a nonempty module list: " + name);
            final modules:Array<String> = [];
            for (item in (cast raw:Array<Dynamic>)) {
                if (!Std.isOfType(item,String))
                    throw new MiraError("Invalid host scope module for " + name);
                final path:String = cast item;
                if (!~/^[A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*( \/ [A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*)*$/.match(path) || modules.indexOf(path) >= 0)
                    throw new MiraError("Invalid or duplicate host scope module: " + path);
                modules.push(path);
            }
            scopes.set(name,modules);
        }
    }

    // Only source resolution receives the narrowed environment. The checker
    // and emitter retain the full host types for resolved HostRef/HostCall.
    public function forModule(path:Null<String>):HostEnvironment {
        if (!scopes.iterator().hasNext()) return this;
        function allowed(name:String):Bool {
            return !scopes.exists(name) || (path != null && scopes.get(name).indexOf(path) >= 0);
        }
        final view = new HostEnvironment(values.filter(allowed),callables.filter(allowed),selectors.filter(allowed));
        for (name => type in types) if (allowed(name)) view.types.set(name,type);
        return view;
    }

    static function names(input:Dynamic, field:String):Array<String> {
        final value:Dynamic = Reflect.field(input, field);
        if (value == null) return [];
        if (!Std.isOfType(value, Array)) {
            throw new MiraError("Host environment " + field + " must be an array");
        }
        final names:Array<String> = [];
        for (item in cast(value, Array<Dynamic>)) {
            if (!Std.isOfType(item, String)) {
                throw new MiraError("Host environment " + field + " contains a non-string");
            }
            names.push(cast item);
        }
        return names;
    }

    static function validName(value:String):Bool {
        if (value.length == 0 || StringTools.trim(value) != value) return false;
        for (word in value.split(" ")) {
            if (!~/^[A-Za-z_][A-Za-z_0-9]*$/.match(word)) return false;
        }
        return value != "_";
    }

    static function validSelector(value:String):Bool {
        if (!StringTools.endsWith(value, ":")) return false;
        final parts = value.substr(0, value.length - 1).split(":");
        for (part in parts) if (!validName(part)) return false;
        return true;
    }
}
