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
