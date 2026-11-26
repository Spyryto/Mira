package mira.resolve;

import mira.MiraError;
import mira.syntax.PublicSignature;
import mira.types.ContractVerifier;

typedef ProviderBinding = {
    final provider:String;
    final signatures:Null<Array<PublicSignature>>;
}

// Build configuration, not a runtime registry. A logical service path
// names a restricted view of a concrete provider's existing declarations.
class ProviderBindings {
    final entries = new Map<String,ProviderBinding>();

    public function new() {}

    public function get(path:String):Null<ProviderBinding> return entries.get(path);
    public function exists(path:String):Bool return entries.exists(path);

    static function validPath(path:String):Bool
        return ~/^[A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*( \/ [A-Za-z_][A-Za-z_0-9]*( [A-Za-z_][A-Za-z_0-9]*)*)*$/.match(path);

    public static function fromJson(json:String):ProviderBindings {
        final config = new ProviderBindings();
        final raw:Dynamic = haxe.Json.parse(json);
        if (raw == null || !Reflect.isObject(raw) || Std.isOfType(raw,Array) || Std.isOfType(raw,String))
            throw new MiraError("Expected provider binding map");
        for (path in Reflect.fields(raw)) {
            final value:Dynamic = Reflect.field(raw,path);
            if (!validPath(path) || value == null || !Reflect.isObject(value) || Std.isOfType(value,Array))
                throw new MiraError("Invalid contract binding " + path);
            final provider:Dynamic = Reflect.field(value,"provider");
            final contract:Dynamic = Reflect.field(value,"contract");
            if (!Std.isOfType(provider,String) || !validPath(provider) || (Reflect.hasField(value,"contract") && !Std.isOfType(contract,String)))
                throw new MiraError("Binding requires provider path and optional contract text: " + path);
            for (field in Reflect.fields(value)) if (field != "provider" && field != "contract")
                throw new MiraError("Unknown binding field " + field);
            config.entries.set(path,{provider:provider,signatures:contract == null ? null : ContractVerifier.signatures(contract)});
        }
        for (path => binding in config.entries)
            if (config.exists(binding.provider))
                throw new MiraError("Provider must be a concrete module, not a contract path: " + binding.provider);
        return config;
    }
}
