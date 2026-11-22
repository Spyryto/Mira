# Dogfooding 01 — AST Inspector scritto in Mira

Questa PR è un **esperimento**, non l'avvio del bootstrap del compilatore.

L'obiettivo concreto è fare in modo che Mira Studio utilizzi davvero Mira
per trasformare un AST prodotto dal proprio compilatore.

## Primo contratto host: `extern`

Una dichiarazione `extern` definisce una dipendenza esplicita dall'ambiente,
senza corpo Mira:

```mira
extern ast tree;
extern fold: nodes, with: reducer, from: initial;
extern node: item, is: kind;
```

Le firme sono raccolte dal normale `Symbols` e le chiamate sono risolte dallo
stesso `SelectorResolver` usato dal resto del linguaggio. Non è prevista
alcuna conoscenza speciale di `fold` o `node` nel parser.

La generazione di codice produce:

- JavaScript: `__miraHost.get(name)` e `__miraHost.call(selector, arguments)`.
- PHP: `MiraHost::get(name)` e `MiraHost::call(selector, arguments)`.

**I target richiedono un host esplicito a runtime.** Il compilatore non
fornisce silenziosamente accesso a filesystem, DOM o networking.
L'host dell'inspector nega qualsiasi valore o selettore sconosciuto.

## Il programma Mira dell'inspector

Codice: [studio/dogfood/inspector.mira](../studio/dogfood/inspector.mira).

```mira
count: total, node: item = total + 1;
count matching: kind, total: total, node: item =
  total + (node: item, is: kind);

count kind: wanted = (count matching: wanted, total: _, node: _);

total nodes = fold: ast tree, with: (count: _, node: _), from: 0;
call nodes = fold: ast tree, with: (count kind: "Call"), from: 0;
section nodes = fold: ast tree, with: (count kind: "Section"), from: 0;
```

La parte host è volutamente stretta: fornisce l'AST, attraversa i figli dei
nodi secondo la struttura dell'AST canonico e restituisce 1 o 0 quando un
nodo ha un determinato `kind`.

**I reducer, la scelta delle categorie e l'accumulazione sono Mira.**
Il codice JavaScript non calcola le statistiche che compaiono nelle card.
La visualizzazione ad albero usa una ricorsione JS presentazionale sui
nodi dell'AST; non è ancora scritta in Mira.

## Come provarlo in Mira Studio

1. Compila un qualsiasi programma Mira.
2. Apri **Esplora → Inspector visuale · scritto in Mira**.
3. Espandi l'albero AST e leggi le statistiche.
4. Apri **Il programma Mira che calcola le statistiche**.
5. Cambia `count: total, node: item = total + 1;` in `... = total + 2;`.
6. Premi **Ricalcola con Mira**: il totale raddoppia, senza modifiche all'host.

Puoi ripristinare il programma predefinito con **Ripristina**.
La copia modificata viene salvata localmente al comando Ricalcola. La PWA
include e conserva offline il sorgente Mira, l'host e il worker.

## Esempio aggiuntivo di contratto host

Il seguente programma si compila per entrambi i target ma, coerentemente,
richiede l'host in fase di esecuzione:

```mira
extern price;
extern add: left, and: right;
result = add: price, and: 7;
```

Con `get("price") → 13` e `call("add:and:", [13, 7]) → 20` il risultato
è 20. Il test di regressione lo esegue nel backend JavaScript e verifica
il contratto emesso anche per PHP.

## Limiti e sicurezza

- Non sono state introdotte liste e record generali, cicli, match o funzioni
  anonime arbitrarie nel linguaggio.
- `fold` è una **capability host** e non una primitiva standard del linguaggio.
- La compilazione Haxe rimane la fonte di verità per token, parser e AST.
- Il programma dell'inspector è eseguito in un Web Worker. Il Worker evita
  di bloccare l'interfaccia nei casi comuni, ma **non è un sandbox di
  sicurezza** per programmi di terzi.
- Nessuna promessa di stabilità della sintassi `extern` prima della 1.0.
- La PR deve rimanere aperta finché non valutiamo se il confine host è
  sufficientemente espressivo e verificabile.

## Test di correttezza e dogfooding

`npm test` comprende test che verificano:

- la compilazione delle dichiarazioni extern in JS/PHP;
- la coerenza dei risultati dell'inspector con il numero reale di nodi;
- la corrispondenza delle trasformazioni nei due runtime;
- un **test metamorfico**: modificare la funzione Mira di conteggio cambia
  davvero il numero restituito;
- il rifiuto di primitive host non autorizzate e la disponibilità offline.

Questo test di laboratorio prepara il terreno per Value, trasformazioni AST
più ricche e un componente View dichiarativo, senza introdurli prematuramente.
