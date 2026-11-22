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
        return names.join("__");
    }
}
