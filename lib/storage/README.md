# Storage testuale (Mira 0.87)

Services / Storage ha tre selector: read text:, save text:for:, remove text:.
read ritorna [] per chiave assente e [testo] per chiave presente;
scrittura e rimozione (anche di chiave assente) ritornano true al successo.
Errori: invalid_key, invalid_text, value_too_large, storage_failure.
Chiavi ASCII [a-z][a-z0-9_-]{0,63}, testo Unicode valido di massimo 64 KiB UTF-8.
Nessun accesso a percorsi scelti dal programma. Le chiamate sono effetti
sincroni: invocare esplicitamente, senza affidarsi a ordine tra dichiarazioni indipendenti.

Dal root, dopo npm run build:

```sh
node dist/mira.cjs lib/storage/App.mira js --checked --tree-shake --host lib/storage/host.json --bindings lib/storage/bindings-browser.json
node dist/mira.cjs lib/storage/App.mira php --checked --tree-shake --host lib/storage/host.json --bindings lib/storage/bindings-files.json
```

JS: caricare storage-host.js e passare MiraStorageHost.browser(storage, namespace)
come __miraHost, con Storage esplicito. PHP: require storage-host.php e
assegnare a $GLOBALS["__miraHost"] il risultato di Mira\Storage\files(directory).
La directory preesistente deve essere privata e fidata, fuori dalla root web;
una chiave corrisponde a un file .txt. Si scrive in un file temporaneo nella
stessa directory, poi rename (sostituzione atomica dove il filesystem la
supporta). Non fsync, non transazioni, non isolamento, non backup né sincronizzazione.
Il controllo symlink è difensivo ma non protegge da race con processi locali
ostili. Browser: spazio e durata dipendono da quota/policy dell'origine;
non è un archivio cifrato. Il namespace va scelto dall'host, non dall'utente.
