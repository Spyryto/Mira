package mira.grammar;

import mira.MiraError;

class GrammarMachine {
    public final rows:Array<Array<Int>>;
    public final accepting:Array<Bool>;
    public final nfaStates:Int;

    public function new(rows:Array<Array<Int>>,accepting:Array<Bool>,nfaStates:Int) {
        this.rows = rows;
        this.accepting = accepting;
        this.nfaStates = nfaStates;
    }

    public function trace(input:String):Dynamic {
        if (input.length > 4096) throw new MiraError("Grammar Lab input limit (4096)");
        final path = [0];
        var state = 0;
        for (i in 0...input.length) {
            final code:Int = input.charCodeAt(i);
            state = code < 128 ? rows[state][code] : -1;
            path.push(state);
            if (state < 0) break;
        }
        return {accepted:state >= 0 && accepting[state],path:path,nfaStates:nfaStates,dfaStates:rows.length};
    }

    // Tables are numeric/boolean JSON, valid array literals on both targets.
    // No runtime parser, regex engine, shared runtime library or backtracking.
    public function emit(target:String):String {
        final table = haxe.Json.stringify(rows);
        final accept = haxe.Json.stringify(accepting);
        return switch (target) {
            case "js":
                "const miraGrammarMatches = (() => {\n"
                + "  const transitions = " + table + ";\n"
                + "  const accepting = " + accept + ";\n"
                + "  return function(input) {\n"
                + "  if (typeof input !== 'string') return false;\n"
                + "  let state = 0;\n"
                + "  for (let i = 0; i < input.length; i++) {\n"
                + "    const code = input.charCodeAt(i);\n"
                + "    if (code >= 128 || (state = transitions[state][code]) < 0) return false;\n"
                + "  }\n  return accepting[state];\n  };\n})();\n";
            case "php":
                "<?php\nfunction miraGrammarMatches($input) {\n"
                + "  if (!is_string($input)) return false;\n"
                + "  static $transitions = " + table + ";\n"
                + "  static $accepting = " + accept + ";\n"
                + "  $state = 0;\n"
                + "  $length = strlen($input);\n"
                + "  for ($i = 0; $i < $length; $i++) {\n"
                + "    $code = ord($input[$i]);\n"
                + "    if ($code >= 128 || ($state = $transitions[$state][$code]) < 0) return false;\n"
                + "  }\n  return $accepting[$state];\n}\n";
            default: throw new MiraError("Unknown grammar target " + target);
        };
    }
}
