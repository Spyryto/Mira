# Moduli Mira — progetto concordato e piano di implementazione

**Stato: progettazione delle interfacce.** La 0.65 introduce il nucleo di
identità e scope isolati; la 0.66 aggiunge sezioni piatte, export di
valori/selettori senza annotazioni e tipi nominali pubblici completi; la 0.67 introduce import selettivi,
import completi e alias di simboli; la 0.68 introduce firme pubbliche
esplicite, comprese quelle parametriche; la 0.69 aggiunge tipi opachi
monomorfi e controllo delle fughe di tipi privati; la 0.69.1 estende
l'opacità ai parametri e ai riferimenti annidati nei tipi pubblici.
La 0.70 introduce riesportazioni esplicite con alias e identità originale.
La 0.70.1 introduce tree shaking conservativo opt-in in modalità checked.
La 0.71 aggiunge il Module Explorer di Studio, con dati del resolver e del checker.
Vedi grammar.md per le funzionalità implementate.
Il campionario completo resta una proposta. Sostituisce la direzione sperimentale
della PR #95 (nomi puntati come fondamento del namespace), che non va integrata
nella sua forma attuale. Gli import statici della 0.30 continuano a funzionare
secondo la grammatica documentata per quella versione.

## Decisioni concordate

- Il percorso logico è una sequenza di nomi discorsivi: `module Music / Jazz Harmony;`.
  Non dipende dal percorso fisico del file. `Music` è un segmento, non uno
  scope padre: non deve esistere come modulo e non conferisce alcun accesso
  automatico. Ogni modulo ha uno scope isolato.
- `interface` e `implementation` delimitano sezioni piatte, senza graffe,
  indentazione obbligatoria o annidamento dell'implementazione.
- Prima i simboli esportati, incluse le riesportazioni; poi gli import
  dell'interfaccia; poi `implementation`. Le firme devono poter riferirsi
  ai tipi importati successivamente: prima si raccolgono le direttive, poi
  si risolvono le dichiarazioni. L'implementazione può usare anche gli import
  dell'interfaccia e aggiungere import privati all'inizio.
- L'interfaccia rende pubblici i tipi e le firme delle funzioni esportate.
  Non obbliga il programmatore a scrivere tutte le firme: inferenza e
  annotazioni esplicite possono convivere. Un'annotazione pubblica è un
  contratto che l'implementazione deve rispettare, non un semplice commento.
- Alias uniformi con `=>` per valori, tipi, selettori e moduli; anche
  gli alias di modulo sono discorsivi (`Float Num`). Nessun wrapper.
- Nelle firme, negli import e negli alias, gli spazi tra keyword sono
  facoltativi. `transpose:by:`, `transpose: by:`, `transpose:by: ;`
  e `transpose: by: ;` (con terminatore dove richiesto) denotano lo stesso
  selettore, con la stessa arità. Convenzione editoriale concordata:
  nei sorgenti degli import preferire sempre uno spazio dopo ogni label
  finale prima del punto e virgola e tra le label: `square: ;`,
  `add: by: => somma: a: ;`. Non è una restrizione grammaticale.
- I tipi nominali possono esporre la rappresentazione o tenerla opaca.
  Un alias non crea una nuova identità nominale.
- Visibilità privata per default; dipendenze esplicite, import non
  transitivi nello scope del consumatore. Nessun oggetto modulo, lookup
  o dispatch dinamico dovuto ai soli import statici.

## Syntax tour (proposta, non programma compilabile)

Riorganizzazione del campionario rivisto dall'autore: gli import pubblici
seguono le esportazioni. Gli esempi di import sono alternative dimostrative:
in un modulo reale si evitano import doppi o collisioni con dichiarazioni
locali. Le funzioni sono illustrative, non tutte le operazioni qui mostrate
sono implementate o verificate dal checker 0.64.

