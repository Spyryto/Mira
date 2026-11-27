# Mira — Quaderno di progettazione

Questo quaderno raccoglie decisioni e proposte delle discussioni sul linguaggio. Non è una specifica eseguibile. Le indicazioni di stato distinguono ciò che è verificato dalla direzione concordata e dagli aspetti ancora aperti.

## Principi — direzione concordata

Un linguaggio ricco con un runtime povero. Spostare a compile time le decisioni che possono essere prese correttamente, senza aumentare inutilmente la complessità del compilatore. La ricchezza sintattica, la tipizzazione e l'analisi statica non devono obbligare a portare nel programma generato parser, tabelle grammaticali, wrapper nominali o dispatch dinamico evitabile.

Preferire primitive componibili, rappresentazioni canoniche, API piccole, disaccoppiamento e rappresentazioni native dei target JS/PHP. Eleganza non significa minimalismo assoluto: introdurre complessità quando utile e motivarla. Verificare correttezza e costo con CI e benchmark (compilazione, throughput, esecuzione, dimensioni del codice e del runtime, memoria e DOM). Non promettere costo zero senza misure. Prima della 1.0 documentare eventuali incompatibilità senza sacrificare buone scelte architetturali.

## Operatori logici e valori funzione — implementato in 0.51

AND, OR, NOT sono parole riservate case-sensitive. La proposta precedente di & è stata superata prima dell'integrazione. AND e OR infissi sono short-circuit; NOT si abbassa alla condizionale canonica. Nel codice controllato gli operandi devono essere Boolean, non Number convertiti implicitamente.

```mira
Percentage :: Number where _ >= 0 AND _ <= 100;
invert = (NOT);
sum = fold: [1, 2, 3], with: (+), from: 0;
```

Le forme (+), (*), (AND), (OR), (NOT) sono funzioni di prima classe; le sezioni con placeholder come (_ * 2) rimangono disponibili. Gli argomenti di una normale funzione sono valutati prima della chiamata, anche quando la funzione rappresenta AND o OR. Questa differenza rispetto agli operatori infissi è intenzionale. Nessun nuovo dispatch.

## Precedenze — implementazione attuale e direzione concordata

In 0.52 accesso ~ e applicazione per giustapposizione precedono gli operatori binari preesistenti; aritmetica, confronti e >> condividono ancora il livello sinistro-associativo. Seguono NOT, AND, OR. Non confondere questa grammatica verificata con la proposta seguente.

Direzione: poche famiglie, precedenze e associatività configurabili. La configurazione iniziale proposta, dalla precedenza più alta alla più bassa, è accesso ~, aritmetica + - * / %, confronto == != < > <= >=, NOT, AND, OR, pipeline >>. L'aritmetica conserva l'ordine sinistro di Smalltalk (2 + 3 * 4 vale 20). Il posizionamento preciso del pipeline, le interazioni con selettori e il comportamento dei confronti concatenati vanno sperimentati prima di fissarli. Un confronto non associativo potrebbe richiedere parentesi o AND esplicito. Le parentesi conservano sempre la possibilità di disambiguare.

## Operatori personalizzati — sintassi proposta, non implementata

```mira
(**) :: {
  precedence: above arithmetic,
  associativity: right
};

a (Number) ** b (Number) -> Number =
  power: a, to: b;

exponentiation = (**);
```

La parte sinistra parentetica distingue le proprietà sintattiche di un operatore da una dichiarazione nominale ::. Le proprietà vengono raccolte prima del parsing dei corpi; l'implementazione usa = e le annotazioni ordinarie, senza duplicare la firma. La risoluzione produce AST canonico e chiamate statiche, senza tabelle a runtime. Con associazione destra 2 ** 3 ** 2 significa 2 ** (3 ** 2).

Preferire relazioni above, below, same as rispetto a numeri arbitrari. Possibile modello: grafo di precedenze con verifica di cicli; operatori non confrontabili richiedono parentesi, non una scelta arbitraria. Associatività left, right, none. Occorre ancora definire lessico dei simboli, regole di collisione, operatori prefissi/postfissi, scope e import espliciti: una libreria non deve cambiare silenziosamente il parsing del chiamante. Overloading basato sui tipi è un problema separato, da rinviare fino alla stabilizzazione del checker.

## Grammar Lab — direzione concordata, non implementata

Parametrizzare gradualmente il lexer e parser effettivi, senza scrivere un parser parallelo dimostrativo. Una tabella di operatori e un Pratt parser o precedence climbing sono candidati, non ancora scelte implementate. Profilo grammaticale serializzabile: caratteri degli identificatori, keyword, operatori, precedenze e associatività. L'AST semantico deve essere canonico e indipendente dal profilo.

Sperimentare identificatori Unicode (quantità, façade, etc.), con regole esplicite di caratteri ammessi, normalizzazione NFC, collisioni e mangling portabile JS/PHP. Non limitarsi ad accettare indiscriminatamente ogni carattere.

```mira
# Esempio ipotetico di profilo italiano, non codice ufficiale
Percentuale :: Number dove _ >= 0 E _ <= 100;
sconto (Percentuale) = 15;
```

Localizzare keyword e, eventualmente, tipi primitivi e costrutti; lasciare invariati gli identificatori scelti dall'utente quando si convertono profili. Distinguere grammatica ufficiale e profili sperimentali. Per ora non è deciso come distribuire profili fra moduli né come consentire nuove produzioni grammaticali.

Il laboratorio deve mostrare token, AST, raggruppamento, diagnostica, JS/PHP generati, differenze fra profili, compatibilità sul corpus esistente, collisioni, fuzzing, benchmark ed export/import. Un corpus di test non dimostra matematicamente l'assenza di ambiguità. Il profilo non è parte del runtime generato.

## Nominalità e proiezioni — implementato in 0.49 e 0.50

```mira
Pixels :: Number;
Size :: {width: Pixels, height: Pixels};
Window Size :: Size;
Image Size :: Size;
area of: size (Size) = size ~ width * size ~ height;
area structurally: size (~ Size) = size ~ width * size ~ height;
```

:: introduce identità nominali distinte. Un sottotipo può essere passato al tipo base, non viceversa né a un fratello. Le costruzioni annotate sono esplicite; le chiamate non rietichettano automaticamente i dati. Student Id e Request Id non sono intercambiabili anche se rappresentati entrambi da Number. ~ Tipo apre il record esterno, consente campi extra e preserva le identità nominali dei campi e i vincoli applicabili; non copia né elimina campi. La sintassi alternativa Window Size... non è stata adottata. Oggi ~ riguarda soltanto record nominali; eventuali predicati di record generali sono futuri e non devono essere cancellati dalla proiezione.

