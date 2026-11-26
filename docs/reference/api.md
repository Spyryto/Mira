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

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L11)

<a id="api-mira-compiler-check"></a>
### `mira.Compiler.check`

**method** · Facade riutilizzata da CLI e Mira Studio; espone parsing, traspilazione e ispezione lessicale.

```haxe
public static function check(source:String, ?host:HostEnvironment, ?readModule:String->Null<String>, ?entry:String):Array<Dynamic>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L53)

<a id="api-mira-compiler-inspecttokens"></a>
### `mira.Compiler.inspectTokens`

**method** · Restituisce una stringa JSON con token, testi e coordinate sorgente.

```haxe
public static function inspectTokens(source:String):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L66)

<a id="api-mira-compiler-parse"></a>
### `mira.Compiler.parse`

**method** · Genera definizioni con corpi risolti dopo la raccolta delle firme dei selettori.

```haxe
public static function parse(source:String, ?host:HostEnvironment, ?readModule:String->Null<String>, ?entry:String, ?origins:ExpressionOrigins):Array<Definition>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L14)

Feature: [Dichiarazioni successive](language.md#feature-forward)

<a id="api-mira-compiler-specialize"></a>
### `mira.Compiler.specialize`

**method** · Facade riutilizzata da CLI e Mira Studio; espone parsing, traspilazione e ispezione lessicale.

```haxe
public static function specialize(source:String,name:String,args:Array<mira.types.Type>,?host:HostEnvironment, ?readModule:String->Null<String>,?entry:String):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L59)

<a id="api-mira-compiler-transpile"></a>
### `mira.Compiler.transpile`

**method** · Converte il sorgente Mira nel target tipizzato `JavaScript` o `Php`.

```haxe
public static function transpile(source:String, target:Target, ?host:HostEnvironment, ?locations:Array<GeneratedLocation>, ?readModule:String->Null<String>, ?entry:String):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L27)

<a id="api-mira-compiler-transpilechecked"></a>
### `mira.Compiler.transpileChecked`

**method** · Facade riutilizzata da CLI e Mira Studio; espone parsing, traspilazione e ispezione lessicale.

```haxe
public static function transpileChecked(source:String,target:Target,?host:HostEnvironment, ?locations:Array<GeneratedLocation>,?readModule:String->Null<String>,?entry:String):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Compiler.hx#L39)

<a id="api-mira-emit-jsemitter"></a>
### `mira.emit.JsEmitter`

**class** · Emette definizioni e valori JavaScript.

```haxe
class JsEmitter
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/JsEmitter.hx#L8)

<a id="api-mira-emit-jsemitter-emit"></a>
### `mira.emit.JsEmitter.emit`

**method** · Converte tutte le definizioni Mira in un programma JavaScript.

```haxe
public static function emit(definitions:Array<Definition>, symbols:Symbols, ?locations:Array<GeneratedLocation>, ?guards:haxe.ds.ObjectMap<Dynamic,mira.types.NumericGuard>):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/JsEmitter.hx#L11)

<a id="api-mira-emit-phpemitter"></a>
### `mira.emit.PhpEmitter`

**class** · Emette definizioni, variabili e arrow functions PHP.

```haxe
class PhpEmitter
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/PhpEmitter.hx#L8)

<a id="api-mira-emit-phpemitter-emit"></a>
### `mira.emit.PhpEmitter.emit`

**method** · Converte tutte le definizioni Mira in un programma PHP.

```haxe
public static function emit(definitions:Array<Definition>, symbols:Symbols, ?locations:Array<GeneratedLocation>, ?guards:haxe.ds.ObjectMap<Dynamic,mira.types.NumericGuard>):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/PhpEmitter.hx#L11)

<a id="api-mira-emit-sourceemitter"></a>
### `mira.emit.SourceEmitter`

**class** · Emette espressioni Mira su un backend tipizzato, incluse closure e pipeline.

```haxe
class SourceEmitter
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/SourceEmitter.hx#L9)

<a id="api-mira-emit-sourceemitter-expression"></a>
### `mira.emit.SourceEmitter.expression`

**method** · Produce un'espressione JS/PHP tenendo conto dello scope e delle collisioni dei nomi.

```haxe
public static function expression(expr:Expr, target:Target, scope:Array<String>, reservedHostNames:Array<String>, ?guards:ObjectMap<Dynamic,NumericGuard>):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/SourceEmitter.hx#L12)

Feature: [Sezioni con più `_`](language.md#feature-multi-sections), [Cattura lessicale](language.md#feature-captures)

<a id="api-mira-emit-sourceemitter-hostaccess"></a>
### `mira.emit.SourceEmitter.hostAccess`

**method** · Emette espressioni Mira su un backend tipizzato, incluse closure e pipeline.

```haxe
public static function hostAccess(name:String, target:Target):String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/SourceEmitter.hx#L319)

<a id="api-mira-emit-sourcelocations"></a>
### `mira.emit.SourceLocations`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class SourceLocations
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/SourceLocations.hx#L13)

<a id="api-mira-emit-sourcelocations-append"></a>
### `mira.emit.SourceLocations.append`

**method** · Membro pubblico di mira.emit.SourceLocations.

```haxe
public static function append(locations:Array<GeneratedLocation>, definition:Definition, lines:Array<String>, first:Int, generatedLine:Int):Int
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/emit/SourceLocations.hx#L16)

<a id="api-mira-hostenvironment"></a>
### `mira.HostEnvironment`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class HostEnvironment
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L8)

