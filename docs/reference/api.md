# Riferimento API Haxe di Mira

Firme, tipi, enum e campi pubblici estratti automaticamente da src/**/*.hx.
Le descrizioni sono conservate in catalog/api-notes.json; i link al codice sorgente sono generati.
Il riferimento non include i membri privati o una specifica semantica del runtime JavaScript/PHP.

## API esterne

- Browser: `MiraStudioCompiler.compile(source, "js"|"php")`, `tokens(source)` e `ast(source)` restituiscono `{ok, output}` o `{ok:false, message}`.
- CLI: `node dist/mira.cjs <file.mira> <js|php|--tokens> [output]`.
- Benchmark: `node dist/mira.cjs --benchmark <file.mira> <js|php> <iterations>`.

## API pubbliche

<a id="api-mira-benchmark"></a>
### `mira.Benchmark`

**class** · Misure ripetute del frontend Mira in un processo Node già avviato.

```haxe
class Benchmark
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Benchmark.hx#L6)

<a id="api-mira-benchmark-run"></a>
### `mira.Benchmark.run`

**method** · Esegue warm-up e campiona i tempi di traspilazione, restituendo statistiche di latenza.

```haxe
public static function run(source:String, target:Target, iterations:Int):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Benchmark.hx#L8)

<a id="api-mira-compiler"></a>
### `mira.Compiler`

**class** · Facade riutilizzata da CLI e Mira Studio; espone parsing, traspilazione e ispezione lessicale.

```haxe
class Compiler
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L10)

<a id="api-mira-compiler-inspecttokens"></a>
### `mira.Compiler.inspectTokens`

**method** · Restituisce una stringa JSON con token, testi e coordinate sorgente.

```haxe
public static function inspectTokens(source:String):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L32)

<a id="api-mira-compiler-parse"></a>
### `mira.Compiler.parse`

**method** · Genera definizioni con corpi risolti dopo la raccolta delle firme dei selettori.

```haxe
public static function parse(source:String, ?host:HostEnvironment):Array<Definition>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L13)

Feature: [Dichiarazioni successive](language.md#feature-forward)

<a id="api-mira-compiler-transpile"></a>
### `mira.Compiler.transpile`

**method** · Converte il sorgente Mira nel target tipizzato `JavaScript` o `Php`.

```haxe
public static function transpile(source:String, target:Target, ?host:HostEnvironment):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L23)

<a id="api-mira-emit-jsemitter"></a>
### `mira.emit.JsEmitter`

**class** · Emette definizioni e valori JavaScript.

```haxe
class JsEmitter
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/JsEmitter.hx#L7)

<a id="api-mira-emit-jsemitter-emit"></a>
### `mira.emit.JsEmitter.emit`

**method** · Converte tutte le definizioni Mira in un programma JavaScript.

```haxe
public static function emit(definitions:Array<Definition>, symbols:Symbols):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/JsEmitter.hx#L10)

<a id="api-mira-emit-phpemitter"></a>
### `mira.emit.PhpEmitter`

**class** · Emette definizioni, variabili e arrow functions PHP.

```haxe
class PhpEmitter
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/PhpEmitter.hx#L7)

<a id="api-mira-emit-phpemitter-emit"></a>
### `mira.emit.PhpEmitter.emit`

**method** · Converte tutte le definizioni Mira in un programma PHP.

```haxe
public static function emit(definitions:Array<Definition>, symbols:Symbols):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/PhpEmitter.hx#L10)

<a id="api-mira-emit-sourceemitter"></a>
### `mira.emit.SourceEmitter`

**class** · Emette espressioni Mira su un backend tipizzato, incluse closure e pipeline.

```haxe
class SourceEmitter
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/SourceEmitter.hx#L6)

<a id="api-mira-emit-sourceemitter-expression"></a>
### `mira.emit.SourceEmitter.expression`

**method** · Produce un'espressione JS/PHP tenendo conto dello scope e delle collisioni dei nomi.

```haxe
public static function expression(expr:Expr, target:Target, scope:Array<String>, reservedHostNames:Array<String>):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/SourceEmitter.hx#L9)