## Refinement — implementato in 0.51 e 0.52

```mira
Percentage :: Number where _ >= 0 AND _ <= 100;
Small Percentage :: Percentage where _ <= 10;
half of: p (Percentage) -> Percentage = p / 2;
average of: a (Percentage), and: b (Percentage)
  -> Percentage = (a + b) / 2;
```

I vincoli ereditati si compongono per intersezione; intervalli impossibili sono rifiutati. La 0.52 tiene separati tipo nominale e fatti numerici sulle espressioni. a e b hanno tipo Percentage e intervallo [0,100]; a + b ha tipo Number e intervallo [0,200]; (a + b) / 2 ha tipo Number e intervallo [0,100]. La costruzione del risultato Percentage è provata. Non si pretende che ogni operazione intermedia preservi il tipo nominale: si verifica il vincolo nel punto in cui è richiesto. I test confrontano l'emissione JS/PHP con e senza annotazioni.

La prova iniziale tratta intervalli finiti e +, -, *, /, con limiti conservativi rispetto a floating point e magnitudine portabile; non include divisioni con zero possibile, modulo, correlazioni, propagazione generica di fatti attraverso nomi non annotati o predicati arbitrari. Il checker è opt-in. Nessuna guardia runtime è ancora generata.

## Refinement — prossime decisioni

Tre esiti: vincolo dimostrato (nessuna guardia), certamente violato (errore di compilazione), non dimostrato (oggi rifiutato dal checker, in futuro costruzione verificata o validazione esplicitamente fallibile). Non dichiarare garantito un vincolo non verificato.

```mira
# Esempio futuro: Integer non ancora implementato
Request Id :: Integer where _ > 0;
Timeout :: Integer where _ >= 100 AND _ <= 60000;
Retry Count :: Integer where _ >= 0 AND _ <= 3;
Request :: {id: Request Id, timeout: Timeout, retries: Retry Count};
```

Le guardie dovrebbero essere inserite soltanto dove necessarie, valutando il valore una volta sola. Le violazioni di invarianti sono errori del programma; i dati invalidi prevedibili provenienti da GUI, rete o DB sono risultati fallibili, da rappresentare esplicitamente senza eccezioni. La sintassi seguente è soltanto un'ipotesi, così come Result e type narrowing.

```mira
result = validate: input, as: Percentage;
# Risultato desiderato: Result (Percentage, Validation Error)
if (is valid: input, as: Percentage)
  then (set volume: input)
  else (show error "Invalid volume");
```

I predicati dovrebbero essere puri, deterministici e verificabili; niente esecuzione arbitraria di codice host a compile time. Non introdurre un secondo linguaggio generale dei predicati se l'AST Mira può essere riutilizzato. Una garanzia già ottenuta non va ricontrollata inutilmente; ai confini host/RPC/persistenza vanno verificate le premesse non fidate. I prossimi temi sono Integer, narrowing, estensione dei predicati, guardie, validazione fallibile e integrazione dei contratti con GUI/RPC/DB. Non costituiscono una promessa di numeri di versione.

## GUI — direzione concordata

Generare updater specializzati quando le dipendenze sono determinabili a compile time; preservare nodi, identità stabile e granularità. Stato immutabile, separazione stato/view/effetti. Il runtime svolge soltanto confronti, aggiornamenti effettivi del DOM e gestione realmente dinamica (liste, componenti condizionali, effetti asincroni). Non ricostruire sistematicamente rappresentazioni intermedie se la riconciliazione è eliminabile staticamente. È una direzione di ottimizzazione, non la dichiarazione che tutte le view attuali abbiano già zero overhead.

## Due filoni, una roadmap

Tipi: nominali, strutturali, refinement numerici e prove aritmetiche già integrati; completare le garanzie statiche e la validazione al confine. Grammatica: AND/OR/NOT e valori funzione già integrati; tabella di precedenze, Grammar Lab, Unicode, localizzazione, operatori custom e possibile overloading da sviluppare separatamente. Alternare i due filoni senza abbandonarne uno. Mira Studio è manuale, IDE, esploratore del compilatore, laboratorio di tipi e grammatica, benchmark e storia del progetto.

Quaderno redatto con assistenza IA a partire dalle discussioni e dalla fonte di progetto «Mira — Principi architetturali e linee guida di sviluppo». La documentazione tecnica per le versioni implementate resta in grammar.md, type-checker.md e nelle rispettive suite di test.

## 0.53 — Integer: decisione di implementazione

Integer è un sottotipo numerico portabile limitato agli interi sicuri
di JavaScript, non un wrapper né un alias del tipo int nativo PHP.
Manteniamo Number come tipo ordinario dei letterali e delle operazioni:
le prove di integrità si affiancano alle prove degli intervalli.
Una costruzione Integer verifica sia l'integrità sia la magnitudine;
una costruzione di un refinement intero verifica anche i suoi limiti.
L'aritmetica intermedia non è automaticamente Integer. Sono state
preferite prove conservative all'inferenza generalizzata dei tipi
discreti. Divisione, overflow e confronti con Number non devono
nascondere differenze fra i target. L'uguaglianza stretta numerica
JS/PHP, i confini host, la validazione dinamica e le conversioni
implicite rimangono temi aperti. Vedi type-checker.md.

La prima CI 0.53 ha superato 227/228 test: il test di esecuzione chiamava
la funzione Mira next:, che collide con next() nativa PHP. Il fixture
usa ora increment retry:. La collisione di nomi con funzioni native PHP
resta un difetto di interoperabilità da risolvere separatamente, non un
errore nelle prove Integer. Non si modifica l'emitter in questo incremento.

## 0.54 — narrowing lessicale (integrato)

Una condizione non è soltanto controllo di flusso: può fornire
informazioni utilizzabili dal checker nel ramo in cui è vera
o falsa. Ad esempio normalize percentage: x (Number) -> Percentage
può restituire x nel ramo x >= 0 AND x <= 100 e 0 nell'altro.
La condizione esiste già nel programma: non aggiungiamo una guardia
per ripetere ciò che è stato dimostrato.

