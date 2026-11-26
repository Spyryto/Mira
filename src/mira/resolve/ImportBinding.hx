package mira.resolve;

import mira.lex.Token;
import mira.syntax.Definition;

// Compile-time lexical binding to a declaration; never emitted as a wrapper.
class ImportBinding {
    public final alias:String;
    public final target:Definition;
    public final origin:Token;

    public function new(alias:String,target:Definition,origin:Token) {
        this.alias = alias;
        this.target = target;
        this.origin = origin;
    }

    public function canonicalName():String
        return ModuleIdentity.qualify(target.modulePath,target.isFunction() ? target.selector() : target.name);
}