Feature: [Sezioni con più `_`](language.md#feature-multi-sections), [Cattura lessicale](language.md#feature-captures)

<a id="api-mira-emit-sourceemitter-hostaccess"></a>
### `mira.emit.SourceEmitter.hostAccess`

**method** · Emette espressioni Mira su un backend tipizzato, incluse closure e pipeline.

```haxe
public static function hostAccess(name:String, target:Target):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/SourceEmitter.hx#L87)

<a id="api-mira-hostenvironment"></a>
### `mira.HostEnvironment`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class HostEnvironment
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L6)

Feature: [UI web e interoperabilità](language.md#feature-browser-ui)

<a id="api-mira-hostenvironment-callables"></a>
### `mira.HostEnvironment.callables`

**field** · Membro pubblico di mira.HostEnvironment.

```haxe
public final callables:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L9)

<a id="api-mira-hostenvironment-empty"></a>
### `mira.HostEnvironment.empty`

**method** · Membro pubblico di mira.HostEnvironment.

```haxe
public static function empty():HostEnvironment
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L38)

<a id="api-mira-hostenvironment-fromjson"></a>
### `mira.HostEnvironment.fromJson`

**method** · Membro pubblico di mira.HostEnvironment.

```haxe
public static function fromJson(source:String):HostEnvironment
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L42)

<a id="api-mira-hostenvironment-new"></a>
### `mira.HostEnvironment.new`

**constructor** · Membro pubblico di mira.HostEnvironment.

```haxe
public function new(?values:Array<String>, ?callables:Array<String>, ?selectors:Array<String>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L12)

<a id="api-mira-hostenvironment-selectors"></a>
### `mira.HostEnvironment.selectors`

**field** · Membro pubblico di mira.HostEnvironment.

```haxe
public final selectors:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L10)

<a id="api-mira-hostenvironment-values"></a>
### `mira.HostEnvironment.values`

**field** · Membro pubblico di mira.HostEnvironment.

```haxe
public final values:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L8)

<a id="api-mira-lex-lexer"></a>
### `mira.lex.Lexer`

**class** · Scanner carattere per carattere del sottoinsieme Mira 0.2.

```haxe
class Lexer
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Lexer.hx#L4)

<a id="api-mira-lex-lexer-new"></a>
### `mira.lex.Lexer.new`

**constructor** · Crea uno scanner per la stringa sorgente fornita.

```haxe
public function new(source:String)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Lexer.hx#L12)

<a id="api-mira-lex-lexer-tokenize"></a>
### `mira.lex.Lexer.tokenize`

**method** · Restituisce i token e il token finale, conservando riga e colonna.

```haxe
public function tokenize():Array<Token>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Lexer.hx#L16)

Feature: [Letterali numerici](language.md#feature-numbers), [Letterali testuali](language.md#feature-strings)

<a id="api-mira-lex-token"></a>
### `mira.lex.Token`

**class** · Token lessicale dotato di valore e posizione.

```haxe
class Token
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L9)

<a id="api-mira-lex-token-column"></a>
### `mira.lex.Token.column`

**field** · Token lessicale dotato di valore e posizione.

```haxe
public final column:Int
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L15)

<a id="api-mira-lex-token-issymbol"></a>
### `mira.lex.Token.isSymbol`

**method** · Verifica se il token è un simbolo specifico.

```haxe
public function isSymbol(symbol:String):Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L24)

<a id="api-mira-lex-token-kind"></a>
### `mira.lex.Token.kind`

**field** · Token lessicale dotato di valore e posizione.

```haxe
public final kind:TokenKind
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L12)

<a id="api-mira-lex-token-line"></a>
### `mira.lex.Token.line`

**field** · Token lessicale dotato di valore e posizione.

