package mira.emit;

import mira.syntax.Definition;

// A definition-level mapping, not a full expression-level source map.
typedef GeneratedLocation = {
    final generatedStartLine:Int;
    final generatedEndLine:Int;
    final line:Int;
    final column:Int;
    final name:String;
    @:optional final file:String;
}

class SourceLocations {
    public static function append(
        locations:Array<GeneratedLocation>, definition:Definition,
        lines:Array<String>, first:Int, generatedLine:Int
    ):Int {
        var nextLine = generatedLine;
        for (i in first...lines.length) {
            // PHP string literals can contain actual newlines.
            nextLine += lines[i].split("\n").length;
        }
        final location:GeneratedLocation = {
            generatedStartLine: generatedLine,
            generatedEndLine: nextLine - 1,
            line: definition.origin.line,
            column: definition.origin.column,
            name: definition.isStatement ? "<expression>"
                : definition.isFunction() ? definition.selector() : definition.name
        };
        if (definition.origin.file != null) Reflect.setField(location, "file", definition.origin.file);
        locations.push(location);
        return nextLine;
    }
}
