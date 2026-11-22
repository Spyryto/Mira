package mira.emit;

import mira.MiraError;
import mira.syntax.Definition;
import mira.resolve.Mangle;
import mira.resolve.Symbols;

class PhpEmitter {
    public static function emit(definitions:Array<Definition>, symbols:Symbols):String {
        final lines = ["<?php", "declare(strict_types=1);", ""];

        for (definition in definitions) {
            if (definition.body == null) throw new MiraError("Missing resolved body", definition.origin);

            final scope = definition.isFunction() ? definition.parameters : symbols.globals;
            final expr = SourceEmitter.expression(cast definition.body, "php", scope);

            if (definition.isFunction()) {
                final arguments = [for (param in definition.parameters) "$" + Mangle.name(param)];
                lines.push("function " + Mangle.selector(definition.labels)
                    + "(" + arguments.join(", ") + ") {");
                lines.push("  return " + expr + ";");
                lines.push("}");
                lines.push("");
            } else {
                lines.push("$" + Mangle.name(definition.name) + " = " + expr + ";");
            }
        }

        return lines.join("\n") + "\n";
    }
}
