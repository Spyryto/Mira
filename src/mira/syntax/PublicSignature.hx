package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.types.Type;

// Contracts are parsed in the public type environment, before private
// imports or implementation types are introduced.
class PublicSignature {
    public final name:String;
    public final origin:Token;
    public final typeParameters:Array<String>;
    public final parameters:Array<Type>;
    public final result:Type;

    public function new(name:String,origin:Token,typeParameters:Array<String>,parameters:Array<Type>,result:Type) {
        this.name = name;
        this.origin = origin;
        this.typeParameters = typeParameters;
        this.parameters = parameters;
        this.result = result;
    }

    public static function read(tokens:Array<Token>,names:Map<String,Type>):PublicSignature {
        final marker = DefinitionParser.topLevel(tokens,"::");
        if (marker < 0) {
            final value = DefinitionParser.annotatedName(tokens,names);
            if (value.type == null) throw new MiraError("Expected public value annotation",tokens[0]);
            return new PublicSignature(value.name,tokens[0],[],[],value.type);
        }
        var header = tokens.slice(0,marker);
        final colon = DefinitionParser.topLevel(header,":");
        if (colon < 0) throw new MiraError("Expected public selector",tokens[0]);
        final first = header.slice(0,colon);
        final opening = DefinitionParser.topLevel(first,"(");
        var generics:Array<String> = [];
        if (opening >= 0) {
            final generic = DefinitionParser.typeHeader(first,names);
            generics = generic.parameters;
            names = names.copy();
            for (i in 0...generics.length) names.set(generics[i],Variable(-i-1));
            header = first.slice(0,opening).concat(header.slice(colon));
        }
        final name = ModuleSections.reference(header);
        final signature = tokens.slice(marker+1);
        final arrow = DefinitionParser.topLevel(signature,"->");
        if (arrow < 3 || !signature[0].isSymbol("(") || !signature[arrow-1].isSymbol(")") || arrow == signature.length-1)
            throw new MiraError("Expected (parameter types) -> result type",tokens[marker]);
        final parameters = [for (part in DefinitionParser.splitHeader(signature.slice(1,arrow-1)))
            new TypeParser(part,part[0],names).parse()];
        if (parameters.length != name.split(":").length-1)
            throw new MiraError("Public signature arity mismatch for " + name,tokens[0]);
        final result = new TypeParser(signature.slice(arrow+1),signature[arrow],names).parse();
        return new PublicSignature(name,tokens[0],generics,parameters,result);
    }

    // Exact equality of written annotations, not assignability. Nominal
    // identity is sufficient; recursive representations are not unfolded.
    static function same(a:Type,b:Type):Bool {
        return switch [a,b] {
            case [NumberType,NumberType] | [IntegerType,IntegerType] | [TextType,TextType] | [BooleanType,BooleanType]: true;
            case [Variable(x),Variable(y)]: x == y;
            case [NamedType(x,_),NamedType(y,_)]: x == y;
            case [OpaqueType(x,xs),NamedType(y,_)] | [NamedType(x,_),OpaqueType(y,xs)]: x == y && xs.length == 0;
            case [OpaqueType(x,xs),OpaqueType(y,ys)] | [OpaqueType(x,xs),ParametricNamedType(y,_,ys)] | [ParametricNamedType(x,_,xs),OpaqueType(y,ys)] | [OpaqueType(x,xs),SumType(y,_,ys)] | [SumType(x,_,xs),OpaqueType(y,ys)] | [OpaqueType(x,xs),SumReference(y,_,ys)] | [SumReference(x,_,xs),OpaqueType(y,ys)]: x == y && sameArray(xs,ys);
            case [ParametricNamedType(x,_,xs),ParametricNamedType(y,_,ys)]
                | [SumType(x,_,xs),SumType(y,_,ys)] | [SumReference(x,_,xs),SumReference(y,_,ys)]
                | [SumType(x,_,xs),SumReference(y,_,ys)] | [SumReference(x,_,xs),SumType(y,_,ys)]:
                x == y && sameArray(xs,ys);
            case [RefinedType(x,r),RefinedType(y,s)]: r.equal(s) && same(x,y);
            case [ListType(x),ListType(y)]: same(x,y);
            case [FunctionType(xs,x),FunctionType(ys,y)]: sameArray(xs,ys) && same(x,y);
            case [RecordType(xs,x),RecordType(ys,y)]:
                sameFields(xs,ys) && (x == null ? y == null : y != null && same(x,y));
            case [StructuralType(x,xs),StructuralType(y,ys)]: x == y && sameFields(xs,ys);
            default: false;
        };
    }

    static function sameArray(a:Array<Type>,b:Array<Type>):Bool {
        if (a.length != b.length) return false;
        for (i in 0...a.length) if (!same(a[i],b[i])) return false;
        return true;
    }

    static function sameFields(a:Map<String,Type>,b:Map<String,Type>):Bool {
        if (Lambda.count(a) != Lambda.count(b)) return false;
        for (key => value in a) if (!b.exists(key) || !same(value,b.get(key))) return false;
        return true;
    }

    public function apply(d:Definition):Void {
        if (d.parameters.length != parameters.length)
            throw new MiraError("Public signature arity mismatch for " + name,origin);
        if (d.typeParameters.length > 0 && d.typeParameters.length != typeParameters.length)
            throw new MiraError("Implementation type parameter count conflicts with public signature " + name,d.origin);
        for (i in 0...parameters.length) {
            final annotation = d.parameterAnnotations[i];
            if (annotation != null && !same(annotation,parameters[i]))
                throw new MiraError("Implementation parameter annotation conflicts with public signature " + name,d.parameterOrigins[i]);
        }
        if (d.resultAnnotation != null && !same(d.resultAnnotation,result))
            throw new MiraError("Implementation result annotation conflicts with public signature " + name,d.resultAnnotationOrigin);
        d.parameterAnnotations = [for (parameter in parameters) parameter];
        d.resultAnnotation = result;
        d.resultAnnotationOrigin = origin;
        d.typeParameters = typeParameters.copy();
        d.hasPublicSignature = true;
    }
}