Feature: [UI web e interoperabilità](language.md#feature-browser-ui), [Filtri con predicati Mira](language.md#feature-filtering), [Libreria GUI Mira e binding](language.md#feature-gui-library), [DOM incrementale e stato indipendente](language.md#feature-incremental-gui), [Stili GUI componibili e griglia](language.md#feature-styled-gui), [Identità stabile delle liste GUI](language.md#feature-gui-keyed)

<a id="api-mira-hostenvironment-callables"></a>
### `mira.HostEnvironment.callables`

**field** · Membro pubblico di mira.HostEnvironment.

```haxe
public final callables:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L11)

<a id="api-mira-hostenvironment-empty"></a>
### `mira.HostEnvironment.empty`

**method** · Membro pubblico di mira.HostEnvironment.

```haxe
public static function empty():HostEnvironment
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L43)

<a id="api-mira-hostenvironment-fromjson"></a>
### `mira.HostEnvironment.fromJson`

**method** · Membro pubblico di mira.HostEnvironment.

```haxe
public static function fromJson(source:String):HostEnvironment
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L47)

<a id="api-mira-hostenvironment-new"></a>
### `mira.HostEnvironment.new`

**constructor** · Membro pubblico di mira.HostEnvironment.

```haxe
public function new(?values:Array<String>, ?callables:Array<String>, ?selectors:Array<String>, ?typeManifest:Dynamic)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L15)

<a id="api-mira-hostenvironment-selectors"></a>
### `mira.HostEnvironment.selectors`

**field** · Membro pubblico di mira.HostEnvironment.

```haxe
public final selectors:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L12)

<a id="api-mira-hostenvironment-types"></a>
### `mira.HostEnvironment.types`

**field** · Membro pubblico di mira.HostEnvironment.

```haxe
public final types:Map<String,Type>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L13)

<a id="api-mira-hostenvironment-values"></a>
### `mira.HostEnvironment.values`

**field** · Membro pubblico di mira.HostEnvironment.

```haxe
public final values:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/HostEnvironment.hx#L10)

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
public function new(source:String, ?file:String)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Lexer.hx#L13)

<a id="api-mira-lex-lexer-tokenize"></a>
### `mira.lex.Lexer.tokenize`

**method** · Restituisce i token e il token finale, conservando riga e colonna.

```haxe
public function tokenize():Array<Token>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Lexer.hx#L18)

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

<a id="api-mira-lex-token-endcolumn"></a>
### `mira.lex.Token.endColumn`

**field** · Token lessicale dotato di valore e posizione.

```haxe
public final endColumn:Int
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L18)

<a id="api-mira-lex-token-endline"></a>
### `mira.lex.Token.endLine`

**field** · Token lessicale dotato di valore e posizione.

```haxe
public final endLine:Int
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L17)

<a id="api-mira-lex-token-file"></a>
### `mira.lex.Token.file`

**field** · Token lessicale dotato di valore e posizione.

```haxe
public final file:Null<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L16)

<a id="api-mira-lex-token-issymbol"></a>
### `mira.lex.Token.isSymbol`

**method** · Verifica se il token è un simbolo specifico.

```haxe
public function isSymbol(symbol:String):Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L30)

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
public function new(kind:TokenKind, value:String, line:Int, column:Int, ?file:String, ?endLine:Int, ?endColumn:Int)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/lex/Token.hx#L20)

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

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Main.hx#L4)

<a id="api-mira-miraerror"></a>
### `mira.MiraError`

**class** · Eccezione diagnostica con posizione del token quando disponibile.

```haxe
class MiraError
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/MiraError.hx#L3)

Feature: [Diagnostica e ambiguità](language.md#feature-diagnostics)

<a id="api-mira-miraerror-diagnostic"></a>
### `mira.MiraError.diagnostic`

**field** · Eccezione diagnostica con posizione del token quando disponibile.

```haxe
public final diagnostic:Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/MiraError.hx#L6)

<a id="api-mira-miraerror-new"></a>
### `mira.MiraError.new`

**constructor** · Eccezione diagnostica con posizione del token quando disponibile.

```haxe
public function new(message:String, ?token:Token, code:String = "source_error")
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/MiraError.hx#L8)

<a id="api-mira-modules"></a>
### `mira.Modules`

**class** · Caricamento statico e ordinamento delle dipendenze tramite un resolver fornito dall'host; mantiene le coordinate dei file.

```haxe
class Modules
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Modules.hx#L10)

