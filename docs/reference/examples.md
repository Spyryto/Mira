# Esempi eseguibili Mira

Catalogo generato e validato in CI. Gli esempi numerici vengono eseguiti su JS/PHP; gli esempi UI sono compilati su entrambi i target ed eseguiti con il DOM host JS.

<a id="example-invoice-total"></a>
## Fattura e trasferta

Compenso comprensivo di ore e trasferta.

Feature: [Definizioni di valori](language.md#feature-values)

```mira
hourly rate = 28;
rehearsal hours = 3;
travel expense = 14;
work subtotal = hourly rate * rehearsal hours;
result = work subtotal + travel expense;
```

**Risultato:** result = 98

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/invoice-total)

<a id="example-concert-margin"></a>
## Margine di un concerto

Incasso meno costo fisso.

Feature: [Definizioni di valori](language.md#feature-values)

```mira
ticket price = 18;
seats reserved = 27;
venue fee = 90;
gross receipts = ticket price * seats reserved;
result = gross receipts - venue fee;
```

**Risultato:** result = 396

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/concert-margin)

<a id="example-salary-adjustment"></a>
## Voci di stipendio

Identificatori autoesplicativi.

Feature: [Identificatori composti](language.md#feature-names)

```mira
base salary = 1800;
performance bonus = 225;
tax adjustment = 75;
total taxable amount = base salary + performance bonus;
result = total taxable amount - tax adjustment;
```

**Risultato:** result = 1950

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/salary-adjustment)

<a id="example-fuel-efficiency"></a>
## Consumi di viaggio

Usa nomi composti lungo tutto il calcolo.

Feature: [Identificatori composti](language.md#feature-names)

```mira
distance travelled = 240;
fuel consumed = 16;
average kilometers per liter = distance travelled / fuel consumed;
result = average kilometers per liter;
```

**Risultato:** result = 15

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/fuel-efficiency)

<a id="example-cash-discount"></a>
## Sconto su fattura

Funzione con due parametri.

Feature: [Funzioni con parametri](language.md#feature-functions)

```mira
discount: total, by: amount = total - amount;
invoice total = 200;
coupon value = 35;
result = discount: invoice total, by: coupon value;
```

**Risultato:** result = 165

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/cash-discount)

<a id="example-scale-estimate"></a>
## Stima scalata

Funzione parametrica riutilizzabile.

Feature: [Funzioni con parametri](language.md#feature-functions)

```mira
scale: value, by: factor = value * factor;
original value = 12;
multiplier = 6;
result = scale: original value, by: multiplier;
```

**Risultato:** result = 72

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/scale-estimate)

<a id="example-three-step-score"></a>
## Punteggio in tre passaggi

Tre keyword con ruolo distinto.

Feature: [Selettori con più keyword](language.md#feature-selectors)

```mira
apply: base, plus: increment, times: factor = (base + increment) * factor;
result = apply: 10, plus: 4, times: 3;
```

**Risultato:** result = 42

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/three-step-score)

<a id="example-tax-and-discount"></a>
## Imposte e sconto

Keyword con più parole.

Feature: [Selettori con più keyword](language.md#feature-selectors)

```mira
price: subtotal, plus tax: tax, less discount: discount = subtotal + tax - discount;
result = price: 100, plus tax: 22, less discount: 15;
```

**Risultato:** result = 107

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/tax-and-discount)

<a id="example-calculated-arguments"></a>
## Argomenti calcolati

Le parentesi delimitano l'argomento composto.

Feature: [Chiamate discorsive](language.md#feature-shorthand)

```mira
add: a, and: b = a + b;
result = add (12 * 3) and (7 + 5);
```

**Risultato:** result = 48

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/calculated-arguments)

<a id="example-shipping-charge"></a>
## Etichetta discorsiva composta

Omissione dei due punti con letterali.

Feature: [Chiamate discorsive](language.md#feature-shorthand)

```mira
total: base, with shipping: fee = base + fee;
result = total 48 with shipping 7;
```

**Risultato:** result = 55

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/shipping-charge)

<a id="example-fractional-invoice"></a>
## Importi decimali

Unisce interi e decimali in una fattura.

Feature: [Letterali numerici](language.md#feature-numbers)

```mira
unit price = 12.5;
quantity = 4;
packing fee = 2.75;
subtotal = unit price * quantity;
result = subtotal + packing fee;
```

**Risultato:** result = 52.75

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/fractional-invoice)

<a id="example-minutes-rate"></a>
## Minuti e coefficiente

Conversione numerica di una durata.

Feature: [Letterali numerici](language.md#feature-numbers)

```mira
seconds = 135;
minutes = seconds / 60;
speed factor = 1.5;
result = minutes * speed factor;
```

**Risultato:** result = 3.375

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/minutes-rate)

<a id="example-band-title"></a>
## Titolo di una band

Stringa trasportata da un selettore.

Feature: [Letterali testuali](language.md#feature-strings)

```mira
label: value = value;
band name = "I Liberamente";
result = label: band name;
```

**Risultato:** result = "I Liberamente"

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/band-title)

<a id="example-welcome-label"></a>
## Testo di benvenuto

Seleziona il testo da due parametri.

Feature: [Letterali testuali](language.md#feature-strings)

```mira
reply: name, with: greeting = greeting;
person name = "Daniele";
welcome text = "Benvenuto in Mira Studio";
result = reply: person name, with: welcome text;
```

**Risultato:** result = "Benvenuto in Mira Studio"

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/welcome-label)

<a id="example-left-to-right"></a>
## Valutazione da sinistra

Lo stesso livello di precedenza cambia il risultato.

Feature: [Operatori aritmetici](language.md#feature-arithmetic)

```mira
start balance = 8;
bonus = 2;
factor = 5;
deduction = 10;
result = start balance + bonus * factor - deduction / 2;
```

**Risultato:** result = 20

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/left-to-right)

<a id="example-modulo-remainder"></a>
## Resto di una ripartizione

