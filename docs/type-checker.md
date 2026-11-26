# Mira 0.39 — nucleo di inferenza

Il checker Haxe analizza l'AST risolto dopo il parser, prima dei backend,
ma in questa versione è un'operazione **opt-in separata**: la normale
transpilazione rimane invariata e non è garantita la tipizzazione di tutti
i programmi Mira. Nessuna modifica alla grammatica.

```sh
npm run build
node dist/mira.cjs example.mira --check
```

Output JSON: nome, tipo, riga, colonna e file della dichiarazione.
Gli errori hanno posizione a livello di dichiarazione, non ancora del
singolo nodo AST. In Studio il laboratorio dei tipi esegue lo stesso
checker senza eseguire il programma.

## Inferenza

```mira
identity: x = x;
name of: person = person ~ name;
a = name of: {name: "Ada", age: 37};
b = name of: {name: 42};
```

Tipi attesi: identity: ('a) -> 'a; name of: ({name: 'a | 'b}) -> 'a;
a: Text; b: Number. Il simbolo dopo la barra è la coda aperta del record.
I nomi di variabili sono locali alla rappresentazione di ciascun tipo.

Il nucleo implementa variabili fresche, sostituzioni, unificazione con
occurs-check, funzioni e arità, record strutturali chiusi/aperti,
liste omogenee, proiezioni e scope lessicale. Le definizioni globali
acicliche sono generalizzate e istanziate a ogni uso; i binding locali
restano monomorfi. Le dipendenze si risolvono su richiesta e le cicliche
sono rifiutate. Inferenza di sezioni, operatori numerici, condizionali
Boolean, map/collect, select/filter/remove, fold, append e update di
record chiusi. L'aggiornamento chiuso può sostituire il tipo di un campo.

Da NailLang 0.61 riprendiamo l'idea di inferire requisiti strutturali
aperti e mantenere le annotazioni esplicite per una fase successiva;
non importiamo codice o l'interprete di Nail. Il checker lavora direttamente
sull'AST Mira, è indipendente da JavaScript/PHP.

## Confini

Questa è una prima implementazione sperimentale, non una prova formale
di soundness. Nessuna promessa di tipi principali per tutto il linguaggio.
Ricorsione, polimorfismo locale, firme host, unioni, tipi nominali, annotazioni
e aggiornamento di record aperti non supportati. L'uguaglianza richiede
uno scalare già noto. Number non distingue interi da decimali o rappresentazioni
JS/PHP. Le liste eterogenee, condizioni non booleane, accessi a campi mancanti
e arità incompatibili sono rifiutati nel sottoinsieme controllato, anche se
la normale transpilazione può accettarli. Non si usa un tipo Dynamic
implicito per nascondere i casi non supportati. Il checker non verifica
ordine di inizializzazione runtime, effetti, portabilità del valore o
contratti RPC. I record aperti richiedono ulteriore verifica di casi limite
e formalizzazione delle restrizioni sulle righe.

Prossime tappe: test generativi dell'unificazione, posizioni precise dei
nodi, gruppi ricorsivi, firme host, update strutturale, annotazioni e
derivazione dei validatori RPC dai tipi.

## 0.40: gruppi ricorsivi e vincoli sulle righe

Questa evoluzione supera il limite della ricorsione indicato nella
descrizione storica 0.39. Il passaggio Dependencies raccoglie riferimenti
globali rispettando gli scope lessicali e identifica le componenti
fortemente connesse (Tarjan). Le componenti sono elaborate in ordine di
dipendenza. Ogni componente ottiene tipi provvisori condivisi; tutti i
membri vengono verificati prima della generalizzazione. I riferimenti
interni sono monomorfi, quelli a componenti già completate sono
istanziati. È ammessa ricorsione diretta o mutua tra funzioni, non la
ricorsione polimorfa o le componenti cicliche contenenti valori globali.

```mira
even: n = if (n <= 0) then true else (odd: (n - 1));
odd: n = if (n <= 0) then false else (even: (n - 1));
```

Entrambe inferiscono (Number) -> Boolean. Nessuna analisi di terminazione.

Le variabili di riga portano un insieme di etichette vietate (lacks).
Le restrizioni si propagano quando una variabile viene legata a un'altra
variabile o a un'estensione di record e sono conservate durante
l'istanziazione. Una coda non può reintrodurre un campo già presente.
La suite include sei permutazioni deterministiche dei campi, proiezioni
multiple, errori per campi assenti o incompatibili, shadowing e ricorsione.
Non è una dimostrazione formale di soundness né un fuzzer completo.

Restano da progettare update di righe aperte (distinguere sostituzione
da aggiunta senza perdere informazioni), generalizzazione locale,
diagnostica a livello di espressione e firme host. Il checker rimane
opt-in; nessuna modifica alla semantica dei backend.

## 0.41: polimorfismo locale e aggiornamenti

I binding locali contengono uno schema di tipo: tipo e insieme delle
variabili quantificate. Per generalizzare si sottraggono le variabili
libere dell'ambiente lessicale e delle componenti ricorsive attive.
Ogni uso istanzia soltanto le variabili quantificate. Le variabili
catturate restano condivise; i parametri sono monomorfi.

```mira
result = () >> {|
    id = {x | x};
    {number: (1 >> id), text: ("ok" >> id)}
};
```

Il risultato ha tipo {number: Number, text: Text}. Si applica una
value restriction conservativa: generalizzazione locale solo per
letterali, nomi, blocchi, accessori e aggregati di valori; non per
chiamate, applicazioni o espressioni calcolate. Gli effetti host non
sono ancora verificabili. La politica delle definizioni globali
rimane invariata.

```mira
rename: r = update: r, with: {name: "Ada"};
result = rename: {name: 42, age: 37};
```

Il tipo di rename è ({name: 'a | 'b}) -> {name: Text | 'b}.
Il risultato conserva age: Number. La patch deve essere un record
chiuso noto. Per una base chiusa sono ammessi aggiunte e sostituzioni.
Per una base aperta o ignota, una patch su un campo non noto richiede
che il campo esista nella base, salvo che un vincolo ne provi già
l'assenza. È una scelta conservativa: può rifiutare aggiunte valide
a runtime, ma non perde la coda del record e non inventa un tipo
di campo. I tipi dei campi sostituiti possono cambiare. Non si
introducono vincoli differiti di overwrite, righe opzionali o nuove
primitive. Nessuna modifica ai backend o alla sintassi.

La CI verifica generalizzazione, catture monomorfe, value restriction,
sostituzioni multiple, campi mancanti e conservazione di campi extra;
anche il bridge browser esegue il checker. Restano da progettare
vincoli degli operatori, firme host, diagnostica precisa ed effetti.

## 0.42: vincoli di tipo

L'uguaglianza e la disuguaglianza (==, !=) unificano i tipi degli
operandi e richiedono il predicato statico ScalarEq. Sono ammessi
Number, Text e Boolean; liste, record e funzioni sono esclusi.
Il predicato può essere risolto immediatamente oppure associato a
una variabile ancora libera. Si propaga durante il binding, anche
attraverso alias; l'istanziazione degli schemi copia il vincolo
soltanto per le variabili quantificate. Le variabili catturate e
le componenti ricorsive attive conservano i vincoli condivisi.
I vincoli di riga e ScalarEq sono incompatibili.

```mira
same: a, as: b = a == b;
n = same: 2, as: 2;
t = same: "Ada", as: "Mira";
```

Tipo inferito: ('a, 'a) -> Boolean where 'a: ScalarEq.
La clausola where e ScalarEq sono soltanto notazione diagnostica,
non nuova sintassi Mira. Il predicato è una famiglia chiusa di tipi,
non un sistema generale di typeclass, overload o dizionari runtime.
L'inferenza risolve il vincolo in Number se altri operatori lo
richiedono. L'ordinamento e l'aritmetica rimangono numerici.
I tipi sono stampati con predicati sulle variabili che compaiono
nel tipo esposto; non si espongono vincoli interni non osservabili.

Gli emitter non sono stati modificati: == e != usano gli operatori
stretti dei target. ScalarEq garantisce l'ammissibilità dei tipi
nel sottoinsieme controllato, non l'identità semantica di tutte
le rappresentazioni numeriche. Per esempio JS considera 1 e 1.0
lo stesso Number, mentre PHP distingue int e float nell'uguaglianza
stretta. La normalizzazione numerica richiede una decisione separata.
Nessuna uguaglianza strutturale implicita per liste o record.

La suite verifica istanziazioni indipendenti, funzioni di ordine
superiore, campi strutturali, closure, ricorsione e rifiuto di tipi
incompatibili. Il checker resta opt-in. Non sono ancora disponibili
firme host, annotazioni o generazione dei validatori RPC.

## 0.43: diagnostica delle espressioni

La normale AST Expr non cambia. Durante Compiler.check il parser
registra un'ancora per nodo in una mappa di identità locale al
check; i parser ricorsivi condividono la mappa e sectionify
trasferisce l'ancora ai nodi riscritti. La normale transpilazione
non alloca questa mappa. Il lexer conserva anche la fine esclusiva
del token originale, incluse le stringhe con escape.

Quando il checker entra in un'espressione cambia l'ancora corrente,
ripristinandola dopo una inferenza riuscita. Una incompatibilità
su un operatore segnala il token operatore; una proiezione segnala
il primo token del nome del campo; una chiamata a selettore segnala
il primo token del selettore. Una applicazione per giustapposizione
segnala il primo token dell'argomento; >> segnala l'operatore.
Le condizioni non booleane, i rami incompatibili e gli elementi
incompatibili di liste segnalano l'ancora dell'espressione coinvolta.
Per errori di gruppi ricorsivi o vincoli risolti soltanto alla fine
della dichiarazione rimane la posizione della dichiarazione.

```mira
x = 1;
y = x + "a";
```

Errore: Type check: expected Number, got Text at 2:7.

CLI precedente --check invariata (testo su stderr per errori).
Nuova CLI: node dist/mira.cjs program.mira --check-json.
Restituisce {ok, types, diagnostics}; per un errore di sorgente
o di tipo ritorna exit code 1 e diagnostica su stdout. Errori di
I/O, manifest host o invocazione fuori dal check conservano la
gestione CLI precedente. Il bridge Studio conserva ok/output/message
e aggiunge diagnostic (oggetto singolo) per MiraError.

Campi: code (source_error o type_error), message (senza suffisso
posizionale), file, line, column, endLine, endColumn. Coordinate
1-based, fine esclusiva; file null indica il sorgente principale.
Su JS le colonne sono in unità UTF-16, non ancora coordinate LSP
zero-based. Gli errori privi di token hanno coordinate null.
Studio seleziona il token per errori del sorgente principale, senza
inventare una selezione per un file importato.

Limiti: sono ancore di token, non intervalli completi di tutte
le espressioni; si riporta il primo errore, senza recupero multiplo.
Non c'è ancora una catena delle origini dei vincoli né una API LSP.
Nessuna modifica al linguaggio o alla semantica dei backend.

## 0.44: firme host

Il manifest JSON esistente mantiene values, callables e selectors.
Il campo facoltativo types descrive i tipi dei nomi già registrati:

```json
{
  "values": ["rate"],
  "callables": ["format"],
  "types": {
    "rate": "Number",
    "format": {"parameters": ["Number"], "result": "Text"}
  }
}
```

```mira
quote: hours = format (hours * rate);
result = quote: 2;
```

quote: (Number) -> Text; result: Text.
CLI: node dist/mira.cjs program.mira --check --host host.json.
In Studio il Laboratorio tipi permette di modificare il manifest.

HostTypeCodec decodifica direttamente in Type: Number, Text, Boolean,
{"list": type}, {"record": {"field": type}}, {"parameters": [type],
"result": type}. I record sono chiusi, i tipi delle funzioni possono
essere annidati (callback), i callable possono avere zero parametri.
I selettori richiedono arità identica al numero di etichette.
Non sono ammesse firme per nomi non registrati; le firme non
autorizzano accesso a nuove capability. Una firma mancante è
un errore del checker, non della normale transpilazione.
Le firme malformate sono rifiutate anche durante la compilazione
ordinaria; il manifest legacy senza types resta supportato.

Le firme sono monomorfe e chiuse: niente variabili di tipo, righe
aperte, Unit, null, tipi opachi o effetti dichiarati in questa fase.
Un record con campi extra rispetto a una firma chiusa può essere
rifiutato conservativamente. Le firme sono una promessa dell'host,
non validatori runtime: l'host deve fornire valori e implementazioni
conformi. Nessun nuovo emitter, wrapper o costo nel codice generato.
Gli errori di firma sono host_type_error (senza coordinate Mira);
gli errori nelle espressioni restano type_error con ancore.
La CLI valida il manifest prima di --check-json, quindi errori di
manifest restano su stderr come nella 0.43.

La suite verifica chiamate, sezioni, callback, campi e arità,
manifest non validi, compatibilità delle firme mancanti e
esecuzione su host JS/PHP. Il bridge usa lo stesso checker.
Prossimo passo: esportare tipi chiusi inferiti in un formato
riutilizzabile per derivare i contratti RPC e i validatori runtime,
senza interpretare la stringa diagnostica dei tipi.

## 0.45: esportazione dei tipi

Ogni voce di Compiler.check e --check-json conserva il campo type
leggibile e aggiunge schema. Il formato descrive direttamente
l'algebra dei tipi dopo le sostituzioni: Number, Text, Boolean
({kind}), List ({kind,item}), Function ({kind,parameters,result}),
Record ({kind,fields:[{name,type}],tail}) e Variable
({kind,id,scalarEq,row,lacks}). La coda null indica record chiuso.
I campi e i vincoli lacks sono ordinati per nome; gli id delle
variabili sono numerati in ordine di visita e locali a uno schema.
row distingue una variabile di riga da una variabile ordinaria.
Non si interpreta la stringa di pretty printing.

Il bridge espone specialize(source, selector, argsJson, hostJson?,
modulesJson?): inferisce il programma, istanzia la funzione
e unifica i tipi degli argomenti forniti (formato chiuso del
manifest host). Restituisce name, type, schema per la firma
specializzata; non esegue il programma. Il type checker non
promette che il risultato sia chiuso: una lista vuota non
vincolata, ad esempio, conserva una variabile libera.

Il generatore RPC usa specialize sulle funzioni Mira esposte,
con i campi Number derivati dall'attuale policy integer.
Verifica la compatibilità del contratto con la funzione reale e
rifiuta firme di rete non concrete, funzioni, record aperti o
vuoti e chiavi numeriche. Produce rpc-types.json nella directory
private del bundle: version 1, methods, parameters, result,
integerPolicy. Le capability host restano fuori da questo export.
I vincoli min/max e interi restano una policy di confine distinta
da Number. Il runtime PHP non cambia: continua a controllare
gli interi con i limiti dichiarati; non valida ancora il risultato
rispetto allo schema inferito. La metadata non è ancora consumata
dal client. Non si elimina services.mira in questa versione:
la scelta dei servizi esposti rimane esplicita.
Il laboratorio permette di visualizzare gli schemi JSON.

## 0.46: validazione runtime RPC

Il generatore usa gli stessi schemi della 0.45 per produrre
MiraRpcTypes nel binding JavaScript e inserire i contratti nelle
closure PHP generate. I validatori sono due piccoli interpreti
dello schema, uno per runtime; nessuna duplicazione manuale
della firma e nessun secondo checker statico. Il contratto JSON
privato resta disponibile per tooling e documentazione.

Il client verifica la portabilità del payload, il tipo chiuso
e la policy integer prima della fetch. Dopo la risposta verifica
la portabilità e il tipo del risultato prima di consegnarlo
all'applicazione. L'adattatore PHP invokeTyped conserva prima
checkParams per gli errori 400 già pubblicati, verifica lo schema,
chiama l'handler e verifica il risultato. Un risultato incompatibile
provoca un errore interno (HTTP 500, internal_error), non un 400
e non una risposta di successo. Nessuna coercizione.

I tipi ammessi sono Number finito (interi sicuri), Text, Boolean,
liste e record chiusi non vuoti. Il controllo dei record richiede
esattamente i campi dichiarati; i campi extra sono rifiutati.
Corretto anche il controllo a build time delle chiavi numeriche.
La policy integer rimane distinta: PHP continua a richiedere
is_int, mentre JS usa Number.isSafeInteger; JSON.stringify
serializza un numero JS intero senza suffisso decimale.
Una richiesta esterna con 2.0 può quindi essere rifiutata da PHP.

Le capability host come ledger.command restano non tipizzate
da questo generatore e conservano la validazione applicativa.
I contratti generati sono metadata fidate di build, non input
di rete. Nessuna garanzia di autenticazione, autorizzazione,
version negotiation, assenza di overflow o correttezza totale
del programma. I controlli riguardano il confine RPC, non ogni
operazione Mira. services.mira conserva la scelta esplicita
dei servizi e la policy numerica. Test negativi sui due runtime,
payload non inviati, risultati malformati e integrazione reale.

## 0.47: annotazioni esplicite

Dall'esperienza di Nail 0.61: un'annotazione deve vincolare la
firma prima dell'inferenza, non scegliere un tipo dopo l'analisi.
In Mira la grammatica è nome (Tipo) per parametri e valori
globali, e -> Tipo prima di = per il risultato di una funzione.
La stessa regola vale per nomi composti; il parser condivide
annotatedName fra i due contesti. La precedente proposta
(parametro: Tipo) e nome -> Tipo per valori è stata scartata
prima del merge: non si mantengono due sintassi.

```mira
rate (Number) = 30;
quote: p ({hours: Number}) -> {total: Number} =
  {total: (p ~ hours * rate)};
empty ([Text]) = [];
multiply: first number (Number), by: second number (Number)
  -> Number = first number * second number;
```

Sono ammessi Number, Text, Boolean, [Tipo] e {campo: Tipo, ...},
anche annidati. I campi possono essere multiword o stringhe.
I record annotati sono strutturali chiusi, non nominali.
Parametri e risultati non annotati restano inferiti.
Le annotazioni diventano direttamente Type; le firme provvisorie
delle componenti ricorsive usano questi tipi, e il corpo viene
unificato con il risultato dichiarato. Non si introducono cast,
coercizioni o validatori impliciti. Il parser condivide il lexer
e distingue i separatori di selettore dai delimitatori annidati.

Il checker resta opt-in (--check, --check-json, Studio).
La compilazione ordinaria verifica la grammatica delle annotazioni
ma non la loro correttezza semantica; le cancella nell'emissione.
I test confrontano l'output JS/PHP annotato e non annotato byte
per byte ed eseguono entrambi i target. L'AST inspector continua
a mostrare i nomi dei parametri e il corpo; lo schema del checker
mostra la firma risultante.

Decisione provvisoria: niente nuovi tipi nominali, unioni, alias,
annotazioni locali, tipi funzione espliciti, righe aperte esplicite
o refinements in questa fase. Prima di introdurre interi positivi,
intervalli, testi non vuoti e invarianti, va distinta la parte
provabile staticamente da quella che richiede controlli runtime.
I contratti RPC della 0.46 conservano la policy integer separata.

## 0.48: annotazioni locali

La grammatica nome (Tipo) della 0.47 vale anche per i parametri
dei blocchi e per le dichiarazioni locali immutabili:

```mira
result = 2 >> {hours (Number) |
  rate (Number) = 30;
  hours * rate
};
names = () >> {|
  students ([Text]) = [];
  students
};
```

Il parser riutilizza annotatedName; il lookahead bindingEnd
riconosce il suffisso solo in un contesto di binding (prima
di =, oppure di , o | nell'intestazione del blocco).
Una normale chiamata f (1 + 2) rimane una chiamata. Il controllo
dei riferimenti in avanti riconosce anche i locali annotati.
Scoping, immutabilità, collisioni dei nomi e restriction sui
valori locali non annotati rimangono invariati.

I tipi chiusi dei parametri inizializzano direttamente i tipi
del blocco. Una dichiarazione locale annotata viene unificata
con il tipo dell'inizializzatore prima di introdurre il binding;
la diagnostica in caso di incompatibilità punta al token del
tipo. La firma chiusa non introduce variabili generalizzabili.
Le annotazioni non modificano Expr: quando il checker è attivo
ExpressionOrigins conserva una mappa di identità aggiuntiva
solo per le espressioni annotate. La normale transpilazione
convalida la sintassi ma non alloca questa mappa e cancella
le annotazioni. Nessuna modifica agli emitter JS/PHP.

Test di blocchi misti, tipi annidati, closure, collezioni,
errori di scope, chiamate con parentesi ed equivalenza byte
per byte del codice emesso. Restano fuori le annotazioni
esplicite dei risultati dei blocchi, tipi funzione e refinements.
Il controllo resta opt-in come nella 0.47.

## 0.49: tipi nominali

```mira
Identifier :: Number;
Student Id :: Identifier;
Request Id :: Identifier;
student (Student Id) = 42;
request (Request Id) = 7;
read student: id (Student Id) = id;
result = read student: student;
```

Ogni dichiarazione :: introduce un'identità nominale distinta
anche con identica rappresentazione. I nomi sono multiword.
Il namespace dei tipi è separato da quello dei valori ed è
condiviso dai moduli importati (come le dichiarazioni globali).
Le dichiarazioni di tipo devono precedere il loro uso nelle
intestazioni globali e nelle altre dichiarazioni di tipo.
I tipi ricorsivi, riferimenti in avanti nelle intestazioni,
duplicati e ridefinizioni di Number/Text/Boolean non sono ammessi.
I blocchi vengono risolti dopo la raccolta delle dichiarazioni.

Type.NamedType(name,base) contiene solo tipi chiusi. L'unificazione
rimane simmetrica e i tipi nominali unificano solo con se stessi.
La relazione direzionale accept consente il passaggio al tipo
di base e ai suoi antenati, non a un fratello né al figlio.
Le annotazioni esplicite di valori, locali e risultati sono
punti di costruzione nominale: un valore della rappresentazione
può acquisire il nome dichiarato; un antenato può essere ristretto
esplicitamente; un fratello non viene automaticamente rietichettato.
Una chiamata non introduce implicitamente una nuova identità.
Le annotazioni dei parametri esprimono requisiti, non costruzioni.

I tipi di campi nominali di un record devono già essere conformi:
non si costruiscono ricorsivamente nuove identità nei campi.
La proiezione di campo usa la rappresentazione esterna, conservando
i tipi dei campi. Gli operatori numerici accettano sottotipi di
Number e restituiscono Number (o Boolean per confronti); l'uguaglianza
rimane rigorosa rispetto all'identità nominale.
La compatibilità direzionale riguarda i confini espliciti e le
chiamate dirette; le callback e l'unificazione di record/liste
in altre operazioni restano conservative. L'aggiornamento di un
record nominale non è ancora supportato dal checker.
Gli schemi esportati usano {kind:"Named",name,base}.
I contratti RPC e manifest host non importano ancora nomi nominali;
il generatore RPC continua a rifiutare questo nuovo tipo.
Le dichiarazioni :: non sono valori e non entrano nell'AST eseguibile.
Non ci sono wrapper JS/PHP e il controllo statico rimane opt-in.

La proiezione strutturale ~ Tipo e i predicati where sono rinviati
a incrementi distinti. Per ~ si intende conservare i campi nominali
interni e i futuri vincoli, ammettendo campi extra; non cancellare
ricorsivamente tutte le identità. Nessun controllo runtime dei
refinements è ancora implementato.

## 0.50: proiezione strutturale

```mira
Size :: {width: Number, height: Number};
Window :: {width: Number, height: Number, title: Text};
window (Window) = {width: 12, height: 10, title: "Mira"};
area of: size (~ Size) = size ~ width * size ~ height;
result = area of: window;
```

~ Tipo richiede una dichiarazione nominale la cui rappresentazione
finale è un record chiuso. La proiezione ignora il nome esterno,
ammette campi extra e verifica la compatibilità direzionale di
ciascun campo richiesto. Un campo Student Id non è soddisfatto
da Request Id né da Number. L'eventuale sottotipo nominale del
campo è invece ammesso. Un campo record chiuso conserva i suoi
requisiti esatti: non si applica ~ ricorsivamente.

StructuralType(name,fields) rappresenta un requisito aperto con
campi noti, non un record chiuso né una variabile di riga
generalizzabile. Il nome serve al rendering e allo schema.
L'unificazione tra due proiezioni richiede la stessa struttura;
acceptShape implementa la compatibilità direzionale più ampia.
Il corpo può leggere soltanto i campi dichiarati, anche se il
valore effettivo ne possiede altri. Nessuna copia o rimozione
dei campi a runtime; le annotazioni sono cancellate come prima.
Il report JSON usa kind Structural, name, fields e open true.

La proiezione è ammessa come annotazione intera di parametri,
valori e risultati, anche nei blocchi e locali. Non ancora
come tipo di base di una nuova dichiarazione :: o dentro altri
tipi. Non si assume la presenza di campi ignoti in una riga
aperta. L'unificazione con record inferiti, aggiornamenti,
callback e altre operazioni rimane conservativa: una vista
non può essere spacciata per un record chiuso. Gli schemi
aperti non sono contratti RPC validi. Nessun cambiamento al
runtime JS/PHP. I predicati where e la loro conservazione
saranno il prossimo incremento, non sono ancora implementati.

## 0.51: refinement numerici

```mira
Percentage :: Number where _ >= 0 AND _ <= 100;
Small Percentage :: Percentage where _ <= 10;
volume (Percentage) = 80;
small volume (Small Percentage) = 5;
```

Il primo sottoinsieme di predicati usa confronti fra _ (lo
stesso valore in ogni confronto) e costanti numeriche decimali:
>, >=, <, <=, ==, combinati con AND. Il parser riconosce questo
sottoinsieme direttamente, senza eseguire codice arbitrario.
Sono ammessi solo tipi con rappresentazione numerica. I limiti
sono finiti e nel range degli interi sicuri JS; intervalli
contraddittori anche rispetto alla base sono rifiutati.
where è riservato nella sintassi dei tipi. Sono ammessi anche
refinement anonimi come annotazione intera, non ancora nei campi
dei record o nelle liste. Integer e predicati generali, != e OR
nei refinement sono rinviati.

Nelle espressioni ordinarie AND, OR e NOT sono parole riservate
case-sensitive. AND e OR sono short-circuit e si traducono nei
corrispondenti operatori nativi JS/PHP; NOT si abbassa a Conditional.
Precedenza: operazioni preesistenti > NOT > AND > OR.
Le precedenze di aritmetica, confronto e pipeline rimangono quelle
della 0.50 in questo incremento. Non sono ancora configurabili.
Gli operatori binari aritmetici, di confronto e logici sono valori
funzione tra parentesi, ad esempio (+), (AND), (OR); (NOT) è un
blocco unario. I valori funzione hanno argomenti valutati prima
della chiamata, diversamente dall'infisso short-circuit.
& e && non sono sintassi di congiunzione. Nessun dispatch dinamico.

RefinedType(base,range) conserva la base (inclusa eventuale
identità nominale). NumericRange normalizza le congiunzioni
in intervalli aperti/chiusi e calcola intersezione e implicazione.
Le costruzioni esplicite accettano un letterale decimale conforme
oppure un tipo già provato che implica il vincolo. Un letterale
incompatibile produce un errore di violazione; un'espressione
non dimostrata viene rifiutata. In particolare anche 50 + 10
non è ancora valutato staticamente. Non vengono generate guardie
runtime in questa versione. La compatibilità ai confini non
crea implicitamente identità nominali. Lo schema JSON Refined
contiene base e range con estremi null quando illimitati.
Il checker resta opt-in: la transpilazione ordinaria senza
checker non garantisce i vincoli, esattamente come per gli altri
tipi. Nessun validatore RPC/host o runtime ancora generato.
La proiezione strutturale rimane limitata ai record; i vincoli
numerici nei tipi nominali dei campi non sono rimossi.

Passi successivi: analisi delle espressioni e propagazione
degli intervalli (rispettando la semantica JS/PHP), predicati
più generali, poi guardie runtime e validazione fallibile.

## 0.52: prove aritmetiche

```mira
Percentage :: Number where _ >= 0 AND _ <= 100;
half of: p (Percentage) -> Percentage = p / 2;
complement of: p (Percentage) -> Percentage = 100 - p;
volume (Percentage) = 50 + 30;
result = half of: volume;
```

Il checker conserva fatti numerici per espressione in una ObjectMap
privata, senza introdurre varianti nella rappresentazione Type o
modificare le firme inferite dei valori Number ordinari. I letterali
hanno intervalli puntuali; le espressioni di tipo raffinato possono
fornire i loro limiti. +, -, *, / calcolano i limiti dai quattro
angoli degli intervalli finiti. Gli estremi dei risultati sono chiusi
anche quando quelli degli operandi sono aperti: l'arrotondamento
floating point potrebbe raggiungere un estremo. Non si analizzano
divisori che includono o sfiorano zero, risultati fuori dalla
magnitudine degli interi sicuri JS, né modulo o intervalli illimitati.
Il calcolo dei limiti non esegue codice host.

Un fatto interamente contenuto nel vincolo prova la costruzione;
un intervallo disgiunto prova una violazione; sovrapposizione parziale
o assenza di fatti significa non dimostrato e viene rifiutata.
Le espressioni non annotate mantengono il normale tipo Number:
non si propagano automaticamente fatti attraverso variabili non
annotate o ritorni di funzioni non annotati. Non c'è ancora narrowing
dei rami, analisi di correlazioni (p - p), Integer, predicati
generali o guardie runtime. Il checker resta opt-in. I contratti
dichiarati presuppongono un ambiente host conforme.
Nessun cambiamento al codice generato: test confrontano byte per byte
JS e PHP con la versione priva di annotazioni, ed eseguono i risultati.

### Vincolo al confine, non a ogni operazione

```mira
Percentage :: Number where _ >= 0 AND _ <= 100;
average of: a (Percentage), and: b (Percentage)
  -> Percentage = (a + b) / 2;
```

| Espressione | Tipo | Intervallo dedotto |
| --- | --- | --- |
| a, b | Percentage | [0, 100] |
| a + b | Number | [0, 200] |
| (a + b) / 2 | Number | [0, 100] |
| risultato annotato | Percentage | [0, 100] |

La somma può superare 100; non è un errore, perché è Number.
Il vincolo è richiesto soltanto dal risultato annotato.
L'analisi conserva i fatti intermedi senza trasformarli in tipi
nominali. La costruzione finale è dimostrata staticamente.
Si veda anche il [quaderno di progettazione](design-notes.md).

## 0.53: Integer portabile

```mira
Request Id :: Integer where _ > 0;
Retry Count :: Integer where _ >= 0 AND _ <= 3;
retry (Retry Count) = 2;
next retry: r (Retry Count) -> Integer = r + 1;
result = next retry: retry;
```

Integer rappresenta un valore matematicamente intero nel dominio
comune JS/PHP da -9007199254740991 a 9007199254740991.
È accettato direzionalmente dove è richiesto Number, non viceversa.
Non è il tipo nativo int di PHP; un valore numerico come 3.0 può
soddisfare Integer. L'uguaglianza stretta conserva per ora le regole
precedenti, incluso il limite noto della distinzione int/float in PHP.
Il checker resta opt-in e non vengono ancora generate guardie.

Le espressioni numeriche ordinarie mantengono Number, anche per
letterali interi: una costruzione esplicitamente annotata Integer
usa fatti separati di integrità e intervallo. Non si cambia il tipo
inferito di tutti i programmi esistenti. Le chiamate con parametro
Integer richiedono un valore già tipizzato Integer o un suo
sottotipo; non si esegue ancora la costruzione implicita da letterali.

+ - * conservano l'integrità di operandi interi quando la prova
aritmetica resta nella magnitudine sicura. / è provata solo nei
casi puntuali con risultato intero o divisore unitario in valore
assoluto. Non si deduce divisibilità generale, e non si promuove
automaticamente un risultato Number a Integer. Il checker restringe
i limiti dei tipi interi alla griglia discreta, ad esempio 0 < x < 4
diventa [1,3], e rifiuta tipi vuoti come 0 < x < 1.

Il tipo nominale Request Id resta distinto da Retry Count. Non
si cambia il runtime, e si confronta l'emissione JS/PHP con
l'equivalente non annotato. Codec host/RPC, guardie runtime, narrowing
e propagazione dei fatti attraverso nomi non annotati restano futuri.

## 0.54: narrowing numerico

```mira
Percentage :: Number where _ >= 0 AND _ <= 100;
normalize percentage: x (Number) -> Percentage =
  if (x >= 0 AND x <= 100) then x else 0;
```

Una condizione fornisce fatti numerici lessicali ai rami.
Si riconoscono confronti ordinati fra un nome locale/parametro
e un letterale decimale portabile, anche in ordine inverso.
Nel ramo vero di AND e nel ramo falso di OR si accumulano
le informazioni di entrambi gli operandi; NOT, che si abbassa
a una condizionale booleana, scambia i rami. Il complemento
di un confronto è usato soltanto quando il valore ha già
limiti finiti portabili: con NaN, ad esempio, NOT (x < 0)
non implica x >= 0. Un Number senza limiti può essere
ristretto nel ramo vero di due confronti, ma un solo estremo
non prova la finitezza (potrebbe includere infinito).

Le informazioni sono conservate in copie degli schemi
lessicali dei rami, non modificano il tipo nominale né
fuoriescono dal ramo; un nome ombreggiato non eredita
i fatti del nome esterno. Alla ricongiunzione dei rami si
usa l'inviluppo chiuso dei due intervalli, quando entrambi
sono noti, e si conserva l'integrità se entrambi la provano.
La condizionale continua a richiedere tipi di ramo unificabili.
Non si introduce il tipo bottom per rami impossibili.

Il narrowing riguarda per ora soltanto i fatti numerici, non
i tipi nominali in generale. Non comprende ancora l'analisi
del secondo operando short-circuit, unioni disgiuntive di
intervalli, confronti fra due variabili, campi dei record,
uguaglianza (differenze JS/PHP), o guardie runtime. Nessuna
modifica agli emitter: la condizione originale è sufficiente,
quando dimostra la costruzione del risultato. I test verificano
l'identità byte per byte di JS/PHP con e senza annotazioni.

## 0.55: esiti delle prove numeriche

NumericProof distingue Proven, Violated e Unknown. Un intervallo
contenuto nel vincolo è una prova, un intervallo disgiunto è una
violazione, altrimenti manca una dimostrazione. Per Integer si
distingue anche un intervallo senza interi dal dominio superato.

```mira
good (Integer) = 9007199254740990 + 1;
bad (Integer) = 9007199254740991 + 1;
increment: x (Integer) -> Integer = x + 1;
```

good è dimostrato; bad supera certamente il dominio portabile;
increment potrebbe superarlo. In questa versione entrambi i casi
negativi sono rifiutati dal checker, ma con diagnostica distinta.
I campi JSON proof (violated/unknown) e reason (integer_overflow,
integer_fractional, integer_unproven, refinement_disjoint,
refinement_unproven) si aggiungono al codice type_error esistente.

Le osservazioni oltre la magnitudine sicura ottenute da letterali
finiti o da una singola operazione su operandi portabili sono
usate solo per diagnosticare violazioni certe. Non partecipano
alle successive prove: non si assume che un risultato nuovamente
nel dominio dopo un intermedio non portabile sia esatto. I fatti
sui valori Number non sono nuovi vincoli intermedi. La divisione
per zero, i risultati non finiti e l'analisi incompleta rimangono
casi non dimostrati. L'aritmetica non annotata resta nativa.

Nessuna guardia a runtime e nessuna modifica agli emitter.
La futura compilazione con guardie deve distinguere l'obbligo
dinamico da un errore statico, valutare una sola volta il valore
e non assumere equivalenza dopo perdita di precisione. Un controllo
del solo risultato non garantisce esattezza dopo un intermedio
non portabile. Validazione fallibile e gestione degli errori
di esecuzione rimangono da progettare.

## 0.56: guardie numeriche

```mira
Percentage :: Number where _ >= 0 AND _ <= 100;
bounded value: x (Number) -> Percentage = x;
increment checked: x (Integer) -> Integer = x + 1;
half of: p (Percentage) -> Percentage = p / 2;
```

La compilazione controllata è distinta dal controllo strettamente
statico e dalla transpilazione ordinaria.

```sh
node dist/mira.cjs example.mira js --checked
node dist/mira.cjs example.mira php --checked
```

Compiler.transpileChecked riutilizza lo stesso AST tra checker
ed emitter, con una ObjectMap di obblighi NumericGuard per identità
dell'espressione. Il flag --locations funziona anche con --checked.
L'API Studio compile accetta checked come sesto argomento Boolean
(default false); il Type Lab offre due pulsanti per osservare
l'emissione JS e PHP senza eseguire il codice.

Proven: nessuna guardia, emissione identica alla transpilazione
ordinaria. Violated: errore di compilazione. Unknown: guardia
solo alle costruzioni esplicite supportate, altrimenti ancora errore.
Non si introducono nuove conversioni implicite negli argomenti.

Le guardie sono funzioni native inline che ricevono il valore una
volta sola, verificano tipo numerico e finitezza; Integer richiede
anche dominio sicuro e parte frazionaria nulla. I limiti ereditati
ancora da dimostrare si fondono nello stesso controllo. Una
violazione lancia Error in JS e RuntimeException in PHP. Il valore
originale viene restituito, senza wrapper. Nessuna libreria runtime
aggiuntiva o tabella di tipi. Le condizioni già provate non
richiedono una seconda verifica.

Per questo primo incremento si ammettono valori (nomi, riferimenti
host, campi, risultati di chiamata/applicazione) e singole
operazioni su operandi di cui è nota la portabilità. Per Integer,
le operazioni non dimostrate sono limitate a + - * su operandi
di integrità provata. Una divisione di integrità incerta,
una divisione con possibile zero o un intermedio non portabile
non sono automaticamente accettati. Le guardie sui valori Number
validano il valore effettivo, non dimostrano l'esattezza della
sua storia di calcolo. Non si promette aritmetica esatta oltre
i limiti JS, né uniformità generale della semantica Number.

Le premesse delle firme di parametri/host già tipizzate sono
fidate: non si validano automaticamente le chiamate provenienti
da codice esterno. Nessuna convalida generale di record/list,
guardia fallibile Result, o inserimento di verifiche implicite
ai confini RPC/DB. Il normale --check conserva il comportamento
strettamente statico. La modalità checked resta sperimentale.

## 0.57: validazione fallibile

```mira
Percentage :: Number where _ >= 0 AND _ <= 100;
display percent: p (Percentage) = p + 0;

read percent: input =
  validate: (input), as: (Percentage),
    then: {p | display percent: p},
    else: {error | 0};

result = read percent: 120;
```

La forma esplicita validate:as:then:else: valuta l'input una volta,
verifica tipo numerico, finitezza, integrità e limiti applicabili
e invoca soltanto il blocco pertinente. Il valore non viene
convertito: la stringa "42" non è un Number. Il fallimento del
predicato non genera eccezioni. Il blocco then riceve un valore
del tipo richiesto, inclusa l'identità nominale; else riceve un
Text con un messaggio generico. I due risultati devono unificarsi.
Il tipo del parametro dei blocchi è assegnato dal checker, non
va annotato. I blocchi devono avere un solo parametro.

Sono obbligatorie le parentesi intorno all'input e al tipo, i
due punti e le virgole; il primo label validate è riservato.
Il tipo è risolto staticamente, non un valore o un nome host.
Sono supportati Number (finito), Integer e i relativi sottotipi
e refinement numerici. Il checker accetta anche input non
numerici, che possono fallire normalmente; non permette il
rebranding diretto fra identità nominali estranee.

Il nodo Validate contiene il tipo già risolto e due Block;
il checker verifica entrambi i rami e ne inferisce il risultato.
L'emitter riutilizza il predicato delle guardie 0.56 e seleziona
la funzione con una condizionale nativa, senza runtime condiviso,
senza catturare eccezioni e senza introdurre un tipo Result.
Le callback possono catturare lo scope lessicale. La validazione
è una operazione esplicita e viene emessa anche nella transpilazione
ordinaria; le garanzie di tipo dei rami richiedono il checker.
Non si elimina ancora il predicato quando il valore è provato.
Gli errori durante il calcolo dell'input o nei blocchi non sono
intercettati: solo il fallimento della validazione è previsto.

Questa forma è un primo eliminatore con due continuazioni, non
un valore Result di prima classe. Tipi somma, pattern matching,
errori strutturati, accumulo di errori, parsing di testo, validazione
ricorsiva di record e confini RPC/persistenza sono futuri.
Il Type Lab include un esempio; la suite verifica JS/PHP, input
singolo, lazy handlers, identità nominale e diagnostica.


## 0.58: tipi somma nominali

```mira
Session :: {user: Text};
Connection :: Disconnected | Connecting | Connected (Session) | Failed (Text);
session (Session) = {user: "Ada"};
initial = Disconnected;
active connection = Connected: session;
failure = Failed: "Timeout";
states = [initial, active connection, failure];
```

Il checker distingue nominalmente Connection dagli altri
tipi somma. Tutti i costruttori restituiscono Connection;
Connected: richiede Session, Failed: richiede Text.
Una variante senza payload è un valore globale; una con
payload è un selettore unario. Il separatore | a livello
zero distingue la somma dalla dichiarazione nominale
ordinaria. Per una somma con una sola alternativa usare
una barra iniziale (Only :: | Single;). Le alternative
iniziano con una lettera maiuscola, sono uniche e possono
avere nomi discorsivi. Le annotazioni dei payload si
riferiscono a tipi già dichiarati.

DefinitionParser sintetizza Definition con body Variant;
Compiler.parse non riparsa questi body. Si riutilizzano
il resolver, le annotazioni dei parametri e il checker
ordinario. I costruttori sono soggetti alle collisioni
ordinarie di valori e selettori, senza qualificazione.
Lo schema strutturato usa kind Sum, name e alternatives
ordinate per tag, con payload null per le alternative
senza dati.

JavaScript usa oggetti e PHP array associativi con tag
e, per le varianti con dati, value. Non si espongono i
campi della rappresentazione al type checker; un record
con la stessa forma non è un valore del tipo somma.
Le garanzie valgono nei programmi controllati, non per
dati host arbitrari. Nessuna libreria runtime aggiuntiva.
I costruttori sono emessi anche se inutilizzati, senza
ottimizzazioni in questa versione. Il formato non è un
contratto RPC o persistente stabile.

Non sono ancora supportati match, generici, tipi somma
ricorsivi, pattern annidati o payload multipli (usare
un record come singolo payload). Il Type Lab mostra i
tipi e lo schema; i test verificano l'identità nominale,
i costruttori, il rifiuto di record falsificati e la
rappresentazione JS/PHP. Il quaderno registra la regola
grammaticale concordata per il futuro match.


## 0.59: match esaustivo

```mira
Connection :: Disconnected | Connecting | Connected (Text) | Failed (Text);
connection = Connected: "Ada";
result = match: connection {
  disconnected: {| "offline"},
  connecting: {| "waiting"},
  connected: {name | name},
  failed: {error | error}
};
```

Match è un costrutto contestuale, non un nuovo selettore
riservato. Una graffa a livello zero dopo uno scrutinee
non vuoto apre le alternative; una virgola a livello zero
interrompe la ricerca. Una graffa racchiusa in parentesi
resta parte dell'argomento ordinario. Per esempio:

```mira
match: x = x;
match: x, with: y = y;
ordinary = match: 42;
other = match: 42, with: 7;
```

Le chiamate ordinarie restano valide. Uno scrutinee
complesso può essere parentetizzato. Le alternative sono
separate da virgole, etichettate con la prima lettera
minuscola del costruttore (Connected → connected), e
hanno come corpo un blocco normale di zero o un parametro.
Non sono ammesse annotazioni dei parametri dei blocchi:
il checker assegna il tipo del payload. I duplicati sono
rifiutati dal parser; il checker richiede un tipo somma
noto, esattamente tutte le alternative, arità corretta e
risultati unificabili. La verifica di esaustività richiede
--check oppure --checked, come gli altri controlli di tipo.

L'AST Match mantiene scrutinee, tag e blocchi. Gli emitter
generano una funzione nativa inline che riceve il valore
una volta e confronta il discriminante con uguaglianza
stretta, invocando soltanto il ramo selezionato. I blocchi
sono creati come closure; non sono ancora eliminati tramite
inlining. Nessun registro o libreria runtime. Un valore
host falsificato non è validato dal match: le premesse dei
tipi restano fidate. Un discriminante non riconosciuto
produce un'eccezione. La rappresentazione tag/value non
costituisce un contratto wire.

Non sono ancora supportati wildcard, pattern annidati,
guardie dei pattern, inferenza del tipo somma dalle sole
etichette, generici o ricorsione. Type Lab mostra un esempio
ed espone l'AST. I test verificano esaustività, shadowing
dei selettori ordinari, payload, tipi dei risultati,
singola valutazione dello scrutinee e selezione del ramo
su JS/PHP.

Il nome match è riservato da PHP 8, non da Mira: il mangler
traduce il selettore unario match: (anche nelle varianti
maiuscole/minuscole) in un identificatore prefissato, uguale
nei due target. La risoluzione delle collisioni generate resta
quella ordinaria. Il test esegue insieme selettori utente
e costrutto algebrico su entrambi i target. Il problema più
generale delle collisioni con nomi nativi rimane distinto.


## 0.60: tipi somma parametrici

```mira
Result (T, E) :: Ok (T) | Err (E);
Option (T) :: Some (T) | None;

a (Result (Number, Text)) = Ok: 42;
b (Result (Text, Number)) = Ok: "Mira";
empty (Option (Number)) = None;
present = Some: 7;

result = match: a {
  ok: {n | n},
  err: {error | 0}
};
```

I parametri di tipo sono identificatori, locali alla
dichiarazione, distinti fra loro e dai tipi già noti.
Dalla 0.60.1 possono contenere più parole, con la stessa
sintassi degli altri nomi (vedi sotto).
Le applicazioni esplicite richiedono tutti gli argomenti
di tipo: Result (Number, Text), Option (Number).
Sono ammesse applicazioni annidate a somme dichiarate prima,
anche nei payload di record e liste. Le somme con parametri
diversi sono nominalmente lo stesso costruttore di tipo,
ma le istanze sono invarianti negli argomenti.

I costruttori sono polimorfici: Some: 7 inferisce
Option (Number), mentre Ok: 42 inferisce Result (Number, 'a),
con il tipo di errore ancora libero; None può essere
usato in istanze diverse. Le annotazioni o il contesto
vincolano i parametri liberi. La dichiarazione di un
costruttore non lega le variabili di altre istanze.
Il match richiede ancora un tipo somma noto; il payload
del ramo riceve il tipo concreto o inferito dell'istanza.

TypeParser effettua una sostituzione pura degli slot di
template (id negativi locali, distinti dagli id di inferenza).
TypeChecker istanzia i costruttori con variabili fresche
e riutilizza unificazione, occurs check, free variables
e generalizzazione esistenti. Lo schema JSON Sum conserva
alternatives e aggiunge arguments per i tipi parametrici.
Nessuna informazione dei parametri di tipo viene emessa
a runtime: resta la rappresentazione tag/value della 0.58.
Non occorre un costruttore JS/PHP diverso per ogni istanza.

La sintassi Result/Option è un esempio definito nel
programma, non una nuova libreria implicita. Per ora i
costruttori condividono il namespace ordinario, e si
usano Ok/Err per evitare una collisione con Error di JS.
Non sono ancora disponibili annotazioni di funzioni
con parametri di tipo dichiarati esplicitamente, alias
generici, somme ricorsive, qualificazione dei costruttori
o conversioni automatiche da validate a Result. Il
Type Lab include un esempio interattivo. Test positivi
e negativi coprono istanze indipendenti, arità, inferenza,
payload annidati, identità nominali, match e output
JS/PHP; integrare soltanto dopo CI verde.


## 0.60.1: parametri di tipo discorsivi

```mira
Result (Success Type, Failure Type) ::
  Ok (Success Type) | Err (Failure Type);
Option (element type) :: Some (element type) | None;
```

I nomi dei parametri seguono la grammatica ordinaria degli
identificatori: una o più parole, separate da spazi; la virgola
separa i parametri. Non è richiesta una convenzione tipografica.
Il nome completo è locale alla dichiarazione, case-sensitive e
non può duplicare un parametro o un tipo noto. La parola where
è esclusa perché delimita i refinement nelle annotazioni.
Il parser riutilizza readWords e TypeParser già riconosce
nomi composti; rappresentazione, inferenza ed emissione sono
invariate. I nomi dei parametri sono eliminati a compile time.
Il Type Lab usa un esempio discorsivo; i nomi brevi restano validi.


## 0.60.2: protezione dei nomi host

Il mangler protegge le keyword JavaScript, gli identificatori
nativi utilizzati dagli emitter e un insieme esplicito di
nomi comuni PHP. Esempio:

```mira
Result (Success Type, Failure Type) ::
  Ok (Success Type) | Error (Failure Type);
failure (Result (Number, Text)) = Error: "timeout";
```

Il costruttore Error conserva il tag originale e viene emesso
come __miraEsc_Error. Anche i nomi sorgente che iniziano con
__mira vengono escapati, salvo il sentinel riservato __miraHost;
match conserva la mappatura della 0.59. I nomi host espliciti
restano chiavi originali del registro di capability. Nessuna
modifica alla grammatica, al checker o alla rappresentazione,
nessun costo runtime. Err rimane la convenzione degli esempi.
La protezione non costituisce un namespace PHP completo:
estensioni PHP arbitrarie, simboli dell'applicazione ospite e
collisioni fra selettori che differiscono solo per maiuscole
restano temi separati. Le normali collisioni di mangling
continuano a essere diagnosticate.


## 0.61: funzioni parametriche esplicite

```mira
identity (Value Type): x (Value Type) -> Value Type = x;
singleton (Element Type): x (Element Type) -> [Element Type] = [x];
a = identity: 42;
b = identity: "Ada";
```

La lista di parametri di tipo, separati da virgole e anche
composti da più parole, segue la prima etichetta del selettore.
Non fa parte dell'identità del selettore e non compare nella
chiamata. Tutti i parametri valore e il risultato devono avere
un'annotazione in una funzione esplicitamente generica.
Il checker usa variabili rigide nel corpo, per verificare che
la funzione sia valida per qualsiasi tipo scelto dal chiamante;
una nuova istanza flessibile della firma è creata a ogni uso.
Non è lecito imporre aritmetica, uguaglianza scalare o una forma
record non dichiarata a un parametro di tipo arbitrario.
Liste, record e somme parametriche sono ammesse nella firma.
Nessun codice dei parametri di tipo viene emesso; il test
confronta l'output con la variante a inferenza implicita.
In questa iterazione non sono ammessi gruppi ricorsivi con
funzioni esplicitamente generiche, annotazioni dei parametri
di tipo nel corpo, argomenti di tipo espliciti nelle chiamate,
o vincoli sui parametri. L'inferenza ordinaria resta invariata.


## 0.62: validazione con Result

```mira
Result (Value Type, Failure Type) :: Ok (Value Type) | Err (Failure Type);
Percentage :: Number where _ >= 0 AND _ <= 100;
validation = validate: (42), as: (Percentage);
result = match: validation {
  ok: {p | p + 0},
  err: {message | 0}
};
```

La forma breve validate:as: restituisce Result (Percentage, Text)
nel caso illustrato. Richiede una dichiarazione esplicita di Result
con due parametri e precisamente Ok con il primo payload ed Err
con il secondo, indipendentemente dai nomi dei parametri. Non
introduce un tipo implicito o una prelude. La forma con then:else:
resta disponibile senza Result. I due modi condividono la verifica
numerica finita, i refinement, Integer e il divieto di rebranding
nominale tra tipi estranei nei programmi controllati.
Il nuovo nodo ValidateResult conserva il tipo richiesto e la somma
concreta; l'emitter produce una sola funzione inline che valuta
l'input una volta e seleziona un solo record tag/value nativo.
Non genera chiamate ai costruttori o closure per i due rami.
Non intercetta eccezioni durante il calcolo dell'input. Err contiene
il messaggio Text già usato dalla forma lunga. Record, liste,
errori strutturati e validazione ricorsiva restano futuri.


## 0.63: record e liste nominali parametrici

```mira
Pair (First Type, Second Type) :: {
  first: First Type,
  second: Second Type
};
Bag (Element Type) :: [Element Type];

make pair (A, B): x (A), with: y (B) -> Pair (A, B) =
  {first: x, second: y};
a = make pair: 42, with: "Ada";
b (Bag (Number)) = [1, 2];
result = a ~ first;
```

Una dichiarazione parametrica non somma richiede in questa
iterazione una rappresentazione record chiusa o lista.
I parametri possono essere discorsivi e sono locali alla
dichiarazione. Sono ammesse applicazioni annidate di tipi
già dichiarati. Le istanze nominali sono invarianti negli
argomenti. Una costruzione annotata verifica la rappresentazione
e attribuisce l'identità nominale; una chiamata richiede
l'identità dichiarata, non soltanto la forma del record.
Il checker sostituisce gli slot anche nella rappresentazione
e mantiene la coerenza degli argomenti nelle nuove istanze.
Lo schema Named aggiunge arguments per le istanze parametriche.
I record e le liste generati sono identici a quelli ordinari:
nessun wrapper, tag nominale o parametro di tipo a runtime.
Si rinviano alias di tipo arbitrari (es. Box (T) :: T),
refinement parametrici, ricorsione e proiezione strutturale
esplicita ~ di un tipo parametrico. L'accesso ai campi di
un record nominale parametrico è già supportato.


## 0.64: tipi somma ricorsivi

```mira
Tree (Element Type) ::
  Leaf (Element Type) | Branch ([Tree (Element Type)]);

sum tree: tree (Tree (Number)) -> Number =
  match: tree {
    leaf: {n | n},
    branch: {children |
      fold: children, with: {acc, child | acc + (sum tree: child)},
      from: 0
    }
  };

a = Branch: [(Leaf: 2), (Branch: [(Leaf: 3), (Leaf: 4)])];
result = sum tree: a;
```

Una somma può riferirsi a se stessa nei payload, anche dentro
liste o record. Per la prima iterazione è ammessa la ricorsione
nominale diretta e regolare: una somma parametrica deve usare
gli stessi parametri nello stesso ordine nel riferimento a sé.
SumReference contiene nome, argomenti e riferimento alla
tabella della dichiarazione; la tabella viene completata una
sola volta dal parser. Il riferimento viene espanso di un
livello solo quando match richiede le alternative. Unificazione,
sostituzione, inferenza e descrizione JSON non attraversano
ricorsivamente la tabella; lo schema usa un nodo SumReference
con nome e argomenti. I payload sono ancora record nativi
tag/value, senza metadati nominali o nuovi helper a runtime.
I test verificano costruzioni annidate, match esaustivo,
invarianza, ricorsione di funzioni a tipo concreto ed emissione
JS/PHP identica tra checked e unchecked. Restano fuori ricorsione
mutua tra dichiarazioni, ricorsione non regolare, dichiarazioni
nominali non somma ricorsive e funzioni esplicitamente generiche
ricorsive. Non si garantisce terminazione delle funzioni runtime.