<a id="api-mira-modules-collect"></a>
### `mira.Modules.collect`

**method** · Raccoglie dichiarazioni da import transitivi, una sola volta per percorso, prima del parsing delle espressioni.

```haxe
public static function collect(source:String, ?read:String->Null<String>, ?entry:String, ?types:Map<String,mira.types.Type>):Array<Definition>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/Modules.hx#L12)

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

Feature: [Selettori con più keyword](language.md#feature-selectors), [Chiamate discorsive](language.md#feature-shorthand), [Blocchi diretti negli argomenti dei selettori](language.md#feature-bare-block-arguments)

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

Feature: [Aggiornamento immutabile dei record](language.md#feature-record-update), [Operazioni native sulle sequenze](language.md#feature-native-sequences)

<a id="api-mira-resolve-symbols-collectionselectors"></a>
### `mira.resolve.Symbols.collectionSelectors`

**method** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public static function collectionSelectors():Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L14)

<a id="api-mira-resolve-symbols-environment"></a>
### `mira.resolve.Symbols.environment`

**field** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public final environment:HostEnvironment
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L25)

<a id="api-mira-resolve-symbols-functions"></a>
### `mira.resolve.Symbols.functions`

**field** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public final functions:Array<Definition>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L22)

<a id="api-mira-resolve-symbols-globals"></a>
### `mira.resolve.Symbols.globals`

**field** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public final globals:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L23)

<a id="api-mira-resolve-symbols-hostnames"></a>
### `mira.resolve.Symbols.hostNames`

**field** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public final hostNames:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L24)

<a id="api-mira-resolve-symbols-ishostname"></a>
### `mira.resolve.Symbols.isHostName`

**method** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public function isHostName(name:String):Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L137)

<a id="api-mira-resolve-symbols-ishostselector"></a>
### `mira.resolve.Symbols.isHostSelector`

**method** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public function isHostSelector(selector:String):Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L142)

<a id="api-mira-resolve-symbols-matcheswords"></a>
### `mira.resolve.Symbols.matchesWords`

**method** · Confronta una sequenza di token con le parole di un nome Mira.

```haxe
public static function matchesWords(tokens:Array<Token>, start:Int, name:String):Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L163)

<a id="api-mira-resolve-symbols-matchingfunctions"></a>
### `mira.resolve.Symbols.matchingFunctions`

**method** · Filtra le firme il cui primo segmento coincide con il prefisso di token.

```haxe
public function matchingFunctions(tokens:Array<Token>, start:Int):Array<Definition>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L146)

<a id="api-mira-resolve-symbols-nativeselectors"></a>
### `mira.resolve.Symbols.nativeSelectors`

**method** · Indice delle definizioni, firme dei selettori e simboli generati.

```haxe
public static function nativeSelectors():Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L19)

<a id="api-mira-resolve-symbols-new"></a>
### `mira.resolve.Symbols.new`

**constructor** · Raccoglie le firme e rileva collisioni e parametri ripetuti.

```haxe
public function new(definitions:Array<Definition>, ?environment:HostEnvironment)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L27)

<a id="api-mira-resolve-symbols-resolvename"></a>
### `mira.resolve.Symbols.resolveName`

**method** · Riconosce il nome più lungo compatibile con lo scope disponibile.

```haxe
public function resolveName(tokens:Array<Token>, start:Int, locals:Array<String>):Null<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/resolve/Symbols.hx#L154)

Feature: [Identificatori composti](language.md#feature-names)

<a id="api-mira-studio-bridge"></a>
### `mira.studio.Bridge`

**class** · Interfaccia JavaScript esposta dal compilatore Haxe nel browser.

```haxe
class Bridge
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L10)

<a id="api-mira-studio-bridge-ast"></a>
### `mira.studio.Bridge.ast`

**method** · API browser: restituisce JSON con AST canonico del programma.

```haxe
public static function ast(source:String, ?hostJson:String, ?modulesJson:String):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L85)

<a id="api-mira-studio-bridge-check"></a>
### `mira.studio.Bridge.check`

**method** · Interfaccia JavaScript esposta dal compilatore Haxe nel browser.

```haxe
public static function check(source:String, ?hostJson:String, ?modulesJson:String):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L63)

<a id="api-mira-studio-bridge-compile"></a>
### `mira.studio.Bridge.compile`

**method** · API browser: `{ok,output}` o `{ok:false,message}` per `js` e `php`.

```haxe
public static function compile(source:String, targetName:String, ?hostJson:String, ?withLocations:Bool = false, ?modulesJson:String, ?checked:Bool = false):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L45)

<a id="api-mira-studio-bridge-main"></a>
### `mira.studio.Bridge.main`

**method** · Installa `MiraStudioCompiler` sul global scope del browser.

```haxe
public static function main():Void
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L13)

<a id="api-mira-studio-bridge-specialize"></a>
### `mira.studio.Bridge.specialize`

**method** · Interfaccia JavaScript esposta dal compilatore Haxe nel browser.

```haxe
public static function specialize(source:String,name:String,argsJson:String,?hostJson:String,?modulesJson:String):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L70)