Conserviamo il tipo dichiarato e aggiungiamo fatti locali, copiati
per ramo. Alla ricongiunzione un inviluppo conservativo dei risultati
sostituisce i fatti specifici. Non assumiamo che il complemento
di una disuguaglianza sia valido per Number senza premesse di
finitezza: NaN e infinito richiedono attenzione. Evitiamo per ora
un solver generale, unioni disgiunte, bottom e tipi di ramo nuovi.
La validazione esplicita ai confini non fidati rimane un tema distinto.
Vedi type-checker.md; tutti i workflow della 0.54 sono verdi.

## 0.55 — overflow portabile e classificazione delle prove

JavaScript Number ha interi sicuri fino a 2^53-1; PHP int su
64 bit arriva a 2^63-1, oltre il quale passa a float. Il dominio
Integer di Mira è comune, non coincide con l'overflow nativo.
Le operazioni Number non sono rese modulari, saturanti o BigInt.
Il vincolo riguarda il confine di costruzione, come per Percentage.

Decisione concordata: dimostrato significa nessun costo aggiunto;
certamente violato significa errore a compile time; indeterminato
richiederà una guardia o una validazione esplicitamente fallibile.
La 0.55 implementa la classificazione, non ancora le guardie.
Le osservazioni fuori dominio non possono diventare nuove prove
aritmetiche: un intermedio non esatto può produrre un risultato
apparentemente valido. Prima di generare guardie occorre fissare
la semantica dei casi di precisione perduta e divisione per zero,
distinguere input non fidati da premesse tipizzate e scegliere
un percorso di compilazione checked esplicito. Nessun wrapper o
runtime aggiunto per le prove statiche. Vedi type-checker.md.

## 0.56 — guardie selettive (implementazione sperimentale)

La modalità --checked permette di distinguere un obbligo dinamico
da un errore statico, senza cambiare la transpilazione ordinaria.
Il checker e gli emitter condividono l'AST esistente e una mappa
di obblighi, non un nuovo interprete, un tipo di valore runtime
o una tabella di dispatch. Le verifiche ereditate si uniscono e
il valore è valutato una volta sola. Le prove riuscite producono
esattamente il codice non controllato.

Scelta conservativa: non usare una guardia finale per recuperare
l'esattezza matematica dopo un calcolo intermedio non portabile.
Per ora i calcoli Integer incerti supportati sono + - * di
operandi già dimostrati interi e portabili. Le guardie su valori
Number controllano la rappresentazione effettivamente ricevuta.
L'overflow possibile di x + 1 è verificabile al confine
Integer; il caso (MAX + 2) - 2 non viene reso valido con una
semplice guardia finale. Le firme host e parametri restano
premesse fidate. Le eccezioni rappresentano violazioni delle
invarianti; la validazione fallibile esplicita dei dati esterni,
le garanzie sulle interfacce RPC/DB e gli errori strutturati a
runtime restano incrementi distinti. Non adottiamo un runtime
universale per controllare ogni operazione. Vedi type-checker.md.

## 0.57 — validazione fallibile con due blocchi (esperimento)

Prima di progettare Result(T,E) e i tipi somma generali,
sperimentiamo una forma diretta:

```mira
validate: (input), as: (Percentage),
  then: {value | display percent: value},
  else: {error | 0}
```

Il tipo è sintassi statica; il ramo di successo riceve
il valore già garantito (non un Number da ricostruire),
il ramo di fallimento un messaggio Text. Si valutano
l'input una volta e un solo corpo di handler. I due
risultati si unificano come per if. Non si catturano
eccezioni arbitrarie né si convertono stringhe in numeri.
Le guardie e la validazione riutilizzano lo stesso
generatore di predicati, differendo solo nell'esito:
eccezione per l'invariante, ramo di errore per dati invalidi.

La scelta dei due blocchi è una decisione sperimentale
di implementazione, non un rifiuto della proposta Result
discussa in precedenza. Evita per ora un'algebra dei tipi
somma e un secondo meccanismo di pattern matching.
L'alternativa validate: input, as: Percentage con risultato
persistente resta aperta. Altri temi aperti: messaggi
strutturati e localizzati, validazione di record e liste,
composizione/accumulo degli errori, integrazione con GUI
e confini host/RPC, eliminazione statica di controlli
espliciti già provati. Vedi type-checker.md.


## Selettori con argomenti statici — intuizione concordata

La validazione 0.57 è stata integrata con tutti e tre i workflow
verdi. L'utente apprezza la forma validate:as:then:else: e le
continuazioni tipizzate: as: riceve un tipo risolto dal compilatore,
non un oggetto tipo a runtime. Il tipo determina a sua volta il
parametro del blocco di successo. Questa è una relazione semantica
tra argomenti, non una semplice chiamata ordinaria.

Possibile generalizzazione futura: selettori definibili dall'utente
con argomenti statici, valori runtime e blocchi i cui parametri
dipendono dagli argomenti statici. Esempi esplorativi, non sintassi
implementata: decode: json, as: Person; specialize: operation,
for: Integer; default value of: Window Size. Non introdurre
riflessione o oggetti tipo a runtime solo per rappresentare tali
argomenti. Studiare la dichiarazione, risoluzione e specializzazione
dei selettori prima di scegliere un meccanismo generale.

## Tipi somma e match discorsivo — proposta preferita

L'esperimento con due continuazioni non esclude i tipi somma.
Sono complementari: il consumo immediato può evitare la
materializzazione, mentre un valore somma di prima classe
può essere conservato, trasmesso e composto. Result e Option
potrebbero essere definiti in libreria sopra tipi somma nominali
generali, in futuro parametrizzati e ricorsivi. Non è ancora
decisa la sintassi delle dichiarazioni e dei costruttori.

```mira
Connection ::
  Disconnected |
  Connecting |
  Connected (Session) |
  Failed (Text);
```

Per il consumo esaustivo l'utente propone la seguente forma,
preferita alla sequenza di label di un selettore ordinario:

```mira
match: connection {
  disconnected: {| show login},
  connecting: {| show spinner},
  connected: {session | show dashboard: session},
  failed: {error | show error: error}
};
```

Il blocco esterno delimita una struttura di controllo con
alternative, non un record ordinario di callback. Le graffe
interne sono normali blocchi Mira. L'eliminatore deve verificare
staticamente alternative note, mancanti o duplicate, arità e
tipi dei payload, e compatibilità dei risultati. Lo scrutinee
è valutato una volta; si esegue soltanto il ramo selezionato.

Alternativa considerata:

```mira
match: connection, with: {
  disconnected: {| show login},
  connecting: {| show spinner},
  connected: {session | show dashboard: session},
  failed: {error | show error: error}
};
```

Questa seconda forma è indistinguibile in superficie da una
chiamata ordinaria match:with: a cui si passa un record. La
prima proposta preserva invece, come obiettivo di design,
la possibilità di dichiarare sia match: sia match:with: in
user space. Non riservare globalmente la parola match;
riconoscere la specifica costruzione grammaticale. Non
sostituire la normale risoluzione dei selettori.

Questione grammaticale aperta: Mira ammette applicazione per
giustapposizione anche a blocchi/record. Il parser deve quindi
distinguere la graffa esterna dal possibile argomento di
un'espressione callable; la forma speciale potrebbe avere
priorità quando la graffa è a livello zero dopo lo scrutinee,
con parentesi esplicite per disambiguare le chiamate utente e
gli scrutinee complessi. Verificare nel Grammar Lab con il
parser reale, non dare per risolta l'ambiguità. Anche validate:
oggi riserva il primo label: una futura generalizzazione dei
selettori statici potrebbe evitare tale riserva.

Pattern matching ML e narrowing per varianti rimangono
alternative o estensioni possibili, non prerequisiti del
match discorsivo. Per la rappresentazione runtime preferire
dati nativi con discriminante e payload quando il risultato
deve sopravvivere; quando costruzione ed eliminazione sono
locali, valutare fusione, eliminazione delle allocazioni e
inlining delle continuazioni solo dopo prove di equivalenza
(effetti, ordine e singola valutazione). Nessuna promessa di
zero overhead per casi dinamici. Applicazioni naturali:
Result, Option, stati di connessione, messaggi ed effetti MVU.


## Match — regola di disambiguazione concordata

La graffa a livello zero dopo lo scrutinee di match: apre
le alternative del costrutto speciale. Una graffa racchiusa
nelle parentesi dell'argomento appartiene all'espressione
ordinaria. La decisione deve essere grammaticale, non guidata
dai tipi inferiti. Esempi:

```mira
match: connection;
match: connection, with: handlers;
match: connection { disconnected: {| 0}, connected: {s | 1} };
match: (get connection: server) { disconnected: {| 0}, connected: {s | 1} };
match: (process {connected: {| 1}, disconnected: {| 0}});
```

Le prime due e l'ultima sono chiamate utente; la terza e
la quarta sono eliminazioni algebriche. Questa è la regola
concordata da verificare quando si implementerà match.
Resta da definire il comportamento per uno scrutinee che
sia esso stesso un record non parentetizzato e per le
chiamate con label successive a un argomento complesso.

## 0.58 — primo incremento dei tipi somma

Partiamo da tipi somma nominali chiusi, senza generici o
ricorsione. Le dichiarazioni con | a livello zero
sintetizzano costruttori ordinari: una variante senza
payload è un valore globale, una con payload è un
selettore unario. Non si introduce un secondo sistema
di risoluzione dei nomi o un registro runtime.

```mira
Session :: {user: Text};
Connection :: Disconnected | Connecting | Connected (Session) | Failed (Text);
session (Session) = {user: "Ada"};
initial = Disconnected;
active connection = Connected: session;
failure = Failed: "Timeout";
```

Scelta sperimentale: costruttori con iniziale maiuscola
e namespace ordinario dei valori/selettori. Il tipo somma
non è un record strutturale, anche se gli emitter producono
un record nativo con tag e, se presente, value. Non si può
costruire un Connection annotando un record arbitrario.
Questa rappresentazione è una prima scelta interna, non
un contratto wire stabile. Il prossimo incremento è
l'eliminazione esaustiva. Qualificazione dei costruttori,
payload multipli, generici, ricorsione, ottimizzazione e
collisioni dei nomi nativi PHP restano temi aperti.


## 0.59 — match contestuale esaustivo (implementazione proposta)

Il nodo Match implementa la proposta concordata: match:
value { ... } è riconosciuto sintatticamente, senza
consultare i tipi o riservare la parola match. Le chiamate
match: x e match: x, with: y rimangono definibili dall'utente.
Per la scansione iniziale si rispettano i delimitatori
annidati, e la virgola a livello zero interrompe la ricerca.
Una graffa iniziale che è l'intero argomento non è trattata
come lista di alternative. Parentetizzare i casi complessi.

Le label delle alternative riprendono il nome del costruttore
con la prima lettera minuscola, scelta sperimentale.
Non si introducono pattern generali: si riutilizzano i blocchi
e le annotazioni implicite dei payload, con controllo di
esaustività e dei risultati. Lo scrutinee è valutato una volta
e viene invocato un solo handler. Gli emitter usano confronti
stretti per evitare le conversioni implicite di PHP switch.
Per ora tutte le closure sono create; l'inlining e la fusione
con i costruttori richiedono prove successive di equivalenza.
La sintassi e il runtime sono distinti dall'eventuale futuro
match di ML. Vedi type-checker.md; CI richiesta prima del merge.

La prima PR 0.59 è stata sostituita dopo lo squash della
0.58 perché la base non era integrabile senza conflitti.
Il nome match è inoltre una keyword PHP 8: non va riservato
in Mira, ma tradotto deterministicamente nel mangler.
Il selettore match:with: non richiede una modifica.
Il test di convivenza deve eseguire il codice effettivo,
non limitarsi all'inferenza. Questo è un intervento mirato,
non una soluzione generale ai nomi riservati dei target.


## 0.60 — tipi somma parametrici (implementazione proposta)

La 0.59 è stata integrata con 241 test del compilatore e
tutti i workflow verdi, inclusi i selettori match: e
match:with: eseguiti su JS/PHP. La prossima estensione
è un insieme ristretto di tipi somma parametrici:

```mira
Result (T, E) :: Ok (T) | Err (E);
Option (T) :: Some (T) | None;
```

La forma delle dichiarazioni e delle applicazioni segue
le parentesi delle annotazioni già utilizzate da Mira.
I parametri restano a compile time. Non si genera
una classe o un costruttore runtime per ogni combinazione:
i tag e i payload conservano la rappresentazione nativa.
Le istanze sono invarianti e i costruttori utilizzano
l'inferenza polimorfica del checker, con variabili fresche.

