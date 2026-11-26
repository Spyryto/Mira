package mira.types;

// Pure substitution of declaration-local negative variable slots.
// No checker bindings are shared by different applications.
class TypeTemplates {
    public static function apply(template:Type,arguments:Array<Type>):Type {
        return switch (template) {
            case SumType(_,_,parameters) | ParametricNamedType(_,_,parameters):
                if (parameters.length != arguments.length) throw new mira.MiraError("Wrong number of type arguments");
                final slots = new Map<Int,Type>();
                for (i in 0...parameters.length) switch (parameters[i]) {
                    case Variable(id) if (id < 0): slots.set(id,arguments[i]);
                    default: throw new mira.MiraError("Expected a parametric type template");
                }
                substitute(template,slots);
            default: throw new mira.MiraError("Expected a parametric type template");
        };
    }

    static function substitute(type:Type,slots:Map<Int,Type>):Type {
        return switch (type) {
            case Variable(id) if (slots.exists(id)): slots.get(id);
            case ListType(item): ListType(substitute(item,slots));
            case RecordType(fields,tail):
                RecordType([for (key => field in fields) key => substitute(field,slots)],
                    tail == null ? null : substitute(tail,slots));
            case ParametricNamedType(name,base,arguments):
                ParametricNamedType(name,substitute(base,slots),[for (argument in arguments) substitute(argument,slots)]);
            case SumType(name,alternatives,arguments):
                SumType(name,[for (tag => payload in alternatives) tag => payload == null ? null : substitute(payload,slots)],
                    [for (argument in arguments) substitute(argument,slots)]);
            case FunctionType(args,result): FunctionType([for (arg in args) substitute(arg,slots)],substitute(result,slots));
            default: type;
        };
    }
}