<a id="api-mira-studio-bridge-tokens"></a>
### `mira.studio.Bridge.tokens`

**method** · API browser: restituisce i token JSON e le posizioni.

```haxe
public static function tokens(source:String):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L81)

<a id="api-mira-studio-bridge-trace"></a>
### `mira.studio.Bridge.trace`

**method** · Interfaccia JavaScript esposta dal compilatore Haxe nel browser.

```haxe
public static function trace(source:String, ?hostJson:String, ?modulesJson:String):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/studio/Bridge.hx#L117)

<a id="api-mira-syntax-definition"></a>
### `mira.syntax.Definition`

**class** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
class Definition
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L4)

<a id="api-mira-syntax-definition-body"></a>
### `mira.syntax.Definition.body`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public var body:Null<Expr>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L17)

<a id="api-mira-syntax-definition-bodytokens"></a>
### `mira.syntax.Definition.bodyTokens`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final bodyTokens:Array<Token>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L10)

<a id="api-mira-syntax-definition-isfunction"></a>
### `mira.syntax.Definition.isFunction`

**method** · Distingue una funzione keyword da un valore ordinario.

```haxe
public function isFunction():Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L37)

<a id="api-mira-syntax-definition-isstatement"></a>
### `mira.syntax.Definition.isStatement`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final isStatement:Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L13)

<a id="api-mira-syntax-definition-labels"></a>
### `mira.syntax.Definition.labels`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final labels:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L8)

<a id="api-mira-syntax-definition-name"></a>
### `mira.syntax.Definition.name`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final name:String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L7)

<a id="api-mira-syntax-definition-new"></a>
### `mira.syntax.Definition.new`

**constructor** · Costruisce una definizione con header e token del corpo.

```haxe
public function new(name:String, labels:Array<String>, parameters:Array<String>, bodyTokens:Array<Token>, origin:Token, isStatement:Bool = false, ?parameterOrigins:Array<Token>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L19)

<a id="api-mira-syntax-definition-origin"></a>
### `mira.syntax.Definition.origin`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final origin:Token
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L11)

<a id="api-mira-syntax-definition-parameterannotations"></a>
### `mira.syntax.Definition.parameterAnnotations`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public var parameterAnnotations:Array<Null<Type>>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L14)

<a id="api-mira-syntax-definition-parameterorigins"></a>
### `mira.syntax.Definition.parameterOrigins`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final parameterOrigins:Array<Token>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L12)

<a id="api-mira-syntax-definition-parameters"></a>
### `mira.syntax.Definition.parameters`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public final parameters:Array<String>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L9)

<a id="api-mira-syntax-definition-resultannotation"></a>
### `mira.syntax.Definition.resultAnnotation`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public var resultAnnotation:Null<Type>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L15)

<a id="api-mira-syntax-definition-resultannotationorigin"></a>
### `mira.syntax.Definition.resultAnnotationOrigin`

**field** · Definizione Mira, valore o funzione keyword, con testo del corpo e origine.

```haxe
public var resultAnnotationOrigin:Null<Token>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L16)

<a id="api-mira-syntax-definition-selector"></a>
### `mira.syntax.Definition.selector`

**method** · Restituisce la firma canonica con due punti, per esempio `add:and:`.

```haxe
public function selector():String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Definition.hx#L41)

<a id="api-mira-syntax-definitionparser"></a>
### `mira.syntax.DefinitionParser`

**class** · Analizza le dichiarazioni e i loro terminatori.

```haxe
class DefinitionParser
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/DefinitionParser.hx#L6)

<a id="api-mira-syntax-definitionparser-annotatedname"></a>
### `mira.syntax.DefinitionParser.annotatedName`

**method** · Analizza le dichiarazioni e i loro terminatori.

```haxe
public static function annotatedName(tokens:Array<Token>,?names:Map<String,Type>):{name:String,type:Null<Type>,typeOrigin:Null<Token>} { final opening = topLevel(tokens,"("); if (opening < 0) return {name:readWords(tokens),type:null,typeOrigin:null}; if (opening == 0) throw new MiraError("Expected name before type annotation",tokens[0]); final name = readWords(tokens.slice(0,opening)); if (!tokens[tokens.length-1].isSymbol(")")) throw new MiraError("Expected closing ) after type annotation",tokens[opening]); final origin = opening + 1 < tokens.length - 1 ? tokens[opening+1] : tokens[opening]; final type = new TypeParser(tokens.slice(opening+1,tokens.length-1),origin,names).parse(); return {name:name,type:type,typeOrigin:origin}; } static function splitHeader(tokens:Array<Token>):Array<Array<Token>>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/DefinitionParser.hx#L169)

<a id="api-mira-syntax-definitionparser-parse"></a>
### `mira.syntax.DefinitionParser.parse`