Combina modulo e calcoli intermedi.

Feature: [Operatori aritmetici](language.md#feature-arithmetic)

```mira
batch size = (90 - 15) / 3;
extra items = 6 * 2;
result = batch size + extra items % 7;
```

**Risultato:** result = 2

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/modulo-remainder)

<a id="example-stage-production"></a>
## Costi per gruppo

Parentesi e prodotti in un budget.

Feature: [Parentesi](language.md#feature-grouping)

```mira
participants = 5;
guests = 7;
meal cost = 10;
discount = 4;
result = (participants + guests) * (meal cost - discount) / 3;
```

**Risultato:** result = 24

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/stage-production)

<a id="example-split-payment"></a>
## Ripartizione e supplemento

Parentesi nel denominatore.

Feature: [Parentesi](language.md#feature-grouping)

```mira
gross amount = 100;
first group = 2;
second group = 3;
extra per person = 4 * 2;
result = gross amount / (first group + second group) + extra per person;
```

**Risultato:** result = 28

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/split-payment)

<a id="example-reduce-price"></a>
## Sconto riutilizzabile

Sezione unaria che conserva lo sconto.

Feature: [Sezioni unarie](language.md#feature-sections)

```mira
subtract: amount, by: deduction = amount - deduction;
reduce by ten = (subtract: _, by: 10);
listed price = 85;
result = listed price >> reduce by ten;
```

**Risultato:** result = 75

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/reduce-price)

<a id="example-triple-quantity"></a>
## Moltiplicatore nominato

Trasforma una funzione binaria in una unaria.

Feature: [Sezioni unarie](language.md#feature-sections)

```mira
scale: value, by: factor = value * factor;
triple = (scale: _, by: 3);
boxes = 14;
result = boxes >> triple;
```

**Risultato:** result = 42

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/triple-quantity)

<a id="example-mix-two-inputs"></a>
## Funzione binaria

Invoca mixer(7,9) nel test dei target.

Feature: [Sezioni con più `_`](language.md#feature-multi-sections)

```mira
blend: first, with: second = first * 2 + second;
mixer = (blend: _, with: _);
result = 0;
```

**Risultato:** mixer(7, 9) = 23

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/mix-two-inputs)

<a id="example-fee-calculator"></a>
## Due argomenti liberi

Invoca adjustment(125,20) nei test.

Feature: [Sezioni con più `_`](language.md#feature-multi-sections)

```mira
adjust: price, by: percent, with fee: fee = price * percent / 100 + fee;
adjustment = (adjust: _, by: _, with fee: 6);
result = 0;
```

**Risultato:** adjustment(125, 20) = 31

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/fee-calculator)

<a id="example-recording-level"></a>
## Catena di livelli

Moltiplica e aggiunge in una pipeline.

Feature: [Pipeline `>>`](language.md#feature-pipelines)

```mira
add: a, and: b = a + b;
multiply: a, by: b = a * b;
input level = 6;
result = input level >> (multiply: _, by: 3) >> (add: _, and: 4);
```

**Risultato:** result = 22

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/recording-level)

<a id="example-revised-budget"></a>
## Budget progressivo

Due trasformazioni consecutive.

Feature: [Pipeline `>>`](language.md#feature-pipelines)

```mira
subtract: amount, by: deduction = amount - deduction;
scale: amount, by: multiplier = amount * multiplier;
original budget = 50;
result = original budget >> (subtract: _, by: 5) >> (scale: _, by: 2);
```

**Risultato:** result = 90

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/revised-budget)

<a id="example-extra-budget"></a>
## Sezione che cattura un parametro

Una funzione restituisce un'altra funzione.

Feature: [Cattura lessicale](language.md#feature-captures)

```mira
add: a, and: b = a + b;
add extra: extra = (add: _, and: extra);
base budget = 12;
result = base budget >> (add extra: 8);
```

**Risultato:** result = 20

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/extra-budget)

<a id="example-rate-factory"></a>
## Fabbrica di moltiplicatori

Il parametro esterno resta disponibile.

Feature: [Cattura lessicale](language.md#feature-captures)

```mira
multiply: a, by: b = a * b;
multiply by: multiplier = (multiply: _, by: multiplier);
items count = 7;
result = items count >> (multiply by: 6);
```

**Risultato:** result = 42

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/rate-factory)

<a id="example-declare-later"></a>
## Dichiarazione successiva

Firma raccolta prima dell'analisi del corpo.

Feature: [Dichiarazioni successive](language.md#feature-forward)

```mira
# Il calcolo precede la definizione.
result = total: 20, plus: 5;
total: a, plus: b = a + b;
```

**Risultato:** result = 25

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/declare-later)

<a id="example-commented-forward"></a>
## Commenti e firma futura

I commenti non cambiano la raccolta delle firme.

Feature: [Dichiarazioni successive](language.md#feature-forward)

```mira
# Durata stimata, prima della dichiarazione.
result = double: 19;
# Il selettore viene definito dopo il suo utilizzo.
double: value = value * 2;
```

**Risultato:** result = 38

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/commented-forward)

<a id="example-ambiguous-words"></a>
## Argomenti senza confini

Errore intenzionale: richiede confini espliciti.

Feature: [Diagnostica e ambiguità](language.md#feature-diagnostics)

```mira
add: first number, and: second number = first number + second number;
result = add first number and second number;
```

**Risultato:** Errore atteso: Unknown identifier

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/ambiguous-words)

<a id="example-duplicate-parameter"></a>
## Parametro ripetuto

Errore intenzionale su una firma.

Feature: [Diagnostica e ambiguità](language.md#feature-diagnostics)

```mira
add: x, and: x = x + x;
result = add 2 and 3;
```

**Risultato:** Errore atteso: Duplicate parameter

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/duplicate-parameter)

<a id="example-practice-log"></a>
## Registro delle sessioni di studio

Una lista di durate viene aggregata e trasformata in secondi attraverso funzioni Mira passate all'host.

