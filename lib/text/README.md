# Mira Text (0.83)

Contratto Services / Text, provider Providers / Text Native e due adapter host.
Import esplicito, binding statico; nessuna modifica al compilatore o al runtime generale.

Dal root del repository, dopo npm run build:

```sh
node dist/mira.cjs lib/text/App.mira js --checked --tree-shake --host lib/text/host.json --bindings lib/text/bindings.json
node dist/mira.cjs lib/text/App.mira php --checked --tree-shake --host lib/text/host.json --bindings lib/text/bindings.json
```

Per eseguire, registrare le capability prima di invocare il programma: in JS
caricare text-host.js e fornire globalThis.MiraTextHost come __miraHost;
in PHP assegnare a $GLOBALS["__miraHost"] la mappa restituita da require
'lib/text/text-host.php' prima di caricare il codice generato.
Per un altro progetto, rendere disponibili i due file .mira nei rispettivi
percorsi logici del resolver e combinare manifest/binding esplicitamente.
Non è un package manager.

| Selettore | Semantica |
| --- | --- |
| code points: | Numero di punti di codice Unicode |
| contains:in: | Sottostringa esatta |
| starts with:in: | Prefisso esatto |
| ends with:in: | Suffisso esatto |

Unicode scalare valido, ricerca case-sensitive senza normalizzazione; ago
vuoto sempre vero. Nessuna segmentazione in grafemi. I due adapter
rifiutano input non stringa e Unicode malformato. Queste sono verifiche
al confine host, non un invariante globale di Text. PHP richiede PHP 8
e PCRE standard, non mbstring. Il ritorno del conteggio è Number.