**method** · Raccoglie definizioni complete e rifiuta terminatori o parentesi mancanti.

```haxe
public static function parse(tokens:Array<Token>, ?names:Map<String,Type>):Array<Definition>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/DefinitionParser.hx#L9)

Feature: [Definizioni di valori](language.md#feature-values), [Funzioni con parametri](language.md#feature-functions)

<a id="api-mira-syntax-expr"></a>
### `mira.syntax.Expr`

**enum** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
enum Expr
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L3)

Feature: [Sezioni unarie](language.md#feature-sections), [Pipeline `>>`](language.md#feature-pipelines)

<a id="api-mira-syntax-expr-apply"></a>
### `mira.syntax.Expr.Apply`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Apply(callee:Expr, argument:Null<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L30)

<a id="api-mira-syntax-expr-binary"></a>
### `mira.syntax.Expr.Binary`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Binary(symbol:String, left:Expr, right:Expr)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L22)

<a id="api-mira-syntax-expr-block"></a>
### `mira.syntax.Expr.Block`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Block(parameters:Array<String>, body:Expr)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L19)

Feature: [Blocchi funzione con parametro](language.md#feature-blocks), [Blocchi con più parametri](language.md#feature-block-parameters), [Blocchi senza parametri](language.md#feature-nullary-blocks)

<a id="api-mira-syntax-expr-booleanliteral"></a>
### `mira.syntax.Expr.BooleanLiteral`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
BooleanLiteral(value:Bool)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L9)

Feature: [Booleani e confronti](language.md#feature-comparisons)

<a id="api-mira-syntax-expr-call"></a>
### `mira.syntax.Expr.Call`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Call(selector:String, arguments:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L24)

<a id="api-mira-syntax-expr-conditional"></a>
### `mira.syntax.Expr.Conditional`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Conditional(condition:Expr, whenTrue:Expr, whenFalse:Expr)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L13)

Feature: [Espressioni condizionali](language.md#feature-conditionals)

<a id="api-mira-syntax-expr-fieldaccessor"></a>
### `mira.syntax.Expr.FieldAccessor`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
FieldAccessor(key:String)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L10)

Feature: [Accessor funzionali di record](language.md#feature-accessors)

<a id="api-mira-syntax-expr-fieldget"></a>
### `mira.syntax.Expr.FieldGet`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
FieldGet(record:Expr, key:String)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L11)

Feature: [Accesso diretto ai campi `~`](language.md#feature-field-get)

<a id="api-mira-syntax-expr-fieldsection"></a>
### `mira.syntax.Expr.FieldSection`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
FieldSection(key:String)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L12)

<a id="api-mira-syntax-expr-hostcall"></a>
### `mira.syntax.Expr.HostCall`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
HostCall(selector:String, arguments:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L25)

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

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L28)

<a id="api-mira-syntax-expr-local"></a>
### `mira.syntax.Expr.Local`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Local(name:String, value:Expr)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L21)

Feature: [Valori locali immutabili nei blocchi](language.md#feature-local-values)

<a id="api-mira-syntax-expr-match"></a>
### `mira.syntax.Expr.Match`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Match(value:Expr, tags:Array<String>, handlers:Array<Expr>)
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

<a id="api-mira-syntax-expr-operatorsection"></a>
### `mira.syntax.Expr.OperatorSection`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
OperatorSection(symbol:String, left:Expr, right:Expr)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L23)

<a id="api-mira-syntax-expr-placeholder"></a>
### `mira.syntax.Expr.Placeholder`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Placeholder
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L26)

<a id="api-mira-syntax-expr-record"></a>
### `mira.syntax.Expr.Record`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Record(keys:Array<String>, values:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L18)

Feature: [Record e dati strutturati](language.md#feature-records)

<a id="api-mira-syntax-expr-section"></a>
### `mira.syntax.Expr.Section`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Section(selector:String, arguments:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L27)

<a id="api-mira-syntax-expr-sequence"></a>
### `mira.syntax.Expr.Sequence`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Sequence(items:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L17)

Feature: [Sequenze e trasformazioni](language.md#feature-sequences)

<a id="api-mira-syntax-expr-steps"></a>
### `mira.syntax.Expr.Steps`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Steps(expressions:Array<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L20)

Feature: [Blocchi con espressioni in sequenza](language.md#feature-block-steps)

<a id="api-mira-syntax-expr-text"></a>
### `mira.syntax.Expr.Text`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Text(value:String)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L8)

<a id="api-mira-syntax-expr-validate"></a>
### `mira.syntax.Expr.Validate`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Validate(value:Expr, required:mira.types.Type, success:Expr, failure:Expr)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L14)

<a id="api-mira-syntax-expr-variant"></a>
### `mira.syntax.Expr.Variant`

**variant** · AST canonico, indipendente dalla grafia superficiale dei selettori.

```haxe
Variant(sum:mira.types.Type, tag:String, payload:Null<Expr>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/Expr.hx#L15)

<a id="api-mira-syntax-expressionorigins"></a>
### `mira.syntax.ExpressionOrigins`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class ExpressionOrigins
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionOrigins.hx#L8)

<a id="api-mira-syntax-expressionorigins-annotations"></a>
### `mira.syntax.ExpressionOrigins.annotations`

**method** · Membro pubblico di mira.syntax.ExpressionOrigins.

```haxe
public function annotations(expr:Expr):Null<Array<Null<Type>>> return bindingTypes.get(expr); public function inherit(rewritten:Expr, original:Expr):Expr
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionOrigins.hx#L30)

<a id="api-mira-syntax-expressionorigins-get"></a>
### `mira.syntax.ExpressionOrigins.get`

**method** · Membro pubblico di mira.syntax.ExpressionOrigins.

```haxe
public function get(expr:Expr):Null<Token> return anchors.get(expr); public function annotate(expr:Expr, types:Array<Null<Type>>):Expr
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionOrigins.hx#L23)

<a id="api-mira-syntax-expressionorigins-new"></a>
### `mira.syntax.ExpressionOrigins.new`

**constructor** · Membro pubblico di mira.syntax.ExpressionOrigins.

```haxe
public function new()
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionOrigins.hx#L13)

<a id="api-mira-syntax-expressionorigins-remember"></a>
### `mira.syntax.ExpressionOrigins.remember`

**method** · Membro pubblico di mira.syntax.ExpressionOrigins.

```haxe
public function remember(expr:Expr, token:Token):Expr
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionOrigins.hx#L15)

<a id="api-mira-syntax-expressionparser"></a>
### `mira.syntax.ExpressionParser`

**class** · Analizza espressioni e risolve selettori tramite Symbols.

```haxe
class ExpressionParser
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionParser.hx#L9)

<a id="api-mira-syntax-expressionparser-new"></a>
### `mira.syntax.ExpressionParser.new`

**constructor** · Crea il parser per i token di un'espressione e uno scope di parametri.

```haxe
public function new(tokens:Array<Token>, symbols:Symbols, localNames:Array<String>, ?allowOperatorArgument:Bool = false, ?pendingLocals:Array<String>, ?origins:ExpressionOrigins, ?types:Map<String,Type>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionParser.hx#L25)

<a id="api-mira-syntax-expressionparser-parse"></a>
### `mira.syntax.ExpressionParser.parse`

**method** · Restituisce l'espressione canonica dopo aver consumato tutti i token.

```haxe
public function parse():Expr
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/ExpressionParser.hx#L43)

Feature: [Operatori aritmetici](language.md#feature-arithmetic), [Parentesi](language.md#feature-grouping), [Sezioni di operatori](language.md#feature-operator-sections), [Accesso `~` prima dell'aritmetica](language.md#feature-field-precedence)

<a id="api-mira-syntax-typeparser"></a>
### `mira.syntax.TypeParser`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class TypeParser
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/TypeParser.hx#L9)

<a id="api-mira-syntax-typeparser-new"></a>
### `mira.syntax.TypeParser.new`

**constructor** · Membro pubblico di mira.syntax.TypeParser.

```haxe
public function new(tokens:Array<Token>, fallback:Token, ?names:Map<String,Type>, ?allowProjection:Bool = true)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/TypeParser.hx#L17)

<a id="api-mira-syntax-typeparser-parse"></a>
### `mira.syntax.TypeParser.parse`

**method** · Membro pubblico di mira.syntax.TypeParser.

```haxe
public function parse():Type
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/syntax/TypeParser.hx#L39)

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

<a id="api-mira-types-dependencies"></a>
### `mira.types.Dependencies`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class Dependencies
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Dependencies.hx#L7)

<a id="api-mira-types-dependencies-new"></a>
### `mira.types.Dependencies.new`

**constructor** · Membro pubblico di mira.types.Dependencies.

```haxe
public function new(program:Array<Definition>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Dependencies.hx#L17)

<a id="api-mira-types-dependencies-ordered"></a>
### `mira.types.Dependencies.ordered`

**method** · Membro pubblico di mira.types.Dependencies.

```haxe
public function ordered():Array<Array<String>> return groups; public function recursive(group:Array<String>):Bool return group.length > 1 || edges.get(group[0]).indexOf(group[0]) >= 0; function visit(name:String):Void
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Dependencies.hx#L35)

<a id="api-mira-types-hosttypecodec"></a>
### `mira.types.HostTypeCodec`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class HostTypeCodec
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/HostTypeCodec.hx#L6)

<a id="api-mira-types-hosttypecodec-decode"></a>
### `mira.types.HostTypeCodec.decode`

**method** · Membro pubblico di mira.types.HostTypeCodec.

```haxe
public static function decode(value:Dynamic,path:String,depth:Int = 0):Type
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/HostTypeCodec.hx#L12)

<a id="api-mira-types-hosttypecodec-read"></a>
### `mira.types.HostTypeCodec.read`

**method** · Membro pubblico di mira.types.HostTypeCodec.

```haxe
public static function read(input:Dynamic,values:Array<String>,callables:Array<String>,selectors:Array<String>):Map<String,Type>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/HostTypeCodec.hx#L46)

<a id="api-mira-types-numericguard"></a>
### `mira.types.NumericGuard`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class NumericGuard
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericGuard.hx#L4)

<a id="api-mira-types-numericguard-integer"></a>
### `mira.types.NumericGuard.integer`

**field** · Membro pubblico di mira.types.NumericGuard.

```haxe
public var integer:Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericGuard.hx#L6)

<a id="api-mira-types-numericguard-new"></a>
### `mira.types.NumericGuard.new`

**constructor** · Membro pubblico di mira.types.NumericGuard.

```haxe
public function new()
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericGuard.hx#L8)

<a id="api-mira-types-numericguard-range"></a>
### `mira.types.NumericGuard.range`

**field** · Membro pubblico di mira.types.NumericGuard.

```haxe
public var range:Null<NumericRange>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericGuard.hx#L7)

<a id="api-mira-types-numericguard-requirerange"></a>
### `mira.types.NumericGuard.requireRange`

**method** · Membro pubblico di mira.types.NumericGuard.

```haxe
public function requireRange(value:NumericRange):Void
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericGuard.hx#L9)

<a id="api-mira-types-numericproof"></a>
### `mira.types.NumericProof`

**enum** · Tipo dichiarato nel compilatore Haxe.

```haxe
enum NumericProof
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericProof.hx#L3)

<a id="api-mira-types-numericproof-proven"></a>
### `mira.types.NumericProof.Proven`

**variant** · Membro pubblico di mira.types.NumericProof.

```haxe
Proven
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericProof.hx#L5)

<a id="api-mira-types-numericproof-unknown"></a>
### `mira.types.NumericProof.Unknown`

**variant** · Membro pubblico di mira.types.NumericProof.

```haxe
Unknown
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericProof.hx#L7)

<a id="api-mira-types-numericproof-violated"></a>
### `mira.types.NumericProof.Violated`

**variant** · Membro pubblico di mira.types.NumericProof.

```haxe
Violated
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericProof.hx#L6)

<a id="api-mira-types-numericrange"></a>
### `mira.types.NumericRange`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class NumericRange
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L4)

<a id="api-mira-types-numericrange-any"></a>
### `mira.types.NumericRange.any`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public static function any():NumericRange return new NumericRange(Math.NEGATIVE_INFINITY,Math.POSITIVE_INFINITY,false,false); public static function integers():NumericRange return new NumericRange(-9007199254740991.0,9007199254740991.0,true,true); public function integerHull():NumericRange
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L18)

<a id="api-mira-types-numericrange-arithmetic"></a>
### `mira.types.NumericRange.arithmetic`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public static function arithmetic(op:String,a:NumericRange,b:NumericRange):Null<NumericRange>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L111)

<a id="api-mira-types-numericrange-arithmeticbounds"></a>
### `mira.types.NumericRange.arithmeticBounds`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public static function arithmeticBounds(op:String,a:NumericRange,b:NumericRange):Null<NumericRange>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L87)

<a id="api-mira-types-numericrange-comparison"></a>
### `mira.types.NumericRange.comparison`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public static function comparison(op:String,value:Float):NumericRange
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L35)

<a id="api-mira-types-numericrange-empty"></a>
### `mira.types.NumericRange.empty`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public function empty():Bool return low > high || (low == high && !(lowClosed && highClosed)); public function contains(n:Float):Bool return Math.isFinite(n) && (n > low || (lowClosed && n == low)) && (n < high || (highClosed && n == high)); public function implies(other:NumericRange):Bool return (low > other.low || (low == other.low && (!lowClosed || other.lowClosed))) && (high < other.high || (high == other.high && (!highClosed || other.highClosed))); public function proof(required:NumericRange):NumericProof
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L52)

<a id="api-mira-types-numericrange-equal"></a>
### `mira.types.NumericRange.equal`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public function equal(other:NumericRange):Bool return implies(other) && other.implies(this); public static function ofType(type:Type):Null<NumericRange>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L116)

<a id="api-mira-types-numericrange-high"></a>
### `mira.types.NumericRange.high`

**field** · Membro pubblico di mira.types.NumericRange.

```haxe
public final high:Float
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L7)

<a id="api-mira-types-numericrange-highclosed"></a>
### `mira.types.NumericRange.highClosed`

**field** · Membro pubblico di mira.types.NumericRange.

```haxe
public final highClosed:Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L9)

<a id="api-mira-types-numericrange-integertype"></a>
### `mira.types.NumericRange.integerType`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public static function integerType(type:Type):Bool return switch (type)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L29)

<a id="api-mira-types-numericrange-intersect"></a>
### `mira.types.NumericRange.intersect`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public function intersect(other:NumericRange):NumericRange
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L46)

<a id="api-mira-types-numericrange-literal"></a>
### `mira.types.NumericRange.literal`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public static function literal(text:String):Null<NumericRange>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L82)

<a id="api-mira-types-numericrange-low"></a>
### `mira.types.NumericRange.low`

**field** · Membro pubblico di mira.types.NumericRange.

```haxe
public final low:Float
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L6)

<a id="api-mira-types-numericrange-lowclosed"></a>
### `mira.types.NumericRange.lowClosed`

**field** · Membro pubblico di mira.types.NumericRange.

```haxe
public final lowClosed:Bool
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L8)

<a id="api-mira-types-numericrange-new"></a>
### `mira.types.NumericRange.new`

**constructor** · Membro pubblico di mira.types.NumericRange.

```haxe
public function new(low:Float,high:Float,lowClosed:Bool,highClosed:Bool)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L11)

