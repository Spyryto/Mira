# Dogfooding 01 — oggetto Host e AST Inspector scritto in Mira

Questa PR è sperimentale: non è bootstrap e non va integrata in main senza revisione.

## Un ambiente di funzioni, senza extern

Un programma Mira può chiamare una funzione resa disponibile dall'ambiente:

```mira
log "hey there";
log (4 + 5);
result = 9;
```

Il compilatore riceve il manifest **separatamente dal sorgente**:

```json
{ "values": [], "callables": ["log"], "selectors": [] }
```

L'host JS espone i callable in un semplice oggetto:

```javascript
const host = { log: message => console.log(message) };
```

Il codice JS generato richiama direttamente `__miraHost["log"]("hey there")`.
Non passa attraverso un dispatcher `get/call`; il compilatore risolve i nomi
registrati, e continua a segnalare gli identificatori sconosciuti.

L'host PHP espone un array associativo di callable:

```php
$GLOBALS['__miraHost'] = [
  'log' => static function($message) { echo $message, "\n"; }
];
```

Il codice emesso invoca il callable usando il suo nome registrato, evitando
la collisione con la funzione matematica nativa `log()` di PHP.

### Che cosa contiene il manifest

- `values`: nomi di valori, per esempio `ast tree`;
- `callables`: nomi di funzioni utilizzabili come valori e applicate con giustapposizione;
- `selectors`: firme complete, per esempio `fold:with:from:` o `node:is:`.

I nomi delle funzioni reali non vengono eseguiti durante la compilazione:
il manifest contiene solo simboli. Il sistema di compilazione, il bridge
del browser e la CLI usano lo stesso `mira.HostEnvironment` in Haxe.
Il manifest è una capability list: le API effettive restano nell'oggetto host.

## Nuove regole sintattiche sperimentali

- Una chiamata unaria può essere `log "ciao"`, `increment 5` o `log (double 21)`.
- Un'espressione autonoma può terminare con `;`, senza assegnazione.
- L'applicazione per giustapposizione precede gli operatori binari.
- I selettori keyword e le sezioni continuano a usare il resolver deterministico.
- I nomi host non registrati sono errori; non esiste fallback implicito a JS/PHP.

## Il primo dogfooding effettivo

Il codice in [studio/dogfood/inspector.mira](../studio/dogfood/inspector.mira)
calcola statistiche sull'AST prodotto da Haxe:

```mira
count: total, node: item = total + 1;
count matching: kind, total: total, node: item =
  total + (node: item, is: kind);
count kind: wanted = (count matching: wanted, total: _, node: _);
total nodes = fold: ast tree, with: (count: _, node: _), from: 0;
```

Il manifest [studio/dogfood/host.json](../studio/dogfood/host.json)
registra il valore `ast tree` e le funzioni host `fold:with:from:` e `node:is:`.
L'host fornisce i nodi e il meccanismo di traversamento; le funzioni di conteggio,
la selezione e l'accumulo sono scritti in Mira. JS renderizza l'albero
espandibile, ma non calcola le statistiche mostrate.

Modifica il reducer `total + 1` in `total + 2` nell'inspector e premi
**Ricalcola con Mira**: il totale dei nodi deve raddoppiare.
Questo comportamento è verificato automaticamente, anche su PHP.

## Prova locale

```sh
npm test
npm run test:studio
node dist/mira.cjs studio/dogfood/inspector.mira js --host studio/dogfood/host.json
node dist/mira.cjs studio/dogfood/inspector.mira php --host studio/dogfood/host.json
```

Mira Studio include un esempio «Interoperabilità: log» e il programma
dell'inspector modificabile in **Esplora**. Manifest, sorgenti e worker
sono nella cache della PWA. Il preview della PR è disponibile negli
artefatti del workflow «Mira Studio PWA».

## Limiti e questioni aperte

Non sono ancora disponibili un type checker delle API host, le liste e i
record generali o un sistema di moduli. Le chiamate possono fallire a runtime
se l'oggetto host non corrisponde al manifest. Il worker evita blocchi comuni
della UI, ma non isola in sicurezza codice di terze parti. Lo scope e il
lifetime delle capability richiederanno un disegno successivo.

La PR deve rimanere aperta per confrontare questo sistema con il precedente
prototipo `extern` e decidere se introdurre più avanti uno scope `use Host`.

## Secondo esperimento: un vero report strutturato

L'inspector non produce più soltanto conteggi scalari: il programma Mira
costruisce ora record per ogni definizione (nome, tipo, nodi e chiamate)
e una sequenza di riepiloghi. L'host fornisce `map:with:` e
`get:from:`, senza costruire esso stesso i report. Il browser renderizza
i dati ricevuti. Questo esperimento è documentato in
[Structured Data](structured-data.md).