```mira
module Music / Jazz Harmony;

interface

# Riesportazione
export Music / Theory {
  Note;
  Chord;
};

# Valori: inferiti ed espliciti
standard tuning;
default voicing;
octave size (Integer);
reference frequency (Number);

# Tipi opachi
Jazz Chord;
Voicing;
Collection (Element Type);

# Tipi nominali pubblici
Pitch Class :: Integer where _ >= 0 AND _ <= 11;

Interval :: {
  semitones: Integer,
  name: Text
};

Chord Quality ::
  Major | Minor | Dominant | Diminished | Augmented;

Pair (First Type, Second Type) :: {
  first: First Type,
  second: Second Type
};

Result (Success Type, Failure Type) ::
  Ok (Success Type) | Err (Failure Type);

Tree (Element Type) ::
  Leaf (Element Type) | Branch ([Tree (Element Type)]);

# Selettori inferiti
normalize note:;
transpose: by: ;
notes of:;
default chord: ;

# Selettori con firma esplicita
interval between: and: :: (Note, Note) -> Interval;
make chord:with: :: (Note, Chord Quality) -> Jazz Chord;
parse chord: :: (Text) -> Result (Jazz Chord, Text);

# Selettori parametrici
identity (Value Type): :: (Value Type) -> Value Type;
make pair (A, B):with: :: (A, B) -> Pair (A, B);

# Operatore e metadati (proposta da consolidare separatamente)
(**) :: (Number, Number) -> Number;
(**) :: {
  precedence: above arithmetic,
  associativity: right
};

# Import selettivi
import Music / Theory / Note;
import Music / Theory / transpose: by: ;
import Math / Integer {
  remainder: by: ;
  absolute value: ;
};

# Alias, anche delle keyword
import Music / Theory {
  Chord => Accord;
  transpose: by: => trasponi: di: ;
};

# Import completo e alias di modulo
import Data / Collections {
  *
};
import Math / Floating Point => Float Num;

implementation

# Import privati
import Music / Internal / Chord Parser {
  parse: ;
};
import Math / Power {
  power: to: ;
};

# Import compile time (proposta, non ancora implementata)
import compile time Language / Tools {
  transform: ;
};

# Rappresentazioni private dei tipi opachi
Jazz Chord :: {root: Note, quality: Chord Quality};
Voicing :: [Note];
Collection (T) :: [T];

# Tipo privato
Internal State :: {notes: [Note], position: Integer};

# Valori pubblici
standard tuning = [40, 45, 50, 55, 59, 64];
default voicing (Voicing) = [];
octave size = 12;
reference frequency = 440;

# Valori e funzione privati
minimum pitch = 0;
maximum pitch = 127;

clamp pitch: n =
  if (n < minimum pitch)
    then minimum pitch
    else (if (n > maximum pitch) then maximum pitch else n);

# Funzioni con firma inferita
normalize note: n = remainder: n, by: octave size;
transpose: note, by: interval = clamp pitch: (note + interval);
notes of: voicing (Voicing) = voicing;
default chord: root = make chord: root, with: Major;

# Firma pubblica utilizzata come tipo atteso
interval between: first, and: second = {
  semitones: second - first,
  name: "Interval"
};

# Annotazioni compatibili anche nell'implementazione
make chord: root (Note), with: quality (Chord Quality)
  -> Jazz Chord = {root: root, quality: quality};

parse chord: text = parse: text;

identity: value = value;
make pair: first, with: second = {first: first, second: second};

(**) = power: _, to: _;
```

## Semantica e invarianti da verificare

1. **Identità.** Il modulo è il percorso completo, non l'ultimo segmento;
   ogni dichiarazione risolta possiede un'identità canonica indipendente dal
   nome con cui viene importata. Distinguere valore, selettore e tipo.
   Gli alias dei selettori conservano arità e ordine degli argomenti.
   La scelta del separatore di qualificazione nelle espressioni è indipendente.
2. **Risoluzione.** Nessuna visibilità implicita dal padre, dai fratelli o
   dalle dipendenze transitive. Le esportazioni esplicite costituiscono
   l'unica porta pubblica. Una riesportazione pubblica esplicitamente
   l'identità originale. Proposta: collisioni di simboli distinti nello
   stesso scope sono errori, mai "ultimo import vince" o overload per tipo.
3. **Contratto.** Firme inferite ed esplicite producono un'interfaccia
   elaborata. La firma esplicita guida la verifica del corpo; eventuali
   annotazioni ripetute devono essere compatibili. L'inferenza può essere
   riutilizzata per i consumatori senza esporre l'AST dell'implementazione.
   Proposta: rifiutare firme pubbliche che fanno trapelare tipi privati.
4. **Opacità.** Un tipo opaco ha la stessa identità dentro e fuori, ma il
   consumatore non può usare la rappresentazione privata per costruzione,
   proiezione, conversione al tipo base o pattern matching. Restituire un
   tipo opaco non autorizza automaticamente i costruttori. Un tipo somma
   pubblico richiede una regola esplicita di esposizione dei costruttori;
   dettagli ancora da definire. Nessun wrapper a runtime per il solo
   incapsulamento statico.
5. **Caricamento.** Il resolver host associa percorsi logici a sorgenti
   o interfacce; il compilatore non accede a filesystem o rete. Conservare
   coordinate originali e diagnostica per modulo. Proposta iniziale:
   grafo aciclico, dichiarazioni duplicate di modulo rifiutate, inizializzazione
   deterministica delle dipendenze prima dei consumatori.