Feature: [Sequenze e trasformazioni](language.md#feature-sequences)

```mira
# Sessioni di studio: dati e trasformazioni rimangono in Mira.
session minutes = [15, 20, 10, 25];
add: first, and: second = first + second;
to seconds: minutes = minutes * 60;

total minutes = fold: session minutes, with: (add: _, and: _), from: 0;
session seconds = map: session minutes, with: (to seconds: _);
result = {minutes: total minutes, seconds: session seconds};
```

**Risultato:** result = {"minutes":70,"seconds":[900,1200,600,1500]}

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/practice-log)

<a id="example-setlist-plan"></a>
## Scaletta musicale e minutaggio

Elabora una lista di brani, calcola la durata e produce una nuova scaletta con le durate in secondi.

Feature: [Sequenze e trasformazioni](language.md#feature-sequences)

```mira
# Scaletta: i dati sono una sequenza di record Mira.
songs = [
  {title: "Opening", minutes: 4.5},
  {title: "Midnight", minutes: 3.75},
  {title: "Encore", minutes: 5.25}
];
duration: song = get: "minutes", from: (song);
add duration: total, of: song = total + (duration: song);
to plan: song = {
  title: (get: "title", from: (song)),
  seconds: ((duration: song) * 60)
};

total minutes = fold: songs, with: (add duration: _, of: _), from: 0;
plan = map: songs, with: (to plan: _);
result = {minutes: total minutes, items: plan};
```

**Risultato:** result = {"minutes":13.5,"items":[{"title":"Opening","seconds":270},{"title":"Midnight","seconds":225},{"title":"Encore","seconds":315}]}

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/setlist-plan)

<a id="example-gig-ledger"></a>
## Bilancio di tre concerti

Per ogni serata calcola un compenso netto stimato, poi riepiloga tutti i concerti.

Feature: [Record e dati strutturati](language.md#feature-records)

```mira
# Stima illustrativa, con rimborso chilometrico convenzionale.
shows = [
  {venue: "Padova", fee: 240, km: 60, toll: 5},
  {venue: "Treviso", fee: 310, km: 100, toll: 8},
  {venue: "Venezia", fee: 180, km: 30, toll: 0}
];
net: show = (get: "fee", from: (show))
  - ((get: "km", from: (show)) * 0.2)
  - (get: "toll", from: (show));
add net: subtotal, from: show = subtotal + (net: show);
summarize: show = {
  venue: (get: "venue", from: (show)),
  net: (net: show)
};

net total = fold: shows, with: (add net: _, from: _), from: 0;
settlements = map: shows, with: (summarize: _);
result = {netTotal: net total, shows: settlements};
```

**Risultato:** result = {"netTotal":679,"shows":[{"venue":"Padova","net":223},{"venue":"Treviso","net":282},{"venue":"Venezia","net":174}]}

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/gig-ledger)

<a id="example-teaching-ledger"></a>
## Registro delle lezioni di chitarra

Ricalcola ricavi e voci di un registro lezioni a partire da record strutturati.

Feature: [Record e dati strutturati](language.md#feature-records)

```mira
lessons = [
  {student: "Anna", hours: 1.5, rate: 30},
  {student: "Luca", hours: 2, rate: 25},
  {student: "Mia", hours: 1, rate: 35}
];
fee: lesson = (lesson ~ hours) * (lesson ~ rate);
accumulate fee: total, with: lesson = total + (fee: lesson);
invoice: lesson = {
  student: (lesson ~ student),
  amount: (fee: lesson)
};
income = fold: lessons, with: (accumulate fee: _, with: _), from: 0;
invoices = map: lessons, with: (invoice: _);
result = {income: income, invoices: invoices};
```

**Risultato:** result = {"income":130,"invoices":[{"student":"Anna","amount":45},{"student":"Luca","amount":50},{"student":"Mia","amount":35}]}

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/teaching-ledger)

<a id="example-browser-alert"></a>
## Alert dall’host

Mira chiama una funzione dell'host che apre una finestra di dialogo nell'anteprima.

Feature: [UI web e interoperabilità](language.md#feature-browser-ui)

```mira
# alert è una normale funzione dell'host, non una keyword Mira.
render {
  type: "text",
  text: "Questa view è creata in Mira. Ora compare un alert."
};
alert "Ciao! Questo messaggio arriva da Mira!";
```

**Risultato:** Anteprima interattiva (browser JS; PHP compilato soltanto)

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/browser-alert)

<a id="example-browser-view"></a>
## View e pulsante

Una view dichiarativa costruita con record Mira; il pulsante richiama una funzione Mira.

Feature: [UI web e interoperabilità](language.md#feature-browser-ui)

```mira
# La UI è un record Mira, interpretato dal renderer dell'host.
say hello: ignored = alert "Ciao dal pulsante Mira!";

render {
  type: "column",
  children: [
    {type: "title", text: "Una view scritta in Mira"},
    {type: "text", text: "Nessun accesso diretto al DOM."},
    {type: "button", label: "Salutami", onClick: (say hello: _)}
  ]
};
```

**Risultato:** Anteprima interattiva (browser JS; PHP compilato soltanto)

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/browser-view)

<a id="example-browser-counter"></a>
## Pulsante con contatore

Mira definisce sia la view dipendente dallo stato sia le transizioni +1 e -1; l'host conserva il valore e gestisce i clic.

Feature: [UI web e interoperabilità](language.md#feature-browser-ui)

```mira
# Lo stato corrente viene mantenuto dall'host.
# Le trasformazioni di stato e la view sono funzioni Mira.
increment: value = value + 1;
decrement: value = value - 1;

counter view: value = {
  type: "column",
  children: [
    {type: "title", text: "Contatore funzionale"},
    {type: "text", text: value},
    {type: "button", label: "+1", update: (increment: _)},
    {type: "button", label: "-1", update: (decrement: _)}
  ]
};

render {
  type: "state",
  initial: 0,
  view: (counter view: _)
};
```

**Risultato:** Anteprima interattiva (browser JS; PHP compilato soltanto)

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/browser-counter)

