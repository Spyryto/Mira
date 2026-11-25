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
