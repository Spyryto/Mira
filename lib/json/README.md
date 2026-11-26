# JSON tipizzato (0.84)

Dal root: npm run build:json genera dist/json-service/{decoder,host,bindings}.json
a partire dal contratto Mira non collegato e dalla mappa decoder.json.
Quest'ultima contiene soltanto nomi di modulo, selector, provider e capability,
non il tipo del risultato. La build Studio usa lo stesso generatore.

```sh
node dist/mira.cjs lib/json/App.mira js --checked --tree-shake --host dist/json-service/host.json --bindings dist/json-service/bindings.json
node dist/mira.cjs lib/json/App.mira php --checked --tree-shake --host dist/json-service/host.json --bindings dist/json-service/bindings.json
```

JS: caricare studio/effects.js e json-host.js; passare
MiraJsonDecoder.host(binding) come __miraHost, dove binding è il contenuto
JSON di decoder.json generato in dist/json-service. PHP: require json-host.php
e assegnare a $GLOBALS["__miraHost"] il risultato di Mira\Json\host(binding)
con lo stesso file decodificato in array associativo. L'adapter PHP riusa
runtime/php/Rpc.php, mantenere il percorso relativo o adattare il require.

Schema chiuso, dati concreti, niente coercizione. 16 KiB, profondità schema
30, Unicode valido, numeri finiti e interi sicuri. Errori invalid_json_data.
Niente Result, null tipizzato, nominali o refinement in questa versione;
chiavi duplicate seguono la politica nativa last-key-wins. Il tipo è derivato
dal contratto, non dal JSON ricevuto. Il contratto può cambiare a build time;
non è possibile richiedere uno schema arbitrario a runtime.
