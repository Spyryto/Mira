package mira;

import mira.lex.Token;

class MiraError extends haxe.Exception {
    public final diagnostic:Dynamic;

    public function new(message:String, ?token:Token, code:String = "source_error") {
        if (token != null) {
            super(message + " at " + (token.file == null ? "" : token.file + ":") + token.line + ":" + token.column);
        } else {
            super(message);
        }
        diagnostic = {code:code, message:message, file:token == null ? null : token.file,
            line:token == null ? null : token.line, column:token == null ? null : token.column,
            endLine:token == null ? null : token.endLine, endColumn:token == null ? null : token.endColumn};
    }
}
