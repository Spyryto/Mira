# Tipi semantici, enumerazioni e rappresentazione nativa

Stato: analisi architetturale basata su Mira 0.95 integrata e sulla candidata 0.96 (PR #138). Non introduce sintassi, modifica semantica o promesse di prestazioni. La CI del commit candidato 92e6252 è fallita; non considerare la 0.96 integrata.

## Il problema reale

Separare tre livelli: (1) identità e invarianti del tipo sorgente, (2) costruzione e pattern matching, (3) rappresentazione emessa e ABI. Il principio compile-time first non implica l'eliminazione di ogni discriminante: occorre conservare l'informazione necessaria per distinguere alternative dinamiche. Evitare solo rappresentazioni e lavoro superflui.

Fonti interne: [algebra dei tipi](../src/mira/types/Type.hx), [firme GUI](../src/mira/types/GuiTypes.hx), [emissione](../src/mira/emit/SourceEmitter.hx), [renderer](../studio/ui-host.js), [contratti dichiarativi](declarative-contracts.md), [questioni aperte](open-questions.md).

## Capacità e limiti accertati

- Tipi nominali e opachi, tipi parametrici, somme nominali (anche ricorsive regolari), match esaustivo, record e inferenza di righe, refinement numerici: esistono, con i limiti descritti in TYPE-01–10.
- Le liste sono omogenee. I descrittori GUI hanno record diversi; View(State) interno è un tipo fantasma opaco con firme fidate nel compilatore. La libreria corrente non offre una dichiarazione Mira capace di descrivere in modo opaco tutte queste rappresentazioni eterogenee senza aggiungere un nuovo involucro. Non manca la nominalità, manca il modo di realizzarla su quel tipo di rappresentazione.
- La proiezione strutturale richiede campi e ne ammette altri; non esprime un record chiuso di soli campi ammessi, ciascuno facoltativo. Le liste di strati con forme diverse ricevono quindi un controllo contestuale locale (0.93–0.95).
- Le somme sono nominali e tagged. Non esiste un mapping configurabile dei costruttori a scalari o a record già discriminati; non esistono unioni native non tagged. Il checker non può riconoscere due alternative dalla rappresentazione nativa senza una regola di discriminazione.
- I refinement sono numerici a intervalli. Mancano membership testuali, predicati relazionali e vincoli sulle liste/record trasportabili nelle firme. Le regole GUI attuali non garantiscono a priori tutti i valori dinamici.
- La 0.96 candidata estrae le regole di stile in dati Mira, ma non aggiunge tipi enumerativi scalari né un sistema utente di associazione dei contratti. I tag Range, Choices, Either ecc. appartengono ai dati consumati dal compilatore, non agli stili applicativi.

## Le enumerazioni non sono assenti in senso semantico

Sintassi attuale (esempio):

```mira
Alignment :: Start | Center | End | Stretch | Baseline;
alignment (Alignment) = Center;
```

È una somma con costruttori nullari: insieme finito chiuso, identità nominale, match esaustivo. Non abbiamo evidenza di un tentativo di implementazione di una enum scalare fallito; la scelta precedente è stata preservare l'ABI esistente. Non serve necessariamente un secondo costrutto enum.

SourceEmitter emette ogni Variant come record: senza payload {tag: "Center"}, con payload {tag: "Fixed", value: 240}. Questo è uno schema portabile e corretto per le somme generali, ma non coincide con il formato corrente degli stili. Non implica che ogni utilizzo allochi un nuovo oggetto: costanti possono essere condivise; non disponiamo di benchmark specifici per affermare il costo.

## Perché fill e auto sono stringhe

Il renderer accetta width/minWidth/maxWidth come numero finito 0..4096 (px), oppure "fill" o "auto". "fill" è un token della libreria, convertito in "100%"; "auto" viene passato come valore CSS. L'API non è un modello universale del layout. Un record {tag:"Fill"} non è accettato dal renderer attuale. Analogamente align accetta il testo "center", non {tag:"Center"}.

Le stringhe sono un formato ABI ereditato, non necessariamente la migliore API sorgente. Choices(["fill","auto"]) nella 0.96 rappresenta il dominio di quell'ABI, non una nuova enum applicativa. La scelta ha evitato migrazione del renderer e specializzatore durante l'aggiunta dei controlli. Non è una necessità teorica: si possono usare ADT oggi e un adattatore esplicito che traduce al confine, oppure adottare un'ABI nativa tipizzata.

## Tre opzioni e relativi trade-off

A. ADT tagged già disponibili + conversione al confine. Valido ora, con un match che traduce i casi a dati nativi. Per Size con alternativa numerica e testuale, una funzione Mira che restituisca direttamente entrambe le rappresentazioni non è tipizzabile con il sistema attuale; può invece scegliere fra chiamate che restituiscono lo stesso tipo o passare da un adapter host dichiarato. Evitare di nascondere questa difficoltà con Dynamic. Nessuna promessa di eliminazione dell'adapter.

B. Somme con codifica scalare dichiarata: casi nullari associati biunivocamente a stringhe o interi. Esempio concettuale: Center -> "center", Start -> "start". Stessa identità nominale e match esaustivo; output scalare. La sintassi di associazione non è ancora decisa. Rifiutare collisioni entro lo stesso tipo; tipi nominali fratelli restano distinti anche se il valore emesso coincide. Validare input esterno prima di attribuire il tipo.

C. Somme a rappresentazione nativa disgiunta: Size = Fixed(Pixels) | Fill | Auto, con Fixed -> numero, Fill -> "fill", Auto -> "auto". Il match dinamico distingue numero e stringhe specifiche; il match noto staticamente può essere semplificato. Non aggiungere wrapper quando l'informazione è già presente. Due casi con payload numerico sovrapposto (ad esempio Width(Number) | Height(Number)) non possono condividere la stessa codifica senza perdere identità; richiedono discriminante o rifiuto della codifica. JS/PHP devono concordare su numeri, stringhe e confronto stretto. Per view già discriminate da type, valutare successivamente riuso del discriminante del record, non supporre che sia supportato.

## Riferimenti comparativi (documentazione ufficiale)

- Dart: [enums](https://dart.dev/language/enums) come insieme chiuso di istanze costanti, anche con campi; [extension types](https://dart.dev/language/extension-types) come astrazione statica su una rappresentazione esistente, non validazione automatica; [sealed classes](https://dart.dev/language/class-modifiers) per gerarchie chiuse e match esaustivo. Flutter usa [MainAxisAlignment](https://api.flutter.dev/flutter/rendering/MainAxisAlignment.html) e [BoxConstraints](https://api.flutter.dev/flutter/rendering/BoxConstraints-class.html): tipi e vincoli di layout, non una riproduzione del CSS. Prendere esempio dalla sicurezza dell'API, non replicare la gerarchia di classi.
- F#: [discriminated unions](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/discriminated-unions) per domini chiusi e payload; [enumerations](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/enumerations) per codifica integrale .NET (valori fuori dall'elenco possono essere costruiti via conversione); [units of measure](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/units-of-measure) per annotazioni cancellate a runtime, non vincoli di intervallo. Le struct DU hanno compromessi di memoria/copia; non equivalgono a erasure. Distinguere la semantica del dominio dalla strategia di storage.
- Elm: [custom types](https://guide.elm-lang.org/types/custom_types) e [The Elm Architecture](https://guide.elm-lang.org/architecture/): modellare stati e messaggi tramite somme e API tipizzate, con traduzione esplicita ai confini. Html Msg indica il messaggio prodotto, mentre View(State) Mira attuale indicizza lo stato delle transizioni: analogia, non equivalenza. Non serve un sistema di classi o enum separato per modellare il dominio. Non assumere identità di rappresentazione generata con JS.
- ReScript: [variants](https://rescript-lang.org/docs/manual/variant/) con costruttori nullari scalari, mapping @as, e @unboxed per payload distinguibili nativamente. È il riferimento più diretto per conservare le somme nominali evitando wrapper non necessari su JS. Reason è sintassi dell'ecosistema OCaml; la codifica del ReScript moderno non è automaticamente una proprietà di ogni compilatore Reason/OCaml. Mira deve definire anche la semantica PHP e non importare indiscriminatamente le annotazioni di ReScript.

## Ordine proposto, non decisione definitiva

1. Consolidare la 0.96 senza confondere dati del contratto e tipi applicativi.
2. Studiare una prima codifica scalare per le somme nullarie già esistenti, evitando una nuova categoria enum se non serve. Prototipo e discussione della sintassi prima di fissarla. Test costruttori, identità nominale, match, collezioni, confini e JS/PHP emessi.
3. Estendere solo a somme miste con codifica disgiunta dimostrabile (Size). Mantenere le somme tagged per default e compatibilità con Option/Result esistenti. Misurare dimensione, allocazioni, esecuzione e compilazione rispetto ai valori nativi.
4. In parallelo, progettare record con campi facoltativi, contratti e refinement testuali, con distinzione tra violato, provato e non dimostrato. Non è obbligatorio unificare tutto in una sola feature.
5. Migrare gradualmente API GUI e firme View, tenendo il renderer compatibile o dichiarando esplicitamente la migrazione. Verificare Studio, renderer generico e specializzato, CLI JS/PHP. Rimuovere i casi speciali Haxe solo quando sostituiti da meccanismi generici equivalenti.

Non sono state scelte una sintassi definitiva, una codifica globale per tutti i tipi o una politica di eliminazione indiscriminata dei tag. Non c'è ancora una misura di costo runtime per confrontare le alternative.


## Scalar variants 0.97

Stato: candidata. Sintassi sperimentale, da consolidare dopo test e feedback.

```mira
Alignment :: Start = "start" | Center = "center" | End = "end";

Direction :: North = 0 | East = 1 | South = 2 | West = 3;

label: x (Alignment) -> Text =
  match: x {
    start: {| "Sinistra"},
    center: {| "Centro"},
    end: {| "Destra"}
  };

result = {alignment: Center, label: (label: Center)};
```

La dichiarazione rimane una somma nominale, con costruttori nullari. Le codifiche sono letterali Text o interi esatti portabili (da -9007199254740991 a 9007199254740991); sono ammessi valori testuali e interi nella stessa somma. Ogni alternativa deve avere una codifica esplicita, unica nell'ambito del tipo. Stringa "0" e intero 0 sono distinti. -0 è normalizzato a 0; gli zeri iniziali e le codifiche decimali non sono ammessi per evitare differenze di interpretazione dei literal JS/PHP. Costruttori con payload e tipi parametrici non sono ammessi in questa prima forma. La forma con una sola alternativa richiede il separatore iniziale |, come le somme esistenti.

L'identità nominale resta invariata: Center non è Text, e una stringa "center" non è un valore Alignment. Due somme distinte possono usare la stessa rappresentazione senza diventare compatibili. Match resta esaustivo, con gli stessi handler nullari; la comparazione delle codifiche è stretta su entrambi i backend. Non si introduce una conversione implicita verso Text/Integer e non si amplia ancora ScalarEq. Le somme ordinarie (in particolare Option, Result e quelle con payload) mantengono la rappresentazione tagged.

### Implementazione

Il parser conserva SumType, Variant e le firme dei costruttori già esistenti. La codifica è un fatto di rappresentazione sul costruttore sintetizzato. Il checker raccoglie i mapping per identità nominale e, per ogni espressione Match, registra le codifiche dei casi nell'ordine degli handler. Gli emitter emettono il letterale del costruttore e confrontano direttamente il valore nativo quando il checker ha risolto il match. Non c'è una tabella di conversione runtime, un tag aggiuntivo o un nuovo tipo nell'algebra di inferenza. Il meccanismo del match (closure e selezione dei rami) rimane quello esistente. L'ispettore AST di Studio espone scalarEncoding e il Laboratorio tipi offre un esempio compilabile in modalità checked.

### Confini intenzionali

La prima implementazione richiede compilazione checked e dichiarazioni non parametriche in sorgenti senza modulo nominale. Non si può emettere correttamente un match scalare senza conoscere il tipo della scrutinee. Le dichiarazioni modulari sono rinviate: il mapping dovrà essere parte del contratto ABI pubblico e della verifica di compatibilità dei provider, non solo una proprietà di un costruttore locale. Nessuna migrazione della GUI in questo incremento. Non si promette che il codice match non allochi closure; la sola rappresentazione del valore non richiede un involucro. Non sono ancora disponibili misure comparative delle prestazioni.

Test previsti: esecuzione effettiva JS/PHP e Studio, rifiuto di codici duplicati, collisione -0/0, interi fuori limite, payload e tipi incompatibili, match non esaustivi e handler errati, e preservazione delle somme ordinarie. I prossimi passi sono supporto delle codifiche nelle interfacce dei moduli e somme miste con payload nativi disgiunti, evitando di estendere prematuramente la sintassi.


## Modular scalar variants 0.97.1

Stato: candidata. La restrizione ai sorgenti piatti della 0.97 viene rimossa. La rappresentazione è definita una volta nel tipo, anche in un'interfaccia indipendente:

```mira
module Services / Layout;
interface
Alignment :: Start = "start" | Center = "center" | End = "end";
preferred: :: (Text) -> Alignment;
```

Il provider eredita le definizioni dei costruttori, con identità nominale del contratto quando selezionato tramite binding:

```mira
module Providers / A;
implements Services / Layout;
implementation
preferred: x = if (x == "wide") then Center else Start;
```

Non occorre ripetere le codifiche; ridefinire il tipo pubblico è rifiutato dal controllo di dichiarazioni duplicate già presente. Il report delle interfacce include la proprietà representation con kind Scalar e cases ordinate per nome del caso, contenenti tag e valore nativo. Il fingerprint distingue modifiche delle codifiche ma non il riordino delle alternative. L'identità nominale, gli alias e le riesportazioni riusano il resolver esistente. Per un tipo opaco la rappresentazione privata non entra nello schema pubblico. Il collegamento è a programma intero, non un nuovo meccanismo di linking binario separato.

Il checker continua a raccogliere le codifiche dai costruttori sintetizzati e a risolvere i match prima dell'emissione; nessun nuovo emitter, runtime o tipo. Le firme host che non esprimono ancora queste somme e la validazione al confine esterno restano aperte. Il Laboratory di Studio offre un esempio di import e alias; i test di CLI esercitano contratti senza provider, sostituzione dei provider, fingerprint, opacità e JS/PHP con tree shaking. In questo incremento non sono introdotte alternative con payload nativi, codifiche parametriche o conversioni implicite.


## Native variants 0.98

Stato: candidata. La sintassi sperimentale estende la codifica esplicita delle scalar variants: = _ conserva direttamente il payload.

```mira
Pixels :: Number where _ >= 0 AND _ <= 4096;
Size :: Fixed (Pixels) = _ | Fill = "fill" | Auto = "auto";
n (Pixels) = 240;
sizes = [(Fixed: n), Fill, Auto];
resolve: s (Size) -> Number = match: s {
  fixed: {p | p + 0},
  fill: {| 100},
  auto: {| 0}
};
```

La lista è nominalmente [Size] ma contiene, in entrambi i backend, 240, "fill", "auto". Il costruttore Fixed restituisce direttamente il proprio argomento; il match usa un test sul dominio nativo e consegna lo stesso valore al callback. Il payload conserva il tipo dichiarato, inclusi refinement; non viene introdotta una conversione implicita dal valore nativo al tipo somma.

### Prova di disgiunzione

Il parser separa tre domini primitivi: numero (Number e Integer, inclusi tipi nominali e refinement numerici), testo (Text), booleano (Boolean). È consentito al massimo un payload non incapsulato per dominio. I letterali nullari sono quelli della 0.97: Text e interi sicuri; devono essere distinti e non possono appartenere a un dominio già occupato da un payload. Non sono ammessi = _ su un costruttore nullario, codifiche parziali o payload con codifica costante. Le somme senza codifiche esplicite mantengono il formato tagged.

Il controllo è volutamente conservativo: non usa intervalli disgiunti per distinguere due payload numerici, né record con discriminanti, liste, somme annidate, tipi opachi non ispezionabili o parametri generici. Number e Integer si sovrappongono e non possono essere usati come due domini distinti. Non si introduce un solver generale.

### Implementazione e interoperabilità

Il costruttore sintetizzato mantiene il corpo Variant e la firma nominale, con scalarValue come espressione di rappresentazione. NativeCase distingue un literal da un dominio di payload nella mappa compile-time usata dal match. Le condizioni emesse sono typeof su JS e is_int/is_float, is_string, is_bool su PHP, oltre ai confronti stretti per i literal. Il valore è valutato una volta dal match già esistente; il ramo payload riceve il valore originale. Nessun nuovo involucro o tabella runtime; restano chiamate dei costruttori e closure del match, non si promette assenza di ogni costo di esecuzione.

Le interfacce pubbliche mantengono kind Scalar per sole codifiche letterali e kind Native per somme con payload nativo; i casi ordinati espongono value o domain. Riutilizzo dei moduli e dei fingerprint esistenti. Le rappresentazioni opache rimangono private. Il lettore di dati costanti conserva la stessa rappresentazione emessa per i costruttori nativi. Richiede checked compilation; l'ABI rimane whole-program. Non si attribuisce un tipo nominale a valori arbitrari provenienti da host esterni. Validazione esterna e ScalarEq, migrazione GUI, proof di disgiunzione entro lo stesso dominio e somme a record restano aperte.

Mira Studio: pulsante Varianti native nel Laboratorio tipi, ispezione della rappresentazione nel report checked, compilazione JS/PHP. I test includono esecuzione nativa, frazioni, integer/text/boolean, nominalità, match esaustivi, collisioni, alias di modulo, fingerprint, tree shaking e valutazione dei dati costanti. Nessuna misura prestazionale comparativa è ancora disponibile.


## Optional record fields 0.99

Stato: candidata. Un campo facoltativo può essere assente dal record; non è un valore nullable, un Option implicito, un valore predefinito o un wrapper.

```mira
Style :: {name: Text, padding?: Number, color?: Text};
original (Style) = {name: "base"};
changed = update: original, with: {padding: 12};
styles = [original, changed];
title: s (Style) = s ~ name;
```

La sintassi field?: Type appartiene soltanto alle annotazioni di tipo, non ai literal. I nomi ammessi sono chiusi. I campi richiesti devono essere sicuramente presenti; quelli opzionali eventualmente presenti devono rispettare il tipo dichiarato. I nomi sconosciuti sono rifiutati. La costruzione nominale e l'identità dei tipi restano quelle precedenti. I record strutturali anonimi con campi opzionali sono utilizzabili come annotazioni di parametri e risultati; l'assegnazione a questo schema è direzionale. Un record con campo forse presente non è prova della sua presenza obbligatoria. Non si introduce sottotipizzazione generale delle righe: gli schema con campi opzionali devono essere chiusi, i campi condivisi sono verificati con unificazione invariante. L'unificazione tra due schema opzionali richiede gli stessi insiemi di campi obbligatori e opzionali. I record e le righe ordinari mantengono la propria inferenza.

Il checker distingue OptionalRecordType da RecordType e attraversa entrambe le mappe nella sostituzione dei parametri, nell'istanziazione, nell'occurs check, nelle variabili libere e nella visibilità. I report pubblici mantengono kind Record e aggiungono optional: true soltanto ai campi facoltativi. Le firme esplicite e i fingerprint distinguono i campi obbligatori da quelli opzionali. I record nominali parametrici e i campi di tipo somma nativa riusano i meccanismi esistenti.

La proiezione diretta ~ è ammessa sui campi obbligatori, non sui campi opzionali, anche se un particolare valore è stato costruito con quel campo presente. Non si inferisce ancora la presenza a livello di singolo valore. Un aggiornamento immutabile update:with: di un record a schema opzionale ammette soltanto proprietà dichiarate e tipi compatibili e restituisce lo stesso tipo, anche nominale. Non promuove automaticamente un campo opzionale a obbligatorio. L'aggiornamento ordinario e i relativi emitter non sono modificati.

Nessun nuovo runtime: la rappresentazione è quella dei record già esistenti (oggetti JavaScript e array associativi PHP), con sole proprietà effettivamente presenti. L'annotazione è cancellata dall'emitter. L'array PHP vuoto conserva la semantica preesistente, incluso il formato JSON di un array vuoto, che non è una nuova garanzia di serializzazione del record. L'assegnazione e gli aggiornamenti sono verificati in modalità checked; la compilazione non checked non offre tali garanzie.

Limiti intenzionali: accesso fallibile o con default ai campi opzionali, test di presenza con narrowing, proiezione aperta ~ di uno schema nominale opzionale, unificazione tra schema opzionali e righe aperte e composizione ricorsiva direzionale di schema annidati restano da progettare. Anche i manifest host, i codec e i validatori esterni devono essere estesi esplicitamente prima di usarvi questo nuovo contratto. Il caso di studio GUI non viene ancora migrato: servirà un accesso sicuro e una API tipizzata degli stili. Il Laboratorio tipi di Studio contiene l'esempio Record con campi opzionali, con test di erasure, update immutabile, diagnostica, JS/PHP e report pubblici. La prossima versione è 0.100, non 1.0.


## Safe optional access 0.100

Stato: candidata. L'operatore postfix ~? ha la stessa precedenza e associatività di ~; il nome del campo è statico (anche chiave testuale quotata). Riutilizza la somma nominale visibile con forma Option (T) :: Some (T) | None, come la validazione breve riutilizza Result. Nei moduli importare Option da Data / Outcome; non occorre importare i costruttori per usare l'operatore. Nessun nuovo tipo o valore null.

```mira
Option (T) :: Some (T) | None;
Style :: {padding?: Number};
a (Style) = {};
b (Style) = {padding: 0};
x = a ~? padding;
resolve: s (Style) -> Number =
  match: (s ~? padding) {
    some: {p | p},
    none: {| 12}
  };
result = [(resolve: a), (resolve: b)];
```

x ha tipo Option (Number) e result contiene 12 e 0. La modalità checked richiede uno schema noto e il campo esplicitamente opzionale; non introduce inferenza di righe opzionali. Campi sconosciuti e richiesti, record non annotati, proiezioni dirette di opzionali e receiver non record sono rifiutati. La lettura mantiene il tipo del payload. L'assenza è verificata tramite Object.hasOwn (JS) e array_key_exists (PHP), non con truthiness, isset o un valore sentinella. Un valore presente pari a 0, false o testo vuoto resta presente. Input host non validati non acquistano automaticamente garanzie nominali.

Il nuovo nodo OptionalFieldGet conserva il receiver, la chiave e il template Option lessicale. Il checker applica il template al tipo del campo, preservando l'identità nominale e la visibilità. L'emitter usa la rappresentazione tagged già esistente di Some/None solo quando serve un valore Option. Un match diretto ed esaustivo con handler corretti viene invece specializzato nel punto di emissione: un solo test di presenza, receiver valutato una volta, payload originale al ramo Some e nessuna allocazione intermedia di Option. Restano le closure del match. Il tree shaker e la raccolta delle catture visitano il receiver. Nessun nuovo runtime o tabella. La modalità non checked non garantisce validità del receiver o tipo del campo.

Limiti intenzionali: la dichiarazione Option deve essere visibile col nome Option e avere esattamente i due casi standard, non un tipo opaco o un alias con nome differente. Non sono ancora supportate sezioni/accessor ~?, flow narrowing della presenza, ottimizzazione di accessi dopo update, varianti opzionali generiche unboxed o fusione attraverso binding intermedi. Non si promette un miglioramento misurato delle prestazioni. Il Laboratorio tipi mostra esempio e AST; i test esercitano nominalità, import, false/0/testo vuoto, entrambi gli ordini dei rami, catture, tree shaking e JS/PHP. La prossima versione proposta è 0.101 per la presenza statica.


## Static presence inference 0.101

Stato: candidata. Nessuna sintassi aggiuntiva. Le prove positive di presenza appartengono alle espressioni e ai binding immutabili, non al tipo nominale o alla rappresentazione del record.

```mira
Option (T) :: Some (T) | None;
Style :: {padding?: Number};
original (Style) = {};
padded = update: original, with: {padding: 0};
result = padded ~ padding;
chosen = match: (padded ~? padding) {
  some: {p | p},
  none: {| 12}
};
```

Il checker conserva le chiavi dei literal, le propaga per alias locali e globali nello stesso modulo, catture lessicali e update:with: (unione delle chiavi provate della base e della patch). Nei condizionali mantiene solo l'intersezione dei fatti dei rami. Un parametro o una chiamata ordinaria non eredita fatti arbitrari; un binding che oscura il precedente non eredita la sua presenza. I fatti non entrano nelle firme, nello schema pubblico o nei fingerprint. I campi continuano a essere opzionali nel tipo Style. I valori originali non vengono modificati.

Il checker accetta ~ su un campo opzionale provato presente e registra un fatto di emissione per quel nodo. JS/PHP emettono accesso diretto; ~? conserva il tipo Option ma può costruire Some senza controllare la presenza. Nel match diretto fuso viene emesso il solo ramo Some senza test di presenza, mantenendo la valutazione del receiver. Per la presenza sconosciuta si conserva il comportamento 0.100. Non si promette l'eliminazione di tutte le closure o allocazioni.

Confine di validità: la prova assume l'immutabilità dei record Mira. Un host fidato non deve mutare i record ricevuti per riferimento o alterare la semantica delle primitive native; non è un sistema di effetti né un isolamento da JS ostile. Non si propagano fatti da funzioni generiche, risultati host o attraverso confini modulari. Non si deduce l'assenza e non si introducono test di presenza con narrowing nei rami, righe opzionali, accesso a percorsi annidati o analisi interprocedurale. Le dichiarazioni e gli aggiornamenti si validano ancora con le regole della 0.99. Nessuna misura prestazionale specifica ancora disponibile.

Mira Studio: Presenza statica dei campi nel Laboratorio tipi. Test di regressione per identità nominale, scoping e shadowing, join, aggiornamenti immutabili, catture e assenza dei controlli nel JS/PHP checked, con mantenimento dei controlli per parametri sconosciuti.


## Text refinements 0.102

Stato: candidata. La sintassi where esistente accetta, per un tipo con rappresentazione Text, una disgiunzione di uguaglianze con literal testuali:

```mira
Alignment :: Text where _ == "start" OR _ == "center" OR _ == "end";
a (Alignment) = "center";
Result (T, E) :: Ok (T) | Err (E);
parse: x (Text) = validate: (x), as: (Alignment);
result = [(parse: "start"), (parse: "bad")];
```

Nessun nuovo token. TextRefinedType contiene il tipo base e un insieme finito canonico TextChoices; il vocabolario delle prove resta Proven / Violated / Unknown (enum storico NumericProof). La rappresentazione è Text nativo. Un refinement nominale non è una somma con costruttori: la costruzione esplicita può attribuire il tipo a un testo provato appartenente al dominio, senza cambiare la rappresentazione. Tipi nominali fratelli restano distinti. Raffinare ulteriormente un tipo interseca i domini ereditati; un'intersezione vuota è un errore.

Il checker conserva fatti testuali da literal, alias immutabili locali e nello stesso modulo, rami condizionali (unione dei possibili valori) e tipi già raffinati. La prova è positiva quando l'insieme noto è incluso nel dominio richiesto, negativa se disgiunto, altrimenti sconosciuta. Una costruzione testuale non provata è rifiutata anche nella compilazione checked: a differenza dei guard numerici storici non vengono introdotti guard impliciti. Le chiamate a funzioni nominali richiedono il tipo nominale. Il report pubblico TextRefined include choices ordinate e senza duplicati; firma e fingerprint riusano i meccanismi esistenti.

La validazione esplicita validate:as: riutilizza entrambe le forme esistenti, con Result oppure handler then/else. Per un input sconosciuto emette confronti stretti con i literal ammessi, evitando coercizioni PHP (ad esempio "00" non è "0"). Il receiver è valutato una volta. Un literal noto usa una condizione costante. I valori rimangono stringhe; Result mantiene la rappresentazione normale. Nessuna modifica del runtime. La modalità unchecked non offre garanzie sulle costruzioni annotate.

Limiti: solo insiemi finiti di literal espressi con == e OR; non sono ancora disponibili regex, lunghezza, testo non vuoto, predicati generici, AND testuale o narrowing da confronti. Non si aggiunge un sistema di conversioni implicite, né una prova interprocedurale; l'inferenza di fatti non attraversa i moduli, mentre i tipi pubblici sì. Non si estende ancora il criterio di disgiunzione delle Native variants ai sottoinsiemi del dominio Text. Codec esterni e migrazione GUI restano da verificare prima di utilizzarli. Il Laboratorio tipi offre un esempio modificabile, con schema, esecuzione JS/PHP e diagnostica; i test confrontano il codice emesso con quello non annotato. Nessun benchmark specifico ancora disponibile.


## Typed GUI styles 0.103

Stato: candidata. Primo percorso opt-in, senza modificare la libreria legacy né il renderer. Importare lib/gui.mira e lib/gui-typed-styles.mira in compilazione checked.

```mira
import "lib/gui.mira";
import "lib/gui-typed-styles.mira";
px (GUI Pixels) = 12;
panel (GUI Style) = {padding: px, width: Style Fill, align: Align Center};
result = styled: (text: "Mira"), with styles: [panel];
```

GUI Style è un record chiuso con 17 campi opzionali. GUI Pixels, GUI Font Weight e GUI Flex usano refinement numerici; GUI Size usa una Native variant; GUI Alignment usa Scalar variants; le altre cinque scelte finite sono Text refinements. I valori devono essere costruiti esplicitamente nel tipo richiesto (nessuna conversione implicita nei campi). Le liste possono essere calcolate e riutilizzate perché il tipo [GUI Style] è verificato dalla normale firma. La rappresentazione del descrittore e dei suoi campi rimane nativa. Non si aggiunge una nuova fase di validazione runtime.

Il nuovo decoratore mantiene l'ABI di View già fidato: il compilatore riconosce soltanto l'import della sorgente esatta incorporata, non una funzione omonima. La firma usa il tipo layers già dichiarato nel sorgente Mira. Il checker contestuale checkGuiStyle non viene eseguito dal nuovo selettore. Non si introduce alcuna conoscenza di nomi, limiti o tipi delle 17 proprietà in Haxe.

Misura a livello di sorgenti: 17/20 proprietà (85%) migrate nel percorso opt-in; 3 colori esclusi perché richiedono regex. Delta netto nel compilatore Haxe: Compiler +3 righe, GuiTypes +3, TypeChecker invariato nel numero di righe; Studio Bridge +5. Nessuna riga del controllo legacy è rimossa, poiché serve ancora alle applicazioni esistenti. Le regole legacy sono ancora duplicate in dati Mira: non è una riduzione netta del codice, ma una prima migrazione del percorso di verifica. Nessuna misura di prestazioni o dimensione del JS/PHP generato rivendicata. Il limite massimo di 32 strati resta verificato dall'host, non dal nuovo tipo lista. Il supporto dei colori, il vincolo sulla lunghezza delle liste, l'integrazione dello specializzatore GUI e l'unificazione delle due API sono passi successivi. Il record vuoto in PHP mantiene la rappresentazione array associativo già esistente (JSON []); non si cambia l'ABI. Il Laboratorio tipi include l'esempio Stili GUI tipizzati. Test di regressione verificano nominalità, errori, descrittori nativi JS/PHP e rifiuto di una libreria modificata come fonte fidata.


## Composable grammars 0.104

Stato: candidata. Le grammatiche sono normali valori Mira, non regex esposte. Il nucleo riutilizza la somma nominale ricorsiva Grammar (ricorsiva come struttura dati, non ancora come definizione di una grammatica) con cinque costruttori: Literal (Text), Character Set (Text), Sequence ([Grammar]), Choice ([Grammar]), Repeat ({pattern: Grammar, min: Number, max: Number, unbounded: Boolean}). I combinatori in lib/grammar.mira sono funzioni ordinarie, utilizzabili in programmi checked JS/PHP importando la libreria. Nessun token o costrutto speciale.

```mira
digit = character in: "0123456789";
integer part = one or more of: digit;
fraction = all of: [(one: "."), (one or more of: digit)];
grammar = all of: [
  (zero or one of: (one: "-")),
  integer part,
  (zero or one of: fraction)
];
```

Semantica: riconoscimento dell'intero testo, non ricerca di una sottostringa. one: consuma il literal esatto (anche vuoto). character in: consuma un solo carattere appartenente all'insieme; l'insieme vuoto non riconosce alcun testo. all of: concatena nell'ordine, e la lista vuota riconosce solo il testo vuoto. one of: è unione delle alternative, non scelta esclusiva né ordered choice: se più alternative riconoscono lo stesso testo, questo resta valido; lista vuota = linguaggio vuoto. exactly:of: impone n ripetizioni; between:and:of: ha estremi inclusivi; zero or one of:, zero or more of: e one or more of: sono specializzazioni di Repeat. Il flag unbounded rende max non applicabile (codifica canonica 0), distinto da exactly 0. any of: è rinviato, per non introdurre un sinonimo ambiguo. Non sono ancora disponibili intervalli character from:to:, negazioni, riferimenti grammaticali ricorsivi, catture o alberi di parsing.

La modalità di analisi del Grammar Lab premette la libreria alla sorgente dichiarativa editabile, controlla il programma con il type checker reale e valuta il valore Grammar attraverso l'evaluatore ConstantData con opzione pureCalls. Tale opzione consente chiamate a funzioni Mira nel sottoinsieme dei costruttori e composizioni di dati, con frame lessicali, non esegue JS/PHP o chiamate host, non implementa un interprete generale. La modalità ConstantData precedente mantiene le sue restrizioni. Il compilatore grammaticale decodifica il valore e costruisce un NFA di Thompson, con epsilon-closure e determinizzazione per sottoinsiemi. Non usa espressioni regolari. Un DFA è indipendente dal target; la funzione di riconoscimento generata usa una tabella di transizione e stati finali. JS conserva le tabelle in una closure, PHP in variabili statiche; nessun runtime condiviso. Il riconoscimento ha un passo per carattere consumato, non backtracking. La tabella densa è una prima implementazione, non ancora minimizzata/compressa o confrontata con backend alternativi. Il programma Mira che produce un valore grammaticale e la generazione di un riconoscitore specializzato sono due operazioni distinte: per ora la seconda è esposta tramite Bridge/Grammar Lab, non con un nuovo builtin Mira o opzione CLI.

Prima semantica portabile: ASCII (codici 0–127), uguaglianza esatta case-sensitive, niente normalizzazione. I literal e gli insiemi non ASCII sono errori di compilazione; input non ASCII è rifiutato. I limiti di risorse sono diagnostiche, non fallimenti di riconoscimento: sorgente 65536, valutazione 10000 passi e profondità 64, limiti di ripetizione interi da 0 a 64 (non limite alle ripetizioni unbounded), 256 stati NFA e 256 stati DFA, 4096 unità di input nel trace del Lab. Non si promette che qualsiasi grammatica regolare sia compilabile entro questi limiti. Le funzioni emesse non hanno il limite di trace. Il ciclo epsilon di ripetizioni nullable è terminato dalla visita per stato.

Grammar Lab: pagina autonoma indicizzata e inclusa nel service worker, editor di dichiarazioni, esempi decimale/colore/alternative sovrapposte, AST grammaticale ad albero testuale, numero di stati, traccia degli stati attraversati, riconoscimento e generazione codice JS/PHP. Test di regressione confrontano la semantica attesa, l'automa del laboratorio e le funzioni generate eseguite su entrambi i target; includono input vuoto, false/zero/null non testuali, sovrapposizioni, nullable, rifiuti, limiti. Non si tratta di un parser con produzione di AST: la traccia mostra stati, non l'albero di parsing dell'input. Nessun benchmark comparativo ancora disponibile.

Prossimo passo: collegare i valori grammaticali ai refinement con prove statiche e validazione esplicita, senza esporre regex. Migrazione dei tre colori GUI soltanto dopo quella integrazione. Unicode e politiche di disgiunzione richiederanno scelte esplicite.


## Grammar refinements 0.105

Stato: candidata. Sintassi: dichiarazione nominale piatta con base diretta Text, e riferimento a un valore Grammar dichiarato precedentemente.

```mira
import "lib/grammar.mira";
digit = character in: "0123456789";
digits = one or more of: digit;
Digits :: Text where matches: _, grammar: digits;
value (Digits) = "123";
Result (T,E) :: Ok (T) | Err (E);
parse: x (Text) = validate: (x), as: (Digits);
```

La dichiarazione elabora uno snapshot dei valori e funzioni precedenti, con il parser, type checker e valutatore ConstantData esistenti. Per ora si richiedono dichiarazioni piatte, nessun host, nessuna dipendenza in avanti nel prefisso, e valore Grammar nel sottoinsieme puro supportato dal Lab. Non viene eseguito codice emesso. Non si introduce un interprete generale. Il type node GrammarRefinedType conserva un automa, non un riferimento runtime al valore grammaticale. Nominalità e rappresentazione Text sono preservate. Il checker usa i fatti testuali finiti esistenti: tutti i valori riconosciuti = Proven, nessuno = Violated, altrimenti Unknown. La costruzione non provata richiede validazione esplicita. Un automa identico è prova sufficiente, non necessaria; non si implementa ancora inclusione o equivalenza semantica generale. Composizione di refinement grammaticali e finiti non ammessa; la base deve essere Text.

validate:as: riusa Result e handler. Un literal testuale viene riconosciuto a compile time, un literal numerico o booleano fallisce; input dinamico usa lo stesso riconoscitore DFA del Lab, emesso come espressione locale. Nessun riconoscitore viene aggiunto per una semplice costruzione statica. Non si promette eliminazione di tutti i valori Grammar dichiarati: usare tree shaking se non consumati dal programma. La tabella densa del riconoscitore dinamico può essere ripetuta per più siti di validazione; deduplicazione e ottimizzazione sono aperte. ASCII e limiti automi 0.104 invariati. Il report espone lo schema dell'automa; la rappresentazione non è minimizzata e non è un fingerprint canonico del linguaggio riconosciuto.

Grammar Lab offre un pulsante Prova come refinement per sottoporre il campione corrente al checker, oltre alla precedente traccia. Test di Studio verificano nominalità, prove statiche, codice nativo senza riconoscitori per costruzione e validazione letterale, Result e handler con esecuzione dinamica su JS/PHP. Caso di studio: grammatica CSS che riconosce esadecimali 3/4/6/8 e le due parole transparent/currentColor. La libreria GUI esistente non è ancora migrata: prima occorre validare il nuovo meccanismo e la composizione del prefisso con gli import GUI. Nessuna regex nella nuova sintassi.


## Grammar-powered GUI colors 0.106

Stato: candidata. La libreria opt-in lib/gui-typed-styles.mira importa lib/grammar.mira e dichiara una grammatica di colore condivisa da background, color e borderColor. Il refinement nominale GUI Color mantiene Text come rappresentazione nativa; ammette esadecimali di 3, 4, 6 o 8 caratteri dopo #, con cifre ASCII e A-F/a-f, oppure esattamente transparent e currentColor. Non accetta altri nomi CSS o corrispondenze parziali. Nessuna regex nella nuova libreria.

```mira
import "lib/gui.mira";
import "lib/gui-typed-styles.mira";
ink (GUI Color) = "#234";
paper (GUI Color) = "#ffeedd";
panel (GUI Style) = {color: ink, background: paper, borderColor: ink};
result = styled: (text: "Mira"), with styles: [panel];
```

Il record chiuso contiene ora tutte le 20 proprietà di stile; le tre nuove sono opzionali e usano lo stesso tipo nominale. La composizione riusa gli import piatti e la risoluzione dei valori grammaticali precedenti. La firma View fidata richiede sia la sorgente esatta della libreria tipizzata sia la sorgente esatta della sua dipendenza grammaticale, incorporata anche nel build CLI. Un file grammaticale modificato non deve poter ottenere il tipo View fidato attraverso il decoratore. Nessun nome di proprietà, intervallo o formato di colore è aggiunto al checker Haxe.

Misure sorgenti rispetto alla 0.105: copertura opt-in 17/20 (85%) -> 20/20 (100%); lib/gui-typed-styles.mira +14 righe nette; Compiler.hx +2 righe nette (verifica della dipendenza e condizione di fiducia aggiornata); build.hxml +1 risorsa; Bridge.hx solo versione; renderer invariato. Nessuna cancellazione dal percorso legacy. Il contratto storico lib/gui-style-contract.mira contiene ancora Pattern con regex, e il renderer conserva la validazione al confine host: non rappresentano la nuova API grammaticale. La loro migrazione/rimozione richiede un incremento separato. Il limite di 32 strati è ancora un controllo host nel nuovo percorso.

Deduplicazione: un solo tipo GUI Color con un automa compile-time, usato dai tre campi. Le costruzioni provate e la validazione di literal non emettono riconoscitori. Con tree shaking, i valori grammaticali non usati a runtime sono rimossi. Per validazioni dinamiche multiple il codice 0.105 conserva un riconoscitore locale per sito di validazione. La regressione Studio misura e stampa i byte del programma checked/tree-shaken per uno e due siti e verifica la quantità di tabelle; la misura non è un benchmark temporale. Una funzione ordinaria parse color: x (Text) = validate: (x), as: (GUI Color); permette già di riutilizzare un unico sito, senza infrastruttura nuova. Deduplicazione automatica whole-program rinviata: dovrebbe preservare nomi, source mapping, tree shaking e indipendenza delle compilazioni. Non usare una cache globale del compilatore come scorciatoia.

Verifiche candidate: CLI con entrambi gli ordini di import e import esplicito ripetuto della grammatica; descrittori JS/PHP nativi; schema Studio di 20 campi, triplo riutilizzo nominale; confronto con legacy e renderer per campioni validi/invalidi; dipendenza grammaticale manomessa; conteggio delle tabelle generate. L'esempio Stili GUI tipizzati in Studio include i tre colori. Il supporto Unicode, grammatiche modulari e vincoli sulla lunghezza delle collezioni restano aperti.


## List cardinality 0.107

Stato: candidata. Sintassi discorsiva nella dichiarazione di refinement, con base diretta [T]:

```mira
Small :: [Number] where
  (length of: _) >= 1 AND (length of: _) <= 3;
raw = [1, 2];
first (Small) = raw;
expanded = append: 3, to: first;
next (Small) = expanded;
Result (T,E) :: Ok (T) | Err (E);
parse: xs ([Number]) = validate: (xs), as: (Small);
```

Il nodo ListRefinedType contiene il tipo lista e un NumericRange normalizzato all'intervallo intero non negativo portabile [0, 4294967295], limite della lunghezza di Array JS. Si riusa readRange e il protocollo Proven / Violated / Unknown; confronti con soglie frazionarie vengono normalizzati a estremi interi, intervalli impossibili rifiutati. Non è ancora un selettore length of: disponibile nelle normali espressioni. Il tipo nominale è separato dai fatti: alias immutabili nello stesso modulo, binding lessicali, literal, join condizionale, append n+1, collect/map n e select/filter intervallo [0,n] per i soli selettori nativi, nessun fatto arbitrario da chiamate host. Le operazioni su liste raffinate restituiscono liste ordinarie; non conservano un'identità nominale che potrebbe non essere più valida. Per recuperarla serve costruzione provata. La costruzione non dimostrata è errore, non guard implicito. Tipi di elementi già compatibili, nessuna conversione implicita di elementi. Nessuna inferenza interprocedurale aggiuntiva.

validate:as: richiede un input lista con tipo di elemento compatibile in checked, non è un codec per dati non tipizzati. La forma Result e quella a handler sono riusate. Il literal è valutato staticamente per cardinalità, preservando la valutazione degli elementi. Per input dinamico il backend usa Array.isArray e length, oppure is_array, array_is_list e count su PHP. Il controllo di forma PHP può avere un costo per array non packed; non promettiamo complessità costante per tutti gli input. Il tipo non aggiunge wrapper runtime; una costruzione provata genera la stessa lista. Le annotazioni e validate in modalità unchecked non garantiscono compatibilità degli elementi. Il contratto di immutabilità/host fidato rimane necessario.

GUI: Style Layers :: [GUI Style] where (length of: _) <= 32. La firma del decoratore opt-in styled:with styles: accetta ora Style Layers, dunque richiede una costruzione nominale esplicita. È un cambiamento della API opt-in pre-1.0; il selettore legacy styled:with: non cambia. I 20 campi dello stile, l'ABI del descrittore, il renderer e i controlli host restano invariati. Non si introduce un controllo Haxe specifico per 32 nel nuovo percorso.

Studio: Cardinalità delle liste, diagnostica, schema ListRefined con base e length, validazione e JS/PHP. Test per estremi, alias, scope, append/map, cardinalità sconosciuta, tipi degli elementi, Result/handler, erasure e 0/1/32/33 strati. Limiti: base diretta [T], niente refinement annidati su liste già nominali, tipi parametrici raffinati, lunghezze di testo, record o collezioni generiche, predicati su elementi, narrowing da confronti e validazione strutturale esterna. Le prove sui literal e sui binding non attraversano confini modulari; la firma pubblica può conservare il refinement e i relativi estremi.

Misure confermate della 0.106 (Studio CI run 46000219655): JS 15599 byte con un sito dinamico, 29019 con due; PHP 18671 e 32272. Il test CLI della 0.106 richiese maxBuffer più grande per i report con tabelle ripetute. Compattazione dei report e riconoscitori è una possibile ottimizzazione separata.
