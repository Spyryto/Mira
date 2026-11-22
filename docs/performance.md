# Build and transpilation timings

Mira's CI collects **two distinct kinds of measurements**:

1. **Haxe build wall time**, measured by `scripts/build.mjs` while invoking
   `haxe build.hxml`. This includes starting the Haxe process but excludes
   npm startup, checkout and dependency installation.
2. **Mira frontend timings**, measured inside the already-running Node process
   by `Benchmark.hx`, from `Compiler.transpile(source, target)` entry to
   generation of JS/PHP output. Each configuration runs ten warmups followed
   by 100 timed iterations.

The measured transpiler path includes **lexing, parsing, selector resolution
and code emission**. It excludes reading input files, writing generated files,
starting Node, and building the compiler with Haxe.

## Workloads

- `small`: the checked-in `examples/arithmetic.mira` fixture
- `medium-100`: 100 dependent definitions generated deterministically from
  an arithmetic selector

Each workload is measured with both the **JavaScript** and **PHP** backends.
The script reports the median and 95th-percentile (p95) latency in milliseconds.

## Run locally

```sh
npm run build           # writes dist/build-metrics.json
node --test             # correctness tests
node scripts/benchmark.mjs
```

Or run `npm run benchmark` to build and benchmark in one command.

Raw results are written to `dist/benchmark-results.json`. GitHub Actions
also puts a Markdown table into the workflow run's **Job summary** and uploads
both JSON files as the `mira-timings` artifact. CI fails if compilation,
transpilation or the existing correctness tests fail.

## Interpreting the numbers

These timings are **observability metrics**, not strict performance budgets.
Hosted runners vary in CPU load and hardware. Before setting pass/fail
thresholds for regression detection, accumulate several comparable runs on
`main` and establish a stable baseline. Comparing median/p95 values for the
same fixture and runner is more useful than comparing a single cold CLI launch.

The small sample reflects fixed compiler overhead; the larger sample is more
useful for detecting superlinear growth as the resolver evolves.

## Esecuzione JS/PHP e righe di Mira al secondo

Da Mira 0.4 il benchmark della CI include anche:

- **Righe Mira compilate al secondo**: righe fisiche non vuote e non
  commentate divise per la mediana in secondi di `Compiler.transpile`.
  Non sono istruzioni macchina, token né righe del JavaScript/PHP
  generato: una riga di Mira può contenere espressioni complesse.
- **Esecuzione JavaScript**: tempo per chiamata di una funzione `run:`
  scritta in Mira e compilata in JS. Il codice JS viene inizializzato
  una sola volta, fuori dall'intervallo cronometrato.
- **Esecuzione PHP**: stesso programma Mira compilato in PHP e
  misurato con `hrtime(true)`, caricando le funzioni una sola volta.
  Non include avvio di PHP, lettura dei file o parsing della sorgente
  generata.

I tre carichi condivisi fra PWA e CI si trovano in
[`studio/benchmark-cases.js`](../studio/benchmark-cases.js): 5, 50
e 100 passi di funzione. Ogni programma contiene anche `run:` e
`result`. Prima di misurare si verifica che entrambi i backend
restituiscano lo stesso risultato.

Per l'esecuzione si usano 200 chiamate di warmup, poi 21 batch di
chiamate con **input variabili e checksum** del risultato, per evitare
che il JIT elimini calcoli apparentemente inutilizzati. Il numero di
chiamate per batch viene calibrato per ridurre il rumore del timer. Sono mostrati mediana, p95 e chiamate/secondo,
non una media di processi lanciati ripetutamente.

Il report `dist/benchmark-results.json` contiene sia `samples`
(compilazione) sia `runtime` (esecuzione) con target JS e PHP. La
workflow CI pubblica i risultati nel sommario della run.

### Benchmark direttamente nella PWA

La vista [Bench](https://spyryto.github.io/Mira/#/benchmark)
permette di lanciare un benchmark indipendente sul dispositivo:

- Mira→JS e Mira→PHP: 5 warmup, 25 misure, calcolate nel
  compilatore Haxe già caricato nel browser.
- Mira→JS runtime: 200 warmup e 21 batch di esecuzione in un
  Web Worker. Non si cronometrano creazione del worker o compilazione
  dinamica del JavaScript.
- Il pulsante **Schermo intero** usa un overlay CSS fissato al
  viewport e funziona anche in modalità PWA standalone su iOS.
  **Esc** oppure il pulsante di chiusura riportano alla vista normale.

**Limiti:** i carichi sono sintetici, non misurano DOM, network o
reazioni UI, e la velocità in righe/s cambia molto con la complessità
del sorgente. Le frequenze del processore, il JIT e la precisione del
timer influenzano il risultato: usare più misure e distinguere CI,
dispositivo e target. PHP non è eseguibile dal browser e non viene
spacciato per un benchmark locale della PWA.
