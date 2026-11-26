package mira.types;

// A row tail is either another record, an inference variable, or null (closed).
enum Type {
    NamedType(name:String,base:Type);
    OpaqueType(name:String,arguments:Array<Type>);
    ParametricNamedType(name:String,base:Type,arguments:Array<Type>);
    SumType(name:String,alternatives:Map<String,Null<Type>>,arguments:Array<Type>);
    // A finite nominal back-reference; the shared declaration map is never traversed implicitly.
    SumReference(name:String,template:Map<String,Null<Type>>,arguments:Array<Type>);
    RefinedType(base:Type,range:NumericRange);
    // A read-only structural requirement; additional fields are unknown.
    StructuralType(name:String,fields:Map<String,Type>);
    NumberType;
    IntegerType;
    TextType;
    BooleanType;
    Variable(id:Int);
    ListType(item:Type);
    FunctionType(parameters:Array<Type>, result:Type);
    RecordType(fields:Map<String, Type>, tail:Null<Type>);
}
