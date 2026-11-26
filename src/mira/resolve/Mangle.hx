package mira.resolve;

class Mangle {
    public static function name(source:String):String {
        final words = source.split(" ");
        var result = words[0];

        for (i in 1...words.length) {
            final word = words[i];
            result += word.substr(0, 1).toUpperCase() + word.substr(1);
        }
        return result;
    }

    public static function selector(labels:Array<String>):String {
        final names:Array<String> = [];
        for (label in labels) names.push(label.split(" ").join("_"));
        final generated = names.join("__");
        // PHP 8 reserves match (case-insensitively). Keep source selectors
        // legal and use the same deterministic spelling on both targets.
        return generated.toLowerCase() == "match" ? "__miraSelector_" + generated : generated;
    }
}
