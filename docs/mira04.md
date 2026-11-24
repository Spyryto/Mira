# Mira 0.4 — accessor, booleani e filtri reali

> **Documentazione storica:** gli esempi di questa pagina descrivono la
> sintassi della 0.4. Dalla 0.6 `~` legge direttamente un campo, mentre
> l'applicazione funzionale usa `>>`. Per eseguire oggi gli esempi,
> sostituisci `lesson ~ hours` con `lesson >> hours` quando `hours`
> è dichiarato con `field "hours"`.

Questa versione nasce dal dogfooding di [Mira Atlas](atlas.md): le
trasformazioni dei record devono essere leggibili e le condizioni devono
essere valutate in Mira, non nel JavaScript dell'interfaccia.

## Accessor di prima classe, senza chiamata host

```mira
hours = field "hours";
rate = field "rate";
fee: lesson = (lesson ~ hours) * (lesson ~ rate);
lesson = {hours: 1.5, rate: 30};
result = fee: lesson;
```

`field "hours"` costruisce una funzione che legge il campo `hours` di un
record. `lesson ~ hours` resta una **normale applicazione funzionale**:
non è un operatore speciale per i record. Il compilatore genera direttamente
una funzione JavaScript o PHP e non chiama un host per ogni lettura.

Le chiavi dei campi sono stringhe esplicite, non inferite dal nome della
variabile. I record JS richiedono una proprietà *own*; i record PHP sono
array associativi. Un campo mancante genera un errore di esecuzione
su entrambi i backend.

Non sono implementati accessor derivati automaticamente da una dichiarazione
di tipo, record nominali o controllo statico della presenza del campo.

## Booleani e confronti

```mira
enabled = true;
score = 8;
result = enabled == (score >= 6);
```

Disponibili: `true`, `false`, `==`, `!=`, `<`, `>`, `<=`, `>=`.
Sono operatori nativi, non dipendono dall'host. Il parser continua ad avere
**un solo livello di precedenza, associativo a sinistra**: usa le parentesi
per esprimere le intenzioni e per evitare confronti a catena ambigui.

`==` e `!=` sono emessi come uguaglianza stretta `===` / `!==` su
JavaScript e PHP. Per ora i test di parità riguardano scalari omogenei;
eguaglianza fra array/record e differenze di rappresentazione numerica
non hanno ancora semantica unificata dal linguaggio.

## Espressione condizionale lazy

```mira
result = if: (score >= 6),
  then: ("Superato"),
  else: ("Da ripetere");
```

`if: (...), then: (...), else: (...)` è un costrutto **nativo**:
le espressioni sono delimitate da parentesi e l'emettitore produce
l'operatore condizionale del backend. **Si valuta un solo ramo**.
Questo è importante per espressioni che possono generare errori o avere
effetti host.

Il compilatore non dispone ancora di un type checker: non è verificato
staticamente che la condizione sia un booleano. Per esiti portabili
conviene usare predicati che restituiscano `true` o `false`.

## Filtrare lezioni con un predicato Mira

```mira
lessons = [
  {student: "Ada", hours: 1.5},
  {student: "Eva", hours: 0.5},
  {student: "Lia", hours: 2}
];
hours = field "hours";
student name = field "student";
billable: lesson = (lesson ~ hours) >= 1;

result = map: (filter: lessons, with: (billable: _)),
  with: (student name);
```

Il predicato `billable:` è scritto in Mira. **`filter:with:` rimane
una capability host**: JavaScript usa un array filtrato e PHP usa
`array_filter` con reindicizzazione, con limite di 10.000 elementi.
`map:with:` è anch'esso host. Non abbiamo introdotto prematuramente
una libreria standard delle collezioni.

Il [registro delle lezioni](../catalog/examples/teaching-ledger.mira)
è stato migrato dagli accessor `get:from:` a `lesson ~ hours` e
`lesson ~ rate`.

## Dogfooding: Atlas filtra in Mira

Nel sorgente [`studio/atlas/atlas.mira`](../studio/atlas/atlas.mira) trovi:

```mira
module matches: module, group: expected =
  (module ~ group field) == expected;

atlas select modules: modules, group: requested =
  if: (requested == "Tutti"),
  then: (modules),
  else: (filter: modules,
    with: (module matches: _, group: (requested)));
```

L'Atlas browser ora richiama la funzione Mira precompilata
`atlas_select_modules` invece di effettuare `modules.filter(...)`
in JavaScript. Il codice UI mantiene la responsabilità per DOM,
SVG e interazione.

Il benchmark `node scripts/benchmark-atlas.mjs` continua a confrontare
le trasformazioni Mira→JS con la stessa logica scritta manualmente
in JavaScript, con input identici e risultati verificati. I numeri
variabili nel tempo sono pubblicati nei sommari GitHub Actions, non
sono valori garantiti.

## Requisiti rimasti dopo la 0.4

- **Predicati come funzioni anonime:** sezioni di operatori `(_ > 3)`
  e closure vere ridurrebbero la necessità di definizioni dedicate.
- **Moduli e import Mira:** Atlas sta diventando più grande di un file.
- **Collezioni portabili:** implementare progressivamente `sort`,
  `groupBy` e traversal, misurando i costi di host e di runtime.
- **Stringhe e interpolazione:** le etichette dell'Atlas restano in JS.
- **Tipi somma/pattern matching:** fondamentali per analizzare l'AST
  senza controllare campi stringa `kind`.
- **Tipi e checker:** utili per contratti e semantica coerente
  dell'uguaglianza, ma non necessari per questo dogfooding.

La documentazione dell'origine dei testi resta visibile in
[`docs/documentation-origin.md`](documentation-origin.md).