<a id="api-mira-types-numericrange-portable"></a>
### `mira.types.NumericRange.portable`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public function portable():Bool return Math.isFinite(low) && Math.isFinite(high) && Math.abs(low) <= 9007199254740991.0 && Math.abs(high) <= 9007199254740991.0; // Wide observations are for diagnostics only. They must not feed // further arithmetic proofs after leaving the portable domain. public static function literalBounds(text:String):Null<NumericRange>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L70)

<a id="api-mira-types-numericrange-predicate"></a>
### `mira.types.NumericRange.predicate`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public function predicate():String
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L130)

<a id="api-mira-types-numericrange-schema"></a>
### `mira.types.NumericRange.schema`

**method** · Membro pubblico di mira.types.NumericRange.

```haxe
public function schema():Dynamic return
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/NumericRange.hx#L137)

<a id="api-mira-types-type"></a>
### `mira.types.Type`

**enum** · Tipo dichiarato nel compilatore Haxe.

```haxe
enum Type
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L3)

<a id="api-mira-types-type-booleantype"></a>
### `mira.types.Type.BooleanType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
BooleanType
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L13)

<a id="api-mira-types-type-functiontype"></a>
### `mira.types.Type.FunctionType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
FunctionType(parameters:Array<Type>, result:Type)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L16)

