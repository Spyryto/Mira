package mira.types;

import mira.resolve.ModuleIdentity;
import mira.MiraError;
import mira.lex.Token;

// Shared compile-time metadata. The underlying type remains available only
// while checking the declaring module. Foreign views carry just identity.
class TypeVisibility {
    public final privateNames = new Map<String,Bool>();
    public final opaqueNames = new Map<String,Bool>();
    var hasOpaque = false;
    final representations = new Map<String,Type>();

    public function new() {}

    public function markOpaque(name:String):Void {
        opaqueNames.set(name,true);
        hasOpaque = true;
    }

    public function defineOpaque(name:String,type:Type):Void {
        markOpaque(name);
        representations.set(name,type);
    }

    // Only the declaring module can reveal a forward opaque reference.
    // Do not recursively expand records/sums: nominal recursion stays finite.
    public function reveal(type:Type,owner:Null<String>):Type {
        return switch (type) {
            case OpaqueType(name,args) if (ModuleIdentity.owner(name) == owner && representations.exists(name)):
                final template = representations.get(name);
                args.length == 0 ? template : TypeTemplates.apply(template,args);
            default: type;
        };
    }

    public function view(type:Type,owner:Null<String>,?resolve:Type->Type):Type {
        if (!hasOpaque) return type;
        final t = resolve == null ? type : resolve(type);
        function child(value:Type):Type return view(value,owner,resolve);
        return switch (t) {
            case NamedType(name,_) if (opaqueNames.exists(name) && ModuleIdentity.owner(name) != owner): OpaqueType(name,[]);
            case ParametricNamedType(name,_,args) | SumType(name,_,args) | SumReference(name,_,args)
                if (opaqueNames.exists(name) && ModuleIdentity.owner(name) != owner): OpaqueType(name,[for (a in args) child(a)]);
            case OpaqueType(name,args): OpaqueType(name,[for (a in args) child(a)]);
            case NamedType(name,base): NamedType(name,child(base));
            case ParametricNamedType(name,base,args): ParametricNamedType(name,child(base),[for (a in args) child(a)]);
            case SumType(name,alternatives,args):
                SumType(name,[for (tag => payload in alternatives) tag => payload == null ? null : child(payload)],
                    [for (a in args) child(a)]);
            // A finite reference; unfold in the checker only when matching,
            // then apply the view again to the unfolded alternatives.
            case SumReference(name,template,args): SumReference(name,template,[for (a in args) child(a)]);
            case RefinedType(base,range): RefinedType(child(base),range);
            case StructuralType(name,fields): StructuralType(name,[for (key => value in fields) key => child(value)]);
            case ListType(item): ListType(child(item));
            case FunctionType(args,result): FunctionType([for (a in args) child(a)],child(result));
            case RecordType(fields,tail): RecordType([for (key => value in fields) key => child(value)],tail == null ? null : child(tail));
            default: t;
        };
    }

    // A nominally public opaque type is a boundary. Never inspect its
    // private representation when validating a public contract.
    public function requirePublic(type:Type,origin:Token,resolve:Type->Type):Void {
        final seen = new Map<String,Bool>();
        function checkName(name:String):Void {
            if (privateNames.exists(name))
                throw new MiraError("Public signature exposes private type " + name,origin,"type_error");
        }
        function walk(value:Type):Void {
            switch (resolve(value)) {
                case OpaqueType(name,args): checkName(name); for (a in args) walk(a);
                case NamedType(name,base):
                    checkName(name);
                    if (!opaqueNames.exists(name) && !seen.exists(name)) {
                        seen.set(name,true);
                        walk(base);
                    }
                case ParametricNamedType(name,base,args):
                    checkName(name);
                    for (a in args) walk(a);
                    if (!opaqueNames.exists(name)) walk(base);
                case SumType(name,alternatives,args):
                    checkName(name);
                    for (a in args) walk(a);
                    if (!opaqueNames.exists(name)) {
                        for (payload in alternatives) if (payload != null) walk(payload);
                    }
                case SumReference(name,_,args):
                    checkName(name);
                    for (a in args) walk(a);
                case StructuralType(name,fields):
                    checkName(name);
                    if (opaqueNames.exists(name))
                        throw new MiraError("Public signature exposes opaque representation " + name,origin,"type_error");
                    for (field in fields) walk(field);
                case RefinedType(base,_):
                    switch (view(base,null,resolve)) {
                        case OpaqueType(name,_): throw new MiraError("Public signature exposes opaque refinement " + name,origin,"type_error");
                        default:
                    }
                    walk(base);
                case ListType(item): walk(item);
                case FunctionType(args,result): for (a in args) walk(a); walk(result);
                case RecordType(fields,tail):
                    for (field in fields) walk(field);
                    if (tail != null) walk(tail);
                default:
            }
        }
        walk(type);
    }
}
