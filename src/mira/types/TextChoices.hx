package mira.types;

import mira.types.NumericProof;

// A finite, canonical set of permitted Text values. Same three-way proof
// protocol as numeric refinements, without imposing numeric range semantics.
class TextChoices {
    public final values:Array<String>;

    public function new(items:Array<String>) {
        values = [];
        for (item in items) if (values.indexOf(item) < 0) values.push(item);
        values.sort(Reflect.compare);
    }

    public function intersect(other:TextChoices):TextChoices
        return new TextChoices([for (value in values) if (other.values.indexOf(value) >= 0) value]);

    public function union(other:TextChoices):TextChoices
        return new TextChoices(values.concat(other.values));

    public function implies(other:TextChoices):Bool
        return Lambda.foreach(values,value -> other.values.indexOf(value) >= 0);

    public function equal(other:TextChoices):Bool return implies(other) && other.implies(this);

    public function proof(required:TextChoices):NumericProof {
        if (implies(required)) return Proven;
        if (intersect(required).values.length == 0) return Violated;
        return Unknown;
    }

    public static function isText(type:Type):Bool return switch (type) {
        case TextType: true;
        case NamedType(_,base) | TextRefinedType(base,_): isText(base);
        default: false;
    };

    public static function ofType(type:Type):Null<TextChoices> return switch (type) {
        case NamedType(_,base): ofType(base);
        case TextRefinedType(base,choices):
            final parent = ofType(base);
            parent == null ? choices : parent.intersect(choices);
        default: null;
    };

    public function predicate():String
        return [for (value in values) "_ == " + haxe.Json.stringify(value)].join(" OR ");
}
