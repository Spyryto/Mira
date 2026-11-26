package mira.emit;

import mira.MiraError;
import mira.Target;
import mira.syntax.Definition;
import mira.resolve.Mangle;
import mira.resolve.Symbols;
import mira.emit.SourceLocations.GeneratedLocation;

class PhpEmitter {
    public static function emit(definitions:Array<Definition>, symbols:Symbols, ?locations:Array<GeneratedLocation>, ?guards:haxe.ds.ObjectMap<Dynamic,mira.types.NumericGuard>):String {
        final lines = ["<?php", "declare(strict_types=1);", ""];
        var generatedLine = lines.length + 1;
        for (definition in definitions) {
            final first = lines.length;
            if (definition.body == null) throw new MiraError("Missing resolved body", definition.origin);
            // Function parameters shadow outer named values, but global values remain
            // accessible from every function in both backends.
            final scope = definition.isFunction()
                ? definition.parameters.concat(symbols.globals) : symbols.globals;
            final expr = SourceEmitter.expression(
                cast definition.body, Php, scope, symbols.hostNames, guards
            );

            if (definition.isStatement) {
                lines.push(expr + ";");
            } else if (definition.isFunction()) {
                final args = [for (param in definition.parameters) "$" + Mangle.name(param)];
                lines.push("function " + Mangle.selector(definition.labels)
                    + "(" + args.join(", ") + ") {");
                // PHP named functions do not capture top-level variables
                // automatically. Exclude parameters to preserve lexical shadows.
                final globals = [for (name in symbols.globals)
                    if (definition.parameters.indexOf(name) == -1) "$" + Mangle.name(name)];
                if (globals.length > 0) lines.push("  global " + globals.join(", ") + ";");
                lines.push("  return " + expr + ";");
                lines.push("}");
                lines.push("");
            } else {
                lines.push("$" + Mangle.name(definition.name) + " = " + expr + ";");
            }
            if (locations != null) generatedLine = SourceLocations.append(
                locations, definition, lines, first, generatedLine);
        }
        return lines.join("\n") + "\n";
    }
}
