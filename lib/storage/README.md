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

## API fallibile 0.89.5

Services / Storage Safe aggiunge try read text: -> Result (Option (Text), Storage Error), try save text:for: e try remove text: -> Result (Boolean, Storage Error), true al successo. Data / Storage Outcome dichiara InvalidKey, InvalidText, ValueTooLarge, StorageFailure e storage error code:. Provider Browser/Files riusano gli adapter esistenti tramite envelope strutturale privato {values, error}; i costruttori nominali restano Mira. None significa soltanto chiave assente; Some("") è un valore. La configurazione iniziale non valida della directory resta un errore di setup; la perdita di accessibilità durante le operazioni è StorageFailure. Non si promette distinzione perfetta di errori stat/race su filesystem ostile. Nessuna migrazione dei dati, nessun cambiamento ai selettori legacy; nuove capability e binding sono espliciti. Costi non misurati.
