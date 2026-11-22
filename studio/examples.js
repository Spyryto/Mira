// Intentionally limited to syntax implemented by Mira 0.1.
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
    id: 'errors',
    name: 'Ambiguità (errore)',
    source: `# Senza delimitatori la chiamata non è univoca.
add: first number, and: second number = first number + second number;

result = add first number and second number;`
  }
];

export const defaultSource = examples[0].source;