Scelta circoscritta: generici dei soli tipi somma, non
una sintassi universale per tutte le dichiarazioni.
I parametri si applicano ai payload e a somme annidate
già note. La ricorsività richiede un incremento separato,
con analisi delle dichiarazioni e rappresentazione finita
dei tipi. Il nome Err è scelto negli esempi perché Error
può collidere con il costruttore nativo JS; non implica
la scelta definitiva dei nomi della libreria standard.
Nessuna nuova keyword Result o Option. Il passo futuro
verso la validazione materializzata dovrà riutilizzare
questi tipi, senza duplicare le continuazioni o la
logica dei predicati. Vedi type-checker.md.


## 0.60.1 — parametri di tipo discorsivi

Decisione: i parametri di tipo sono identificatori ordinari,
anche composti da più parole, senza imposizione di PascalCase.
La virgola delimita i nomi; lo scope resta quello della dichiarazione.
Si riutilizzano readWords, la separazione delle parti e il parser
delle annotazioni. Nessuna modifica alla IR o al runtime.
Il problema generale del mangling dei nomi host resta separato.


## 0.60.2 — indipendenza dai nomi host

Prima correzione centralizzata: il mangler distingue nomi
sorgente e nomi generati, protegge i simboli nativi usati
dagli emitter e un insieme esplicito di keyword e funzioni
comuni. Il prefisso interno viene escapato se usato dal
sorgente. Manteniamo la compatibilità dei nomi ordinari degli
adattatori JS/PHP. Un isolamento completo rispetto a estensioni
PHP o codice host arbitrario richiederà namespace/export espliciti.


## 0.61 — funzioni parametriche esplicite

Proposta implementativa: identity (Value Type): x (Value Type)
-> Value Type = x. Parametri dichiarati dopo la prima label,
selettore invariato. Riutilizzo del parser dei parametri delle
somme; variabili rigide durante il controllo e istanziazione
flessibile alla chiamata. Annotazioni complete richieste per
questa prima forma. Nessuna modifica agli emitter; ricorsione,
vincoli e annotazioni generiche nel corpo rimandati.


## 0.62 — risultato di validazione come valore

Forma breve validate: (x), as: (Type) che restituisce Result
(Type, Text), verificando la forma canonica della somma esplicita.
Niente prelude implicita: Result resta dichiarabile in Mira.
Si mantengono validate:as:then:else: e il suo predicato numerico.
Il nodo ValidateResult emette direttamente tag/value nel ramo
selezionato, con una sola valutazione dell'input e senza chiamare
costruttori o creare due continuation. Errori strutturati e altri
tipi di validazione sono separati da questa iterazione.


## 0.63 — tipi nominali parametrici con rappresentazione dati

Estendiamo il meccanismo di template delle somme a record
chiusi e liste nominali. Identità e argomenti sono verificati
staticamente; la rappresentazione rimane nativa. Si conserva
NamedType per le dichiarazioni esistenti e si distingue
ParametricNamedType con argomenti espliciti. Non introduciamo
alias trasparenti, applicazioni ricorsive o nuovi costi runtime.


## 0.64 — somme ricorsive regolari

Un riferimento nominale finito (SumReference) conserva il
nome, gli argomenti e la tabella condivisa delle alternative,
senza espandere ricorsivamente la definizione. L'espansione
esplicita di un solo livello serve a match; unificazione e
schema operano sui riferimenti nominali. Riutilizzo del
template sostitutivo, senza modifiche agli emitter. La prima
forma è volutamente limitata a ricorsione diretta regolare.


## Moduli — direzione concordata dopo la 0.64

La sperimentazione della PR #95 sui nomi puntati non costituisce la
grammatica ufficiale. Il fondamento sarà lo scope isolato del modulo,
non un separatore di qualificazione. Il progetto completo, il syntax
tour revisionato dall'autore e la roadmap sono in
[module-design.md](module-design.md); Mira Studio include quel documento
nel quaderno offline. Il nucleo di isolamento è descritto nella sezione 0.65; le sezioni piatte sono descritte nella 0.66, mentre i contratti completi restano pianificati.

## 0.65 — primo nucleo dei moduli isolati

La dichiarazione module con percorso discorsivo crea uno scope privato.
Le definizioni sono analizzate nel proprio scope e solo dopo la risoluzione
vengono convertite in dichiarazioni canoniche, mantenendo il percorso logico
nelle identità nominali. Il mangling è iniettivo e non richiede sintassi di
qualificazione nel sorgente. Nessun export o import selettivo ancora;
caricamento legacy esplicito, senza visibilità dei moduli dichiarati.

## 0.66 — sezioni piatte e appartenenza all'interfaccia

ModuleSections raccoglie riferimenti di export e dichiarazioni nominali
pubbliche prima di riusare il parser ordinario. Il flag isExported segue
l'identità canonica senza influenzare il codice emesso. Studio mostra
le dichiarazioni pubbliche e private, non ancora un contratto tipizzato
indipendente. L'import logico e la validazione delle firme pubbliche
sono incrementi separati.

## 0.67 — binding lessicali degli import

ModuleImport analizza percorsi e selettori. ImportBinding conserva alias
locale e dichiarazione originale; il resolver converte i riferimenti
all'identità canonica. Le tabelle dei tipi ricevono le identità originali,
senza copie nominali. Il resolver host sceglie i file. Gli emitter vedono
le globali locali e quelle importate, senza wrapper o oggetti modulo.
La convenzione editoriale degli import preferisce `square: ;` e
`add: by: => somma: a: ;`, pur accettando gli spazi facoltativi.

## 0.68 — contratti pubblici espliciti

PublicSignature risolve la firma nello scope dei tipi pubblici e la
trasferisce alla definizione prima della risoluzione dei corpi. Il checker
riusa annotazioni, rigidità delle variabili esplicite e inferenza esistenti.
L'uguaglianza delle annotazioni ripetute è strutturale per dati anonimi,
nominale per tipi dichiarati e confronta gli slot generici per posizione.
Nessun nuovo nodo AST o modifica agli emitter. La verifica delle fughe di
tipi privati resta separata, insieme all'opacità.

## 0.69 — visibilità nominale e vista opaca

TypeVisibility registra identità private e opache. Una vista del tipo
attraverso il confine del modulo sostituisce le rappresentazioni opache
con OpaqueType(name), anche in strutture annidate. Le firme pubbliche
sono controllate dopo l'inferenza, senza esaminare la rappresentazione
privata dietro un confine opaco. L'AST runtime e gli emitter non cambiano.
Prima forma: tipi nominali monomorfi e somme non parametriche.

