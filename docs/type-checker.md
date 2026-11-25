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