```haxe
public final line:Int
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L14)

<a id="api-mira-lex-token-new"></a>
### `mira.lex.Token.new`

**constructor** · Costruisce un token lessicale con tipo, testo e coordinate.

```haxe
public function new(kind:TokenKind, value:String, line:Int, column:Int)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L17)

<a id="api-mira-lex-token-tokenkind"></a>
### `mira.lex.Token.TokenKind`

**enum** · Categorie lessicali Word, Number, Text, Symbol ed End.

```haxe
enum TokenKind
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L1)

<a id="api-mira-lex-token-tokenkind-end"></a>
### `mira.lex.Token.TokenKind.End`

**variant** · Categorie lessicali Word, Number, Text, Symbol ed End.

```haxe
End
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L8)

<a id="api-mira-lex-token-tokenkind-number"></a>
### `mira.lex.Token.TokenKind.Number`

**variant** · Categorie lessicali Word, Number, Text, Symbol ed End.

```haxe
Number
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L5)

<a id="api-mira-lex-token-tokenkind-symbol"></a>
### `mira.lex.Token.TokenKind.Symbol`

**variant** · Categorie lessicali Word, Number, Text, Symbol ed End.

```haxe
Symbol
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L7)

<a id="api-mira-lex-token-tokenkind-text"></a>
### `mira.lex.Token.TokenKind.Text`

**variant** · Categorie lessicali Word, Number, Text, Symbol ed End.

```haxe
Text
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L6)

<a id="api-mira-lex-token-tokenkind-word"></a>
### `mira.lex.Token.TokenKind.Word`

**variant** · Categorie lessicali Word, Number, Text, Symbol ed End.

```haxe
Word
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L4)

<a id="api-mira-lex-token-value"></a>
### `mira.lex.Token.value`

**field** · Token lessicale dotato di valore e posizione.

```haxe
public final value:String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L13)

<a id="api-mira-main"></a>
### `mira.Main`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class Main
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Main.hx#L3)

<a id="api-mira-miraerror"></a>
### `mira.MiraError`

**class** · Eccezione diagnostica con posizione del token quando disponibile.

```haxe
class MiraError
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/MiraError.hx#L3)