<a id="example-lesson-accessors"></a>
## Fattura di una lezione

Gli accessor `field` restano funzioni di prima classe, applicate con `>>`.

Feature: [Accessor funzionali di record](language.md#feature-accessors)

```mira
lesson = {hours: 1.5, rate: 30};
hours = field "hours";
rate = field "rate";
result = (lesson >> hours) * (lesson >> rate);
```

**Risultato:** result = 45

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/lesson-accessors)

<a id="example-student-accessors"></a>
## Record dello studente

Due accessor costruiscono un riepilogo di un record Mira.

Feature: [Accessor funzionali di record](language.md#feature-accessors)

```mira
student = {name: "Ada", minutes: 90};
name = field "name";
minutes = field "minutes";
result = {student: (student >> name), hours: ((student >> minutes) / 60)};
```

**Risultato:** result = {"student":"Ada","hours":1.5}

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/student-accessors)

<a id="example-threshold-comparisons"></a>
## Confronti e booleani

Operatori relazionali, uguaglianza stretta e letterali true/false senza host.

Feature: [Booleani e confronti](language.md#feature-comparisons)

```mira
result = (8 >= 6) == true;
```

**Risultato:** result = true

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/threshold-comparisons)

<a id="example-equality-comparisons"></a>
## Confronti su testo e numeri

Confronti fra scalari verificati sia su JavaScript sia su PHP.

Feature: [Booleani e confronti](language.md#feature-comparisons)

```mira
result = ("Mira" != "Nail") == (3 < 5);
```

**Risultato:** result = true

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/equality-comparisons)

<a id="example-conditional-label"></a>
## Scelta di un'etichetta

if:then:else: valuta soltanto il ramo selezionato.

Feature: [Espressioni condizionali](language.md#feature-conditionals)

```mira
result = if: (1 < 2), then: ("valid"), else: ("invalid");
```

**Risultato:** result = "valid"

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/conditional-label)

<a id="example-conditional-fee"></a>
## Soglia per uno sconto

Un record viene prodotto da una condizione che non richiede callback host.

Feature: [Espressioni condizionali](language.md#feature-conditionals)

```mira
fee = 4;
result = {bonus: (if: (fee >= 6), then: (10), else: (0))};
```

**Risultato:** result = {"bonus":0}

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/conditional-fee)

<a id="example-filter-numbers"></a>
## Numeri sopra soglia

Un predicato Mira filtra una lista con la primitiva host filter:with:.

Feature: [Filtri con predicati Mira](language.md#feature-filtering)

```mira
numbers = [2, 5, 9, 1];
greater than four: value = value > 4;
result = filter: numbers, with: (greater than four: _);
```

**Risultato:** result = [5,9]

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/filter-numbers)

<a id="example-filter-lessons"></a>
## Lezioni da fatturare

Accesso diretto `~`, predicati Mira, filter e map compongono una lista di lezioni.

Feature: [Filtri con predicati Mira](language.md#feature-filtering)

```mira
lessons = [
  {student: "Ada", hours: 1.5},
  {student: "Eva", hours: 0.5},
  {student: "Lia", hours: 2}
];
billable: lesson = (lesson ~ hours) >= 1;
result = collect: (collect: lessons, if: (billable: _)),
  with: (_ ~ student);
```

**Risultato:** result = ["Ada","Lia"]

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/filter-lessons)

<a id="example-operator-threshold"></a>
## Soglia come funzione

Un predicato con un valore catturato diventa una funzione chiamabile nella pipeline.

Feature: [Sezioni di operatori](language.md#feature-operator-sections)

```mira
minimum = 6;
passes = (_ >= minimum);
result = 8 >> passes;
```

**Risultato:** result = true

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/operator-threshold)

<a id="example-operator-as-argument"></a>
## Predicato passato a un selettore

Una sezione di operatore è un normale valore funzione passato a un selettore discorsivo.

Feature: [Sezioni di operatori](language.md#feature-operator-sections)

```mira
accept: predicate = 8 >> predicate;
result = accept: (_ > 5);
```

**Risultato:** result = true

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/operator-as-argument)

<a id="example-record-field-path"></a>
## Navigazione di record annidati

Lettura diretta e concatenata dei campi senza accessor intermedi.

Feature: [Accesso diretto ai campi `~`](language.md#feature-field-get)

```mira
student = {address: {city: "Padova"}};
result = student ~ address ~ city;
```

**Risultato:** result = "Padova"

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/record-field-path)

<a id="example-record-field-quoted"></a>
## Campo con spazi

Una chiave testuale letterale permette campi con nomi non identificatori.

Feature: [Accesso diretto ai campi `~`](language.md#feature-field-get)

```mira
lesson = {"total hours": 3};
result = lesson ~ "total hours";
```

**Risultato:** result = 3

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/record-field-quoted)

<a id="example-record-field-words"></a>
## Campo con nome composto, senza virgolette

La stessa chiave composta si scrive senza virgolette nella dichiarazione del record e dopo ~.

Feature: [Accesso diretto ai campi `~`](language.md#feature-field-get)

```mira
lesson = {total hours: 3};
result = lesson ~ total hours;
```

**Risultato:** result = 3

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/record-field-words)

<a id="example-collect-if-lessons"></a>
## Collect if: selezionare lezioni

`collect:if:` filtra usando un predicato Mira, senza introdurre un secondo algoritmo.

Feature: [Filtri con predicati Mira](language.md#feature-filtering)

```mira
lessons = [
  {student: "Ada", hours: 1.5},
  {student: "Eva", hours: 0.5},
  {student: "Lia", hours: 2}
];
billable: lesson = (lesson ~ hours) >= 1;
result = collect: lessons, if: (billable: _);
```

**Risultato:** result = [{"student":"Ada","hours":1.5},{"student":"Lia","hours":2}]

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/collect-if-lessons)

