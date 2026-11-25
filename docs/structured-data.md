# Mira — dati strutturati e casi d'uso (esperimento)

Questa iterazione aggiunge due costrutti **del linguaggio**, mantenendo
i servizi sulle collezioni come normali callable dell'ambiente:

- **Sequenze**: `[3, 5, 8]` o `[{title: "A", minutes: 4.5}, ...]`.
- **Record anonimi**: `{venue: "Padova", fee: 240}`.

I record possono contenere campi calcolati, liste e altri record. Le chiavi
possono essere parole singole, nomi composti senza virgolette (per esempio
`{total hours: 3}`) oppure letterali di testo (`{"total hours": 3}`).
Le forme con e senza virgolette sono equivalenti; le chiavi duplicate e
le virgole finali vengono rifiutate. Non sono ancora tipi record dichiarati
né oggetti con metodi.

## Una scaletta costruita in Mira

```mira
songs = [
  {title: "Opening", minutes: 4.5},
  {title: "Midnight", minutes: 3.75},
  {title: "Encore", minutes: 5.25}
];

duration: song = get: "minutes", from: (song);
add duration: total, of: song = total + (duration: song);

total minutes =
  fold: songs, with: (add duration: _, of: _), from: 0;

result = {minutes: total minutes, songs: songs};
```

Il codice completo produce anche una scaletta trasformata con tempi
espressi in secondi. Tutto il calcolo del minutaggio è scritto in Mira;
l'ambiente fornisce soltanto il traversamento di una lista e l'accesso
alle chiavi di un record.

Quattro esempi completi sono in `catalog/examples/`:
`practice-log.mira`, `setlist-plan.mira`, `gig-ledger.mira`,
`teaching-ledger.mira`. Sono integrati nel riferimento automatico e
verificati in CI eseguendo i programmi generati **sia in JS sia in PHP**.

I numeri economici e chilometrici sono illustrativi, non tariffe o
rimborsi ufficiali.

## Contratto host: nessun ciclo speciale nel parser

Il manifest `studio/host.json` dichiara i selettori:

```json
{
  "values": [],
  "callables": ["log"],
  "selectors": ["fold:with:from:", "map:with:", "get:from:"]
}
```

- `get: key, from: record` legge una chiave presente, altrimenti segnala
  un errore;
- `map: list, with: f` applica `f` a ogni elemento;
- `fold: list, with: reducer, from: seed` restituisce l'accumulatore.

Le implementazioni host sono in `studio/collection-host.js` e
`test/fixtures/CollectionHost.php`. Non costituiscono ancora una libreria
standard di Mira: sono un'interoperabilità di prova, con limite di 10.000
elementi per la PWA. Mira conosce soltanto nomi, funzioni e valori.

Il codice del compilatore emette un array JS oppure un array PHP per le
sequenze, un oggetto JS oppure un array associativo PHP per i record.
Questo è il livello minimo sufficiente per programmi descrittivi e
portabili, senza introdurre una VM o un nuovo sistema di tipi.

## Dogfooding: dall'AST a una lista di report

`studio/dogfood/inspector.mira` continua a contare i nodi con reducer Mira,
ma ora costruisce anche **un record per ciascuna definizione**:

```mira
summarize: definition = {
  name: (get: "name", from: (definition)),
  kind: (get: "kind", from: (definition)),
  nodes: (fold: definition, with: (count: _, node: _), from: 0),
  calls: (fold: definition, with: (count kind: "Call"), from: 0)
};
definition summaries =
  map: (get: "definitions", from: ast tree), with: (summarize: _);
```

L'host fornisce l'AST, attraversa nodi o liste e recupera chiavi.
**Il report, la scelta delle statistiche e l'accumulazione sono Mira.**
Il rendering dei report e dell'albero rimane JavaScript presentazionale.

Nella PWA: **Esplora → Inspector visuale**. Apri il sorgente e modifica
un reducer, quindi premi **Ricalcola con Mira** per osservare l'effetto.
La documentazione e i programmi sono disponibili nella **Guida** offline.

## Limiti conosciuti

Questa non è ancora una collezione standard ricca: mancano pattern matching,
immutatibilità verificata, record tipizzati, operatori di confronto,
`filter` generalizzato e applicazione n-aria uniforme. Le funzioni host non
sono controllate staticamente per argomenti e valore restituito.

Le due nuove forme sintattiche sono sperimentali prima di Mira 1.0;
il loro utilizzo nei case study ci aiuterà a decidere cosa conservare.

## Alias di collezione (Mira 0.6.3)

Gli alias sono selettori dell'host, non parole riservate del compilatore.
La semantica è uniforme su JS e PHP, con lo stesso limite di 10.000 elementi.

| Operazione | Selettori equivalenti |
| --- | --- |
| Filtrare una lista | `filter:with:`, `select:with:`, `select:if:`, `collect:if:` |
| Trasformare gli elementi | `map:with:`, `collect:with:` |

L'esempio richiesto si può scrivere direttamente:

```mira
billable: lesson = (lesson ~ hours) >= 1;
result = collect: lessons, if: (billable: _);
```

Per mantenere la distinzione con Smalltalk, `collect:with:` trasforma
ogni elemento (come `collect:` in Smalltalk), mentre la forma discorsiva
`collect:if:` seleziona gli elementi per cui il predicato è vero.
Gli alias riutilizzano le implementazioni esistenti: niente duplicazione
dei cicli di iterazione e nessuna modifica al parser di Mira.

## Fold con blocchi multi-parametro (Mira 0.9)

I blocchi della 0.9 permettono di definire il riduttore direttamente
nell'argomento `with:`, senza introdurre una nuova funzione di nome:

```mira
numbers = [1, 2, 3, 4];
result = fold: numbers, with: ({total, item | total + item}), from: 0;
```

L'accumulatore iniziale è `0`, e il risultato è `10`. L'host JS
esegue `Array.reduce`, l'host PHP `array_reduce`; la callback è
emessa dal compilatore come closure nativa. I dati sono limitati a
10.000 elementi, come già avveniva per `fold`.

I blocchi multi-parametro non sono applicabili con `>>`, che resta
riservato alle funzioni unarie. Questo evita di introdurre currying
implicito prima di averne progettato semantica e limiti.

## Accesso prioritario e blocchi diretti (Mira 0.10)

Con `~` associativo a sinistra e prioritario sull'aritmetica, il
programma seguente non necessita parentesi attorno a ogni campo.
`with:` accetta il blocco senza un involucro `( )`.

```mira
lessons = [
  {hours: 2, rate: 30},
  {hours: 1.5, rate: 40}
];
result = fold: lessons,
  with: {total, lesson |
    total + (lesson ~ hours * lesson ~ rate)
  },
  from: 0;
```

Risultato: `120`, con semantica identica in JS e PHP.
Le parentesi attorno alla moltiplicazione sono ancora necessarie
per separarla dalla somma: gli operatori aritmetici mantengono
la stessa precedenza reciproca.

## Blocchi con più espressioni (Mira 0.11)

Un blocco di `fold:with:from:` può eseguire più espressioni
prima di restituire il risultato dell'accumulo:

```mira
numbers = [1, 2, 3];
result = fold: numbers,
  with: {sum, item |
    item + 10;
    sum + (item * 2)
  },
  from: 0;
```

Il risultato è `12`, identico su JS e PHP. La prima espressione
viene comunque valutata, ma solo l'ultima diventa il nuovo
accumulatore. Per il momento i blocchi non possono definire
variabili locali né modificare parametri: l'estensione
alla sequenza di espressioni è indipendente da quella scelta.