Feature: [Diagnostica e ambiguità](language.md#feature-diagnostics)

<a id="api-mira-miraerror-new"></a>
### `mira.MiraError.new`

**constructor** · Eccezione diagnostica con posizione del token quando disponibile.

```haxe
public function new(message:String, ?token:Token)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/MiraError.hx#L6)

<a id="api-mira-resolve-mangle"></a>
### `mira.resolve.Mangle`

**class** · Converte nomi Mira in simboli validi per i target.

```haxe
class Mangle
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Mangle.hx#L1)

<a id="api-mira-resolve-mangle-name"></a>
### `mira.resolve.Mangle.name`

**method** · Converte un identificatore multiword in camelCase.

```haxe
public static function name(source:String):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Mangle.hx#L4)

<a id="api-mira-resolve-mangle-selector"></a>
### `mira.resolve.Mangle.selector`

**method** · Codifica una firma keyword in un identificatore di funzione univoco.

```haxe
public static function selector(labels:Array<String>):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Mangle.hx#L15)

<a id="api-mira-resolve-selectorresolver"></a>
### `mira.resolve.SelectorResolver`

**class** · Riconosce keyword e confini degli argomenti senza inferire i tipi.

```haxe
class SelectorResolver
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/SelectorResolver.hx#L20)

<a id="api-mira-resolve-selectorresolver-match"></a>
### `mira.resolve.SelectorResolver.match`

**method** · Restituisce un selettore con segmenti di argomento oppure segnala ambiguità.

```haxe
public function match(tokens:Array<Token>, start:Int):Null<SelectorMatch>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/SelectorResolver.hx#L29)

Feature: [Selettori con più keyword](language.md#feature-selectors), [Chiamate discorsive](language.md#feature-shorthand)

<a id="api-mira-resolve-selectorresolver-new"></a>
### `mira.resolve.SelectorResolver.new`

**constructor** · Prepara il riconoscimento selettori per una tabella dei simboli.

```haxe
public function new(symbols:Symbols)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/SelectorResolver.hx#L25)

<a id="api-mira-resolve-selectorresolver-selectormatch"></a>
### `mira.resolve.SelectorResolver.SelectorMatch`

**class** · Corrispondenza strutturale con selettore, argomenti e indice finale.

```haxe
class SelectorMatch
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/SelectorResolver.hx#L9)

<a id="api-mira-resolve-selectorresolver-selectormatch-arguments"></a>
### `mira.resolve.SelectorResolver.SelectorMatch.arguments`

**field** · Corrispondenza strutturale con selettore, argomenti e indice finale.

```haxe
public final arguments:Array<Array<Token>>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/SelectorResolver.hx#L12)

<a id="api-mira-resolve-selectorresolver-selectormatch-end"></a>
### `mira.resolve.SelectorResolver.SelectorMatch.end`

**field** · Corrispondenza strutturale con selettore, argomenti e indice finale.

```haxe
public final end:Int
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/SelectorResolver.hx#L13)

<a id="api-mira-resolve-selectorresolver-selectormatch-new"></a>
### `mira.resolve.SelectorResolver.SelectorMatch.new`

**constructor** · Corrispondenza strutturale con selettore, argomenti e indice finale.

```haxe
public function new(selector:String, arguments:Array<Array<Token>>, end:Int)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/SelectorResolver.hx#L15)

<a id="api-mira-resolve-selectorresolver-selectormatch-selector"></a>
### `mira.resolve.SelectorResolver.SelectorMatch.selector`

**field** · Corrispondenza strutturale con selettore, argomenti e indice finale.

```haxe
public final selector:String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/SelectorResolver.hx#L11)

<a id="api-mira-resolve-symbols"></a>
### `mira.resolve.Symbols`

**class** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
class Symbols
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L7)

<a id="api-mira-resolve-symbols-environment"></a>
### `mira.resolve.Symbols.environment`

**field** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public final environment:HostEnvironment
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L13)

<a id="api-mira-resolve-symbols-functions"></a>
### `mira.resolve.Symbols.functions`

**field** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public final functions:Array<Definition>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L10)

<a id="api-mira-resolve-symbols-globals"></a>
### `mira.resolve.Symbols.globals`

**field** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public final globals:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L11)

<a id="api-mira-resolve-symbols-hostnames"></a>
### `mira.resolve.Symbols.hostNames`

**field** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public final hostNames:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L12)

<a id="api-mira-resolve-symbols-ishostname"></a>
### `mira.resolve.Symbols.isHostName`

**method** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public function isHostName(name:String):Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L84)

<a id="api-mira-resolve-symbols-ishostselector"></a>
### `mira.resolve.Symbols.isHostSelector`

**method** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public function isHostSelector(selector:String):Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L89)

<a id="api-mira-resolve-symbols-matcheswords"></a>
### `mira.resolve.Symbols.matchesWords`

**method** · Confronta una sequenza di token con le parole di un nome Mira.

```haxe
public static function matchesWords(tokens:Array<Token>, start:Int, name:String):Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L110)

<a id="api-mira-resolve-symbols-matchingfunctions"></a>
### `mira.resolve.Symbols.matchingFunctions`

**method** · Filtra le firme il cui primo segmento coincide con il prefisso di token.

```haxe
public function matchingFunctions(tokens:Array<Token>, start:Int):Array<Definition>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L93)

<a id="api-mira-resolve-symbols-new"></a>
### `mira.resolve.Symbols.new`

**constructor** · Raccoglie le firme e rileva collisioni e parametri ripetuti.

