package mira.resolve;

class Mangle {
    // Portable spellings are shared by both emitters and Studio. Protect the
    // native identifiers used by generated code, JS binding restrictions and
    // common PHP native functions without changing ordinary exported spellings.
    static final jsProtected = ("await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield eval arguments "
        + "Array Object Error EvalError RangeError ReferenceError SyntaxError TypeError URIError AggregateError JSON Math Number String Boolean Symbol BigInt Function Date RegExp Map Set WeakMap WeakSet Promise Proxy Reflect ArrayBuffer DataView globalThis undefined NaN Infinity console").split(" ");
    static final phpVariables = "this GLOBALS _SERVER _GET _POST _FILES _COOKIE _SESSION _REQUEST _ENV".split(" ");
    static final phpSelectors = ("__halt_compiler abstract and array as break callable case catch class clone const continue declare default die do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum eval exit extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield true false null "
        + "array_key_exists array_keys array_replace array_is_list array_reduce array_map array_values array_filter is_array is_string is_bool is_int is_float is_finite preg_match floor count sizeof strlen trim ltrim rtrim time date log abs min max round ceil rand mt_rand json_encode json_decode print_r var_dump sprintf printf implode explode substr strpos strtolower strtoupper sort rsort usort in_array array_merge array_push array_pop range gettype intval floatval strval boolval function_exists class_exists").split(" ");

    static function protect(generated:String, selector:Bool):String {
        // Keep the existing host sentinel diagnostic and the 0.59 spelling
        // for match; both are part of the existing interop convention.
        if (generated == "__miraHost") return generated;
        final lower = generated.toLowerCase();
        if (selector && lower == "match") return "__miraSelector_" + generated;
        // Escape source names already in the compiler-owned prefix too:
        // Error and __miraEsc_Error must not acquire the same spelling.
        if (StringTools.startsWith(lower,"__mira")
            || jsProtected.indexOf(generated) >= 0
            || (!selector && phpVariables.indexOf(generated) >= 0)
            || (selector && phpSelectors.indexOf(lower) >= 0))
            return "__miraEsc_" + generated;
        return generated;
    }

    public static function name(source:String):String {
        if (ModuleIdentity.isQualified(source)) return ModuleIdentity.mangle(source,"v");
        final words = source.split(" ");
        var result = words[0];

        for (i in 1...words.length) {
            final word = words[i];
            result += word.substr(0, 1).toUpperCase() + word.substr(1);
        }
        return protect(result,false);
    }

    public static function selector(labels:Array<String>):String {
        if (ModuleIdentity.isQualified(labels[0])) return ModuleIdentity.mangle(labels.join(":"),"s");
        final names:Array<String> = [];
        for (label in labels) names.push(label.split(" ").join("_"));
        return protect(names.join("__"),true);
    }
}
