# Mira — Quaderno di progettazione

Questo quaderno raccoglie decisioni e proposte delle discussioni fino alla 0.52. Non è una specifica eseguibile. Le indicazioni di stato distinguono ciò che è verificato dalla direzione concordata e dagli aspetti ancora aperti.

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