```haxe
public function new(definitions:Array<Definition>, ?environment:HostEnvironment)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L15)

<a id="api-mira-resolve-symbols-resolvename"></a>
### `mira.resolve.Symbols.resolveName`

**method** · Riconosce il nome più lungo compatibile con lo scope disponibile.

```haxe
public function resolveName(tokens:Array<Token>, start:Int, locals:Array<String>):Null<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L101)

Feature: [Identificatori composti](language.md#feature-names)

<a id="api-mira-studio-bridge"></a>
### `mira.studio.Bridge`

**class** · Interfaccia JavaScript esposta dal compilatore Haxe nel browser.

```haxe
class Bridge
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L8)

<a id="api-mira-studio-bridge-ast"></a>
### `mira.studio.Bridge.ast`

**method** · API browser: restituisce JSON con AST canonico del programma.

```haxe
public static function ast(source:String, ?hostJson:String):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L38)

<a id="api-mira-studio-bridge-compile"></a>
### `mira.studio.Bridge.compile`

**method** · API browser: `{ok,output}` o `{ok:false,message}` per `js` e `php`.

```haxe
public static function compile(source:String, targetName:String, ?hostJson:String):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L21)

<a id="api-mira-studio-bridge-main"></a>
### `mira.studio.Bridge.main`

**method** · Installa `MiraStudioCompiler` sul global scope del browser.

```haxe
public static function main():Void
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L11)

<a id="api-mira-studio-bridge-tokens"></a>
### `mira.studio.Bridge.tokens`

**method** · API browser: restituisce i token JSON e le posizioni.

```haxe
public static function tokens(source:String):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L34)

<a id="api-mira-syntax-definition"></a>
### `mira.syntax.Definition`

**class** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
class Definition
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L3)

<a id="api-mira-syntax-definition-body"></a>
### `mira.syntax.Definition.body`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public var body:Null<Expr>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L12)

<a id="api-mira-syntax-definition-bodytokens"></a>
### `mira.syntax.Definition.bodyTokens`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final bodyTokens:Array<Token>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L9)

<a id="api-mira-syntax-definition-isfunction"></a>
### `mira.syntax.Definition.isFunction`

**method** · Distingue una funzione keyword da un valore ordinario.

```haxe
public function isFunction():Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L30)

<a id="api-mira-syntax-definition-isstatement"></a>
### `mira.syntax.Definition.isStatement`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final isStatement:Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L11)

<a id="api-mira-syntax-definition-labels"></a>
### `mira.syntax.Definition.labels`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final labels:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L7)

<a id="api-mira-syntax-definition-name"></a>
### `mira.syntax.Definition.name`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final name:String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L6)

<a id="api-mira-syntax-definition-new"></a>
### `mira.syntax.Definition.new`

**constructor** · Costruisce una definizione con header e token del corpo.

```haxe
public function new(name:String, labels:Array<String>, parameters:Array<String>, bodyTokens:Array<Token>, origin:Token, isStatement:Bool = false)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L14)

<a id="api-mira-syntax-definition-origin"></a>
### `mira.syntax.Definition.origin`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final origin:Token
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L10)

<a id="api-mira-syntax-definition-parameters"></a>
### `mira.syntax.Definition.parameters`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final parameters:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L8)

<a id="api-mira-syntax-definition-selector"></a>
### `mira.syntax.Definition.selector`

**method** · Restituisce la firma canonica con due punti, per esempio `add:and:`.

```haxe
public function selector():String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L34)

<a id="api-mira-syntax-definitionparser"></a>
### `mira.syntax.DefinitionParser`

**class** · Analizza le dichiarazioni e i loro terminatori.

```haxe
class DefinitionParser
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/DefinitionParser.hx#L5)

<a id="api-mira-syntax-definitionparser-parse"></a>
### `mira.syntax.DefinitionParser.parse`

**method** · Raccoglie definizioni complete e rifiuta terminatori o parentesi mancanti.

```haxe
public static function parse(tokens:Array<Token>):Array<Definition>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/DefinitionParser.hx#L8)