<a id="example-collect-with-numbers"></a>
## Collect with: trasformare valori

`collect:with:` è l'alias per la trasformazione `map:with:`.

Feature: [Sequenze e trasformazioni](language.md#feature-sequences)

```mira
numbers = [1, 2, 3];
result = collect: numbers, with: (_ * 2);
```

**Risultato:** result = [2,4,6]

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/collect-with-numbers)

<a id="example-conditional-natural-label"></a>
## Selezione discorsiva senza due punti

`if (test) then value else value` equivale alla forma con `if:then:else:`.

Feature: [Espressioni condizionali](language.md#feature-conditionals)

```mira
result = if (1 < 2) then "valid" else "invalid";
```

**Risultato:** result = "valid"

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/conditional-natural-label)

<a id="example-conditional-natural-lazy"></a>
## Ramo non selezionato mai eseguito

La forma discorsiva mantiene il ramo falso lazy anche quando contiene un campo inesistente.

Feature: [Espressioni condizionali](language.md#feature-conditionals)

```mira
result = if (true) then 42 else ({value: 0} ~ missing);
```

**Risultato:** result = 42

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/conditional-natural-lazy)

<a id="example-conditional-optional-commas"></a>
## Virgole e due punti opzionali

`if (test), then: (a), else: (b)` resta identico alla sintassi sintetica senza punteggiatura.

Feature: [Espressioni condizionali](language.md#feature-conditionals)

```mira
result = if (1 < 2), then: ("valid"), else: ("invalid");
```

**Risultato:** result = "valid"

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/conditional-optional-commas)

<a id="example-block-fee"></a>
## Calcolo della tariffa con un blocco

Lo stesso parametro `_` viene riutilizzato per leggere due campi e calcolare il compenso.

Feature: [Blocchi funzione con parametro](language.md#feature-blocks)

```mira
lesson = {hours: 2, rate: 30};
fee = {_ | (_ ~ hours) * (_ ~ rate)};
result = lesson >> fee;
```

**Risultato:** result = 60

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/block-fee)

<a id="example-block-filter"></a>
## Filtrare lezioni con un blocco

Il blocco `{ _ | (_ ~ hours) >= 1 }` evita una funzione nominata e viene passato direttamente al filtro.

Feature: [Blocchi funzione con parametro](language.md#feature-blocks)

```mira
lessons = [
  {student: "Ada", hours: 1.5},
  {student: "Eva", hours: 0.5},
  {student: "Lia", hours: 2}
];
result = collect: lessons, if: ({_ | (_ ~ hours) >= 1});
```

**Risultato:** result = [{"student":"Ada","hours":1.5},{"student":"Lia","hours":2}]

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/block-filter)

<a id="example-block-fold-numbers"></a>
## Somma di numeri con un blocco binario

`fold` riceve direttamente `{total, item | total + item}` senza dichiarare un selettore riduttore.

Feature: [Blocchi con più parametri](language.md#feature-block-parameters)

```mira
numbers = [1, 2, 3, 4];
result = fold: numbers, with: ({total, item | total + item}), from: 0;
```

**Risultato:** result = 10

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/block-fold-numbers)

<a id="example-block-fold-fees"></a>
## Ridurre il compenso di più lezioni

Un blocco con due parametri accede a due campi del record e accumula il compenso.

Feature: [Blocchi con più parametri](language.md#feature-block-parameters)

```mira
lessons = [
  {hours: 2, rate: 30},
  {hours: 1.5, rate: 40}
];
result = fold: lessons,
  with: ({total, lesson | total + ((lesson ~ hours) * (lesson ~ rate))}),
  from: 0;
```

**Risultato:** result = 120

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/block-fold-fees)

<a id="example-precedence-fee"></a>
## Tariffa senza parentesi sui campi

La lettura di ciascun campo precede la moltiplicazione.

Feature: [Accesso `~` prima dell'aritmetica](language.md#feature-field-precedence)

```mira
lesson = {hours: 2, rate: 30};
result = lesson ~ hours * lesson ~ rate;
```

**Risultato:** result = 60

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/precedence-fee)

<a id="example-precedence-nested-field"></a>
## Accessi concatenati e addizione

La concatenazione `a ~ b ~ c` viene completata prima della somma.

Feature: [Accesso `~` prima dell'aritmetica](language.md#feature-field-precedence)

```mira
student = {address: {city: {length: 6}}};
result = student ~ address ~ city ~ length + 1;
```

**Risultato:** result = 7

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/precedence-nested-field)

<a id="example-bare-fold-fees"></a>
## Fold compensi con blocco diretto

Il blocco con due parametri è passato a `with:` senza parentesi tonde, come nell'esempio richiesto.

Feature: [Blocchi diretti negli argomenti dei selettori](language.md#feature-bare-block-arguments)

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

**Risultato:** result = 120

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/bare-fold-fees)

<a id="example-bare-collect-map"></a>
## Trasformare una lista con un blocco diretto

Il selettore `collect:with:` accetta direttamente un blocco unario.

Feature: [Blocchi diretti negli argomenti dei selettori](language.md#feature-bare-block-arguments)

```mira
numbers = [1, 2, 3];
result = collect: numbers, with: {_ | _ * 2};
```

**Risultato:** result = [2,4,6]

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/bare-collect-map)

<a id="example-block-steps-last"></a>
## Il blocco restituisce l'ultima espressione

Due espressioni separate da `;`; il risultato della prima viene valutato ma non restituito.

Feature: [Blocchi con espressioni in sequenza](language.md#feature-block-steps)

```mira
result = 4 >> {n |
  n + 1;
  n * 3
};
```

**Risultato:** result = 12

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/block-steps-last)

<a id="example-block-steps-fold"></a>
## Più espressioni nel riduttore

Un blocco binario con due espressioni viene invocato da `fold` senza parentesi aggiuntive.

