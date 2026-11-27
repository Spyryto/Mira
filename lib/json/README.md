# JSON tipizzato (0.84)

Dal root: npm run build:json genera dist/json-service/{decoder,host,bindings}.json
a partire dal contratto Mira non collegato e dalla mappa decoder.json.
Quest'ultima contiene soltanto nomi di modulo, selector, provider e capability,
non il tipo del risultato. La build Studio usa lo stesso generatore.

```sh
node dist/mira.cjs lib/json/App.mira js --module-root lib/common --checked --tree-shake --host dist/json-service/host.json --bindings dist/json-service/bindings.json
node dist/mira.cjs lib/json/App.mira php --module-root lib/common --checked --tree-shake --host dist/json-service/host.json --bindings dist/json-service/bindings.json
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

## 0.85: variante fallibile

try decode lesson: restituisce Result (record della lezione, Text), definito nel contratto.
Il decoder diretto rimane disponibile. Dopo build:json si può compilare
lib/json/Fallible.mira con gli stessi manifest generati (sostituire il
percorso App.mira negli esempi). Il provider converte il risultato strutturale
privato del decoder in Ok/Err con fold; niente eccezioni per input non valido.
Gli errori inattesi dell'host restano eccezioni. Nessun nuovo costrutto.

## 0.89.7: Result condiviso

Il Result locale di Services / Json viene sostituito con Data / Outcome / Result: identità nominale diversa (migrazione pre-1.0), medesimo valore tag/value e payload Text. Importare i tipi/costruttori da Data / Outcome. Entrambi i provider JSON usano decoded result: di Data / Decoder Outcome, funzione parametrica che converte il privato envelope zero/uno in Result con fold. È una convenzione di adapter fidati, non un validatore generico per envelope arbitrari; più elementi darebbero l'ultimo. Il generatore controlla ancora identità e payload, usa per default Result comune, mantiene resultType esplicito per vecchi contratti. Il CLI usa --module-root lib/common, ripetibile, senza copiare sorgenti. Nessun cambio alla struttura JSON, alla validazione wire o agli adapter. Estrazione del validatore puro, encoder, errori JSON più granulari e codec nominali restano aperti.