## 0.69.1 — applicazioni opache e riferimenti anticipati

OpaqueType conserva gli argomenti del tipo. TypeTemplates, unificazione,
istanza e generalizzazione li trattano come gli altri tipi nominali.
La raccolta degli header permette riferimenti opachi finiti nelle forme
pubbliche, mantenendo le rappresentazioni in una tabella del checker.
Alias diretti pubblici verso rappresentazioni opache locali esclusi;
nessuna modifica del runtime.

## 0.70 — riesportazione statica

La tabella dei simboli esportati associa i nomi pubblici a definizioni
originali; la tabella dei tipi pubblici include gli alias riesportati.
ModuleImport analizza anche export. Le riesportazioni sono binding
lessicali e pubblici, non dichiarazioni sintetizzate. Il trace espone
la provenienza canonica. Il tree shaking resta un incremento separato.

## 0.70.1 — pruning a programma chiuso

TreeShaker riusa Dependencies senza richiedere il calcolo delle SCC:
visita iterativa di raggiungibilità, filtro stabile e pulizia delle
importedGlobals. Controllo dei tipi prima del pruning, whitelist di
inizializzatori innocui, entry e legacy preservati, opt-in esplicito.
Nessun sistema generale di effetti o euristica di purezza delle chiamate.

## 0.71 — Module Explorer

Il resolver registra le direttive di dipendenza su richiesta del trace.
Il bridge exploreModules unisce i metadati delle interfacce al report
checked, senza ricostruire i tipi dalla sintassi. La vista mobile mostra
archi navigabili, contratti, simboli privati e identità di tipi opachi e
alias. Due analisi del sorgente (trace e check), nessuna dipendenza web.

### Consolidamento 0.71

Indicizzazione delle dichiarazioni pubbliche e private per modulo in un
solo passaggio (anziché scansione completa per ogni modulo). Fixture
con dipendenza a diamante, benchmark per JS/PHP e test di identità opaca
attraverso due riesportazioni, proiezione negata e ciclo di dipendenze.
Non si introducono cache persistenti o compilazione incrementale.

## 0.72 — primo verificatore indipendente

ContractVerifier riusa ModuleSections (modalità frammento autonomo),
PublicSignature e TypeChecker. Un contratto è una lista di firme
esplicite; viene verificata una nuova istanza del programma, applicando
le firme ai soli simboli pubblici locali del provider. Non si confrontano
stringhe di tipi inferiti. Prima fase deliberatamente conservativa:
nessun matching per subtyping delle firme annotate, nessuna equazione
tra tipi nominali di provider differenti, nessuna selezione di provider.

## 0.73 — collegamento statico dei provider

ProviderBindings interpreta una configurazione di build. Modules risolve
il percorso di servizio al provider, riusa la sua tabella delle dichiarazioni
e costruisce una vista ristretta ai requisiti. PublicSignature.apply
inserisce i vincoli prima del checker nello stesso AST che raggiunge gli
emitter. Nessun wrapper, nessun nuovo costruttore Expr, nessuna seconda
compilazione di verifica. I binding richiedono modalità checked.

## 0.74 — interfaccia indipendente, implementazione ereditata

ModulePath condivide la grammatica del percorso tra module e implements.
ContractModule legge il sorgente del contratto con ModuleSections in
modalità standalone. Modules riusa direttamente i token dell'interfaccia
nella compilazione del provider, senza concatenare sorgenti sintetici.
Il manifest con solo provider verifica il percorso implements. L'opacità
e i tipi parametrici riusano TypeVisibility e il checker. Identità nominale
concreta per build; niente nuovi costruttori Expr o emitter.

## 0.75 — analisi prima del collegamento

ContractModule elabora la sola interfaccia in tipi nominali opachi e
Definition senza corpo, esplicitamente marcate. Dependencies non visita
corpi inesistenti; TypeChecker istanzia le firme dichiarate senza
inferire un corpo fittizio. Compiler.check consente contratti irrisolti;
i percorsi di emissione li rifiutano prima del pruning. Classificazione
comune degli header astratti con il provider. Il checker conserva
identità del contratto nell'analisi astratta, non tra build differenti.

## 0.76 — identità pubblica e accesso alla rappresentazione

DefinitionParser accetta identità nominali esplicite per i tipi astratti
realizzati. Le dichiarazioni pubbliche ereditate del provider selezionato
usano il namespace del contratto. TypeVisibility separa ownerOf dalla
qualificazione nominale, con un grant esclusivo per il provider selezionato.
Il resolver dei valori non cambia; provider non selezionati mantengono
identità proprie. Test di uguaglianza degli schemi pubblici, isolamento
tra provider e verifica JS/PHP. Nessuna cache persistente ancora.

## 0.77 — superficie pubblica canonica

InterfaceReport raccoglie i metadati dal resolver durante Compiler.parse,
usa gli schemi del checker per le firme e per i tipi pubblici e serializza
solo dati semantici versionati con ordinamento deterministico. SHA-256
è un'impronta della superficie tipizzata, non una chiave di cache di
compilazione. L'analisi resta completa; il confronto Studio è in memoria.

## Direzione dopo la 0.77

Roadmap concordata come ordine di priorità, non calendario né promessa di versioni.

1. Consolidare contratti, identità e confronto delle interfacce. Misurare prima di introdurre cache e compilazione separata.
2. Moduli host tipizzati e libreria standard pragmatica: riusare direttamente librerie native, estrarre astrazioni portabili solo da esigenze concrete, scegliere implementazioni a compile time quando possibile.
3. Unificare GUI e checker: tipi di modelli, view, binding, messaggi ed effetti; updater specializzati generati quando le dipendenze sono note.
4. Studio multifile e tooling: navigazione, tipi al cursore, diagnostica durante l'editing, workspace.
5. Applicazioni reali: Studio progressivamente in Mira, registro lezioni, deploy PHP, MiraHost/WebView. Separare prototipi da sistemi con dati reali.
6. Grammar Lab, operatori personalizzati e trasformazioni compile time; successivamente un eventuale backend Go motivato da casi concreti.

La correttezza prevale sulle ottimizzazioni. Ogni incremento: test positivi e negativi, JS/PHP, Studio, documentazione e integrazione solo con CI verde. La 1.0 è un traguardo di usabilità applicativa, non un numero di feature.

## 0.78 — impatto potenziale delle modifiche pubbliche

