package mira.lex;

enum TokenKind {
    Word;
    Number;
    Text;
    Symbol;
    End;
}

class Token {
    public final kind:TokenKind;
    public final value:String;
    public final line:Int;
    public final column:Int;
    public final file:Null<String>;

    public function new(kind:TokenKind, value:String, line:Int, column:Int, ?file:String) {
        this.kind = kind;
        this.value = value;
        this.line = line;
        this.column = column;
        this.file = file;
    }

    public function isSymbol(symbol:String):Bool {
        return kind == Symbol && value == symbol;
    }
}
