package mira.types;

// A row tail is either another record, an inference variable, or null (closed).
enum Type {
    NumberType;
    TextType;
    BooleanType;
    Variable(id:Int);
    ListType(item:Type);
    FunctionType(parameters:Array<Type>, result:Type);
    RecordType(fields:Map<String, Type>, tail:Null<Type>);
}
