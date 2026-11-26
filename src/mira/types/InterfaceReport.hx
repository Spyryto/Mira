package mira.types;

import mira.MiraError;
import mira.resolve.ProviderBindings;

// Versioned type-level public surface, not a build cache key.
// A module's body, source coordinates, inferred vs explicit declaration
// spelling and selected implementation are deliberately excluded.
class InterfaceReport {
    public final publicTypes = new Map<String,Array<String>>();
    public final reexports = new Map<String,Array<Dynamic>>();
    public final edges:Array<Dynamic> = [];
    public var moduleTypes:Map<String,Map<String,Type>>;

    public function new() {}

    public static function canonical(value:Dynamic):String {
        if (value == null) return "null";
        if (Std.isOfType(value,Array)) {
            final items:Array<Dynamic> = cast value;
            return "[" + [for (item in items) canonical(item)].join(",") + "]";
        }
        if (Std.isOfType(value,String) || Std.isOfType(value,Bool) || Std.isOfType(value,Float))
            return haxe.Json.stringify(value);
        final keys = Reflect.fields(value);
        keys.sort(Reflect.compare);
        return "{" + [for (key in keys) haxe.Json.stringify(key) + ":" + canonical(Reflect.field(value,key))].join(",") + "}";
    }

    public function build(rows:Array<Dynamic>,checker:TypeChecker,providers:ProviderBindings):Dynamic {
        final byName = new Map<String,Dynamic>();
        final byModule = new Map<String,Array<Dynamic>>();
        for (row in rows) if (row.module != null && row.exported == true) {
            byName.set(row.name,row);
            final path:String = row.module;
            if (!byModule.exists(path)) byModule.set(path,[]);
            byModule.get(path).push(row);
        }
        final contractPaths = new Map<String,String>();
        if (providers != null) for (edge in edges) if (edge.kind == "implements") {
            final selected = providers.get(edge.to);
            if (selected != null && selected.signatures == null && selected.provider == edge.from)
                contractPaths.set(edge.from,edge.to);
        }
        final modules:Array<Dynamic> = [];
        for (path in publicTypes.keys()) {
            final logical = contractPaths.exists(path) ? contractPaths.get(path) : path;
            final types:Array<Dynamic> = [];
            for (name in publicTypes.get(path))
                types.push({name:name,schema:checker.publicSchema(moduleTypes.get(path).get(name))});
            types.sort((a,b) -> Reflect.compare(a.name,b.name));
            final symbols:Array<Dynamic> = [];
            if (byModule.exists(path)) for (row in byModule.get(path)) {
                final name:String = row.name.substr(path.length+3);
                symbols.push({name:name,kind:StringTools.endsWith(name,":") ? "selector" : "value",schema:row.schema});
            }
            if (reexports.exists(path)) for (item in reexports.get(path)) if (item.kind != "type") {
                final row = byName.get(item.target);
                if (row == null) throw new MiraError("Missing checked re-export " + item.target);
                symbols.push({name:item.name,kind:item.kind,schema:row.schema});
            }
            symbols.sort((a,b) -> Reflect.compare(a.name,b.name));
            final surface = {format:1,module:logical,types:types,symbols:symbols};
            final serialized = canonical(surface);
            modules.push({module:logical,resolvedModule:path,fingerprint:haxe.crypto.Sha256.encode(serialized),canonical:serialized,surface:surface});
        }
        modules.sort((a,b) -> Reflect.compare(a.module,b.module));
        return {format:1,interfaces:modules,dependencies:edges};
    }
}
