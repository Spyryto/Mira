// Only examples accepted by the current Haxe Mira compiler.
// The UI does not pretend that unimplemented features work.
export const examples = [
  {
    id: 'arithmetic',
    name: 'Somma discorsiva',
    source: `# Selettori con keyword e nomi composti.
add: a number, and: another number = a number + another number;
square: value = value * value;

two = add: 1, and: 1;
five = add 2 and 3;
seven = add (two) and (five);
result = square: (seven);`
  },
  {
    id: 'words',
    name: 'Nomi composti',
    source: `# I nomi possono contenere spazi.
a number = 12;
another number = 3;
add: left value, and: right value = left value + right value;

result = add: a number, and: another number;`
  },
  {
    id: 'operators',
    name: 'Senza precedenze',
    source: `# Operatori binari associativi a sinistra.
calculated left to right = 1 + 2 * 3;
calculated with parentheses = 1 + (2 * 3);

result = calculated with parentheses;`
  },
  {
    id: 'sections',
    name: 'Sezioni e pipeline',
    source: `# _ trasforma una chiamata in una funzione.
add: left, and: right = left + right;
square: value = value * value;

increment = (add: _, and: 1);
result = 2 >> increment >> (square: _) >> (add: _, and: 1);`
  },
  {
    id: 'operator-sections',
    name: 'Sezioni di operatori · 0.5',
    source: `# I predicati sono funzioni, senza definizioni con parametro.
minimum = 6;
passes = (_ >= minimum);
result = 8 >> passes;`
  },
  {
    id: 'record-fields',
    name: 'Campi e funzioni · 0.6',
    source: `# ~ legge campi; >> applica funzioni.
lesson = {hours: 2, rate: 30};
fee: item = (item ~ hours) * (item ~ rate);
result = lesson >> (fee: _);`
  },
  {
    id: 'multiword-fields',
    name: 'Campi con più parole',
    source: `# Gli accessi ai campi usano nomi composti senza virgolette.
lesson = {total hours: 3};
result = lesson ~ total hours;`
  },
  {
    id: 'collect-if',
    name: 'Collect if · collezioni',
    source: `# collect:if: filtra; collect:with: trasforma.
lessons = [{student: "Ada", hours: 1.5}, {student: "Eva", hours: 0.5}];
billable: lesson = (lesson ~ hours) >= 1;
result = collect: lessons, if: (billable: _);`
  },
  {
    id: 'natural-if',
    name: 'If then else · 0.7',
    source: `# Due sintassi, un solo condizionale lazy.
result = if (1 < 2) then "valid" else "invalid";`
  },
  {
    id: 'conditional-commas',
    name: 'If · virgole opzionali',
    source: `# La punteggiatura tra if, then, else è opzionale.
result = if (1 < 2), then: ("valid"), else: ("invalid");`
  },
  {
    id: 'blocks',
    name: 'Blocchi · 0.8',
    source: `# Nei blocchi, ogni _ indica lo stesso parametro.
lesson = {hours: 2, rate: 30};
fee = {_ | (_ ~ hours) * (_ ~ rate)};
result = lesson >> fee;`
  },
  {
    id: 'fold-blocks',
    name: 'Fold · blocchi 0.9',
    source: `# Callback binaria: due parametri, un'espressione.
numbers = [1, 2, 3, 4];
result = fold: numbers,
  with: ({total, item | total + item}),
  from: 0;`
  },
  {
    id: 'fold-fees',
    name: 'Fold · compensi 0.10',
    source: `# L'accesso ~ precede l'aritmetica.
# with: accetta il blocco direttamente, senza parentesi.
lessons = [
  {hours: 2, rate: 30},
  {hours: 1.5, rate: 40}
];
result = fold: lessons,
  with: {total, lesson |
    total + (lesson ~ hours * lesson ~ rate)
  },
  from: 0;`
  },
  {
    id: 'block-steps',
    name: 'Blocchi · più espressioni 0.11',
    source: `# Ogni espressione viene eseguita; l'ultima è il valore restituito.
# La funzione log è fornita dall'host Studio.
result = 4 >> {value |
  log value;
  value * 3
};`
  },
  {
    id: 'local-values',
    name: 'Valori locali · 0.12',
    source: `# I nomi locali sono immutabili, e visibili solo nel blocco.
# Il blocco interno cattura il valore doubled.
result = 4 >> {value |
  doubled = value * 2;
  doubled >> {inner |
    inner + doubled
  }
};`
  },
  {
    id: 'runtime-location',
    name: 'Errore runtime · 0.13',
    source: `# Compila, poi esegui: il campo richiesto manca.
read: item = item ~ missing;
result = read: {present: 1};`
  },
  {
    id: 'function-shadow',
    name: 'Funzioni e shadowing · 0.12.2',
    source: `# Un parametro può ombreggiare un globale con lo stesso nome.
# Nomi Mira differenti ma identici dopo mangling sono vietati.
x = 100;
increment: x = x + 1;
result = increment: 5;`
  },
  {
    id: 'nested-shadow',
    name: 'Shadowing lessicale · 0.12.1',
    source: `# Lo stesso nome può essere riutilizzato nei parametri annidati.
# Nomi diversi che generano lo stesso simbolo sono invece rifiutati.
result = 4 >> {value |
  (value + 1) >> {value |
    value * 2
  }
};`
  },
  {
    id: 'host-log',
    name: 'Interoperabilità: log',
    source: `# La funzione log arriva dall'oggetto host di Studio.
log "hey there";
log (4 + 5);
result = 9;`
  },
  {
    id: 'errors',
    name: 'Ambiguità (errore)',
    source: `# Senza delimitatori la chiamata non è univoca.
add: first number, and: second number = first number + second number;

result = add first number and second number;`
  }
];

export const defaultSource = examples[0].source;