Il report delle interfacce espone anche le direttive di dipendenza già raccolte dal resolver, fuori dalla superficie hashata. Studio confronta due report riusciti, distingue aggiunte, rimozioni, modifiche di schema e cambio di provider, e percorre gli archi inversi logici di entrambi i grafi. I consumatori raggiunti sono candidati conservativi alla riverifica, non una decisione di cache. Il cambio di provider è segnalato separatamente per il collegamento. Il compilatore continua a controllare tutto; modifiche private, host, sorgente e opzioni non sono coperte da una semplice impronta.

## 0.79 — distinguere sorgenti, tipi e collegamento

Il report avvolge il resolver già esistente solo nel percorso di introspezione, registrando l'hash del testo realmente consegnato al compilatore. L'ordine delle letture è conservato, anche per richieste ripetute. Non si confondono identità logica del contratto e chiave fisica/logica del resolver. Studio separa cambi di sorgente, impatto potenziale sui tipi e collegamenti effettivamente osservati. Il confronto testuale dei manifest nella sessione è conservativo, non parte di una chiave di cache. Prima di implementare riuso reale, misurare le fasi del compilatore e la dimensione dei progetti applicativi. Nessuna promessa di riuso per modifiche private: codegen, inizializzatori, tree shaking e specializzazione possono richiedere lavoro globale.

## 0.80 — misurare prima di introdurre cache

Profilazione opt-in del percorso checked reale, con intervalli consecutivi in Compiler e riuso della fixture modulare di Studio. Separare raccolta/lexer/import, scope, espressioni, checker, pruning ed emissione. Non duplicare parser o checker, non misurare per sottrazione di due compilazioni indipendenti. Il timer non appartiene al runtime Mira. I dati sono esplorativi, la cache incrementale resta una possibilità da valutare su app concrete. Vedi performance.md.

## 0.81 — interoperabilità nativa a confini espliciti

Si riusa il manifest tipizzato e il resolver esistente, aggiungendo soltanto scope per capability. Un provider ordinario Mira implementa un contratto e chiama una funzione nativa registrata dall'host (Math.abs in JS, abs in PHP nel test); un provider Mira alternativo si può selezionare senza rendere visibile la capability al consumatore. Non si introduce sintassi extern, generazione di wrapper, package manager o un ABI universale. Il test confronta la funzione valore assoluto nativa con una normale funzione Mira su un input negativo; non costituisce una prova di equivalenza su tutti i valori numerici. I tipi dichiarati sono affidati all'host; eventuali boundary validator sono un incremento separato.

I primi campioni CI della 0.80 (66 moduli sintetici) mostrano circa 69.67 ms JS e 62.52 ms PHP checked senza pruning; con pruning 15.53 e 19.69 ms. L'emissione domina i campioni senza pruning (55 e 49 ms); type checker circa 4 ms. Timer interno grossolano (~1 ms), campioni singoli, non mediana. Priorità: interoperabilità applicativa, profilazione più fine degli emitter solo con misure ripetute. Nessuna cache incrementale introdotta.

## 0.82 — laboratorio dei moduli host

Prima di aggiungere servizi o sintassi extern, rendere osservabile la sostituzione statica dei provider. Host Module Lab riusa il compilatore browser, espone sorgenti, manifest, binding, impronte e output reali; l'esecuzione JS è isolata dal thread UI con un worker terminabile. PHP è ispezionabile in Studio ed eseguito nei test. Esempi numerici minimi, nessuna pretesa di equivalenza su ogni valore. Non introdurre un secondo sistema di moduli, binding o type checker.

## 0.83 — primo servizio nativo riutilizzabile: Text

Contratto Mira e provider concreto in lib/text, manifest con scope, adapter JS/PHP espliciti. Studio importa gli stessi file nel proprio bundle. Semantica Unicode scalare dichiarata, test differenziali dei due host su ASCII, accenti, emoji, combinanti, ZWJ, newline, NUL, ago vuoto e input non valido. Il conteggio non è una misura di grafemi. Riutilizzare native API quando la semantica coincide, adattare solo dove necessario; niente prelude, grammatica o nuovo runtime.

## 0.84 — decoder JSON specializzato da un contratto

Il contratto è l'unica fonte delle firme. Il generatore converte lo schema chiuso già verificato in un manifest host strutturale e riusa il medesimo schema per i validatori esistenti JS/PHP della 0.46. La capability nativa rimane confinata al provider. Non aggiungere Dynamic o un parser JSON proprio. Primo incremento concreto: eccezione al confine per dati non validi, non ancora Result; valutare un'estensione fallibile tipizzata quando si possa conservare un'unica firma senza duplicare l'algebra dei tipi nel manifest.

## 0.85 — errori JSON come valori

Il Result appartiene al contratto Mira, non al manifest. Si conserva l'ABI strutturale esistente e si usa un envelope privato {values: [payload], error: Text} a cardinalità zero/uno, costruito soltanto dall'adapter che valida. Il provider costruisce Ok/Err con i costruttori ordinari tramite fold. Nessuna duplicazione dei validatori o del tipo di successo nel manifest; il generatore verifica che i due decoder condividano lo schema. La firma del contratto contiene entrambe le dichiarazioni esplicite e un controllo di coerenza impedisce divergenze; non si introduce ancora alias di tipo strutturale. I dati non validi sono gestiti con match; i bug host inattesi non vengono trasformati indiscriminatamente in errori di dati. L'envelope non è zero-cost: è un adattatore pragmatico, non una proposta per un ABI generale.

## 0.86 — separare data civile, istante e durata

Date opaco in Services / Date, costruzione controllata dal provider e rappresentazione non osservabile dal consumatore. Nessuna dipendenza o nuova sintassi. Aritmetica nativa in UTC per evitare DST e timezone impliciti. Nessuna semantica implicita di ora corrente. Per ora valid date: permette un controllo preventivo, gli errori di costruzione/arithmetic sono eccezioni; introdurre Result e clock/Instant solo con contratti concreti. I Number usati per i giorni richiedono controllo runtime di integrità, finché il manifest host non espone Integer. L'uso di Date non implica che i dati serializzati siano già validati.

## 0.87 — persistenza testuale con provider sostituibili

