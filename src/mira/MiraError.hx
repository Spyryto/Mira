package mira;

import mira.lex.Token;

class MiraError extends haxe.Exception {
    public function new(message:String, ?token:Token) {
        if (token != null) {
            super(message + " at " + token.line + ":" + token.column);
        } else {
            super(message);
        }
    }
}
