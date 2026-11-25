package mira.types;

import mira.MiraError;

// Manifest types are a serialization of the existing closed Type algebra.
// No evaluation, host reflection, or implicit Dynamic.
class HostTypeCodec {
    static function invalid(path:String, message:String):Dynamic {
        throw new MiraError("Host type " + path + ": " + message, null, "host_type_error");
    }

    public static function decode(value:Dynamic,path:String,depth:Int = 0):Type {
        if (depth > 32) return invalid(path,"type nesting exceeds 32");
        if (Std.isOfType(value,String)) {
            return switch (cast(value,String)) {
                case "Number": NumberType;
                case "Text": TextType;
                case "Boolean": BooleanType;
                default: invalid(path,"unknown primitive " + value);
            };
        }
        if (value == null || !Reflect.isObject(value) || Std.isOfType(value,Array))
            return invalid(path,"expected a primitive or type object");
        final keys = Reflect.fields(value);
        if (keys.length == 1 && Reflect.hasField(value,"list"))
            return ListType(decode(Reflect.field(value,"list"),path+".list",depth+1));
        if (keys.length == 1 && Reflect.hasField(value,"record")) {
            final fields:Dynamic = Reflect.field(value,"record");
            if (fields == null || !Reflect.isObject(fields) || Std.isOfType(fields,Array) || Std.isOfType(fields,String))
                return invalid(path,"record must contain a field map");
            final result = new Map<String,Type>();
            for (key in Reflect.fields(fields))
                result.set(key,decode(Reflect.field(fields,key),path+".record."+key,depth+1));
            return RecordType(result,null);
        }
        if (keys.length == 2 && Reflect.hasField(value,"parameters") && Reflect.hasField(value,"result")) {
            final args:Dynamic = Reflect.field(value,"parameters");
            if (!Std.isOfType(args,Array)) return invalid(path,"parameters must be an array");
            final items:Array<Dynamic> = cast args;
            return FunctionType([for (i in 0...items.length) decode(items[i],path+".parameters["+i+"]",depth+1)],
                decode(Reflect.field(value,"result"),path+".result",depth+1));
        }
        return invalid(path,"expected list, record or parameters/result");
    }

    public static function read(input:Dynamic,values:Array<String>,callables:Array<String>,selectors:Array<String>):Map<String,Type> {
        final result = new Map<String,Type>();
        if (input == null) return result;
        if (!Reflect.isObject(input) || Std.isOfType(input,Array) || Std.isOfType(input,String))
            return invalid("types","expected a name-to-type object");
        for (name in Reflect.fields(input)) {
            if (values.indexOf(name) < 0 && callables.indexOf(name) < 0 && selectors.indexOf(name) < 0)
                return invalid(name,"name is not registered");
            final type = decode(Reflect.field(input,name),name);
            if (callables.indexOf(name) >= 0 || selectors.indexOf(name) >= 0) {
                switch (type) {
                    case FunctionType(args,_):
                        if (selectors.indexOf(name) >= 0 && args.length != name.split(":").length-1)
                            return invalid(name,"selector arity mismatch");
                    default: return invalid(name,"callable requires a function type");
                }
            }
            result.set(name,type);
        }
        return result;
    }
}