Feature: [Blocchi con espressioni in sequenza](language.md#feature-block-steps)

```mira
numbers = [1, 2, 3];
result = fold: numbers,
  with: {sum, item |
    item + 10;
    sum + (item * 2)
  },
  from: 0;
```

**Risultato:** result = 12

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/block-steps-fold)

<a id="example-local-values-fee"></a>
## Compenso con subtotale locale

Un subtotale immutabile alimenta il risultato finale.

Feature: [Valori locali immutabili nei blocchi](language.md#feature-local-values)

```mira
rate = 30;
result = 2 >> {hours |
  subtotal = hours * rate;
  subtotal + 5
};
```

**Risultato:** result = 65

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/local-values-fee)

<a id="example-local-values-closure"></a>
## Closure annidata con valore locale

Il blocco interno cattura `doubled` definito nel blocco esterno.

Feature: [Valori locali immutabili nei blocchi](language.md#feature-local-values)

```mira
result = 4 >> {value |
  doubled = value * 2;
  doubled >> {inner |
    inner + doubled
  }
};
```

**Risultato:** result = 16

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/local-values-closure)

<a id="example-local-values-fold"></a>
## Riduzione con valore locale

Il riduttore calcola `doubled` su ogni elemento.

Feature: [Valori locali immutabili nei blocchi](language.md#feature-local-values)

```mira
numbers = [1, 2, 3];
result = fold: numbers,
  with: {sum, item |
    doubled = item * 2;
    sum + doubled
  },
  from: 0;
```

**Risultato:** result = 12

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/local-values-fold)

<a id="example-local-before-declaration"></a>
## Locale usato prima della dichiarazione

Errore intenzionale che segnala il nome del valore usato troppo presto e la posizione nel sorgente.

Feature: [Diagnostica e ambiguità](language.md#feature-diagnostics)

```mira
result = 4 >> {value |
  subtotal = amount + value;
  amount = value * 2;
  subtotal
};
```

**Risultato:** Errore atteso: used before its declaration

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/local-before-declaration)

<a id="example-block-parameter-mangle"></a>
## Collisione del parametro dopo mangling

`a b` e `aB` sono diversi in Mira, ma non devono diventare la stessa variabile JS/PHP.

Feature: [Diagnostica e ambiguità](language.md#feature-diagnostics)

```mira
a b = 4;
result = (a b + 1) >> {aB | a b + aB};
```

**Risultato:** Errore atteso: Generated-name collision for block parameter

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/block-parameter-mangle)

<a id="example-legal-nested-shadow"></a>
## Shadowing lessicale con lo stesso nome

Un parametro interno può ombreggiare correttamente un parametro esterno con identico nome.

Feature: [Diagnostica e ambiguità](language.md#feature-diagnostics)

```mira
result = 4 >> {value |
  (value + 1) >> {value |
    value * 2
  }
};
```

**Risultato:** result = 10

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/legal-nested-shadow)

<a id="example-function-parameter-mangle"></a>
## Collisione tra parametri nominati

Due nomi distinti che generano lo stesso identificatore JS/PHP vengono rifiutati prima dell'emissione.

Feature: [Diagnostica e ambiguità](language.md#feature-diagnostics)

```mira
sum: a b, and: aB = a b + aB;
result = sum: 2, and: 3;
```

**Risultato:** Errore atteso: Generated-name collision for function parameter

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/function-parameter-mangle)

<a id="example-function-parameter-shadow"></a>
## Shadowing valido in una funzione nominata

Il parametro omonimo a un valore globale lo ombreggia senza rinominare il globale.

Feature: [Diagnostica e ambiguità](language.md#feature-diagnostics)

```mira
x = 100;
increment: x = x + 1;
result = increment: 5;
```

**Risultato:** result = 6

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/function-parameter-shadow)

<a id="example-nullary-value"></a>
## Computazione differita

Un blocco creato ma non chiamato non valuta il proprio corpo.

Feature: [Blocchi senza parametri](language.md#feature-nullary-blocks)

```mira
unused = {| {present: 1} ~ missing};
action = {| 21 * 2};
result = () >> action;
```

**Risultato:** result = 42

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/nullary-value)

<a id="example-nullary-closure"></a>
## Cattura lessicale senza argomenti

Una closure senza parametri cattura un valore locale del blocco esterno.

Feature: [Blocchi senza parametri](language.md#feature-nullary-blocks)

```mira
result = 20 >> {x |
  subtotal = x + 1;
  action = {| subtotal * 2};
  () >> action
};
```

**Risultato:** result = 42

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/nullary-closure)

<a id="example-gui-greeting"></a>
## Salutami · input reattivo

Un campo di testo aggiorna lo stato e una closure senza argomenti apre un saluto.

Feature: [Libreria GUI Mira e binding](language.md#feature-gui-library)

```mira
# Mira GUI: ordinary functions; no compiler or DOM dependencies.
column: items = {type: "column", children: items};
row: items = {type: "row", children: items};
title: caption = {type: "title", text: caption};
text: content = {type: "text", text: content};
button: caption, on click: action = {
  type: "button", label: caption, onClick: action
};
button: caption, update: transition = {
  type: "button", label: caption, update: transition
};
text input: caption, value: current, update: transition = {
  type: "input", label: caption, value: current, update: transition
};
checkbox: caption, checked: current, update: transition = {
  type: "checkbox", label: caption, checked: current, update: transition
};
choose: caption, value: current, options: choices, update: transition = {
  type: "select", label: caption, value: current, options: choices, update: transition
};
state: initial, view: factory = {type: "state", initial: initial, view: factory};
# Explicit identity for resetting a state at the same structural position.
state: initial, key: identity, view: factory = {
  type: "state", initial: initial, key: identity, view: factory
};

# Style records compose from left to right; decorators do not add DOM nodes.
styled: view, with: layers = {type: "styled", view: view, styles: layers};
grid: count, children: items = {type: "grid", columns: count, children: items};

# Un input con binding e un pulsante che cattura lo stato.
greeting: name = column: [
  title: "Salutami",
  text input: "Il tuo nome", value: name, update: {old, entered | entered},
  text: name,
  button: "Mostra saluto", on click: {| alert name}
];

render (state: "Mira", view: (greeting: _));
```

**Risultato:** Anteprima interattiva (browser JS; PHP compilato soltanto)

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/gui-greeting)

