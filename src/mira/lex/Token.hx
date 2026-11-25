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
    public final endLine:Int;
    public final endColumn:Int;

    public function new(kind:TokenKind, value:String, line:Int, column:Int, ?file:String, ?endLine:Int, ?endColumn:Int) {
        this.kind = kind;
        this.value = value;
        this.line = line;
        this.column = column;
        this.file = file;
        this.endLine = endLine == null ? line : endLine;
        this.endColumn = endColumn == null ? column + value.length : endColumn;
    }

    public function isSymbol(symbol:String):Bool {
        return kind == Symbol && value == symbol;
    }
}
