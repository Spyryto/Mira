# Mira — riferimento generato

**Indice dei riferimenti**

- [Guida alle feature](language.md): feature implementate, spiegazione e collegamenti agli esempi e alle API.
- [Esempi](examples.md): programmi completi con risultati verificati su JS e PHP.
- [API Haxe](api.md): tutti i simboli pubblici estratti dalle sorgenti, firma e collegamento alla riga di codice.
- [Mira Studio](https://spyryto.github.io/Mira/#/guide): lettura e prova degli esempi anche offline.

I tre file Markdown sopra sono **generati**: non vanno modificati direttamente.
La sorgente canonica è `catalog/manifest.json`, con i programmi
`catalog/examples/*.mira` e le note API in `catalog/api-notes.json`.
Le firme e le posizioni dei simboli sono lette automaticamente da `src/**/*.hx`.

Per ricostruire i riferimenti: `npm run docs`.

Dopo il merge su `main`, la workflow `reference.yml` aggiorna i Markdown
quando i cataloghi o il sorgente Haxe cambiano. Se la scrittura tramite
GitHub Actions è bloccata dalle impostazioni del repository, i documenti
restano comunque generati e scaricabili come artefatto della CI.