<a id="example-gui-lesson"></a>
## Scheda lezione · form reattivo

Input, layout orizzontale, checkbox e select con calcolo del compenso e stato immutabile.

Feature: [Libreria GUI Mira e binding](language.md#feature-gui-library)

```mira
# Mira GUI: ordinary functions; no compiler or DOM dependencies.
column: items = {type: "column", children: items};
row: items = {type: "row", children: items};
title: caption = {type: "title", text: caption};
text: content = {type: "text", text: content};
button: caption, on click: action = {
  type: "button", label: caption, onClick: action
};
button: caption, update: transition = {
  type: "button", label: caption, update: transition
};
text input: caption, value: current, update: transition = {
  type: "input", label: caption, value: current, update: transition
};
checkbox: caption, checked: current, update: transition = {
  type: "checkbox", label: caption, checked: current, update: transition
};
choose: caption, value: current, options: choices, update: transition = {
  type: "select", label: caption, value: current, options: choices, update: transition
};
state: initial, view: factory = {type: "state", initial: initial, view: factory};
# Explicit identity for resetting a state at the same structural position.
state: initial, key: identity, view: factory = {
  type: "state", initial: initial, key: identity, view: factory
};

# Style records compose from left to right; decorators do not add DOM nodes.
styled: view, with: layers = {type: "styled", view: view, styles: layers};
grid: count, children: items = {type: "grid", columns: count, children: items};

# Una piccola scheda lezione, con stato immutabile e componenti.
lesson view: model = column: [
  title: "Scheda lezione",
  text input: "Allievo", value: (model ~ student),
    update: {old, entered | {
      student: entered, hours: (old ~ hours), paid: (old ~ paid), mode: (old ~ mode)
    }},
  row: [
    button: "-1 ora", update: {old | {
      student: (old ~ student),
      hours: (if (old ~ hours > 1) then (old ~ hours - 1) else 1),
      paid: (old ~ paid), mode: (old ~ mode)
    }},
    text: (model ~ hours),
    button: "+1 ora", update: {old | {
      student: (old ~ student), hours: (old ~ hours + 1),
      paid: (old ~ paid), mode: (old ~ mode)
    }}
  ],
  choose: "Modalita", value: (model ~ mode), options: ["In presenza", "Online"],
    update: {old, selected | {
      student: (old ~ student), hours: (old ~ hours),
      paid: (old ~ paid), mode: selected
    }},
  checkbox: "Pagato", checked: (model ~ paid),
    update: {old, checked | {
      student: (old ~ student), hours: (old ~ hours),
      paid: checked, mode: (old ~ mode)
    }},
  text: (model ~ student),
  text: (model ~ mode),
  text: "Compenso in euro (30 / ora)",
  text: (model ~ hours * 30),
  text: (if (model ~ paid) then "Saldato" else "Da saldare")
];

render (state: {student: "Ada", hours: 2, paid: false, mode: "In presenza"},
  view: (lesson view: _));
```

**Risultato:** Anteprima interattiva (browser JS; PHP compilato soltanto)

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/gui-lesson)

<a id="example-gui-independent"></a>
## Due contatori indipendenti

I contatori figli mantengono il proprio stato quando il genitore cambia il passo; le callback usano il passo corrente.

Feature: [DOM incrementale e stato indipendente](language.md#feature-incremental-gui)

```mira
# Mira GUI: ordinary functions; no compiler or DOM dependencies.
column: items = {type: "column", children: items};
row: items = {type: "row", children: items};
title: caption = {type: "title", text: caption};
text: content = {type: "text", text: content};
button: caption, on click: action = {
  type: "button", label: caption, onClick: action
};
button: caption, update: transition = {
  type: "button", label: caption, update: transition
};
text input: caption, value: current, update: transition = {
  type: "input", label: caption, value: current, update: transition
};
checkbox: caption, checked: current, update: transition = {
  type: "checkbox", label: caption, checked: current, update: transition
};
choose: caption, value: current, options: choices, update: transition = {
  type: "select", label: caption, value: current, options: choices, update: transition
};
state: initial, view: factory = {type: "state", initial: initial, view: factory};
# Explicit identity for resetting a state at the same structural position.
state: initial, key: identity, view: factory = {
  type: "state", initial: initial, key: identity, view: factory
};

# Style records compose from left to right; decorators do not add DOM nodes.
styled: view, with: layers = {type: "styled", view: view, styles: layers};
grid: count, children: items = {type: "grid", columns: count, children: items};

# Il genitore cambia il passo, non lo stato dei contatori figli.
counter: caption, step: amount = state: 0, view: {n | row: [
  button: caption, update: {old | old + amount},
  text: n
]};
parent view: amount = column: [
  title: "Due contatori indipendenti",
  text: amount,
  button: "Cambia passo", update: {old | old + 1},
  counter: "A +1", step: amount,
  counter: "B +1", step: amount
];
render (state: 1, view: (parent view: _));
```

**Risultato:** Anteprima interattiva (browser JS; PHP compilato soltanto)

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/gui-independent)

<a id="example-gui-reset"></a>
## Nuova sessione · reset esplicito

Una chiave diversa resetta solo il componente figlio nella stessa posizione.