<a id="api-mira-types-type-integertype"></a>
### `mira.types.Type.IntegerType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
IntegerType
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L11)

<a id="api-mira-types-type-listtype"></a>
### `mira.types.Type.ListType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
ListType(item:Type)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L15)

<a id="api-mira-types-type-namedtype"></a>
### `mira.types.Type.NamedType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
NamedType(name:String,base:Type)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L5)

<a id="api-mira-types-type-numbertype"></a>
### `mira.types.Type.NumberType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
NumberType
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L10)

<a id="api-mira-types-type-recordtype"></a>
### `mira.types.Type.RecordType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
RecordType(fields:Map<String, Type>, tail:Null<Type>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L17)

<a id="api-mira-types-type-refinedtype"></a>
### `mira.types.Type.RefinedType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
RefinedType(base:Type,range:NumericRange)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L7)

<a id="api-mira-types-type-structuraltype"></a>
### `mira.types.Type.StructuralType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
StructuralType(name:String,fields:Map<String,Type>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L9)

<a id="api-mira-types-type-sumtype"></a>
### `mira.types.Type.SumType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
SumType(name:String,alternatives:Map<String,Null<Type>>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L6)

<a id="api-mira-types-type-texttype"></a>
### `mira.types.Type.TextType`

**variant** · Membro pubblico di mira.types.Type.

