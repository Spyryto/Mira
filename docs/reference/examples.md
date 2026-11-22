# Esempi eseguibili Mira

Catalogo generato, validato dalla CI su JavaScript e PHP. Gli esempi con errore atteso sono contrassegnati.

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
result = listed price ~ reduce by ten;
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
result = boxes ~ triple;
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

Feature: [Pipeline `~`](language.md#feature-pipelines)

```mira
add: a, and: b = a + b;
multiply: a, by: b = a * b;
input level = 6;
result = input level ~ (multiply: _, by: 3) ~ (add: _, and: 4);
```

**Risultato:** result = 22

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/recording-level)

<a id="example-revised-budget"></a>
## Budget progressivo

Due trasformazioni consecutive.

Feature: [Pipeline `~`](language.md#feature-pipelines)

```mira
subtract: amount, by: deduction = amount - deduction;
scale: amount, by: multiplier = amount * multiplier;
original budget = 50;
result = original budget ~ (subtract: _, by: 5) ~ (scale: _, by: 2);
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
result = base budget ~ (add extra: 8);
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
result = items count ~ (multiply by: 6);
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
fee: lesson = (get: "hours", from: (lesson))
  * (get: "rate", from: (lesson));
accumulate fee: total, with: lesson = total + (fee: lesson);
invoice: lesson = {
  student: (get: "student", from: (lesson)),
  amount: (fee: lesson)
};

income = fold: lessons, with: (accumulate fee: _, with: _), from: 0;
invoices = map: lessons, with: (invoice: _);
result = {income: income, invoices: invoices};
```

**Risultato:** result = {"income":130,"invoices":[{"student":"Anna","amount":45},{"student":"Luca","amount":50},{"student":"Mia","amount":35}]}

[Apri in Mira Studio](https://spyryto.github.io/Mira/#/example/teaching-ledger)