Contratto minimo e provider Browser/Files separati, non un filesystem virtuale. L'applicazione non decide percorsi, namespace o backend. La lista a cardinalità zero/uno distingue assenza da testo vuoto senza tipi host nominali; non è una nuova Option implicita. Scrittura e rimozione sono effetti sincroni espliciti con true al successo e eccezione al fallimento. Non si presume purezza delle chiamate host, né si promettono transazioni o ordinamento tra dichiarazioni indipendenti: chiamare in risposta a eventi o concatenare dipendenze. Il laboratorio esegue solo programma repository-owned già compilato, non usa il worker (localStorage non è disponibile lì). Si rinvia l'integrazione con schema/versioning del registro esistente, un codec JSON generico, I/O asincrono e Result con errori strutturati.

## 0.88 — GET testuale come effetto

Il descrittore è costruito in Mira, senza Promise o URL nel linguaggio. La capability è associata dall'host a un endpoint fidato. Distinguere risposta HTTP anche non 2xx da errore trasporto; la decodifica JSON rimane separata. JS usa fetch/ReadableStream e cancellazione, PHP stream nativo sincrono con timeout di inattività. Non pretendere equivalenza temporale tra host, non introdurre scheduler PHP. Il modulo è puro e il runtime effects 0.35 può consumarne il descrittore senza modifiche. Il laboratorio usa direttamente lo stesso handler, non un nuovo runtime GUI. Il limite streaming non sostituisce i limiti dei trasporti o la difesa SSRF per URL arbitrari; non esporli. Nessuna grammatica o AST nuova.

## 0.89 — dogfooding: importare una lezione

Comporre cinque servizi già esistenti in un programma checked; nessuna estensione al compilatore. Serve uno schema JSON specifico della app (data aggiunta); generatore e adapter invariati, piccolo provider Mira ripete la conversione strutturale -> Result, candidato a riuso successivo. Il build compone manifest espliciti e rileva capability duplicate. HTML/JS conserva l'orchestrazione asincrona e la UI; la logica di dominio e la decisione di persistere sono Mira. Il record di riepilogo con accepted/error non è un nuovo tipo Result generale; si potrà migliorare dopo aver testato la comodità del sistema. Archiviazione di un singolo JSON originale evita introdurre un encoder speculativo. Il pilota non è un registro multi-lezione; è un test verticale delle librerie. Prossime necessità osservabili: composizione di manifest/decoder, schema e codec per più record, effetti tipizzati e UI checked, non nuove feature speculative.

## 0.89.1 — consolidare prima di espandere

Audit dei servizi 0.83–0.89: mantenere Text Unicode scalare, Date civile opaco, storage delimitato e GET a endpoint fidato; sono scelte documentate, non bug. Correggere invece il troncamento HTTP PHP e l'UX di retry/importazione, aggiungere test Chromium reali. La lunghezza dichiarata è verificata per risposte senza Transfer-Encoding (eccetto 204 senza corpo); la completezza di altri framing HTTP resta responsabilità dello stream nativo, non una garanzia per server malformati. Non cambiare la grammatica. Debito osservato: uguaglianza Number PHP vs JS (anche sezioni), errori prevedibili ancora eccezioni, duplicazione glue JSON/Result e composizione manifest manuale, precisione monetaria applicativa. Le vecchie PR sperimentali aperte non vengono chiuse né integrate automaticamente. La prossima iterazione deve dare precedenza alla correttezza dei valori prima del tooling multifile.

## 0.89.2 — uguaglianza Number indipendente da int/float PHP

Correggere il limite già documentato in 0.42. Non usare == PHP indiscriminatamente. Il checker produce un fatto locale di emissione per le rappresentazioni scalari risolte; PHP numerico checked usa confronto nativo, Text/Boolean stretto, fallback solo per polimorfismo eraso o unchecked. JS invariato. Nessuna nuova sintassi, AST, typeclass, helper globale o cambio dei contratti. Il fallback ha un costo runtime non misurato; il percorso specializzato non ha chiamate aggiuntive. La correttezza numerica generale resta separata.

## 0.89.3 — audit aritmetico e resto portabile

Scegliere la semantica Number di % già espressa da JS e riusare PHP fmod. Correzione in binarySource condiviso, nessuna nuova AST, guardia, libreria o modifica al solver. Il costo della funzione nativa PHP non è zero-cost dimostrato; non specializzare il resto intero senza una prova e una misura concrete. Conservare le precedenti regole statiche sui raffinamenti. La matrice differenziale copre casi finiti portabili, non dimostra l'equivalenza numerica generale. Divisione per zero, overflow e politica dei non finiti restano una decisione separata: non imporre fdiv o cast generalizzati per nascondere divergenze. Prima della 0.90 rimane la coerenza delle API/Result/Option (0.89.4 proposta).

## Direzione dopo la 0.89.3

La revisione complessiva è in [Consolidamento Mira 0.83–0.89.3](consolidation-089.md), incluso nel quaderno Studio. La 0.89.1–0.89.3 sono integrate con CI verde. Prossima proposta: 0.89.4, coerenza Option/Result senza nuove keyword; decisione separata per divisione per zero, non finiti e overflow. Poi 0.90 tooling multifile, 0.91 codec, 0.92 GUI checked, 0.93 effetti tipizzati, 0.94 workspace. Numerazione indicativa e priorità rivedibili: la 1.0 deve essere uno strumento di lavoro, non una conta di feature.

## Registro storico delle questioni aperte

[Registro delle questioni aperte 0.1–0.89.3](open-questions.md): indice permanente con ID, stato, riferimenti e distinzione tra questioni irrisolte, limiti parziali, rinvii, verifiche e risoluzioni. Incluso nel quaderno Studio; aggiornare le voci ad ogni incremento pertinente.

## 0.89.4 — vocabolario comune delle API (primo incremento)

Data / Outcome è un normale modulo Mira, non prelude implicita. Option e Result condividono identità nominale e rappresentazione tag/value già esistente. Necessario supportare import selettivi di tipi nei contratti indipendenti per il decoder applicativo. Si migra il pilota: JSON e data condividono Result, lettura storage espone Option. Date Safe e Storage Optional sono sottili facciate Mira sopra contratti nativi esistenti, senza nuovi adapter host. Le vecchie API restano disponibili; il generatore JSON accetta un'identità Result dichiarata nella configurazione e verifica ancora struttura e payload. Errori I/O Storage non vengono convertiti in None; rimangono eccezioni. Date Safe copre solo costruzione da testo; fallimenti add days e scrittura/rimozione restano aperti. L'envelope JSON privato, doppia validazione data e costo dei tag non sono zero-cost misurati. Non fingere di aver uniformato tutti gli errori in questa iterazione.