```haxe
TextType
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L12)

<a id="api-mira-types-type-variable"></a>
### `mira.types.Type.Variable`

**variant** · Membro pubblico di mira.types.Type.

```haxe
Variable(id:Int)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/Type.hx#L14)

<a id="api-mira-types-typechecker"></a>
### `mira.types.TypeChecker`

**class** · Tipo dichiarato nel compilatore Haxe.

```haxe
class TypeChecker
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/TypeChecker.hx#L16)

<a id="api-mira-types-typechecker-check"></a>
### `mira.types.TypeChecker.check`

**method** · Membro pubblico di mira.types.TypeChecker.

```haxe
public function check(program:Array<Definition>):Array<Dynamic>
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/TypeChecker.hx#L49)

<a id="api-mira-types-typechecker-new"></a>
### `mira.types.TypeChecker.new`

**constructor** · Membro pubblico di mira.types.TypeChecker.

```haxe
public function new(origins:ExpressionOrigins,host:HostEnvironment,?guards:haxe.ds.ObjectMap<Dynamic,NumericGuard>)
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/TypeChecker.hx#L36)

<a id="api-mira-types-typechecker-specialize"></a>
### `mira.types.TypeChecker.specialize`

**method** · Membro pubblico di mira.types.TypeChecker.

```haxe
public function specialize(program:Array<Definition>,name:String,args:Array<Type>):Dynamic
```

[Sorgente Haxe](https://github.com/Spyryto/Mira/blob/main/src/mira/types/TypeChecker.hx#L63)