Feature: [DOM incrementale e stato indipendente](language.md#feature-incremental-gui)

```mira
# Mira GUI: ordinary functions; no compiler or DOM dependencies.
column: items = {type: "column", children: items};
row: items = {type: "row", children: items};
title: caption = {type: "title", text: caption};
text: content = {type: "text", text: content};
button: caption, on click: action = {
  type: "button", label: caption, onClick: action
};
button: caption, update: transition = {
  type: "button", label: caption, update: transition
};
text input: caption, value: current, update: transition = {
  type: "input", label: caption, value: current, update: transition
};
checkbox: caption, checked: current, update: transition = {
  type: "checkbox", label: caption, checked: current, update: transition
};
choose: caption, value: current, options: choices, update: transition = {
  type: "select", label: caption, value: current, options: choices, update: transition
};
state: initial, view: factory = {type: "state", initial: initial, view: factory};
# Explicit identity for resetting a state at the same structural position.
state: initial, key: identity, view: factory = {
  type: "state", initial: initial, key: identity, view: factory
};

# Style records compose from left to right; decorators do not add DOM nodes.
styled: view, with: layers = {type: "styled", view: view, styles: layers};
grid: count, children: items = {type: "grid", columns: count, children: items};

# La chiave identifica la sessione: cambiare chiave azzera il figlio.
counter view: n = row: [
  text: n,
  button: "Incrementa", update: {old | old + 1}
];
session view: session = column: [
  title: "Sessione",
  text: session,
  button: "Nuova sessione", update: {old | if (old == "A") then "B" else "A"},
  state: 0, key: session, view: (counter view: _)
];
render (state: "A", view: (session view: _));
```

**Risultato:** Anteprima interattiva (browser JS; PHP compilato soltanto)

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/gui-reset)

<a id="example-gui-dashboard"></a>
## Dashboard musicale · stili componibili

Schede metriche, griglia, colori e pulsante reattivo.

Feature: [Stili GUI componibili e griglia](language.md#feature-styled-gui)

```mira
# Mira GUI: ordinary functions; no compiler or DOM dependencies.
column: items = {type: "column", children: items};
row: items = {type: "row", children: items};
title: caption = {type: "title", text: caption};
text: content = {type: "text", text: content};
button: caption, on click: action = {
  type: "button", label: caption, onClick: action
};
button: caption, update: transition = {
  type: "button", label: caption, update: transition
};
text input: caption, value: current, update: transition = {
  type: "input", label: caption, value: current, update: transition
};
checkbox: caption, checked: current, update: transition = {
  type: "checkbox", label: caption, checked: current, update: transition
};
choose: caption, value: current, options: choices, update: transition = {
  type: "select", label: caption, value: current, options: choices, update: transition
};
state: initial, view: factory = {type: "state", initial: initial, view: factory};
# Explicit identity for resetting a state at the same structural position.
state: initial, key: identity, view: factory = {
  type: "state", initial: initial, key: identity, view: factory
};

# Style records compose from left to right; decorators do not add DOM nodes.
styled: view, with: layers = {type: "styled", view: view, styles: layers};
grid: count, children: items = {type: "grid", columns: count, children: items};

# Stili riutilizzabili, layout e componenti in Mira.
panel style = {padding: 16, gap: 8, radius: 14, borderWidth: 2,
  borderStyle: "solid", borderColor: "#202629", shadow: "hard"};
metric: caption, amount: number, tint: tone = styled: (column: [
  text: caption,
  styled: (title: number), with: [{fontSize: 30, fontWeight: 800}]
]), with: [panel style, {background: tone}];

dashboard: count = styled: (column: [
  styled: (title: "Studio musicale"), with: [{fontSize: 25}],
  text: "Riepilogo lezioni",
  grid: 2, children: [
    metric: "Lezioni", amount: count, tint: "#c1f1dc",
    metric: "Compenso EUR", amount: (count * 30), tint: "#ffdbab"
  ],
  styled: (button: "Nuova lezione", update: {old | old + 1}),
    with: [{background: "#272a52", color: "#ffffff", padding: 14, radius: 10}]
]), with: [{gap: 16, padding: 12}];

render (state: 2, view: (dashboard: _));
```

**Risultato:** Anteprima interattiva (browser JS; PHP compilato soltanto)

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/gui-dashboard)

<a id="example-gui-style-toggle"></a>
## Tema dinamico

Cambia i colori della stessa view senza rimontarla.

Feature: [Stili GUI componibili e griglia](language.md#feature-styled-gui)

```mira
# Mira GUI: ordinary functions; no compiler or DOM dependencies.
column: items = {type: "column", children: items};
row: items = {type: "row", children: items};
title: caption = {type: "title", text: caption};
text: content = {type: "text", text: content};
button: caption, on click: action = {
  type: "button", label: caption, onClick: action
};
button: caption, update: transition = {
  type: "button", label: caption, update: transition
};
text input: caption, value: current, update: transition = {
  type: "input", label: caption, value: current, update: transition
};
checkbox: caption, checked: current, update: transition = {
  type: "checkbox", label: caption, checked: current, update: transition
};
choose: caption, value: current, options: choices, update: transition = {
  type: "select", label: caption, value: current, options: choices, update: transition
};
state: initial, view: factory = {type: "state", initial: initial, view: factory};
# Explicit identity for resetting a state at the same structural position.
state: initial, key: identity, view: factory = {
  type: "state", initial: initial, key: identity, view: factory
};

# Style records compose from left to right; decorators do not add DOM nodes.
styled: view, with: layers = {type: "styled", view: view, styles: layers};
grid: count, children: items = {type: "grid", columns: count, children: items};

# Cambia i colori senza rimontare il componente.
base style = {padding: 18, radius: 14, gap: 12};
theme view: dark = styled: (column: [
  title: "Tema dinamico",
  text: "Stessi nodi, colori diversi",
  button: "Cambia tema", update: {old | if (old) then false else true}
]), with: [base style, (if (dark)
  then {background: "#202629", color: "#ffffff", shadow: "soft"}
  else {background: "#c1f1dc", color: "#202629"})];
render (state: false, view: (theme view: _));
```

**Risultato:** Anteprima interattiva (browser JS; PHP compilato soltanto)

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/gui-style-toggle)