6. **Emissione.** Riutilizzare il grafo delle dipendenze e gli emitter
   esistenti; i nomi risolti possono inizialmente essere stringhe canoniche
   non esprimibili dal sorgente. Non è necessario introdurre subito un
   nuovo tipo Symbol ID in ogni nodo AST. Mangling iniettivo e portabile,
   inclusi i selettori PHP case-insensitive; preservare le convenzioni
   pubbliche JS/PHP preesistenti ove possibile.
7. **Fasi.** Le estensioni grammaticali non possono mutare silenziosamente
   il codice di altri moduli. Precedenza, associatività e trasformazioni
   sono risolte prima di analizzare i corpi che le utilizzano; l'import
   compile time resta un incremento separato.
8. **Tree shaking.** L'import non implica necessariamente l'emissione;
   rimuovere soltanto codice provatamente non necessario, tenendo conto
   di valori funzione, dipendenze transitive, export per l'host e
   inizializzatori con effetti. Obiettivo da misurare, non promessa.

## Scelte aperte (non adottate implicitamente)

- Sintassi del riferimento qualificato nelle espressioni, specialmente
  con alias discorsivi: punto, doppia barra o altra forma. La barra singola
  è già divisione; nei percorsi delle direttive è contestualmente non
  ambigua. Non imporre spazi per distinguere la divisione.
- Distinzione sintattica tra valore, tipo, selettore a zero argomenti e
  costruttore nullario nella lista di esportazioni (evitare di affidarsi
  alle sole maiuscole se non già previsto dalla grammatica).
- Esportazione selettiva dei costruttori, opacità di tipi somma,
  collisioni tra categorie, eventuali riesportazioni con alias.
- Contratti indipendenti, selezione statica di implementazioni,
  moduli parametrici/functor, package manager, compilazione incrementale,
  dipendenze grammaticali: sviluppi successivi, non prerequisiti.
- Moduli senza interfaccia: proposta, tutti i simboli privati e punto
  d'ingresso esplicito. Precisare effetti top-level e compatibilità
  con i vecchi import a percorso file prima dell'implementazione.

## Roadmap indicativa

| Incremento | Obiettivo |
|---|---|
| 0.65 | Percorsi discorsivi e scope isolati, identità canoniche |
| 0.66 | Sezioni piatte interface / implementation |
| 0.67 | Import selettivi e alias |
| 0.68 | Firme pubbliche inferite ed esplicite |
| 0.69 | Tipi opachi e incapsulamento |
| 0.70 | Riesportazione statica |
| 0.70.1 | Tree shaking conservativo |
| 0.71 | Esplorazione delle interfacce elaborate in Mira Studio |

Le versioni possono cambiare se un incremento necessita di un prerequisito.
Non dichiarare completo l'isolamento prima che tutte le vie d'accesso
(valori, sezioni, tipi e costruttori) siano verificate. Test positivi e
negativi, diagnostica con file/riga/colonna, JS/PHP, Studio e CI verde
prima di ogni integrazione. Confrontare codice emesso e benchmark a parità
di programma; nessun nuovo meccanismo runtime per la sola risoluzione.

## Ispirazioni, non dipendenze

Pascal (interface/implementation e uses separati), F# (firme inferite
o esplicite), OCaml e Standard ML (tipi astratti e contratti di modulo),
Dart ed Elm (import selettivi, alias), Go (indipendenza delle unità),
Racket (fasi di compilazione). Non si vuole importare integralmente il
sistema di nessuno di questi linguaggi.

## Contratti indipendenti — direzione 0.72

Prima fase sperimentale: verifica autonoma di firme esplicite utilizzando
il checker reale. Non richiede ancora sintassi di dichiarazione del
contratto o binding. Separare la verifica dal successivo collegamento
statico. Rimangono aperti: sintassi per i contratti nominati e per la
selezione delle implementazioni; identità di tipi astratti del contratto
rispetto a quelli dei provider; eventuale più ampia relazione di
compatibilità; uso del contratto durante la compilazione del consumatore.
Non considerare questi aspetti implementati nella 0.72.

### 0.73 — primo collegamento di contratti

Manifest sperimentale esterno per scegliere provider e firme esplicite.
Import logici invariati; risoluzione canonica al provider e verifica nel
build effettivo. Rimandati contratto nominale indipendente, equazioni di
tipo, qualificazione di modulo e sintassi dichiarativa per la selezione.
