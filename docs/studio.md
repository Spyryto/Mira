# Mira Studio — PWA

**Mira Studio** is a portrait-first, single-column editor and compiler explorer.
It is intentionally lightweight: no application framework, no runtime CDN, and
no duplicated implementation of the Mira language.

The browser bundle is built from `src/mira/studio/Bridge.hx` using the **same
Haxe compiler code** as the Node CLI. It exposes a minimal boundary:

```javascript
MiraStudioCompiler.compile(source, "js" | "php");
MiraStudioCompiler.tokens(source);
MiraStudioCompiler.ast(source);
```

Each function returns `{ ok: true, output: string }` or
`{ ok: false, message: string }`; there are no thrown Haxe compiler errors
in UI event handlers. These methods can later serve other editors without
coupling parsing to the PWA.

## Guida interlinkata e API

La scheda **Guida** carica `reference.json`, prodotto da
`scripts/generate-reference.mjs` a partire da `catalog/manifest.json`,
`catalog/examples/*.mira` e da tutte le dichiarazioni pubbliche Haxe.

Ogni feature ha almeno due esempi reali, entrambi testati nei backend JS/PHP;
inoltre l'interfaccia offre ricerca, collegamenti feature → esempio → API,
collegamenti al codice sorgente e pulsanti per aprire gli esempi nell'editor.

Le sezioni con più `_` producono funzioni a più parametri: il worker può
invocare le funzioni generate usando gli argomenti predefiniti nel catalogo
perché Mira 0.3 non ha ancora una sintassi per l'applicazione generica n-aria.
La documentazione, incluso il riferimento API, è inclusa nella cache offline.

## Features in the first release

- **Scrivi**: keyboard-friendly editor with line numbers, position indicator,
  selector examples, import/export of local `.mira` files and automatic local
  persistence (browser localStorage).
- **Output**: compile to JavaScript or PHP, copy or download generated code.
- **Esplora**: inspect **real** source tokens with locations and canonical AST
  from the Haxe compiler.
- **Esegui**: explicitly run generated JavaScript in a dedicated Web Worker,
  with a 2-second timeout to prevent ordinary infinite loops from freezing the
  interface. PHP is **generated, not run** in the browser.
- **Offline installability**: relative GitHub Pages paths, manifest, service
  worker, offline asset cache and an update notification. Source drafts are
  retained locally before app refresh.

This is a frontend for **Mira 0.3**. It supports keyword-selector sections and left-to-right pipelines. It does not silently implement
arbitrary closure expressions, typed records, types, general currying, or HTML/MVU.

### Useful shortcuts

- `Ctrl/Cmd + Enter`: compile.
- `Ctrl/Cmd + Shift + Enter`: run JavaScript if JS is selected.
- `Tab`: insert two spaces in the source editor.

## Build and local preview

Prerequisites: Haxe 4.3.7, Node.js 22+ (and PHP 8+ for the PHP smoke test).

```sh
npm run build:studio
node --test test/studio.test.mjs

# Serve dist/studio; PWA service workers don't work from file://.
python3 -m http.server 8080 --directory dist/studio
```

Then open `http://localhost:8080` in a browser.

`npm run test:studio` performs the build and tests in one command.
`npm test` includes CLI and Studio tests. The static site is ready in
`dist/studio/` and can be hosted from any HTTPS static web server, not only
GitHub Pages.

## GitHub Pages

The workflow `.github/workflows/studio-pages.yml` builds Studio on pull
requests and `main`, publishes a downloadable preview artifact, and attempts
a GitHub Pages deployment after successful builds on `main`.

**One-time repository setup, if Pages has not already been activated:**

1. Open repository **Settings → Pages**.
2. Set **Build and deployment → Source → GitHub Actions**.
3. Trigger or rerun the **Mira Studio PWA** workflow on `main`.

Once the Pages deployment succeeds, the expected URL is:

https://spyryto.github.io/Mira/

Do **not** consider that URL live until GitHub reports a successful deployment.

## Caching and updates

The service worker caches the HTML, compiler, UI code, stylesheet, example
library, worker, manifest and icon for offline use. A changing commit-derived
cache name allows new builds to replace old assets.

When a new version is installed, Studio shows an **Aggiorna** control instead
of silently reloading and interrupting a user who is typing. Source content
is saved locally before a refresh. Browser localStorage is device-specific;
export `.mira` files for portable backups.

## Execution and security limitations

Generated JavaScript is executed only after pressing **Esegui**, in a Web
Worker. A Worker keeps ordinary loops off the main UI thread, but it **is not
a secure sandbox** for untrusted JavaScript and does not remove all possible
network or resource access. Do not paste or execute unknown third-party code.

The worker evaluates the JavaScript emitted by the currently limited Mira
compiler and reads its `result` binding. No PHP engine or server-side code
runs inside the PWA.

## Architecture

```text
                  Mira source
                       |
                Haxe compiler core
                       |
             +---------+---------+
             |                   |
       Node CLI main         Browser Bridge
             |                   |
        JS/PHP files        JS/PHP + AST + tokens
                                 |
                         Static Studio UI
                        (no language parser)
                                 |
                      optional JS Worker run
```

The UI can evolve independently of Mira's semantics. Future work might add
structured diagnostics with source spans, native editor syntax highlighting,
or source/AST cross-references, but these are not part of this first release.

## Interoperabilità UI

Dalla Guida scegli **Alert dall'host**, **View e pulsante** o
**Pulsante con contatore**. Premi **Esegui** o **Anteprima UI** con
JavaScript selezionato. L'anteprima compare nella scheda Output;
il pulsante aggiorna lo stato facendo eseguire funzioni Mira, non
implementazioni nascoste in JavaScript.

Le API `alert` e `render` sono funzioni dell'Host Environment.
Le view sono record di tipo `column`, `title`, `text`, `button`
e `state`. L'iframe è isolato tramite `sandbox="allow-scripts"`
senza `allow-same-origin`. Le view non possono essere eseguite
direttamente su PHP, anche se il sorgente Mira traspila in PHP.

[Descrizione dell'esperimento e sorgenti](browser-interop.md).