Feature: [Definizioni di valori](language.md#feature-values), [Funzioni con parametri](language.md#feature-functions)

<a id="api-mira-syntax-expr"></a>
### `mira.syntax.Expr`

**enum** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
enum Expr
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L3)

Feature: [Sezioni unarie](language.md#feature-sections), [Pipeline `~`](language.md#feature-pipelines)

<a id="api-mira-syntax-expr-apply"></a>
### `mira.syntax.Expr.Apply`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Apply(callee:Expr, argument:Expr)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L17)

<a id="api-mira-syntax-expr-binary"></a>
### `mira.syntax.Expr.Binary`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Binary(symbol:String, left:Expr, right:Expr)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L11)

<a id="api-mira-syntax-expr-call"></a>
### `mira.syntax.Expr.Call`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Call(selector:String, arguments:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L12)

<a id="api-mira-syntax-expr-hostcall"></a>
### `mira.syntax.Expr.HostCall`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
HostCall(selector:String, arguments:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L13)

<a id="api-mira-syntax-expr-hostref"></a>
### `mira.syntax.Expr.HostRef`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
HostRef(name:String)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L6)

<a id="api-mira-syntax-expr-hostsection"></a>
### `mira.syntax.Expr.HostSection`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
HostSection(selector:String, arguments:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L16)

<a id="api-mira-syntax-expr-name"></a>
### `mira.syntax.Expr.Name`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Name(value:String)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L5)

<a id="api-mira-syntax-expr-numeric"></a>
### `mira.syntax.Expr.Numeric`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Numeric(value:String)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L7)

<a id="api-mira-syntax-expr-placeholder"></a>
### `mira.syntax.Expr.Placeholder`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Placeholder
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L14)

<a id="api-mira-syntax-expr-record"></a>
### `mira.syntax.Expr.Record`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Record(keys:Array<String>, values:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L10)

Feature: [Record e dati strutturati](language.md#feature-records)

<a id="api-mira-syntax-expr-section"></a>
### `mira.syntax.Expr.Section`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Section(selector:String, arguments:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L15)

<a id="api-mira-syntax-expr-sequence"></a>
### `mira.syntax.Expr.Sequence`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Sequence(items:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L9)

Feature: [Sequenze e trasformazioni](language.md#feature-sequences)

<a id="api-mira-syntax-expr-text"></a>
### `mira.syntax.Expr.Text`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Text(value:String)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L8)

<a id="api-mira-syntax-expressionparser"></a>
### `mira.syntax.ExpressionParser`

**class** · Analizza espressioni e risolve selettori tramite Symbols.

```haxe
class ExpressionParser
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionParser.hx#L7)

<a id="api-mira-syntax-expressionparser-new"></a>
### `mira.syntax.ExpressionParser.new`

**constructor** · Crea il parser per i token di un'espressione e uno scope di parametri.

```haxe
public function new(tokens:Array<Token>, symbols:Symbols, localNames:Array<String>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionParser.hx#L16)

<a id="api-mira-syntax-expressionparser-parse"></a>
### `mira.syntax.ExpressionParser.parse`

**method** · Restituisce l'espressione canonica dopo aver consumato tutti i token.

```haxe
public function parse():Expr
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionParser.hx#L25)

Feature: [Operatori aritmetici](language.md#feature-arithmetic), [Parentesi](language.md#feature-grouping)

<a id="api-mira-target"></a>
### `mira.Target`

**enum** · Enum chiuso dei backend di emissione; input testuale confinato alle API esterne.

```haxe
enum Target
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Target.hx#L3)

<a id="api-mira-target-javascript"></a>
### `mira.Target.JavaScript`

**variant** · Backend JavaScript.

```haxe
JavaScript
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Target.hx#L5)

<a id="api-mira-target-php"></a>
### `mira.Target.Php`

**variant** · Backend PHP.

```haxe
Php
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Target.hx#L6)

