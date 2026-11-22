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
